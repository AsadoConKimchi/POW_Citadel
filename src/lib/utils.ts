import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { TIME } from '@/constants';

// Tailwind 클래스 병합
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 초를 시:분:초 형태로 변환
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / TIME.SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % TIME.SECONDS_PER_HOUR) / TIME.SECONDS_PER_MINUTE);
  const secs = seconds % TIME.SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// 초를 (00시간)00분 00초 형태로 변환
export function formatTimeKorean(seconds: number): string {
  const hours = Math.floor(seconds / TIME.SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % TIME.SECONDS_PER_HOUR) / TIME.SECONDS_PER_MINUTE);
  const secs = seconds % TIME.SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `(${hours.toString().padStart(2, '0')}시간)${minutes.toString().padStart(2, '0')}분 ${secs.toString().padStart(2, '0')}초`;
  }
  return `${minutes.toString().padStart(2, '0')}분 ${secs.toString().padStart(2, '0')}초`;
}

// 시:분을 초로 변환
export function timeToSeconds(hours: number, minutes: number): number {
  return hours * TIME.SECONDS_PER_HOUR + minutes * TIME.SECONDS_PER_MINUTE;
}

// 달성률 계산 (최대 100%)
export function calculateAchievementRate(goalTime: number, actualTime: number): number {
  if (goalTime <= 0) return 0;
  const rate = (actualTime / goalTime) * 100;
  return Math.min(100, Math.round(rate * 10) / 10); // 소수점 첫째자리
}

// 기부금 계산 (반올림)
export function calculateActualSats(targetSats: number, achievementRate: number): number {
  return Math.round(targetSats * (achievementRate / 100));
}

// 숫자에 천 단위 콤마 추가
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

// 날짜 포맷 (YYYY년MM월DD일)
export function formatDateKorean(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}년${month}월${day}일`;
}

// 날짜 + 시간 포맷
export function formatDateTimeKorean(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDateKorean(d);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

// ===== KST 시간대 유틸리티 =====
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // UTC+9 (밀리초)

// 현재 시간을 KST 기준으로 가져오기
export function getKSTNow(): Date {
  const now = new Date();
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcTime + KST_OFFSET_MS);
}

// KST 날짜를 UTC로 변환 (DB 쿼리용)
export function kstToUTC(kstDate: Date): Date {
  return new Date(kstDate.getTime() - KST_OFFSET_MS);
}

// 리더보드 주간 시작일 (일요일 19:00 KST ~ 차주 일요일 18:59 KST)
export function getLeaderboardWeekStart(): Date {
  const kstNow = getKSTNow();
  const dayOfWeek = kstNow.getDay();

  const weekStart = new Date(kstNow);
  weekStart.setDate(kstNow.getDate() - dayOfWeek);
  weekStart.setHours(TIME.LEADERBOARD_RESET_HOUR, 0, 0, 0);

  // 아직 일요일 19:00가 안 됐으면 저번 주 일요일
  if (kstNow < weekStart) {
    weekStart.setDate(weekStart.getDate() - 7);
  }

  // UTC로 변환하여 반환 (DB 쿼리용)
  return kstToUTC(weekStart);
}

// 캘린더 주간 시작일 (일요일 00:00 KST ~ 토요일 23:59 KST)
export function getCalendarWeekStart(): Date {
  const kstNow = getKSTNow();
  const dayOfWeek = kstNow.getDay();

  const weekStart = new Date(kstNow);
  weekStart.setDate(kstNow.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);

  // UTC로 변환하여 반환 (DB 쿼리용)
  return kstToUTC(weekStart);
}

// 캘린더 주간 종료일 (토요일 23:59:59 KST)
export function getCalendarWeekEnd(): Date {
  const kstNow = getKSTNow();
  const dayOfWeek = kstNow.getDay();

  const weekEnd = new Date(kstNow);
  // 토요일까지 남은 일수 = 6 - 현재요일
  weekEnd.setDate(kstNow.getDate() + (6 - dayOfWeek));
  weekEnd.setHours(23, 59, 59, 999);

  // UTC로 변환하여 반환 (DB 쿼리용)
  return kstToUTC(weekEnd);
}

// 오늘 시작 (00:00 KST)
export function getTodayStart(): Date {
  const kstNow = getKSTNow();
  const todayStart = new Date(kstNow);
  todayStart.setHours(0, 0, 0, 0);
  return kstToUTC(todayStart);
}

// 이번 달 시작 (1일 00:00 KST)
export function getMonthStart(): Date {
  const kstNow = getKSTNow();
  const monthStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), 1, 0, 0, 0, 0);
  return kstToUTC(monthStart);
}

// 기존 함수명 유지 (하위 호환성)
export function getWeekStartDate(): Date {
  return getLeaderboardWeekStart();
}

// 디스코드 아바타 URL 생성
export function getDiscordAvatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) {
    // 기본 아바타
    const defaultAvatarIndex = parseInt(userId) % 5;
    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarIndex}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}

// 역할 상태 결정
export function determineRoleStatus(roles: string[]): 0 | 1 | 2 {
  const fullnoderId = process.env.DISCORD_ROLE_FULLNODER || '1456691566306656329';
  const bitcoinerId = process.env.DISCORD_ROLE_BITCOINER || '1456691252329447517';

  if (roles.includes(fullnoderId)) {
    return 2; // 풀노더
  }
  if (roles.includes(bitcoinerId)) {
    return 1; // 비트코이너
  }
  return 0; // 역할 없음
}

// 출석체크 유효 시간인지 확인
export function isAttendanceWindowOpen(plannedDate: Date): boolean {
  const now = new Date();
  const windowStart = new Date(plannedDate.getTime() - TIME.ATTENDANCE_WINDOW_MINUTES * 60000);
  const windowEnd = new Date(plannedDate.getTime() + TIME.ATTENDANCE_WINDOW_MINUTES * 60000);
  return now >= windowStart && now <= windowEnd;
}

// 로컬 스토리지 안전하게 접근
export function getLocalStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Handle quota exceeded or other errors
  }
}
