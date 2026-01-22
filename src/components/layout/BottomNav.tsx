'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TABS } from '@/constants';
import { usePowStore } from '@/stores/pow-store';

export default function BottomNav() {
  const pathname = usePathname();
  const { timer } = usePowStore();

  // 타이머가 실행 중이면 pow-timer 탭 강조
  const isTimerActive = timer.isRunning;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-50">
      <div className="max-w-screen-xl mx-auto px-2">
        <div className="flex justify-around items-center h-16">
          {TABS.map((tab) => {
            const isActive = pathname === tab.path || pathname.startsWith(tab.path + '/');
            const showPulse = tab.id === 'pow-timer' && isTimerActive && !isActive;

            return (
              <Link
                key={tab.id}
                href={tab.path}
                className={cn(
                  'flex flex-col items-center justify-center w-full h-full px-1 py-2 text-xs transition-colors',
                  isActive
                    ? 'text-orange-500 dark:text-orange-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-orange-400'
                )}
              >
                <span className={cn('text-xl relative', showPulse && 'animate-pulse')}>
                  {tab.icon}
                  {showPulse && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
                  )}
                </span>
                <span className="mt-1 truncate">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
