'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { createClient } from '@/lib/supabase/client';
import { ROLE_BORDER_COLORS, ROLE_NAMES } from '@/constants';
import { formatNumber, formatTime } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser } = usePowStore();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [groupPowNotifications, setGroupPowNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch latest user data from database
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

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
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [user?.id, setUser]);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="text-6xl mb-4">👤</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          로그인이 필요합니다
        </h1>
        <button
          onClick={() => router.push('/login')}
          className="mt-4 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg transition-colors"
        >
          디스코드 로그인
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  const borderColor = ROLE_BORDER_COLORS[user.role_status];
  const roleName = ROLE_NAMES[user.role_status];

  const handleLogout = () => {
    if (confirm('정말 로그아웃 하시겠습니까?')) {
      setUser(null);
      router.push('/login');
    }
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        alert('알림이 활성화되었습니다!');
      } else {
        alert('알림 권한이 거부되었습니다. 브라우저 설정에서 활성화해주세요.');
      }
    }
  };

  return (
    <div className="py-4 space-y-6">
      {/* 프로필 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">👤 프로필</h2>
        <div className="flex items-center gap-4">
          <div
            className="relative rounded-full p-1"
            style={{ backgroundColor: borderColor }}
          >
            <img
              src={user.discord_avatar_url || '/default-avatar.png'}
              alt={user.discord_username}
              className="w-20 h-20 rounded-full bg-gray-200"
            />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {user.discord_username}
            </p>
            <p className="text-sm" style={{ color: borderColor }}>
              {roleName}
            </p>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">📊 개인 통계</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">총 기부금</p>
            <p className="text-xl font-bold text-orange-500">
              {formatNumber(user.total_donated_sats)} sats
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">총 POW 시간</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {formatTime(user.total_pow_time)}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">적립금</p>
            <p className="text-xl font-bold text-blue-500">
              {formatNumber(user.accumulated_sats)} sats
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">가입일</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {new Date(user.created_at).toLocaleDateString('ko-KR')}
            </p>
          </div>
        </div>
      </section>

      {/* 알림 설정 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">🔔 알림 설정</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">푸시 알림</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                POW 목표 달성 시 알림
              </p>
            </div>
            <button
              onClick={requestNotificationPermission}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                notificationsEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  notificationsEnabled ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">그룹 POW 알림</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                그룹 POW 시작 및 출석체크 알림
              </p>
            </div>
            <button
              onClick={() => setGroupPowNotifications(!groupPowNotifications)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                groupPowNotifications ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                  groupPowNotifications ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </section>

      {/* 앱 설정 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">⚙️ 앱 설정</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-medium text-gray-900 dark:text-white">언어</p>
            <select className="px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white border-0">
              <option value="ko">한국어</option>
              <option value="en" disabled>English (준비 중)</option>
            </select>
          </div>
        </div>
      </section>

      {/* 정보 */}
      <section className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">ℹ️ 정보</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">앱 버전</span>
            <span className="text-gray-900 dark:text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">문의</span>
            <a
              href="https://discord.gg/citadel"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:underline"
            >
              Discord 서버
            </a>
          </div>
        </div>
      </section>

      {/* 로그아웃 */}
      <button
        onClick={handleLogout}
        className="w-full py-4 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors"
      >
        🚪 로그아웃
      </button>
    </div>
  );
}
