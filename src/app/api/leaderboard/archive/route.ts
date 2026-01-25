import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getLeaderboardWeekStart } from '@/lib/utils';
import { POW_FIELDS } from '@/constants';
import { PowField } from '@/types';

// 주간 랭킹 아카이브 API (매주 일요일 18:55 KST에 호출)
export async function POST() {
  try {
    const supabase = createServiceRoleClient();

    // 현재 주간 시작/종료 시간
    const weekStart = getLeaderboardWeekStart();
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000); // 7일 후 - 1초

    // 이미 저장된 주간인지 확인
    const { data: existing } = await supabase
      .from('weekly_rankings')
      .select('id')
      .eq('week_start', weekStart.toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({
        message: 'Already archived for this week',
        skipped: true,
        week_start: weekStart.toISOString(),
      });
    }

    const rankings: { type: string; data: any[] }[] = [];

    // 1. POW 시간 랭킹 - 전체 (time_total)
    const totalRanking = await getTimeRanking(supabase, weekStart, null);
    rankings.push({ type: 'time_total', data: totalRanking });

    // 2. POW 시간 랭킹 - 분야별
    const fields = Object.keys(POW_FIELDS) as PowField[];
    for (const field of fields) {
      const fieldRanking = await getTimeRanking(supabase, weekStart, field);
      rankings.push({ type: `time_${field}`, data: fieldRanking });
    }

    // 3. 인기 POW 랭킹
    const popularRanking = await getPopularPowRanking(supabase, weekStart);
    rankings.push({ type: 'popular_pow', data: popularRanking });

    // DB에 저장
    const insertData = rankings.map(r => ({
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      ranking_type: r.type,
      rankings: r.data,
    }));

    const { error: insertError } = await supabase
      .from('weekly_rankings')
      .insert(insertData);

    if (insertError) {
      console.error('Failed to insert rankings:', insertError);
      return NextResponse.json(
        { error: 'Failed to save rankings', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Weekly rankings archived successfully',
      week_start: weekStart.toISOString(),
      week_end: weekEnd.toISOString(),
      saved_count: rankings.length,
      rankings: rankings.map(r => ({ type: r.type, top3: r.data.length })),
    });
  } catch (error) {
    console.error('Archive error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET도 지원 (cron-job.org 호환)
export async function GET() {
  return POST();
}

// POW 시간 랭킹 조회 (상위 3명)
async function getTimeRanking(
  supabase: any,
  weekStart: Date,
  field: PowField | null
): Promise<any[]> {
  let query = supabase
    .from('pow_records')
    .select('user_id, actual_time, users!inner(discord_username, discord_avatar_url)')
    .gte('completed_at', weekStart.toISOString())
    .neq('status', 'in_progress');

  if (field) {
    query = query.eq('field', field);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error('Failed to fetch time ranking:', error);
    return [];
  }

  // 사용자별 합계
  const userTotals = new Map<string, {
    total: number;
    username: string;
    avatar_url: string | null;
  }>();

  data.forEach((record: any) => {
    const current = userTotals.get(record.user_id) || {
      total: 0,
      username: record.users.discord_username,
      avatar_url: record.users.discord_avatar_url,
    };
    current.total += record.actual_time;
    userTotals.set(record.user_id, current);
  });

  // 정렬 및 상위 3명
  return Array.from(userTotals.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3)
    .map(([userId, data], index) => ({
      rank: index + 1,
      user_id: userId,
      username: data.username,
      avatar_url: data.avatar_url,
      value: data.total,
    }));
}

// 인기 POW 랭킹 조회 (상위 3개)
async function getPopularPowRanking(
  supabase: any,
  weekStart: Date
): Promise<any[]> {
  const { data, error } = await supabase
    .from('discord_reactions')
    .select(`
      total_reactions,
      reaction_details,
      pow_records!inner(
        id,
        goal_content,
        field,
        user_id,
        users!inner(discord_username, discord_avatar_url)
      )
    `)
    .gt('total_reactions', 0)
    .gte('pow_records.completed_at', weekStart.toISOString())
    .order('total_reactions', { ascending: false })
    .limit(3);

  if (error || !data) {
    console.error('Failed to fetch popular ranking:', error);
    return [];
  }

  return data.map((item: any, index: number) => ({
    rank: index + 1,
    pow_record_id: item.pow_records.id,
    user_id: item.pow_records.user_id,
    username: item.pow_records.users.discord_username,
    avatar_url: item.pow_records.users.discord_avatar_url,
    field: item.pow_records.field,
    goal_content: item.pow_records.goal_content,
    total_reactions: item.total_reactions,
    reaction_details: item.reaction_details,
  }));
}
