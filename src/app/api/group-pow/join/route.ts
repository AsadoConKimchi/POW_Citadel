import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { groupPowId, pledgedSats, userId } = await request.json();

    if (!groupPowId || !pledgedSats || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // Check if group POW exists and is upcoming
    const { data: groupPow, error: groupError } = await supabase
      .from('group_pows')
      .select('*')
      .eq('id', groupPowId)
      .single();

    if (groupError || !groupPow) {
      return NextResponse.json(
        { error: 'Group POW not found' },
        { status: 404 }
      );
    }

    if (groupPow.status !== 'upcoming') {
      return NextResponse.json(
        { error: 'Cannot join this group POW' },
        { status: 400 }
      );
    }

    // Check if already joined
    const { data: existingParticipant } = await supabase
      .from('group_pow_participants')
      .select('*')
      .eq('group_pow_id', groupPowId)
      .eq('user_id', userId)
      .single();

    if (existingParticipant) {
      return NextResponse.json(
        { error: 'Already joined this group POW' },
        { status: 400 }
      );
    }

    // Add participant
    const { data: participant, error: participantError } = await supabase
      .from('group_pow_participants')
      .insert({
        group_pow_id: groupPowId,
        user_id: userId,
        pledged_sats: pledgedSats,
      })
      .select()
      .single();

    if (participantError) {
      console.error('Participant creation error:', participantError);
      return NextResponse.json(
        { error: 'Failed to join group POW' },
        { status: 500 }
      );
    }

    // Update group POW's actual_sats_collected
    await supabase
      .from('group_pows')
      .update({
        actual_sats_collected: groupPow.actual_sats_collected + pledgedSats,
      })
      .eq('id', groupPowId);

    return NextResponse.json({
      success: true,
      participant,
    });
  } catch (error) {
    console.error('Group POW join error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
