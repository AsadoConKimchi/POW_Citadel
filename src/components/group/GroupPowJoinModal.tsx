'use client';

import { useState, useEffect } from 'react';
import { GroupPow } from '@/types';
import { POW_FIELDS } from '@/constants';
import { formatDateTimeKorean, formatTime, formatNumber } from '@/lib/utils';
import { usePowStore } from '@/stores/pow-store';
import { getSupabaseClient } from '@/lib/supabase/client';

interface GroupPowJoinModalProps {
  groupPow: GroupPow;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function GroupPowJoinModal({ groupPow, onClose, onRefresh }: GroupPowJoinModalProps) {
  const { user } = usePowStore();
  const [pledgedSats, setPledgedSats] = useState(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isCheckingAttendance, setIsCheckingAttendance] = useState(false);
  const [attendanceChecked, setAttendanceChecked] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(groupPow.status);

  const fieldInfo = POW_FIELDS[groupPow.field];
  const isCreator = user?.id === groupPow.creator_id;
  const isOngoing = currentStatus === 'ongoing';

  // 시작 가능 여부 체크 (예정 시간 ±15분)
  const canStart = () => {
    if (currentStatus !== 'upcoming') return false;
    const plannedDate = new Date(groupPow.planned_date);
    const now = new Date();
    const timeDiff = now.getTime() - plannedDate.getTime();
    const fifteenMinutes = 15 * 60 * 1000;
    return timeDiff >= -fifteenMinutes && timeDiff <= fifteenMinutes;
  };

  // 이미 참여 여부 및 출석체크 상태 확인
  useEffect(() => {
    const checkParticipation = async () => {
      if (!user) return;

      const supabase = getSupabaseClient();
      const { data, count } = await supabase
        .from('group_pow_participants')
        .select('*', { count: 'exact' })
        .eq('group_pow_id', groupPow.id);

      setParticipantCount(count || 0);

      const participant = data?.find((p) => p.user_id === user.id);
      setIsAlreadyJoined(!!participant);
      setAttendanceChecked(!!participant?.attendance_checked);
    };

    checkParticipation();
  }, [groupPow.id, user]);

  // 그룹 POW 시작
  const handleStart = async () => {
    if (!user?.id || !confirm('그룹 POW를 시작하시겠습니까?')) return;

    setIsStarting(true);
    try {
      const response = await fetch('/api/group-pow/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPowId: groupPow.id, userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '시작 실패');

      alert('그룹 POW가 시작되었습니다!');
      setCurrentStatus('ongoing');
      onRefresh?.();
    } catch (error: any) {
      alert(error.message || '시작에 실패했습니다.');
    } finally {
      setIsStarting(false);
    }
  };

  // 그룹 POW 종료
  const handleEnd = async () => {
    if (!user?.id || !confirm('그룹 POW를 종료하시겠습니까?\n달성률이 계산됩니다.')) return;

    setIsEnding(true);
    try {
      const response = await fetch('/api/group-pow/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPowId: groupPow.id, userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '종료 실패');

      alert(`그룹 POW가 종료되었습니다!\n달성률: ${data.achievementRate}%`);
      onRefresh?.();
      onClose();
    } catch (error: any) {
      alert(error.message || '종료에 실패했습니다.');
    } finally {
      setIsEnding(false);
    }
  };

  // 출석체크
  const handleAttendance = async () => {
    if (!user?.id) return;

    setIsCheckingAttendance(true);
    try {
      const response = await fetch('/api/group-pow/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupPowId: groupPow.id, userId: user.id }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '출석체크 실패');

      alert('출석체크가 완료되었습니다!');
      setAttendanceChecked(true);
    } catch (error: any) {
      alert(error.message || '출석체크에 실패했습니다.');
    } finally {
      setIsCheckingAttendance(false);
    }
  };

  const handleJoin = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (pledgedSats < 100) {
      alert('최소 100 sats 이상 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/group-pow/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupPowId: groupPow.id,
          pledgedSats,
        }),
      });

      if (!response.ok) {
        throw new Error('참여 실패');
      }

      alert('참여가 완료되었습니다!');
      onClose();
    } catch (error) {
      console.error('Join error:', error);
      alert('참여에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const progress = (groupPow.actual_sats_collected / groupPow.target_sats) * 100;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            그룹 POW 참여
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 그룹 POW 정보 */}
          <div className="space-y-3">
            {groupPow.thumbnail_url && (
              <img
                src={groupPow.thumbnail_url}
                alt={groupPow.title}
                className="w-full aspect-video rounded-xl object-cover"
              />
            )}

            <div className="flex items-center gap-2">
              <span className="text-2xl">{fieldInfo.emoji}</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {groupPow.title}
              </h3>
            </div>

            {groupPow.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {groupPow.description}
              </p>
            )}

            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <span className="text-gray-500 dark:text-gray-400">📅</span>
                <span className="text-gray-900 dark:text-white">{formatDateTimeKorean(groupPow.planned_date)}</span>
              </div>
              {groupPow.location && (
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 dark:text-gray-400">📍</span>
                  <span className="text-gray-900 dark:text-white">{groupPow.location}</span>
                </div>
              )}
              <div className="flex items-start gap-2">
                <span className="text-gray-500 dark:text-gray-400">⏱️</span>
                <span className="text-gray-900 dark:text-white">{formatTime(groupPow.planned_duration)}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 dark:text-gray-400">👥</span>
                <span className="text-gray-900 dark:text-white">{participantCount}명 참여</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-gray-500 dark:text-gray-400">🎯</span>
                <span className="text-orange-500">{formatNumber(groupPow.target_sats)} sats 목표</span>
              </div>
            </div>

            {/* 모금 현황 */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600 dark:text-gray-400">
                  현재: {formatNumber(groupPow.actual_sats_collected)} sats
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
          </div>

          {/* 진행 중 표시 */}
          {isOngoing && (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <span className="animate-pulse text-green-600 dark:text-green-400">●</span>
              <span className="text-green-700 dark:text-green-300 font-medium">진행 중</span>
            </div>
          )}

          {/* 개최자 전용 버튼 */}
          {isCreator && (
            <div className="space-y-2">
              {currentStatus === 'upcoming' && canStart() && (
                <button
                  onClick={handleStart}
                  disabled={isStarting}
                  className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
                >
                  {isStarting ? '시작 중...' : '▶️ 그룹 POW 시작'}
                </button>
              )}
              {currentStatus === 'upcoming' && !canStart() && (
                <div className="text-center py-3 bg-gray-100 dark:bg-gray-700 rounded-xl">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    예정 시간 ±15분 내에 시작할 수 있습니다.
                  </p>
                </div>
              )}
              {isOngoing && (
                <button
                  onClick={handleEnd}
                  disabled={isEnding}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
                >
                  {isEnding ? '종료 중...' : '⏹️ 그룹 POW 종료'}
                </button>
              )}
            </div>
          )}

          {/* 참석자: 진행 중일 때 출석체크 */}
          {!isCreator && isOngoing && isAlreadyJoined && (
            <div className="space-y-2">
              {attendanceChecked ? (
                <div className="flex items-center justify-center gap-2 py-4 bg-blue-100 dark:bg-blue-900 rounded-xl">
                  <span className="text-blue-600 dark:text-blue-300 font-medium">✅ 출석체크 완료</span>
                </div>
              ) : (
                <button
                  onClick={handleAttendance}
                  disabled={isCheckingAttendance}
                  className="w-full py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
                >
                  {isCheckingAttendance ? '처리 중...' : '✋ 출석체크'}
                </button>
              )}
            </div>
          )}

          {isAlreadyJoined && !isOngoing ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                이미 참여 완료했습니다!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                그룹 POW 시작 시 알림을 보내드립니다.
              </p>
            </div>
          ) : !isAlreadyJoined && !isOngoing ? (
            <>
              {/* 기부 의사금액 입력 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  이번 그룹 POW에 얼마를 기부하시겠습니까?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={100}
                    step={100}
                    value={pledgedSats}
                    onChange={(e) => setPledgedSats(Math.max(100, parseInt(e.target.value) || 0))}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">sats</span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  * 실제 기부금은 그룹 POW 종료 시 달성률에 따라 계산됩니다.
                </p>
              </div>

              {/* 참여 버튼 */}
              <button
                onClick={handleJoin}
                disabled={isSubmitting}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
              >
                {isSubmitting ? '참여 중...' : '👥 참여하기'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
