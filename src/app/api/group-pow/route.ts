import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const title = formData.get('title') as string;
    const field = formData.get('field') as string;
    const description = formData.get('description') as string;
    const plannedDate = formData.get('plannedDate') as string;
    const location = formData.get('location') as string;
    const plannedDuration = parseInt(formData.get('plannedDuration') as string);
    const targetSats = parseInt(formData.get('targetSats') as string);
    const creatorId = formData.get('creatorId') as string;
    const creatorPledgedSats = parseInt(formData.get('creatorPledgedSats') as string);
    const thumbnail = formData.get('thumbnail') as Blob | null;

    if (!title || !field || !plannedDate || !plannedDuration || !targetSats || !creatorId || !creatorPledgedSats) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Get current user (creator)
    // In production, this would come from the session
    // For now, we'll need to pass the user ID from the client

    // Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnail) {
      const fileName = `group-pow-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('group-pow-thumbnails')
        .upload(fileName, thumbnail, {
          contentType: 'image/jpeg',
        });

      if (!uploadError) {
        const { data: publicUrl } = supabase.storage
          .from('group-pow-thumbnails')
          .getPublicUrl(fileName);
        thumbnailUrl = publicUrl.publicUrl;
      }
    }

    // Create group POW
    const { data: groupPow, error } = await supabase
      .from('group_pows')
      .insert({
        creator_id: creatorId,
        title,
        field,
        description: description || null,
        location: location || null,
        thumbnail_url: thumbnailUrl,
        planned_date: new Date(plannedDate).toISOString(),
        planned_duration: plannedDuration,
        target_sats: targetSats,
        actual_sats_collected: creatorPledgedSats,
        status: 'upcoming',
      })
      .select()
      .single();

    if (error) {
      console.error('Group POW creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create group POW' },
        { status: 500 }
      );
    }

    // 개최자를 첫 번째 참여자로 등록
    const { error: participantError } = await supabase
      .from('group_pow_participants')
      .insert({
        group_pow_id: groupPow.id,
        user_id: creatorId,
        pledged_sats: creatorPledgedSats,
      });

    if (participantError) {
      console.error('Creator participant registration error:', participantError);
    }

    // Send announcement to Discord
    await sendGroupPowAnnouncement(groupPow);

    return NextResponse.json({
      success: true,
      groupPow,
    });
  } catch (error) {
    console.error('Group POW creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendGroupPowAnnouncement(groupPow: any) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_GROUP_POW_CHANNEL_ID;

  if (!botToken || !channelId) return;

  const { POW_FIELDS } = await import('@/constants');
  const { formatDateTimeKorean, formatTime, formatNumber } = await import('@/lib/utils');

  const fieldInfo = POW_FIELDS[groupPow.field as keyof typeof POW_FIELDS];

  const fields = [
    {
      name: '📅 일시',
      value: formatDateTimeKorean(groupPow.planned_date),
      inline: true,
    },
    {
      name: '⏱️ 예정 시간',
      value: formatTime(groupPow.planned_duration),
      inline: true,
    },
    {
      name: '🎯 목표 모금',
      value: `${formatNumber(groupPow.target_sats)} sats`,
      inline: true,
    },
  ];

  // 장소가 있으면 추가
  if (groupPow.location) {
    fields.push({
      name: '📍 장소',
      value: groupPow.location,
      inline: true,
    });
  }

  const message = {
    embeds: [
      {
        title: `${fieldInfo.emoji} 새로운 그룹 POW 개최!`,
        description: groupPow.title,
        color: 0xFF6B35,
        fields,
        thumbnail: groupPow.thumbnail_url ? { url: groupPow.thumbnail_url } : undefined,
        footer: {
          text: '앱에서 참여하세요!',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bot ${botToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(message),
  });
}
