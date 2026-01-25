import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

// POW 목표 시간 도달 시 푸시 알림 예약
export async function POST(request: NextRequest) {
  try {
    const { userId, goalTimeSeconds, powId } = await request.json();

    if (!userId || !goalTimeSeconds) {
      return NextResponse.json(
        { error: 'Missing userId or goalTimeSeconds' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // 예약 시간 계산 (현재 시간 + 목표 시간)
    const scheduledAt = new Date(Date.now() + goalTimeSeconds * 1000);

    // 기존 예약 삭제 후 새로 생성
    await supabase
      .from('scheduled_push')
      .delete()
      .eq('user_id', userId)
      .eq('type', 'pow_goal');

    const { data, error } = await supabase
      .from('scheduled_push')
      .insert({
        user_id: userId,
        type: 'pow_goal',
        scheduled_at: scheduledAt.toISOString(),
        payload: {
          title: '🎯 목표 시간 도달!',
          body: 'POW 목표 시간에 도달했습니다. 종료하고 인증하세요!',
          tag: 'pow-goal-reached',
          requireInteraction: true,
          data: {
            url: '/pow-timer',
            powId,
          },
        },
      })
      .select()
      .single();

    if (error) {
      console.error('Schedule push error:', error);
      return NextResponse.json(
        { error: 'Failed to schedule push' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, scheduledAt, id: data.id });
  } catch (error) {
    console.error('Schedule push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 예약된 푸시 취소
export async function DELETE(request: NextRequest) {
  try {
    const { userId, type } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const query = supabase
      .from('scheduled_push')
      .delete()
      .eq('user_id', userId);

    if (type) {
      query.eq('type', type);
    }

    const { error } = await query;

    if (error) {
      console.error('Cancel push error:', error);
      return NextResponse.json(
        { error: 'Failed to cancel push' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
