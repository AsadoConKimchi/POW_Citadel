import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { APP_CONFIG } from '@/constants';

const DISCORD_API_URL = 'https://discord.com/api/v10';
const BLINK_API_URL = APP_CONFIG.BLINK_API_URL;

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
        { error: 'Only the creator can end this group POW' },
        { status: 403 }
      );
    }

    // 상태 확인
    if (groupPow.status !== 'ongoing') {
      return NextResponse.json(
        { error: 'Group POW is not in ongoing status' },
        { status: 400 }
      );
    }

    // 시작 시간 확인
    if (!groupPow.started_at) {
      return NextResponse.json(
        { error: 'Group POW has no start time' },
        { status: 400 }
      );
    }

    const now = new Date();
    const startedAt = new Date(groupPow.started_at);

    // 실제 진행 시간 계산 (초 단위)
    const actualDuration = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

    // 달성률 계산 (개인 POW와 동일: actual / planned × 100, 최대 100%)
    const achievementRate = Math.min(
      100,
      Math.round((actualDuration / groupPow.planned_duration) * 1000) / 10 // 소수점 1자리
    );

    // 그룹 POW 종료
    const { error: updateError } = await supabase
      .from('group_pows')
      .update({
        status: 'completed',
        ended_at: now.toISOString(),
        actual_duration: actualDuration,
        achievement_rate: achievementRate,
      })
      .eq('id', groupPowId);

    if (updateError) {
      console.error('Group POW end error:', updateError);
      return NextResponse.json(
        { error: 'Failed to end group POW' },
        { status: 500 }
      );
    }

    // 참여자별 actual_sats 계산 및 업데이트 (users 정보도 함께 조회)
    const { data: participants, error: participantsError } = await supabase
      .from('group_pow_participants')
      .select(`
        *,
        users!inner(discord_id, discord_username)
      `)
      .eq('group_pow_id', groupPowId);

    if (!participantsError && participants) {
      for (const participant of participants) {
        // actual_sats = pledged_sats × (achievement_rate / 100)
        const actualSats = Math.round(participant.pledged_sats * (achievementRate / 100));

        await supabase
          .from('group_pow_participants')
          .update({ actual_sats: actualSats })
          .eq('id', participant.id);
      }
    }

    // 실제 모금액 재계산
    const totalActualSats = participants?.reduce((sum, p) => {
      const actualSats = Math.round(p.pledged_sats * (achievementRate / 100));
      return sum + actualSats;
    }, 0) || 0;

    await supabase
      .from('group_pows')
      .update({ actual_sats_collected: totalActualSats })
      .eq('id', groupPowId);

    // 참여자들에게 인보이스 DM 발송
    await sendInvoiceDMs(supabase, groupPowId, groupPow.title, achievementRate, participants || []);

    return NextResponse.json({
      success: true,
      message: 'Group POW ended successfully',
      endedAt: now.toISOString(),
      actualDuration,
      achievementRate,
      totalActualSats,
    });
  } catch (error) {
    console.error('Group POW end error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Blink API로 인보이스 생성
async function createBlinkInvoice(amount: number, memo: string): Promise<string | null> {
  const apiKey = process.env.BLINK_API_KEY;
  const walletId = process.env.BLINK_WALLET_ID;

  if (!apiKey || !walletId) {
    console.error('Blink API not configured');
    return null;
  }

  try {
    const query = `
      mutation LnInvoiceCreateOnBehalfOfRecipient($input: LnInvoiceCreateOnBehalfOfRecipientInput!) {
        lnInvoiceCreateOnBehalfOfRecipient(input: $input) {
          invoice {
            paymentRequest
            paymentHash
          }
          errors {
            message
          }
        }
      }
    `;

    const response = await fetch(BLINK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        query,
        variables: {
          input: {
            walletId,
            amount,
            memo,
          },
        },
      }),
    });

    const data = await response.json();

    if (data.errors || data.data?.lnInvoiceCreateOnBehalfOfRecipient?.errors?.length > 0) {
      console.error('Blink API error:', data.errors || data.data?.lnInvoiceCreateOnBehalfOfRecipient?.errors);
      return null;
    }

    return data.data?.lnInvoiceCreateOnBehalfOfRecipient?.invoice?.paymentRequest || null;
  } catch (error) {
    console.error('createBlinkInvoice error:', error);
    return null;
  }
}

// 참여자들에게 인보이스 DM 발송
async function sendInvoiceDMs(
  supabase: SupabaseClient,
  groupPowId: string,
  groupPowTitle: string,
  achievementRate: number,
  participants: any[]
) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('DISCORD_BOT_TOKEN not configured');
    return;
  }

  const { formatNumber } = await import('@/lib/utils');

  for (const participant of participants) {
    const discordId = (participant.users as any)?.discord_id;
    const actualSats = Math.round(participant.pledged_sats * (achievementRate / 100));

    if (!discordId || actualSats <= 0) continue;

    try {
      // 인보이스 생성
      const memo = `${groupPowTitle} 그룹 POW 기부`;
      const invoice = await createBlinkInvoice(actualSats, memo);

      if (!invoice) {
        console.error(`Failed to create invoice for ${discordId}`);
        continue;
      }

      // 인보이스 ID 저장
      await supabase
        .from('group_pow_participants')
        .update({ invoice_id: invoice })
        .eq('id', participant.id);

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

      // 인보이스 메시지 발송
      const message = {
        embeds: [{
          title: '✅ 그룹 POW 완료!',
          description: `**${groupPowTitle}** 활동을 완료했습니다!\n\n💰 **${formatNumber(actualSats)} sats**를 기부해주세요!`,
          color: 0xFF6B35,
          fields: [
            {
              name: '달성률',
              value: `${achievementRate}%`,
              inline: true,
            },
            {
              name: '기부 금액',
              value: `${formatNumber(actualSats)} sats`,
              inline: true,
            },
          ],
          footer: {
            text: '아래 인보이스로 결제해주세요.',
          },
          timestamp: new Date().toISOString(),
        }],
      };

      await fetch(`${DISCORD_API_URL}/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      // 인보이스 별도 메시지로 발송 (복사하기 쉽게)
      await fetch(`${DISCORD_API_URL}/channels/${dmChannel.id}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: `\`\`\`\n${invoice}\n\`\`\``,
        }),
      });

    } catch (dmError) {
      console.error(`Error sending invoice DM to ${discordId}:`, dmError);
    }
  }
}
