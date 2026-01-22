'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = usePowStore();

  useEffect(() => {
    // Check for session in URL (from OAuth callback)
    const sessionParam = searchParams.get('session');

    if (sessionParam) {
      try {
        const sessionData = JSON.parse(atob(sessionParam));
        setUser(sessionData.user);
        // Clean URL and redirect
        window.history.replaceState({}, '', '/my-pow');
        router.push('/my-pow');
        return;
      } catch (e) {
        console.error('Failed to parse session:', e);
      }
    }

    // Redirect based on login status
    if (user) {
      router.push('/my-pow');
    } else {
      router.push('/login');
    }
  }, [user, setUser, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-orange-500 mb-4">Citadel POW</h1>
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent mx-auto"></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-orange-500 mb-4">Citadel POW</h1>
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent mx-auto"></div>
        </div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
