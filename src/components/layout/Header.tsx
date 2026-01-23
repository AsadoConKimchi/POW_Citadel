'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePowStore } from '@/stores/pow-store';
import { ROLE_BORDER_COLORS, ROLE_NAMES } from '@/constants';
import { cn } from '@/lib/utils';

export default function Header() {
  const { user } = usePowStore();

  const borderColor = user ? ROLE_BORDER_COLORS[user.role_status] : ROLE_BORDER_COLORS[0];
  const roleName = user ? ROLE_NAMES[user.role_status] : ROLE_NAMES[0];

  return (
    <header className="fixed top-0 left-0 right-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 z-50">
      <div className="max-w-screen-xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link href="/my-pow" className="flex flex-col">
            <span className="text-xl font-bold text-orange-500">Citadel POW</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 -mt-1">Proof of Work: Life of Satoshi</span>
          </Link>

          {/* User Profile */}
          {user ? (
            <Link href="/settings" className="flex items-center gap-2">
              <div
                className={cn('relative rounded-full p-0.5')}
                style={{ backgroundColor: borderColor }}
              >
                <Image
                  src={user.discord_avatar_url || '/default-avatar.png'}
                  alt={user.discord_username}
                  width={36}
                  height={36}
                  className="rounded-full bg-gray-200"
                />
              </div>
              <div className="hidden sm:block text-sm">
                <p className="font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
                  {user.discord_username}
                </p>
                <p className="text-xs" style={{ color: borderColor }}>
                  {roleName}
                </p>
              </div>
            </Link>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white text-sm font-medium rounded-lg transition-colors"
            >
              디스코드 로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
