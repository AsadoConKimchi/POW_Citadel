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
}

export default function GroupPowJoinModal({ groupPow, onClose }: GroupPowJoinModalProps) {
  const { user } = usePowStore();
  const [pledgedSats, setPledgedSats] = useState(1000);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAlreadyJoined, setIsAlreadyJoined] = useState(false);
  const [participantCount, setParticipantCount] = useState(0);

  const fieldInfo = POW_FIELDS[groupPow.field];

  // 이미 참여 여부 확인
  useEffect(() => {
    const checkParticipation = async () => {
      if (!user) return;

      const supabase = getSupabaseClient();
      const { data, count } = await supabase
        .from('group_pow_participants')
        .select('*', { count: 'exact' })
        .eq('group_pow_id', groupPow.id);

      setParticipantCount(count || 0);

      const isJoined = data?.some((p) => p.user_id === user.id);
      setIsAlreadyJoined(!!isJoined);
    };

    checkParticipation();
  }, [groupPow.id, user]);

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

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-gray-500 dark:text-gray-400">
                시작: <span className="text-gray-900 dark:text-white">{formatDateTimeKorean(groupPow.planned_date)}</span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                시간: <span className="text-gray-900 dark:text-white">{formatTime(groupPow.planned_duration)}</span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                참여자: <span className="text-gray-900 dark:text-white">{participantCount}명</span>
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                목표: <span className="text-orange-500">{formatNumber(groupPow.target_sats)} sats</span>
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

          {isAlreadyJoined ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">✅</div>
              <p className="text-gray-700 dark:text-gray-300 font-medium">
                이미 참여 완료했습니다!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                그룹 POW 시작 시간에 출석체크 DM을 보내드립니다.
              </p>
            </div>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
