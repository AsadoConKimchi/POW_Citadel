'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { POW_FIELDS } from '@/constants';
import {
  formatTimeKorean,
  formatTime,
  calculateAchievementRate,
  calculateActualSats,
  formatNumber,
} from '@/lib/utils';

export default function PowTimerPage() {
  const router = useRouter();
  const {
    user,
    timer,
    currentPow,
    tickTimer,
    pauseTimer,
    resumeTimer,
    stopTimer,
    setCompletedPow,
    clearCurrentPow,
  } = usePowStore();

  // 타이머 틱
  useEffect(() => {
    if (!timer.isRunning || timer.isPaused) return;

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.isRunning, timer.isPaused, tickTimer]);

  // 목표 시간 도달 시 알림
  useEffect(() => {
    if (timer.elapsedSeconds > 0 && timer.elapsedSeconds === currentPow.goalTime) {
      // Push notification (if supported)
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🎯 목표 시간에 도달했습니다!', {
          body: 'POW를 종료하세요.',
          icon: '/icons/icon-192x192.png',
        });
      }
    }
  }, [timer.elapsedSeconds, currentPow.goalTime]);

  // POW가 없으면 나의 POW 페이지로 리다이렉트
  if (!currentPow.field || !timer.isRunning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="text-6xl mb-4">⏱️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          진행 중인 POW가 없습니다
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          새로운 POW를 시작해보세요!
        </p>
        <button
          onClick={() => router.push('/my-pow')}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          POW 시작하기
        </button>
      </div>
    );
  }

  const fieldInfo = POW_FIELDS[currentPow.field];
  const currentAchievementRate = calculateAchievementRate(currentPow.goalTime, timer.elapsedSeconds);
  const estimatedSats = calculateActualSats(currentPow.targetSats, currentAchievementRate);
  const remainingTime = Math.max(0, currentPow.goalTime - timer.elapsedSeconds);

  // POW 종료 처리
  const handleStop = async () => {
    if (!confirm('POW를 종료하시겠습니까?')) return;

    stopTimer();

    // 완료된 POW 정보 설정
    const completedRecord = {
      id: '', // 서버에서 생성
      user_id: user?.id || '', // 실제 유저 ID
      field: currentPow.field!,
      goal_content: currentPow.goalContent,
      goal_time: currentPow.goalTime,
      actual_time: timer.elapsedSeconds,
      achievement_rate: currentAchievementRate,
      target_sats: currentPow.targetSats,
      actual_sats: estimatedSats,
      mode: currentPow.mode,
      status: 'completed' as const,
      group_pow_id: null,
      memo: null,
      image_url: null,
      discord_message_id: null,
      started_at: currentPow.startedAt ? new Date(currentPow.startedAt).toISOString() : new Date().toISOString(),
      paused_at: null,
      total_paused_time: timer.totalPausedSeconds,
      completed_at: new Date().toISOString(),
      donated_at: null,
      created_at: new Date().toISOString(),
    };

    setCompletedPow(completedRecord);
    clearCurrentPow();

    // 인증카드 생성 페이지로 이동
    router.push('/certification');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      {/* POW 정보 */}
      <div className="mb-6">
        <span className="text-5xl">{fieldInfo.emoji}</span>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          {fieldInfo.labelKo}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400 max-w-xs mx-auto">
          {currentPow.goalContent}
        </p>
      </div>

      {/* 타이머 */}
      <div className="mb-8">
        <div className="text-6xl sm:text-7xl font-mono font-bold text-gray-900 dark:text-white">
          {formatTimeKorean(timer.elapsedSeconds)}
        </div>

        {/* 일시정지 표시 */}
        {timer.isPaused && (
          <div className="mt-2 text-orange-500 font-medium animate-pulse">
            ⏸️ 일시정지됨
          </div>
        )}
      </div>

      {/* 목표 정보 */}
      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">목표까지</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {remainingTime > 0 ? formatTime(remainingTime) : '✅ 달성!'}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">달성률</p>
          <p className="text-lg font-bold text-orange-500">{currentAchievementRate}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">목표 시간</p>
          <p className="text-lg font-bold text-gray-900 dark:text-white">
            {formatTime(currentPow.goalTime)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">예상 기부금</p>
          <p className="text-lg font-bold text-orange-500">{formatNumber(estimatedSats)} sats</p>
        </div>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="flex gap-4">
        {timer.isPaused ? (
          <button
            onClick={resumeTimer}
            className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white text-lg font-bold rounded-xl transition-colors"
          >
            ▶️ 재개
          </button>
        ) : (
          <button
            onClick={pauseTimer}
            className="px-8 py-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-bold rounded-xl transition-colors"
          >
            ⏸️ 일시정지
          </button>
        )}
        <button
          onClick={handleStop}
          className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white text-lg font-bold rounded-xl transition-colors"
        >
          ⏹️ 종료
        </button>
      </div>

      {/* 모드 표시 */}
      <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
        {currentPow.mode === 'immediate' ? '⚡ 즉시기부 모드' : '💾 적립 후 기부 모드'}
      </div>
    </div>
  );
}
