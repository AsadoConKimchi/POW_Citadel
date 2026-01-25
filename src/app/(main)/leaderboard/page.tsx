'use client';

import { useState, useEffect } from 'react';
import { LeaderboardEntry, PopularPowEntry, PowField } from '@/types';
import { POW_FIELDS, POW_FIELD_OPTIONS, ROLE_BORDER_COLORS } from '@/constants';
import { formatNumber, formatTime, getLeaderboardWeekStart } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabase/client';

type LeaderboardType = 'donation' | 'time';
type LeaderboardScope = 'total' | PowField;

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'popular'>('leaderboard');
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>('donation');
  const [scope, setScope] = useState<LeaderboardScope>('total');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [popularPows, setPopularPows] = useState<PopularPowEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 리더보드 데이터 로드
  useEffect(() => {
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      try {
        // 이번 주 시작일 (일요일 19:00 KST 기준)
        const weekStart = getLeaderboardWeekStart();

        if (leaderboardType === 'donation') {
          // 기부금 리더보드
          let query = supabase
            .from('pow_records')
            .select('user_id, actual_sats, field, users!inner(discord_username, discord_avatar_url, role_status)')
            .gte('donated_at', weekStart.toISOString())
            .in('status', ['donated_immediate', 'donated_from_accumulated']);

          if (scope !== 'total') {
            query = query.eq('field', scope);
          }

          const { data, error } = await query;

          if (error) throw error;

          // 사용자별 합계 계산
          const userTotals = new Map<string, {
            total: number;
            username: string;
            avatar_url: string | null;
            role_status: number;
          }>();

          data?.forEach((record: any) => {
            const current = userTotals.get(record.user_id) || {
              total: 0,
              username: record.users.discord_username,
              avatar_url: record.users.discord_avatar_url,
              role_status: record.users.role_status,
            };
            current.total += record.actual_sats;
            userTotals.set(record.user_id, current);
          });

          // 정렬 및 순위 부여
          const sorted = Array.from(userTotals.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([userId, data], index) => ({
              user_id: userId,
              username: data.username,
              avatar_url: data.avatar_url,
              role_status: data.role_status as 0 | 1 | 2,
              value: data.total,
              rank: index + 1,
            }));

          setLeaderboardData(sorted);
        } else {
          // 시간 리더보드
          let query = supabase
            .from('pow_records')
            .select('user_id, actual_time, field, users!inner(discord_username, discord_avatar_url, role_status)')
            .gte('completed_at', weekStart.toISOString())
            .neq('status', 'in_progress');

          if (scope !== 'total') {
            query = query.eq('field', scope);
          }

          const { data, error } = await query;

          if (error) throw error;

          // 사용자별 합계 계산
          const userTotals = new Map<string, {
            total: number;
            username: string;
            avatar_url: string | null;
            role_status: number;
          }>();

          data?.forEach((record: any) => {
            const current = userTotals.get(record.user_id) || {
              total: 0,
              username: record.users.discord_username,
              avatar_url: record.users.discord_avatar_url,
              role_status: record.users.role_status,
            };
            current.total += record.actual_time;
            userTotals.set(record.user_id, current);
          });

          // 정렬 및 순위 부여
          const sorted = Array.from(userTotals.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([userId, data], index) => ({
              user_id: userId,
              username: data.username,
              avatar_url: data.avatar_url,
              role_status: data.role_status as 0 | 1 | 2,
              value: data.total,
              rank: index + 1,
            }));

          setLeaderboardData(sorted);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (activeTab === 'leaderboard') {
      fetchLeaderboard();
    }
  }, [activeTab, leaderboardType, scope]);

  // 인기 POW 데이터 로드
  useEffect(() => {
    const fetchPopularPows = async () => {
      if (activeTab !== 'popular') return;

      setIsLoading(true);
      const supabase = getSupabaseClient();

      try {
        // 이번 주 시작일 (일요일 19:00 KST 기준)
        const weekStart = getLeaderboardWeekStart();

        // 지난 주 시작일 (동기화 범위: 이번 주 시작 - 3일)
        const syncStart = new Date(weekStart.getTime() - 3 * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from('discord_reactions')
          .select(`
            total_reactions,
            reaction_details,
            pow_records!inner(
              *,
              users!inner(discord_username, discord_avatar_url, role_status)
            )
          `)
          .gt('total_reactions', 0)
          .gte('pow_records.completed_at', syncStart.toISOString())
          .order('total_reactions', { ascending: false });

        if (error) throw error;

        // 이번 주 / 지난 주 구분
        const thisWeekPows: PopularPowEntry[] = [];
        const lastWeekPows: PopularPowEntry[] = [];

        data?.forEach((item: any) => {
          const completedAt = new Date(item.pow_records.completed_at);
          const isThisWeek = completedAt >= weekStart;

          const entry = {
            pow_record: item.pow_records,
            user: item.pow_records.users,
            total_reactions: item.total_reactions,
            reaction_details: item.reaction_details,
            isLastWeek: !isThisWeek,
          };

          if (isThisWeek) {
            thisWeekPows.push(entry);
          } else {
            lastWeekPows.push(entry);
          }
        });

        // 이번 주 먼저, 그 다음 지난 주 (각각 반응 수 내림차순 정렬은 이미 됨)
        const combined = [...thisWeekPows, ...lastWeekPows].slice(0, 10);
        setPopularPows(combined);
      } catch (error) {
        console.error('Failed to fetch popular POWs:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularPows();
  }, [activeTab]);

  return (
    <div className="py-4 space-y-6">
      {/* 탭 선택 */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'leaderboard'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          🏆 리더보드
        </button>
        <button
          onClick={() => setActiveTab('popular')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'popular'
              ? 'text-orange-500 border-b-2 border-orange-500'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          ⭐ 인기 POW
        </button>
      </div>

      {activeTab === 'leaderboard' ? (
        <>
          {/* 리더보드 타입 선택 */}
          <div className="flex gap-2">
            <button
              onClick={() => setLeaderboardType('donation')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                leaderboardType === 'donation'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              💰 기부금
            </button>
            <button
              onClick={() => setLeaderboardType('time')}
              className={`flex-1 py-2 rounded-lg font-medium transition-colors ${
                leaderboardType === 'time'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              ⏱️ POW 시간
            </button>
          </div>

          {/* 분야 선택 */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setScope('total')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                scope === 'total'
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              전체
            </button>
            {POW_FIELD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setScope(option.value)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  scope === option.value
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 리더보드 목록 */}
          {isLoading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p>아직 데이터가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {leaderboardData.map((entry) => (
                <LeaderboardItem
                  key={entry.user_id}
                  entry={entry}
                  type={leaderboardType}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* 인기 POW */}
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            ⭐ 이번주 인기 POW Top 5
          </h2>

          {isLoading ? (
            <div className="text-center py-10">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : popularPows.length === 0 ? (
            <div className="text-center py-10 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">⭐</div>
              <p>아직 인기 POW가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {popularPows.map((item, index) => (
                <PopularPowCard key={item.pow_record.id} item={item} rank={index + 1} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LeaderboardItem({
  entry,
  type,
}: {
  entry: LeaderboardEntry;
  type: LeaderboardType;
}) {
  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `${rank}`;
    }
  };

  const borderColor = ROLE_BORDER_COLORS[entry.role_status];

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-sm">
      <div className="text-xl w-8 text-center">{getRankEmoji(entry.rank)}</div>
      <div
        className="relative rounded-full p-0.5"
        style={{ backgroundColor: borderColor }}
      >
        <img
          src={entry.avatar_url || '/default-avatar.png'}
          alt={entry.username}
          className="w-10 h-10 rounded-full bg-gray-200"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 dark:text-white truncate">
          {entry.username}
        </p>
      </div>
      <div className="text-right">
        <p className="font-bold text-orange-500">
          {type === 'donation'
            ? `${formatNumber(entry.value)} sats`
            : formatTime(entry.value)}
        </p>
      </div>
    </div>
  );
}

function PopularPowCard({ item, rank }: { item: PopularPowEntry; rank: number }) {
  const fieldInfo = POW_FIELDS[item.pow_record.field];
  const topReactions = Object.entries(item.reaction_details || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm">
      {/* 인증카드 이미지 */}
      {item.pow_record.image_url && (
        <div className="relative aspect-video w-full">
          <img
            src={item.pow_record.image_url}
            alt={`${item.user.discord_username}의 인증카드`}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 flex gap-1">
            {item.isLastWeek && (
              <span className="bg-gray-500 text-white px-2 py-1 rounded-lg text-sm font-medium">
                지난주
              </span>
            )}
            <span className="bg-orange-500 text-white px-2 py-1 rounded-lg text-sm font-bold">
              #{rank}
            </span>
          </div>
          <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded-lg text-sm">
            반응 {item.total_reactions}개
          </div>
        </div>
      )}
      <div className="p-4">
        {/* 이미지 없을 때만 순위/반응 표시 */}
        {!item.pow_record.image_url && (
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {item.isLastWeek && (
                <span className="bg-gray-500 text-white px-2 py-0.5 rounded text-xs font-medium">
                  지난주
                </span>
              )}
              <span className="text-lg font-bold text-orange-500">#{rank}</span>
            </div>
            <span className="text-sm text-gray-500">반응 {item.total_reactions}개</span>
          </div>
        )}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{fieldInfo.emoji}</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {item.user.discord_username}
          </span>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {item.pow_record.goal_content}
        </p>
        {topReactions.length > 0 && (
          <div className="mt-2 flex gap-2">
            {topReactions.map(([emoji, count]) => (
              <span key={emoji} className="text-sm text-gray-500">
                {emoji} {count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
