'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = usePowStore();
  const error = searchParams.get('error');

  // 이미 로그인된 경우 리다이렉트
  useEffect(() => {
    if (user) {
      router.push('/my-pow');
    }
  }, [user, router]);

  const handleDiscordLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
    const redirectUri = `${window.location.origin}/callback`;
    const scope = 'identify guilds.members.read';

    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}`;

    window.location.href = discordAuthUrl;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-orange-500 mb-2">Citadel POW</h1>
          <p className="text-gray-600 dark:text-gray-400">
            POW 활동을 기록하고 비트코인을 기부하세요
          </p>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error === 'no_role' && '디스코드 서버에서 역할을 받아주세요.'}
            {error === 'auth_failed' && '로그인에 실패했습니다. 다시 시도해주세요.'}
            {!['no_role', 'auth_failed'].includes(error) && '오류가 발생했습니다.'}
          </div>
        )}

        {/* 로그인 카드 */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
          <div className="space-y-4">
            <p className="text-center text-gray-600 dark:text-gray-400 text-sm">
              Citadel 디스코드 서버 회원만 이용 가능합니다
            </p>

            <button
              onClick={handleDiscordLogin}
              className="w-full flex items-center justify-center gap-3 py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-xl transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              디스코드로 로그인
            </button>
          </div>
        </div>

        {/* 안내 사항 */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>로그인 시 다음 정보에 접근합니다:</p>
          <ul className="mt-2 space-y-1">
            <li>• 디스코드 프로필 정보</li>
            <li>• 서버 역할 정보</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
