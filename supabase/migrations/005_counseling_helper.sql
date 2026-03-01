-- 005_counseling_helper.sql
-- 개별상담도우미 기능을 위한 마이그레이션

-- 1. counseling_records 테이블에 컬럼 추가
ALTER TABLE counseling_records
  ADD COLUMN IF NOT EXISTS counseling_type TEXT DEFAULT 'other'
    CHECK (counseling_type IN ('career','resume','interview','mental','other')),
  ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS action_items TEXT,
  ADD COLUMN IF NOT EXISTS next_counseling_date DATE,
  ADD COLUMN IF NOT EXISTS ai_suggestion JSONB;

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_counseling_records_type ON counseling_records(counseling_type);
CREATE INDEX IF NOT EXISTS idx_counseling_records_completed ON counseling_records(is_completed);
CREATE INDEX IF NOT EXISTS idx_counseling_records_next_date ON counseling_records(next_counseling_date);
CREATE INDEX IF NOT EXISTS idx_counseling_records_date ON counseling_records(counseling_date DESC);
