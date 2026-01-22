import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

const DISCORD_API_URL = 'https://discord.com/api/v10';

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

    // 참여자들에게 출석체크 DM 발송
    await sendAttendanceDMs(supabase, groupPowId, groupPow.title);

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

// 참여자들에게 출석체크 DM 발송
async function sendAttendanceDMs(
  supabase: SupabaseClient,
  groupPowId: string,
  groupPowTitle: string
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('DISCORD_BOT_TOKEN not configured');
    return;
  }

  try {
    // 참여자 목록 조회 (users 테이블 join)
    const { data: participants, error } = await supabase
      .from('group_pow_participants')
      .select(`
        *,
        users!inner(discord_id, discord_username)
      `)
      .eq('group_pow_id', groupPowId);

    if (error || !participants) {
      console.error('Failed to fetch participants:', error);
      return;
    }

    // 각 참여자에게 DM 발송
    for (const participant of participants) {
      const discordId = (participant.users as any)?.discord_id;
      if (!discordId) continue;

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
  } catch (error) {
    console.error('sendAttendanceDMs error:', error);
  }
}
