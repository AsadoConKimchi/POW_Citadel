'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { POW_FIELD_OPTIONS } from '@/constants';
import { PowField } from '@/types';
import PowGoalForm from '@/components/pow/PowGoalForm';
import PowRecordList from '@/components/pow/PowRecordList';
import AccumulatedSatsCard from '@/components/pow/AccumulatedSatsCard';
import { createClient } from '@/lib/supabase/client';

function MyPowContent() {
  const searchParams = useSearchParams();
  const { user, setUser, timer } = usePowStore();
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [selectedField, setSelectedField] = useState<PowField | 'all'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [isLoading, setIsLoading] = useState(true);

  // Handle session from URL (OAuth callback)
  useEffect(() => {
    const sessionParam = searchParams.get('session');

    if (sessionParam) {
      try {
        const sessionData = JSON.parse(atob(sessionParam));
        setUser(sessionData.user);
        // Clean URL
        window.history.replaceState({}, '', '/my-pow');
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }
    setIsLoading(false);
  }, [searchParams, setUser]);

  // Fetch latest user data from database to ensure accumulated_sats is up-to-date
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) return;

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (data && !error) {
          // Update local store with fresh data from database
          setUser(data);
        }
      } catch (err) {
        console.error('Failed to fetch user data:', err);
      }
    };

    fetchUserData();
  }, [user?.id, setUser]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  // 로그인 필요
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="text-6xl mb-4">🔐</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          로그인이 필요합니다
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          디스코드로 로그인 후 이용해주세요.
        </p>
        <a
          href="/login"
          className="px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg transition-colors"
        >
          디스코드로 로그인
        </a>
      </div>
    );
  }

  // 역할 없음 체크
  if (user.role_status === 0) {
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

  // 타이머 실행 중이면 안내
  if (timer.isRunning) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="text-6xl mb-4">⏱️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          POW 진행 중입니다
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          현재 POW를 완료하거나 종료한 후 새 POW를 시작할 수 있습니다.
        </p>
        <a
          href="/pow-timer"
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
        >
          POW 타이머로 이동
        </a>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-6">
      {/* 적립금 카드 */}
      {user.accumulated_sats > 0 && <AccumulatedSatsCard />}

      {/* POW 시작 버튼 */}
      <div className="flex justify-center">
        <button
          onClick={() => setShowGoalForm(true)}
          className="w-full max-w-md px-6 py-4 bg-orange-500 hover:bg-orange-600 text-white text-lg font-bold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          ✏️ POW 목표 작성하기
        </button>
      </div>

      {/* 필터 */}
      <div className="space-y-3">
        {/* 분야 필터 */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button
            onClick={() => setSelectedField('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedField === 'all'
                ? 'bg-orange-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            전체
          </button>
          {POW_FIELD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedField(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                selectedField === option.value
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* 기간 필터 */}
        <div className="flex gap-2">
          {[
            { value: 'today', label: '오늘' },
            { value: 'week', label: '이번주' },
            { value: 'month', label: '이번달' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setDateFilter(option.value as typeof dateFilter)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                dateFilter === option.value
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* POW 기록 목록 */}
      <PowRecordList fieldFilter={selectedField} dateFilter={dateFilter} />

      {/* POW 목표 작성 모달 */}
      {showGoalForm && <PowGoalForm onClose={() => setShowGoalForm(false)} />}
    </div>
  );
}

export default function MyPowPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    }>
      <MyPowContent />
    </Suspense>
  );
}
