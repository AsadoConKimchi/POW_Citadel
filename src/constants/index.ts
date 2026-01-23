import { PowField } from '@/types';

// POW 분야 정보
export const POW_FIELDS: Record<PowField, { emoji: string; label: string; labelKo: string }> = {
  video: { emoji: '🎬', label: 'Video', labelKo: '영상제작' },
  art: { emoji: '🎨', label: 'Art', labelKo: '그림' },
  music: { emoji: '🎵', label: 'Music', labelKo: '음악' },
  writing: { emoji: '✒️', label: 'Writing', labelKo: '글쓰기' },
  study: { emoji: '📝', label: 'Study', labelKo: '공부' },
  reading: { emoji: '📚', label: 'Reading', labelKo: '독서' },
  volunteer: { emoji: '✝️', label: 'Volunteer', labelKo: '봉사' },
};

// POW 분야 배열 (드롭다운용)
export const POW_FIELD_OPTIONS = Object.entries(POW_FIELDS).map(([value, { emoji, labelKo }]) => ({
  value: value as PowField,
  label: `${emoji}ㅣ${labelKo}`,
}));

// 역할별 테두리 색상
export const ROLE_BORDER_COLORS = {
  0: '#FF0000', // 빨강 - 역할 없음
  1: '#FFD700', // 노랑 - 비트코이너
  2: '#FFA500', // 주황 - 풀노더
} as const;

// 역할 이름
export const ROLE_NAMES = {
  0: '역할 없음',
  1: '비트코이너',
  2: '풀노더',
} as const;

// 디스코드 역할 ID
export const DISCORD_ROLES = {
  BITCOINER: process.env.DISCORD_ROLE_BITCOINER || '1456691252329447517',
  FULLNODER: process.env.DISCORD_ROLE_FULLNODER || '1456691566306656329',
};

// 시간 관련 상수
export const TIME = {
  SECONDS_PER_MINUTE: 60,
  SECONDS_PER_HOUR: 3600,
  LEADERBOARD_RESET_HOUR: 19, // 19:00 KST
  LEADERBOARD_RESET_DAY: 0, // Sunday
  ATTENDANCE_WINDOW_MINUTES: 15, // ±15분
};

// Lightning 지갑 딥링크
export const WALLET_DEEPLINKS = {
  walletOfSatoshi: (invoice: string) => `walletofsatoshi:${invoice}`,
  blink: (invoice: string) => `lightning:${invoice}`,
  strike: (invoice: string) => `strike:${invoice}`,
  zeus: (invoice: string) => `zeusln:${invoice}`,
};

/* 이전 딥링크 (롤백용)
export const WALLET_DEEPLINKS = {
  walletOfSatoshi: (invoice: string) => `walletofsatoshi:${invoice}`,
  blink: (invoice: string) => `blink:lightning:${invoice}`,
  strike: (invoice: string) => `strike:lightning:${invoice}`,
  zeus: (invoice: string) => `lightning:${invoice}`,
};
*/

// 지갑 목록
export const WALLET_OPTIONS = [
  { id: 'walletOfSatoshi', name: 'Wallet of Satoshi', icon: '📱' },
  { id: 'blink', name: 'Blink', icon: '⚡' },
  { id: 'strike', name: 'Strike', icon: '💵' },
  { id: 'zeus', name: 'Zeus', icon: '🔐' },
] as const;

// 앱 설정
export const APP_CONFIG = {
  MAX_MEMO_LENGTH: 100,
  MAX_GROUP_POW_TITLE_LENGTH: 50,
  MAX_GROUP_POW_DESCRIPTION_LENGTH: 500,
  INVOICE_EXPIRY_SECONDS: 300, // 5분
  BLINK_API_URL: 'https://api.blink.sv/graphql',
  DISCORD_API_URL: 'https://discord.com/api/v10',
};

// 테마 색상
export const THEME_COLORS = {
  primary: '#FF6B35',
  secondary: '#F7931A',
  success: '#00AA00',
  warning: '#FFA500',
  danger: '#FF0000',
  neutral: '#CCCCCC',
};

// 탭 네비게이션
export const TABS = [
  { id: 'my-pow', label: '나의 POW', icon: '📝', path: '/my-pow' },
  { id: 'pow-timer', label: 'POW 진행', icon: '⏱️', path: '/pow-timer' },
  { id: 'certification', label: '인증카드', icon: '🎥', path: '/certification' },
  { id: 'leaderboard', label: 'Citadel POW', icon: '🏆', path: '/leaderboard' },
  { id: 'group-pow', label: '그룹 POW', icon: '👥', path: '/group-pow' },
  { id: 'settings', label: '설정', icon: '⚙️', path: '/settings' },
] as const;

// 에러 메시지
export const ERROR_MESSAGES = {
  UNAUTHORIZED: '로그인이 필요합니다.',
  NO_ROLE: '역할 확인이 필요합니다. 디스코드 서버에서 역할을 받아주세요.',
  PERMISSION_DENIED: '이 기능을 사용할 권한이 없습니다.',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
  INVALID_INPUT: '입력 값을 확인해주세요.',
};

// 성공 메시지
export const SUCCESS_MESSAGES = {
  POW_STARTED: 'POW가 시작되었습니다!',
  POW_COMPLETED: 'POW가 완료되었습니다!',
  DONATION_COMPLETED: '기부가 완료되었습니다!',
  ACCUMULATED: 'Sats가 적립되었습니다!',
  SHARED_TO_DISCORD: '디스코드에 공유되었습니다!',
};
