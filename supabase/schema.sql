-- Citadel POW Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discord_id TEXT UNIQUE NOT NULL,
    discord_username TEXT NOT NULL,
    discord_avatar_url TEXT,
    discord_roles TEXT[] DEFAULT '{}',
    role_status INTEGER DEFAULT 0, -- 0=none, 1=bitcoiner, 2=fullnoder
    accumulated_sats INTEGER DEFAULT 0,
    total_donated_sats INTEGER DEFAULT 0,
    total_pow_time INTEGER DEFAULT 0, -- in seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_users_discord_id ON users(discord_id);

-- =====================================================
-- POW RECORDS TABLE
-- =====================================================
CREATE TYPE pow_field AS ENUM (
    'video',      -- 영상제작
    'art',        -- 그림
    'music',      -- 음악
    'writing',    -- 글쓰기
    'study',      -- 공부
    'reading',    -- 독서
    'volunteer'   -- 봉사
);

CREATE TYPE pow_mode AS ENUM (
    'immediate',   -- 즉시기부
    'accumulated'  -- 적립 후 기부
);

CREATE TYPE pow_status AS ENUM (
    'in_progress',           -- 진행 중
    'completed',             -- 완료 (기부 전)
    'donated_immediate',     -- 즉시 기부 완료
    'accumulated',           -- 적립됨
    'donated_from_accumulated' -- 적립금에서 기부 완료
);

CREATE TABLE pow_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field pow_field NOT NULL,
    goal_content TEXT NOT NULL,
    goal_time INTEGER NOT NULL, -- in seconds
    actual_time INTEGER DEFAULT 0, -- in seconds
    achievement_rate DECIMAL(5,2) DEFAULT 0, -- percentage (0.00 ~ 100.00)
    target_sats INTEGER NOT NULL,
    actual_sats INTEGER DEFAULT 0,
    mode pow_mode NOT NULL,
    status pow_status DEFAULT 'in_progress',
    group_pow_id UUID, -- NULL for personal POW
    memo TEXT, -- 한마디 (max 100 chars)
    image_url TEXT,
    discord_message_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paused_at TIMESTAMP WITH TIME ZONE, -- when paused
    total_paused_time INTEGER DEFAULT 0, -- accumulated pause time in seconds
    completed_at TIMESTAMP WITH TIME ZONE,
    donated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pow_records_user_id ON pow_records(user_id);
CREATE INDEX idx_pow_records_status ON pow_records(status);
CREATE INDEX idx_pow_records_field ON pow_records(field);
CREATE INDEX idx_pow_records_created_at ON pow_records(created_at);

-- =====================================================
-- FIELD DONATIONS TABLE (for tracking donations by field)
-- =====================================================
CREATE TABLE field_donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pow_record_id UUID REFERENCES pow_records(id) ON DELETE SET NULL,
    field pow_field NOT NULL,
    donated_sats INTEGER NOT NULL,
    mode pow_mode NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_field_donations_user_id ON field_donations(user_id);
CREATE INDEX idx_field_donations_field ON field_donations(field);

-- =====================================================
-- GROUP POW TABLE
-- =====================================================
CREATE TYPE group_pow_status AS ENUM (
    'upcoming',   -- 예정
    'ongoing',    -- 진행 중
    'completed',  -- 완료
    'cancelled'   -- 취소
);

CREATE TABLE group_pows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    field pow_field NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    planned_date TIMESTAMP WITH TIME ZONE NOT NULL,
    planned_duration INTEGER NOT NULL, -- in seconds
    actual_duration INTEGER, -- in seconds
    achievement_rate DECIMAL(5,2),
    target_sats INTEGER NOT NULL,
    actual_sats_collected INTEGER DEFAULT 0,
    status group_pow_status DEFAULT 'upcoming',
    pow_record_id UUID REFERENCES pow_records(id), -- creator's certification card
    discord_message_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_group_pows_status ON group_pows(status);
CREATE INDEX idx_group_pows_planned_date ON group_pows(planned_date);

-- =====================================================
-- GROUP POW PARTICIPANTS TABLE
-- =====================================================
CREATE TABLE group_pow_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_pow_id UUID NOT NULL REFERENCES group_pows(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pledged_sats INTEGER NOT NULL,
    actual_sats INTEGER,
    attendance_checked BOOLEAN DEFAULT FALSE,
    attendance_checked_at TIMESTAMP WITH TIME ZONE,
    invoice_id TEXT,
    invoice_paid BOOLEAN DEFAULT FALSE,
    invoice_paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(group_pow_id, user_id)
);

