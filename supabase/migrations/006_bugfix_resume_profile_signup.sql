-- ============================================
-- 006 - 버그 수정: 이력서 DB 저장, 프로필 수정, 회원가입 오류
-- ============================================

-- 1. resume_data 테이블 생성 (이력서 텍스트 데이터, 1인 1이력서)
CREATE TABLE IF NOT EXISTS resume_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  target_field TEXT DEFAULT '',
  intro TEXT DEFAULT '',
  avatar_url TEXT,
  school_name TEXT DEFAULT '',
  department TEXT DEFAULT '',
  grade SMALLINT,
  enrollment_period TEXT DEFAULT '',
  gpa TEXT DEFAULT '',
  courses JSONB DEFAULT '[]'::jsonb,
  selected_cert_ids JSONB DEFAULT '[]'::jsonb,
  cert_order JSONB DEFAULT '[]'::jsonb,
  selected_project_ids JSONB DEFAULT '[]'::jsonb,
  project_order JSONB DEFAULT '[]'::jsonb,
  selected_skill_ids JSONB DEFAULT '[]'::jsonb,
  experiences JSONB DEFAULT '[]'::jsonb,
  self_pr TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- resume_data 인덱스
CREATE INDEX IF NOT EXISTS idx_resume_data_user ON resume_data(user_id);

-- resume_data updated_at 트리거
CREATE TRIGGER resume_data_updated_at
  BEFORE UPDATE ON resume_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. resume_data RLS
ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_data_select_own" ON resume_data
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "resume_data_insert_own" ON resume_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "resume_data_update_own" ON resume_data
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "resume_data_delete_own" ON resume_data
  FOR DELETE USING (auth.uid() = user_id);

-- 관리자 조회 정책
CREATE POLICY "resume_data_admin_select" ON resume_data
  FOR SELECT USING (is_admin());

-- 3. handle_new_user 트리거 수정 (ON CONFLICT 추가)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
