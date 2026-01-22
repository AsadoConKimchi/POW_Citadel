import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

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

    // 참여자들에게 알림 (Discord DM 등) - 추후 구현 가능
    // TODO: Send cancellation notification to participants

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
