import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    // 새로운 형식: certificationCard + mediaFiles
    // 이전 형식과 호환: image
    const certificationCard = formData.get('certificationCard') as Blob | null;
    const legacyImage = formData.get('image') as Blob | null;
    const imageFile = certificationCard || legacyImage;
    const mediaFiles = formData.getAll('mediaFiles') as File[];
    const powDataString = formData.get('powData') as string;

    if (!powDataString) {
      return NextResponse.json(
        { error: 'POW data required' },
        { status: 400 }
      );
    }

    const powData = JSON.parse(powDataString);
    const supabase = createServiceRoleClient();

    // Upload certification card to Supabase Storage
    let imageUrl = null;
    if (imageFile) {
      const fileName = `pow-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('pow-images')
        .upload(fileName, imageFile, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        console.error('Image upload error:', uploadError);
      } else {
        const { data: publicUrl } = supabase.storage
          .from('pow-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl.publicUrl;
      }
    }

    // Determine status based on mode
    const status = powData.mode === 'immediate'
      ? (powData.status === 'donated_immediate' ? 'donated_immediate' : 'completed')
      : 'accumulated';

    // Save POW record
    const { data: powRecord, error: powError } = await supabase
      .from('pow_records')
      .insert({
        user_id: powData.user_id,
        field: powData.field,
        goal_content: powData.goal_content,
        goal_time: powData.goal_time,
        actual_time: powData.actual_time,
        achievement_rate: powData.achievement_rate,
        target_sats: powData.target_sats,
        actual_sats: powData.actual_sats,
        mode: powData.mode,
        status,
        group_pow_id: powData.group_pow_id || null,
        memo: powData.memo || null,
        image_url: imageUrl,
        started_at: powData.started_at,
        total_paused_time: powData.total_paused_time || 0,
        completed_at: new Date().toISOString(),
        donated_at: status === 'donated_immediate' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (powError) {
      console.error('POW record error:', powError);
      return NextResponse.json(
        { error: 'Failed to save POW record' },
        { status: 500 }
      );
    }

    // Update user stats
    if (status === 'accumulated') {
      await supabase.rpc('increment_accumulated_sats', {
        user_id_param: powData.user_id,
        amount: powData.actual_sats,
      });
    } else if (status === 'donated_immediate') {
      await supabase.rpc('increment_donated_sats', {
        user_id_param: powData.user_id,
        amount: powData.actual_sats,
      });
    }

    // Update total POW time
    await supabase.rpc('increment_pow_time', {
      user_id_param: powData.user_id,
      time_seconds: powData.actual_time,
    });

    // Record field donation
    await supabase.from('field_donations').insert({
      user_id: powData.user_id,
      pow_record_id: powRecord.id,
      field: powData.field,
      donated_sats: powData.actual_sats,
      mode: powData.mode,
    });

    // Send to Discord
    console.log('Image URL for Discord:', imageUrl);
    console.log('Media files count:', mediaFiles.length);
    if (imageFile) {
      try {
        console.log('Sending to Discord...');
        await sendToDiscord(powRecord, powData, imageFile, mediaFiles);
        console.log('Discord send success!');
      } catch (discordError) {
        console.error('Discord send error:', discordError);
      }
    } else {
      console.log('No image, skipping Discord share');
    }

    return NextResponse.json({
      success: true,
      powRecord,
    });
  } catch (error) {
    console.error('POW complete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendToDiscord(
  powRecord: any,
  powData: any,
  certificationCard: Blob,
  mediaFiles: File[]
): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_POW_CHANNEL_ID;

  if (!botToken || !channelId) return null;

  const { POW_FIELDS } = await import('@/constants');
  const { formatTime, formatNumber } = await import('@/lib/utils');
  const { createServiceRoleClient } = await import('@/lib/supabase/server');

  const supabase = createServiceRoleClient();
  const { data: userData } = await supabase
    .from('users')
    .select('discord_id, discord_username')
    .eq('id', powData.user_id)
    .single();

  const fieldInfo = POW_FIELDS[powRecord.field as keyof typeof POW_FIELDS];
  const statusText = powRecord.status === 'accumulated' ? '적립' : '기부';

  const userMention = userData?.discord_id ? `<@${userData.discord_id}>` : userData?.discord_username || '사용자';
  const contentText = `${userMention}님이 **${fieldInfo.labelKo}** POW를 완료했습니다!`;
  const memoText = powData.memo ? `\n\n💬 **한마디**: "${powData.memo}"` : '';

  console.log('Discord bot token exists:', !!botToken);
  console.log('Discord channel ID:', channelId);

  // 미디어 파일이 있으면 multipart/form-data로 전송
  if (mediaFiles.length > 0) {
    // Build attachments list
    const attachments = [
      { id: 0, filename: 'certification.jpg', description: '인증카드' },
    ];

    mediaFiles.forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const ext = isVideo ? 'mp4' : 'jpg';
      attachments.push({
        id: index + 1,
        filename: `media-${index + 1}.${ext}`,
        description: `미디어 ${index + 1}`,
      });
    });

    const payload = {
      content: contentText + memoText,
      embeds: [
        {
          title: `${fieldInfo.emoji} ${fieldInfo.labelKo} POW`,
          description: `**${powRecord.goal_content}**\n\n🎯 \`${formatTime(powRecord.goal_time)}\` → ✅ \`${formatTime(powRecord.actual_time)}\` (${powRecord.achievement_rate}%) | 💰 ${formatNumber(powRecord.actual_sats)} sats ${statusText}`,
          color: 0xFF6B35,
          image: { url: 'attachment://certification.jpg' },
          timestamp: new Date().toISOString(),
        },
      ],
      attachments,
    };

    const discordFormData = new FormData();
    discordFormData.append('payload_json', JSON.stringify(payload));
    discordFormData.append('files[0]', certificationCard, 'certification.jpg');

    mediaFiles.forEach((file, index) => {
      const isVideo = file.type.startsWith('video/');
      const ext = isVideo ? 'mp4' : 'jpg';
      discordFormData.append(`files[${index + 1}]`, file, `media-${index + 1}.${ext}`);
    });

    console.log('Sending multipart with', mediaFiles.length + 1, 'files');

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
      body: discordFormData,
    });

    const responseText = await response.text();
    console.log('Discord API response:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${responseText}`);
    }

    return await saveMessageId(supabase, powRecord.id, responseText);
  } else {
    // 미디어 파일 없으면 인증카드만 multipart로 전송
    const payload = {
      content: contentText + memoText,
      embeds: [
        {
          title: `${fieldInfo.emoji} ${fieldInfo.labelKo} POW`,
          description: `**${powRecord.goal_content}**\n\n🎯 \`${formatTime(powRecord.goal_time)}\` → ✅ \`${formatTime(powRecord.actual_time)}\` (${powRecord.achievement_rate}%) | 💰 ${formatNumber(powRecord.actual_sats)} sats ${statusText}`,
          color: 0xFF6B35,
          image: { url: 'attachment://certification.jpg' },
          timestamp: new Date().toISOString(),
        },
      ],
      attachments: [{ id: 0, filename: 'certification.jpg', description: '인증카드' }],
    };

    const discordFormData = new FormData();
    discordFormData.append('payload_json', JSON.stringify(payload));
    discordFormData.append('files[0]', certificationCard, 'certification.jpg');

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
      body: discordFormData,
    });

    const responseText = await response.text();
    console.log('Discord API response:', response.status, responseText.substring(0, 500));

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status} ${responseText}`);
    }

    return await saveMessageId(supabase, powRecord.id, responseText);
  }
}

async function saveMessageId(supabase: any, powRecordId: string, responseText: string): Promise<string | null> {
  try {
    const responseData = JSON.parse(responseText);
    const messageId = responseData.id;

    if (messageId) {
      await supabase
        .from('pow_records')
        .update({ discord_message_id: messageId })
        .eq('id', powRecordId);

      await supabase
        .from('discord_reactions')
        .insert({
          pow_record_id: powRecordId,
          discord_message_id: messageId,
          total_reactions: 0,
          reaction_details: {},
        });

      console.log('Saved Discord message ID:', messageId);
      return messageId;
    }
  } catch (e) {
    console.error('Failed to parse Discord response:', e);
  }

  return null;
}
