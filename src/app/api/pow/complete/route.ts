import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const imageFile = formData.get('image') as Blob | null;
    const powDataString = formData.get('powData') as string;

    if (!powDataString) {
      return NextResponse.json(
        { error: 'POW data required' },
        { status: 400 }
      );
    }

    const powData = JSON.parse(powDataString);
    const supabase = createServiceRoleClient();

    // Upload image to Supabase Storage (if provided)
    let imageUrl = null;
    if (imageFile) {
      const fileName = `pow-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
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
      // Add to accumulated sats
      await supabase.rpc('increment_accumulated_sats', {
        user_id_param: powData.user_id,
        amount: powData.actual_sats,
      });
    } else if (status === 'donated_immediate') {
      // Add to total donated sats
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

    // Send to Discord (if image exists)
    console.log('Image URL for Discord:', imageUrl);
    if (imageUrl) {
      try {
        console.log('Sending to Discord...');
        await sendToDiscord(powRecord, powData, imageUrl);
        console.log('Discord send success!');
      } catch (discordError) {
        console.error('Discord send error:', discordError);
        // Don't fail the request if Discord fails
      }
    } else {
      console.log('No image URL, skipping Discord share');
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

async function sendToDiscord(powRecord: any, powData: any, imageUrl: string): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_POW_CHANNEL_ID;

  if (!botToken || !channelId) return null;

  const { POW_FIELDS } = await import('@/constants');
  const { formatTime, formatNumber } = await import('@/lib/utils');
  const { createServiceRoleClient } = await import('@/lib/supabase/server');

  // Get user info for Discord mention
  const supabase = createServiceRoleClient();
  const { data: userData } = await supabase
    .from('users')
    .select('discord_id, discord_username')
    .eq('id', powData.user_id)
    .single();

  const fieldInfo = POW_FIELDS[powRecord.field as keyof typeof POW_FIELDS];
  const statusText = powRecord.status === 'accumulated' ? '적립' : '기부';

  // Build content with user mention
  const userMention = userData?.discord_id ? `<@${userData.discord_id}>` : userData?.discord_username || '사용자';
  const contentText = `${userMention}님이 **${fieldInfo.labelKo}** POW를 완료했습니다!`;

  // Add memo if exists
  const memoText = powData.memo ? `\n\n💬 **한마디**: "${powData.memo}"` : '';

  const message = {
    content: contentText + memoText,
    embeds: [
      {
        title: `${fieldInfo.emoji} ${fieldInfo.labelKo} POW`,
        description: `**${powRecord.goal_content}**\n\n🎯 \`${formatTime(powRecord.goal_time)}\` → ✅ \`${formatTime(powRecord.actual_time)}\` (${powRecord.achievement_rate}%) | 💰 ${formatNumber(powRecord.actual_sats)} sats ${statusText}`,
        color: 0xFF6B35,
        image: {
          url: imageUrl,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  console.log('Discord bot token exists:', !!botToken);
  console.log('Discord channel ID:', channelId);

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });

  const responseText = await response.text();
  console.log('Discord API response:', response.status, responseText);

  if (!response.ok) {
    throw new Error(`Discord API error: ${response.status} ${responseText}`);
  }

  // Parse response to get message ID
  try {
    const responseData = JSON.parse(responseText);
    const messageId = responseData.id;

    if (messageId) {
      // Update POW record with Discord message ID
      await supabase
        .from('pow_records')
        .update({ discord_message_id: messageId })
        .eq('id', powRecord.id);

      // Create initial discord_reactions record for leaderboard tracking
      await supabase
        .from('discord_reactions')
        .insert({
          pow_record_id: powRecord.id,
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
