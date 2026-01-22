// POW 분야
export type PowField = 'video' | 'art' | 'music' | 'writing' | 'study' | 'reading' | 'volunteer';

// POW 모드
export type PowMode = 'immediate' | 'accumulated';

// POW 상태
export type PowStatus =
  | 'in_progress'
  | 'completed'
  | 'donated_immediate'
  | 'accumulated'
  | 'donated_from_accumulated';

// 그룹 POW 상태
export type GroupPowStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

// 사용자 역할 상태
export type RoleStatus = 0 | 1 | 2; // 0=none, 1=bitcoiner, 2=fullnoder

// 사용자
export interface User {
  id: string;
  discord_id: string;
  discord_username: string;
  discord_avatar_url: string | null;
  discord_roles: string[];
  role_status: RoleStatus;
  accumulated_sats: number;
  total_donated_sats: number;
  total_pow_time: number; // seconds
  created_at: string;
  updated_at: string;
}

// POW 기록
export interface PowRecord {
  id: string;
  user_id: string;
  field: PowField;
  goal_content: string;
  goal_time: number; // seconds
  actual_time: number; // seconds
  achievement_rate: number; // percentage
  target_sats: number;
  actual_sats: number;
  mode: PowMode;
  status: PowStatus;
  group_pow_id: string | null;
  memo: string | null;
  image_url: string | null;
  discord_message_id: string | null;
  started_at: string;
  paused_at: string | null;
  total_paused_time: number;
  completed_at: string | null;
  donated_at: string | null;
  created_at: string;
}

// 분야별 기부 기록
export interface FieldDonation {
  id: string;
  user_id: string;
  pow_record_id: string | null;
  field: PowField;
  donated_sats: number;
  mode: PowMode;
  created_at: string;
}

// 그룹 POW
export interface GroupPow {
  id: string;
  creator_id: string;
  title: string;
  field: PowField;
  description: string | null;
  thumbnail_url: string | null;
  planned_date: string;
  planned_duration: number; // seconds
  actual_duration: number | null;
  achievement_rate: number | null;
  target_sats: number;
  actual_sats_collected: number;
  status: GroupPowStatus;
  pow_record_id: string | null;
  discord_message_id: string | null;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
  cancelled_at: string | null;
}

// 그룹 POW 참여자
export interface GroupPowParticipant {
  id: string;
  group_pow_id: string;
  user_id: string;
  pledged_sats: number;
  actual_sats: number | null;
  attendance_checked: boolean;
  attendance_checked_at: string | null;
  invoice_id: string | null;
  invoice_paid: boolean;
  invoice_paid_at: string | null;
  created_at: string;
}

// 디스코드 반응
export interface DiscordReaction {
  id: string;
  pow_record_id: string;
  discord_message_id: string;
  total_reactions: number;
  reaction_details: Record<string, number>;
  last_updated_at: string;
}

// 리더보드 기록
export interface LeaderboardHistory {
  id: string;
  week_start: string;
  week_end: string;
  leaderboard_type: 'total_donation' | 'field_donation' | 'total_time' | 'field_time';
  field: PowField | null;
  rankings: LeaderboardRanking[];
  created_at: string;
}

export interface LeaderboardRanking {
  user_id: string;
  username: string;
  avatar_url: string | null;
  value: number;
  rank: number;
}

// 리더보드 항목 (현재)
export interface LeaderboardEntry {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role_status: RoleStatus;
  value: number;
  rank: number;
}

// 인기 POW 항목
export interface PopularPowEntry {
  pow_record: PowRecord;
  user: User;
  total_reactions: number;
  reaction_details: Record<string, number>;
}

// POW 목표 생성 폼
export interface PowGoalForm {
  field: PowField;
  goalContent: string;
  goalTime: number; // seconds
  targetSats: number;
  mode: PowMode;
}

// 그룹 POW 생성 폼
export interface GroupPowForm {
  title: string;
  field: PowField;
  description: string;
  thumbnailFile: File | null;
  plannedDate: Date;
  plannedDuration: number; // seconds
  targetSats: number;
}

// Blink Invoice 응답
export interface BlinkInvoice {
  paymentRequest: string;
  paymentHash: string;
  expiresAt: string;
}

// Blink Invoice 상태
export interface BlinkInvoiceStatus {
  paid: boolean;
  confirmedAt: string | null;
}

// 디스코드 사용자 정보
export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
}

// 디스코드 길드 멤버 정보
export interface DiscordGuildMember {
  user: DiscordUser;
  roles: string[];
}

// 세션
export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
