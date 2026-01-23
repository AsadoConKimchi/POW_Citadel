import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { mode, powRecordId, amount, userId } = await request.json();

    if (!mode || !amount || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    if (mode === 'immediate' && powRecordId) {
      // Update POW record status
      await supabase
        .from('pow_records')
        .update({
          status: 'donated_immediate',
          donated_at: new Date().toISOString(),
        })
        .eq('id', powRecordId);

      // Update user's total donated sats
      const { data: user } = await supabase
        .from('users')
        .select('total_donated_sats')
        .eq('id', userId)
        .single();

      if (user) {
        await supabase
          .from('users')
          .update({
            total_donated_sats: user.total_donated_sats + amount,
          })
          .eq('id', userId);
      }
    } else if (mode === 'accumulated') {
      // Get user's accumulated sats
      const { data: user } = await supabase
        .from('users')
        .select('accumulated_sats, total_donated_sats')
        .eq('id', userId)
        .single();

      if (!user || user.accumulated_sats < amount) {
        return NextResponse.json(
          { error: 'Insufficient accumulated sats' },
          { status: 400 }
        );
      }

      // Update all accumulated POW records to donated
      await supabase
        .from('pow_records')
        .update({
          status: 'donated_from_accumulated',
          donated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('status', 'accumulated');

      // Update user's sats
      await supabase
        .from('users')
        .update({
          accumulated_sats: 0,
          total_donated_sats: user.total_donated_sats + amount,
        })
        .eq('id', userId);

      // Send accumulated donation message to Discord
      await sendAccumulatedDonationToDiscord(userId, amount);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Donate error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function sendAccumulatedDonationToDiscord(userId: string, amount: number) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_POW_CHANNEL_ID;

  if (!botToken || !channelId) return;

  const { createServiceRoleClient } = await import('@/lib/supabase/server');
  const { formatNumber } = await import('@/lib/utils');

  const supabase = createServiceRoleClient();
  const { data: user } = await supabase
    .from('users')
    .select('discord_id, discord_username')
    .eq('id', userId)
    .single();

  if (!user) return;

  const userMention = user.discord_id ? `<@${user.discord_id}>` : user.discord_username || '사용자';

  const message = {
    content: `💸 ${userMention}님이 적립해 두셨던 **${formatNumber(amount)} sats**를 기부했습니다!\n\n감사합니다! 🙏`,
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
