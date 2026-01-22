'use client';

import { useState, useEffect } from 'react';
import { GroupPow, GroupPowParticipant } from '@/types';
import { POW_FIELDS } from '@/constants';
import { formatDateTimeKorean, formatNumber, formatTime } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabase/client';
import { usePowStore } from '@/stores/pow-store';
import GroupPowCreateModal from '@/components/group/GroupPowCreateModal';
import GroupPowJoinModal from '@/components/group/GroupPowJoinModal';

export default function GroupPowPage() {
  const { user } = usePowStore();
  const [groupPows, setGroupPows] = useState<{
    today: GroupPow[];
    upcoming: GroupPow[];
    completed: GroupPow[];
  }>({ today: [], upcoming: [], completed: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPow, setSelectedPow] = useState<GroupPow | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleStartGroupPow = async (groupPow: GroupPow) => {
    if (!user?.id) return;

    if (!confirm(`"${groupPow.title}" 그룹 POW를 시작하시겠습니까?`)) {
      return;
    }

    setIsStarting(true);
    try {
      const response = await fetch('/api/group-pow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupPowId: groupPow.id,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '시작 실패');
      }

      alert('그룹 POW가 시작되었습니다!');
      fetchGroupPows();
    } catch (error: any) {
      console.error('Start error:', error);
      alert(error.message || '시작에 실패했습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndGroupPow = async (groupPow: GroupPow) => {
    if (!user?.id) return;

    if (!confirm(`"${groupPow.title}" 그룹 POW를 종료하시겠습니까?\n달성률이 계산됩니다.`)) {
      return;
    }

    setIsEnding(true);
    try {
      const response = await fetch('/api/group-pow/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupPowId: groupPow.id,
          userId: user.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '종료 실패');
      }

      alert(`그룹 POW가 종료되었습니다!\n달성률: ${data.achievementRate}%`);
      fetchGroupPows();
    } catch (error: any) {
      console.error('End error:', error);
      alert(error.message || '종료에 실패했습니다.');
    } finally {
      setIsEnding(false);
    }
  };

  const handleCancelGroupPow = async (groupPow: GroupPow) => {
    if (!user?.id) return;

    if (!confirm(`"${groupPow.title}" 그룹 POW를 취소하시겠습니까?\n참여자들에게 취소 알림이 전송됩니다.`)) {
      return;
    }

    setIsCancelling(true);
    try {
      const response = await fetch('/api/group-pow/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupPowId: groupPow.id,
          userId: user.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '취소 실패');
      }

      alert('그룹 POW가 취소되었습니다.');
      fetchGroupPows();
    } catch (error: any) {
      console.error('Cancel error:', error);
      alert(error.message || '취소에 실패했습니다.');
    } finally {
      setIsCancelling(false);
    }
  };

  // 역할 없음 체크
  if (user && user.role_status === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          역할 확인이 필요합니다
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          디스코드 서버에서 역할을 받은 후 이용해주세요.
        </p>
      </div>
    );
  }

  const fetchGroupPows = async () => {
    setIsLoading(true);
    const supabase = getSupabaseClient();

    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayEnd.getDate() + 1);

      // 오늘 진행 예정
      const { data: todayData } = await supabase
        .from('group_pows')
        .select('*')
        .gte('planned_date', todayStart.toISOString())
        .lt('planned_date', todayEnd.toISOString())
        .in('status', ['upcoming', 'ongoing'])
        .order('planned_date', { ascending: true });

      // 앞으로 진행 예정
      const { data: upcomingData } = await supabase
        .from('group_pows')
        .select('*')
        .gte('planned_date', todayEnd.toISOString())
        .eq('status', 'upcoming')
        .order('planned_date', { ascending: true });

      // 종료된 그룹 POW (최근 10개)
      const { data: completedData } = await supabase
        .from('group_pows')
        .select('*')
        .in('status', ['completed', 'cancelled'])
        .order('ended_at', { ascending: false })
        .limit(10);

      setGroupPows({
        today: todayData || [],
        upcoming: upcomingData || [],
        completed: completedData || [],
      });
    } catch (error) {
      console.error('Failed to fetch group POWs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroupPows();
  }, []);

  const canCreateGroupPow = user?.role_status === 2; // 풀노더만

  return (
    <div className="py-4 space-y-6">
      {/* 그룹 POW 개최 버튼 (풀노더만) */}
      {canCreateGroupPow && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white text-lg font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          👥 새로운 그룹 POW 개최하기
        </button>
      )}

      {isLoading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* 오늘 진행 예정 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              📌 오늘 진행 예정
            </h2>
            {groupPows.today.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                오늘 예정된 그룹 POW가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {groupPows.today.map((pow) => (
                  <GroupPowCard
                    key={pow.id}
                    groupPow={pow}
                    onJoin={() => setSelectedPow(pow)}
                    onCancel={() => handleCancelGroupPow(pow)}
                    onStart={() => handleStartGroupPow(pow)}
                    onEnd={() => handleEndGroupPow(pow)}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 앞으로 진행 예정 */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              📅 앞으로 진행 예정
            </h2>
            {groupPows.upcoming.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                예정된 그룹 POW가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {groupPows.upcoming.map((pow) => (
                  <GroupPowCard
                    key={pow.id}
                    groupPow={pow}
                    onJoin={() => setSelectedPow(pow)}
                    onCancel={() => handleCancelGroupPow(pow)}
                    onStart={() => handleStartGroupPow(pow)}
                    onEnd={() => handleEndGroupPow(pow)}
                    currentUserId={user?.id}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 종료된 그룹 POW */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              ✅ 종료된 그룹 POW
            </h2>
            {groupPows.completed.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                종료된 그룹 POW가 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {groupPows.completed.map((pow) => (
                  <GroupPowCard key={pow.id} groupPow={pow} completed />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* 그룹 POW 생성 모달 */}
      {showCreateModal && (
        <GroupPowCreateModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={fetchGroupPows}
        />
      )}

      {/* 그룹 POW 참여 모달 */}
      {selectedPow && (
        <GroupPowJoinModal
          groupPow={selectedPow}
          onClose={() => setSelectedPow(null)}
        />
      )}
    </div>
  );
}

function GroupPowCard({
  groupPow,
  onJoin,
  onCancel,
  onStart,
  onEnd,
  completed,
  currentUserId,
}: {
  groupPow: GroupPow;
  onJoin?: () => void;
  onCancel?: () => void;
  onStart?: () => void;
  onEnd?: () => void;
  completed?: boolean;
  currentUserId?: string;
}) {
  const fieldInfo = POW_FIELDS[groupPow.field];
  const progress = (groupPow.actual_sats_collected / groupPow.target_sats) * 100;
  const isCreator = currentUserId && groupPow.creator_id === currentUserId;
  const isOngoing = groupPow.status === 'ongoing';

  // 시작 가능 여부 체크 (예정 시간 ±15분)
  const canStart = () => {
    if (groupPow.status !== 'upcoming') return false;
    const plannedDate = new Date(groupPow.planned_date);
    const now = new Date();
    const timeDiff = now.getTime() - plannedDate.getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    return timeDiff >= -fifteenMinutes && timeDiff <= fifteenMinutes;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start gap-3">
        {groupPow.thumbnail_url && (
          <img
            src={groupPow.thumbnail_url}
            alt={groupPow.title}
            className="w-16 h-16 rounded-lg object-cover"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xl">{fieldInfo.emoji}</span>
            <h3 className="font-bold text-gray-900 dark:text-white truncate">
              {groupPow.title}
            </h3>
            {isCreator && (
              <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900 text-orange-600 dark:text-orange-300 text-xs rounded-full">
                개최자
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {formatDateTimeKorean(groupPow.planned_date)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            예정 시간: {formatTime(groupPow.planned_duration)}
          </p>
        </div>
      </div>

      {/* 모금 현황 */}
      <div className="mt-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">
            모금: {formatNumber(groupPow.actual_sats_collected)} / {formatNumber(groupPow.target_sats)} sats
          </span>
          <span className="text-orange-500 font-medium">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
      </div>

      {/* 진행 중 표시 */}
      {isOngoing && (
        <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-green-100 dark:bg-green-900 rounded-lg">
          <span className="animate-pulse text-green-600 dark:text-green-400">●</span>
          <span className="text-green-700 dark:text-green-300 font-medium">진행 중</span>
        </div>
      )}

      {/* 액션 버튼 */}
      {!completed && (
        <div className="mt-3 flex gap-2">
          {/* 진행 중이 아닐 때: 참여/상세보기 버튼 */}
          {!isOngoing && onJoin && (
            <button
              onClick={onJoin}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
            >
              {isCreator ? '상세보기' : '참여하기'}
            </button>
          )}

          {/* 개최자 전용 버튼들 */}
          {isCreator && (
            <>
              {/* 시작 버튼 (upcoming + 시작 가능 시간) */}
              {groupPow.status === 'upcoming' && canStart() && onStart && (
                <button
                  onClick={onStart}
                  className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg transition-colors"
                >
                  ▶️ 시작
                </button>
              )}

              {/* 종료 버튼 (ongoing) */}
              {isOngoing && onEnd && (
                <button
                  onClick={onEnd}
                  className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                  ⏹️ 종료
                </button>
              )}

              {/* 취소 버튼 (upcoming일 때만) */}
              {groupPow.status === 'upcoming' && onCancel && (
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800 text-red-600 dark:text-red-300 font-medium rounded-lg transition-colors"
                >
                  취소
                </button>
              )}
            </>
          )}
        </div>
      )}

      {completed && (
        <div className="mt-3 text-center text-sm">
          {groupPow.status === 'cancelled' ? (
            <span className="text-red-500">취소됨</span>
          ) : (
            <span className="text-gray-500">달성률: {groupPow.achievement_rate || 0}%</span>
          )}
        </div>
      )}
    </div>
  );
}
