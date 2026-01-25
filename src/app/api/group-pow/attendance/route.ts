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

    // 상태 확인 (ongoing일 때만 출석체크 가능)
    if (groupPow.status !== 'ongoing') {
      return NextResponse.json(
        { error: '진행 중인 그룹 POW만 출석체크할 수 있습니다.' },
        { status: 400 }
      );
    }

    // 참여자 확인
    const { data: participant, error: participantError } = await supabase
      .from('group_pow_participants')
      .select('*')
      .eq('group_pow_id', groupPowId)
      .eq('user_id', userId)
      .single();

    if (participantError || !participant) {
      return NextResponse.json(
        { error: '이 그룹 POW에 참여하지 않았습니다.' },
        { status: 403 }
      );
    }

    // 이미 출석체크 완료 확인
    if (participant.attendance_checked) {
      return NextResponse.json(
        { error: '이미 출석체크를 완료했습니다.', alreadyChecked: true },
        { status: 400 }
      );
    }

    // 출석체크 처리
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('group_pow_participants')
      .update({
        attendance_checked: true,
        attendance_checked_at: now,
      })
      .eq('id', participant.id);

    if (updateError) {
      console.error('Attendance check error:', updateError);
      return NextResponse.json(
        { error: '출석체크에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '출석체크가 완료되었습니다!',
      checkedAt: now,
    });
  } catch (error) {
    console.error('Attendance check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 참여자의 출석체크 상태 조회
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupPowId = searchParams.get('groupPowId');
    const userId = searchParams.get('userId');

    if (!groupPowId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    const { data: participant, error } = await supabase
      .from('group_pow_participants')
      .select('*')
      .eq('group_pow_id', groupPowId)
      .eq('user_id', userId)
      .single();

    if (error || !participant) {
      return NextResponse.json({
        isParticipant: false,
        attendanceChecked: false,
      });
    }

    return NextResponse.json({
      isParticipant: true,
      attendanceChecked: participant.attendance_checked,
      attendanceCheckedAt: participant.attendance_checked_at,
      pledgedSats: participant.pledged_sats,
    });
  } catch (error) {
    console.error('Attendance status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
