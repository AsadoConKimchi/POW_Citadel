'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { POW_FIELD_OPTIONS } from '@/constants';
import { PowField, PowMode } from '@/types';
import { timeToSeconds } from '@/lib/utils';

interface PowGoalFormProps {
  onClose: () => void;
}

export default function PowGoalForm({ onClose }: PowGoalFormProps) {
  const router = useRouter();
  const { setCurrentPow, startTimer } = usePowStore();

  const [field, setField] = useState<PowField>('study');
  const [goalContent, setGoalContent] = useState('');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [targetSats, setTargetSats] = useState(1000);
  const [mode, setMode] = useState<PowMode>('immediate');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!goalContent.trim()) {
      alert('목표 내용을 입력해주세요.');
      return;
    }

    const goalTime = timeToSeconds(hours, minutes);
    if (goalTime <= 0) {
      alert('목표 시간을 설정해주세요.');
      return;
    }

    if (targetSats <= 0) {
      alert('기부할 sats를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      // 현재 POW 설정
      setCurrentPow({
        field,
        goalContent: goalContent.trim(),
        goalTime,
        targetSats,
        mode,
      });

      // 타이머 시작
      startTimer();

      // 타이머 페이지로 이동
      router.push('/pow-timer');
      onClose();
    } catch (error) {
      console.error('Failed to start POW:', error);
      alert('POW 시작에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">POW 목표 작성</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* POW 분야 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              POW 분야
            </label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as PowField)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              {POW_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 목표 내용 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              목표 내용
            </label>
            <textarea
              value={goalContent}
              onChange={(e) => setGoalContent(e.target.value)}
              placeholder="예: 유튜브 썸네일 5개 만들기"
              rows={3}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* 목표 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              목표 시간
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white text-center focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-gray-600 dark:text-gray-400">시간</span>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={minutes}
                    onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white text-center focus:ring-2 focus:ring-orange-500"
                  />
                  <span className="text-gray-600 dark:text-gray-400">분</span>
                </div>
              </div>
            </div>
          </div>

          {/* 기부할 sats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기부할 sats
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={targetSats}
                onChange={(e) => setTargetSats(Math.max(1, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">sats</span>
            </div>
          </div>

          {/* 기부 방식 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              기부 방식
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMode('immediate')}
                className={`px-4 py-3 rounded-xl font-medium transition-colors ${
                  mode === 'immediate'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                ⚡ 즉시기부
              </button>
              <button
                type="button"
                onClick={() => setMode('accumulated')}
                className={`px-4 py-3 rounded-xl font-medium transition-colors ${
                  mode === 'accumulated'
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                💾 적립 후 기부
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              {mode === 'immediate'
                ? 'POW 종료 후 바로 기부합니다.'
                : 'POW 종료 후 적립하고, 나중에 한 번에 기부합니다.'}
            </p>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
          >
            {isSubmitting ? '시작 중...' : '🚀 POW 시작'}
          </button>
        </form>
      </div>
    </div>
  );
}
