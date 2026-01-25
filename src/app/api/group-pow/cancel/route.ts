import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import webpush from 'web-push';

// VAPID 설정
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = 'mailto:pow-citadel@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function POST(request: NextRequest) {
  try {
    const { groupPowId, userId } = await request.json();

    if (!groupPowId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // 그룹 POW 조회
    const { data: groupPow, error: fetchError } = await supabase
      .from('group_pows')
      .select('*')
      .eq('id', groupPowId)
      .single();

    if (fetchError || !groupPow) {
      return NextResponse.json(
        { error: 'Group POW not found' },
        { status: 404 }
      );
    }

    // 개최자 확인
    if (groupPow.creator_id !== userId) {
      return NextResponse.json(
        { error: 'Only the creator can cancel this group POW' },
        { status: 403 }
      );
    }

    // 이미 진행 중이거나 완료된 경우 취소 불가
    if (groupPow.status === 'ongoing') {
      return NextResponse.json(
        { error: 'Cannot cancel an ongoing group POW' },
        { status: 400 }
      );
    }

    if (groupPow.status === 'completed' || groupPow.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Group POW is already finished' },
        { status: 400 }
      );
    }

    // 그룹 POW 취소
    const { error: updateError } = await supabase
      .from('group_pows')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', groupPowId);

    if (updateError) {
      console.error('Group POW cancel error:', updateError);
      return NextResponse.json(
        { error: 'Failed to cancel group POW' },
        { status: 500 }
      );
    }

    // 디스코드 채널에 취소 알림
    await sendCancelAnnouncement(groupPow);

    // 참석자들에게 푸시 알림
    await sendCancelPushNotifications(supabase, groupPowId, groupPow.title);

    return NextResponse.json({
      success: true,
      message: 'Group POW cancelled successfully',
    });
  } catch (error) {
    console.error('Group POW cancel error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 디스코드 채널에 취소 알림
async function sendCancelAnnouncement(groupPow: any) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_GROUP_POW_CHANNEL_ID;

  if (!botToken || !channelId) return;

  const { POW_FIELDS } = await import('@/constants');
  const { formatDateTimeKorean } = await import('@/lib/utils');

  const fieldInfo = POW_FIELDS[groupPow.field as keyof typeof POW_FIELDS];

  const message = {
    embeds: [
      {
        title: `❌ 그룹 POW 취소`,
        description: `**${groupPow.title}**\n\n예정되었던 그룹 POW가 취소되었습니다.`,
        color: 0xEF4444, // red
        fields: [
          {
            name: '📅 원래 예정일',
            value: formatDateTimeKorean(groupPow.planned_date),
            inline: true,
          },
          {
            name: '분야',
            value: `${fieldInfo.emoji} ${fieldInfo.labelKo}`,
            inline: true,
          },
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error('Failed to send cancel announcement:', error);
  }
}

// 참석자들에게 푸시 알림
async function sendCancelPushNotifications(
  supabase: any,
  groupPowId: string,
  groupPowTitle: string
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

  try {
    // 참석자 목록 조회
    const { data: participants } = await supabase
      .from('group_pow_participants')
      .select('user_id')
      .eq('group_pow_id', groupPowId);

    if (!participants || participants.length === 0) return;

    const payload = {
      title: '❌ 그룹 POW 취소',
      body: `${groupPowTitle} 그룹 POW가 취소되었습니다.`,
      tag: 'group-pow-cancelled',
      data: { url: '/group-pow' },
    };

    for (const participant of participants) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', participant.user_id);

      if (!subscriptions) continue;

      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(payload)
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to send cancel push notifications:', error);
  }
}
