import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const DISCORD_API_URL = 'https://discord.com/api/v10';

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
        { error: 'Only the creator can start this group POW' },
        { status: 403 }
      );
    }

    // 상태 확인
    if (groupPow.status !== 'upcoming') {
      return NextResponse.json(
        { error: 'Group POW is not in upcoming status' },
        { status: 400 }
      );
    }

    // 시작 가능 시간 확인 (예정 시간 ±15분)
    const plannedDate = new Date(groupPow.planned_date);
    const now = new Date();
    const timeDiff = now.getTime() - plannedDate.getTime();
    const fifteenMinutes = 15 * 60 * 1000; // 15분 in milliseconds

    if (timeDiff < -fifteenMinutes) {
      const minutesUntilStart = Math.ceil((-timeDiff - fifteenMinutes) / 60000);
      return NextResponse.json(
        {
          error: `아직 시작할 수 없습니다. ${minutesUntilStart}분 후에 시작 가능합니다.`,
          canStartAt: new Date(plannedDate.getTime() - fifteenMinutes).toISOString(),
        },
        { status: 400 }
      );
    }

    if (timeDiff > fifteenMinutes) {
      return NextResponse.json(
        { error: '시작 가능 시간이 지났습니다. (예정 시간 +15분 초과)' },
        { status: 400 }
      );
    }

    // 그룹 POW 시작
    const { error: updateError } = await supabase
      .from('group_pows')
      .update({
        status: 'ongoing',
        started_at: now.toISOString(),
      })
      .eq('id', groupPowId);

    if (updateError) {
      console.error('Group POW start error:', updateError);
      return NextResponse.json(
        { error: 'Failed to start group POW' },
        { status: 500 }
      );
    }

    // 참여자들에게 출석체크 알림 발송 (푸시 + Discord DM)
    await sendAttendanceNotifications(supabase, groupPowId, groupPow.title);

    return NextResponse.json({
      success: true,
      message: 'Group POW started successfully',
      startedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Group POW start error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 참여자들에게 출석체크 알림 발송 (푸시 + Discord DM)
async function sendAttendanceNotifications(
  supabase: SupabaseClient,
  groupPowId: string,
  groupPowTitle: string
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;

  try {
    // 참여자 목록 조회 (users 테이블 join)
    const { data: participants, error } = await supabase
      .from('group_pow_participants')
      .select(`
        *,
        users!inner(id, discord_id, discord_username)
      `)
      .eq('group_pow_id', groupPowId);

    if (error || !participants) {
      console.error('Failed to fetch participants:', error);
      return;
    }

    // 각 참여자에게 알림 발송
    for (const participant of participants) {
      const userId = (participant.users as any)?.id;
      const discordId = (participant.users as any)?.discord_id;

      // 1. 푸시 알림 발송
      if (userId && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        try {
          const { data: subscriptions } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

          if (subscriptions && subscriptions.length > 0) {
            const payload = {
              title: '📣 그룹 POW 시작!',
              body: `${groupPowTitle} - 출석체크를 완료해주세요!`,
              tag: 'group-pow-attendance',
              requireInteraction: true,
              data: {
                url: '/group-pow',
                groupPowId,
              },
            };

            for (const sub of subscriptions) {
              try {
                await webpush.sendNotification(
                  { endpoint: sub.endpoint, keys: sub.keys },
                  JSON.stringify(payload)
                );
              } catch (pushError: any) {
                // 410/404 - 구독 만료
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                  await supabase
                    .from('push_subscriptions')
                    .delete()
                    .eq('id', sub.id);
                }
              }
            }
          }
        } catch (pushError) {
          console.error(`Push notification error for ${userId}:`, pushError);
        }
      }

      // 2. Discord DM 발송
      if (discordId && botToken) {
        try {
          // DM 채널 생성
          const dmChannelRes = await fetch(`${DISCORD_API_URL}/users/@me/channels`, {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              recipient_id: discordId,
            }),
          });

          if (!dmChannelRes.ok) {
            console.error(`Failed to create DM channel for ${discordId}:`, await dmChannelRes.text());
            continue;
          }

          const dmChannel = await dmChannelRes.json();

          // 출석체크 메시지 발송
          const message = {
            embeds: [{
              title: '📣 그룹 POW 시작!',
              description: `**${groupPowTitle}** 그룹 POW가 시작되었습니다!\n\n출석체크를 완료해주세요.`,
              color: 0xFF6B35,
              footer: {
                text: '앱에서 출석체크를 진행해주세요.',
              },
              timestamp: new Date().toISOString(),
            }],
          };

          const msgRes = await fetch(`${DISCORD_API_URL}/channels/${dmChannel.id}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bot ${botToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
          });

          if (!msgRes.ok) {
            console.error(`Failed to send DM to ${discordId}:`, await msgRes.text());
          }
        } catch (dmError) {
          console.error(`Error sending DM to ${discordId}:`, dmError);
        }
      }
    }
  } catch (error) {
    console.error('sendAttendanceNotifications error:', error);
  }
}