CREATE INDEX idx_group_pow_participants_group_id ON group_pow_participants(group_pow_id);
CREATE INDEX idx_group_pow_participants_user_id ON group_pow_participants(user_id);

-- =====================================================
-- DISCORD REACTIONS TABLE (for Popular POW tracking)
-- =====================================================
CREATE TABLE discord_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pow_record_id UUID NOT NULL REFERENCES pow_records(id) ON DELETE CASCADE,
    discord_message_id TEXT NOT NULL,
    total_reactions INTEGER DEFAULT 0,
    reaction_details JSONB DEFAULT '{}', -- {"👍": 5, "❤️": 3, ...}
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_discord_reactions_pow_record_id ON discord_reactions(pow_record_id);
CREATE INDEX idx_discord_reactions_total ON discord_reactions(total_reactions DESC);

-- =====================================================
-- LEADERBOARD HISTORY TABLE (for weekly archives)
-- =====================================================
CREATE TABLE leaderboard_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    leaderboard_type TEXT NOT NULL, -- 'total_donation', 'field_donation', 'total_time', 'field_time'
    field pow_field, -- NULL for total leaderboards
    rankings JSONB NOT NULL, -- [{"user_id": "...", "username": "...", "value": 1000, "rank": 1}, ...]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_history_week ON leaderboard_history(week_start, week_end);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update user's updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate achievement rate
CREATE OR REPLACE FUNCTION calculate_achievement_rate(goal_time INTEGER, actual_time INTEGER)
RETURNS DECIMAL(5,2) AS $$
BEGIN
    IF goal_time <= 0 THEN
        RETURN 0;
    END IF;
    RETURN LEAST(100.00, ROUND((actual_time::DECIMAL / goal_time::DECIMAL) * 100, 1));
END;
$$ LANGUAGE plpgsql;

-- Function to calculate actual sats based on achievement rate
CREATE OR REPLACE FUNCTION calculate_actual_sats(target_sats INTEGER, achievement_rate DECIMAL)
RETURNS INTEGER AS $$
BEGIN
    RETURN ROUND(target_sats * (achievement_rate / 100));
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pow_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_pows ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_pow_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE discord_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_history ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all users" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (true); -- Will be restricted by app logic

CREATE POLICY "Service role can insert users" ON users
    FOR INSERT WITH CHECK (true);

-- POW records policies
CREATE POLICY "Anyone can view POW records" ON pow_records
    FOR SELECT USING (true);

CREATE POLICY "Users can insert own POW records" ON pow_records
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own POW records" ON pow_records
    FOR UPDATE USING (true);

-- Field donations policies
CREATE POLICY "Anyone can view field donations" ON field_donations
    FOR SELECT USING (true);

CREATE POLICY "Users can insert field donations" ON field_donations
    FOR INSERT WITH CHECK (true);

-- Group POWs policies
CREATE POLICY "Anyone can view group POWs" ON group_pows
    FOR SELECT USING (true);

CREATE POLICY "Fullnoders can create group POWs" ON group_pows
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Creators can update their group POWs" ON group_pows
    FOR UPDATE USING (true);

-- Group POW participants policies
CREATE POLICY "Anyone can view participants" ON group_pow_participants
    FOR SELECT USING (true);

CREATE POLICY "Users can join group POWs" ON group_pow_participants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own participation" ON group_pow_participants
    FOR UPDATE USING (true);

-- Discord reactions policies
CREATE POLICY "Anyone can view reactions" ON discord_reactions
    FOR SELECT USING (true);

CREATE POLICY "Service can manage reactions" ON discord_reactions
    FOR ALL USING (true);

-- Leaderboard history policies
CREATE POLICY "Anyone can view leaderboard history" ON leaderboard_history
    FOR SELECT USING (true);

CREATE POLICY "Service can manage leaderboard history" ON leaderboard_history
    FOR ALL USING (true);

-- =====================================================
-- SYNC LOGS TABLE (for rate limiting)
-- =====================================================
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT UNIQUE NOT NULL, -- 'discord_reactions', etc.
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sync_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sync logs" ON sync_logs
    FOR SELECT USING (true);

CREATE POLICY "Service can manage sync logs" ON sync_logs
    FOR ALL USING (true);
