-- ============================================
-- 007: 멀티테넌트 SaaS 재설계 (Phase 13R)
-- 역할: super_admin / instructor / student
-- 데이터 격리: instructor_id 기반
-- 실행: Supabase SQL Editor에 이 파일 내용을 복사하여 실행
-- ============================================

-- ============================================
-- 1. profiles 테이블 수정
-- ============================================

-- 기존 role CHECK 제약조건 제거 후 새 제약조건 추가
-- (기존: 'user', 'admin' → 새: 'super_admin', 'instructor', 'student')
DO $$
BEGIN
  -- 기존 role 체크 제약조건 찾아서 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%role%'
    AND constraint_schema = 'public'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE profiles DROP CONSTRAINT ' || constraint_name
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%role%'
      AND constraint_schema = 'public'
      LIMIT 1
    );
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 기존 데이터 마이그레이션: user → student, admin → super_admin
UPDATE profiles SET role = 'student' WHERE role = 'user';
UPDATE profiles SET role = 'super_admin' WHERE role = 'admin';

-- 새 CHECK 제약조건 추가
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'instructor', 'student'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- DEFAULT 변경
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'student';

-- 새 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS invite_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_email TEXT;

-- invite_code UNIQUE 제약조건 (안전하게)
DO $$
BEGIN
  ALTER TABLE profiles ADD CONSTRAINT profiles_invite_code_unique UNIQUE (invite_code);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- is_onboarded 이미 존재하지만 혹시 없을 경우
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN DEFAULT false;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_instructor_id ON profiles(instructor_id);
CREATE INDEX IF NOT EXISTS idx_profiles_invite_code ON profiles(invite_code);

-- ============================================
-- 2. uploaded_resumes 테이블 확장
-- (이미 존재, 컬럼 추가)
-- ============================================
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS ai_review_id UUID;
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- file_type CHECK 업데이트 (hwp 추가)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'uploaded_resumes_file_type_check'
  ) THEN
    ALTER TABLE uploaded_resumes DROP CONSTRAINT uploaded_resumes_file_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE uploaded_resumes ADD CONSTRAINT uploaded_resumes_file_type_check
    CHECK (file_type IN ('pdf', 'docx', 'hwp', 'txt', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_uploaded_resumes_instructor_id ON uploaded_resumes(instructor_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_resumes_status ON uploaded_resumes(status);

-- ============================================
-- 3. uploaded_cover_letters 테이블 확장
-- (이미 존재, 컬럼 추가)
-- ============================================
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS target_company TEXT;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS ai_review_id UUID;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- file_type CHECK 업데이트
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'uploaded_cover_letters_file_type_check'
  ) THEN
    ALTER TABLE uploaded_cover_letters DROP CONSTRAINT uploaded_cover_letters_file_type_check;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE uploaded_cover_letters ADD CONSTRAINT uploaded_cover_letters_file_type_check
    CHECK (file_type IN ('pdf', 'docx', 'hwp', 'txt', 'other'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_uploaded_cover_letters_instructor_id ON uploaded_cover_letters(instructor_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_cover_letters_status ON uploaded_cover_letters(status);

-- ============================================
-- 4. ai_review_results 테이블 확장
-- (이미 존재, 컬럼 추가)
-- ============================================
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS original_content TEXT;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS revised_content TEXT;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS score INTEGER;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS model_used TEXT DEFAULT 'gemini-2.5-flash';
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS tokens_used INTEGER;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS processing_time INTEGER;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES profiles(id);

-- score CHECK 제약조건
DO $$
BEGIN
  ALTER TABLE ai_review_results ADD CONSTRAINT ai_review_results_score_check
    CHECK (score BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_ai_review_results_instructor_id ON ai_review_results(instructor_id);

-- ============================================
-- 5. counseling_records 테이블 확장
-- (이미 존재: user_id=student, counselor_id=instructor)
-- instructor_id 추가, 기존 counselor_id 데이터 복사
-- ============================================
ALTER TABLE counseling_records ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);

-- 기존 counselor_id 데이터를 instructor_id로 복사
UPDATE counseling_records
SET instructor_id = counselor_id
WHERE instructor_id IS NULL AND counselor_id IS NOT NULL;

-- type 컬럼 추가 (counseling_type과 별도, 스펙에 맞춤)
-- counseling_type은 이미 존재 (005에서 추가), 그대로 유지

CREATE INDEX IF NOT EXISTS idx_counseling_records_instructor_id ON counseling_records(instructor_id);

-- ============================================
-- 6. resume_data 테이블 확장
-- (이미 존재, instructor_id 추가)
-- ============================================
ALTER TABLE resume_data ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES profiles(id);

-- ============================================
-- 7. cover_letter_data 테이블 (신규)
-- ============================================
CREATE TABLE IF NOT EXISTS cover_letter_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  instructor_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL DEFAULT '자기소개서',
  target_company TEXT,
  growth TEXT,
  personality TEXT,
  motivation TEXT,
  aspiration TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cover_letter_data_user_id ON cover_letter_data(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letter_data_instructor_id ON cover_letter_data(instructor_id);

-- updated_at 트리거
DO $$
BEGIN
  CREATE TRIGGER cover_letter_data_updated_at
    BEFORE UPDATE ON cover_letter_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 8. email_logs 테이블 (신규)
-- ============================================
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instructor_id UUID REFERENCES profiles(id) NOT NULL,
  student_id UUID REFERENCES profiles(id) NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('ai_review', 'counseling', 'custom')),
  document_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_logs_instructor_id ON email_logs(instructor_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_student_id ON email_logs(student_id);

-- ============================================
-- 9. RLS 헬퍼 함수
-- ============================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_instructor()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'instructor');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_instructor_id()
RETURNS UUID AS $$
  SELECT CASE
    WHEN role = 'instructor' THEN id
    WHEN role = 'student' THEN instructor_id
    ELSE NULL
  END
  FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 기존 is_admin() 함수 재정의 (super_admin에 매핑)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 10. RLS 정책 — profiles (기존 모두 DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_select_own" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_update_own" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_insert_own" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_select_public" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_select" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_instructor_read_students" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_instructor_create_student" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_instructor_update_student" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "profiles_super_admin_all" ON profiles; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 본인 프로필 조회/수정
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 강사: 본인 소속 학생 프로필 조회
CREATE POLICY "profiles_instructor_read_students" ON profiles
  FOR SELECT USING (
    is_instructor() AND instructor_id = auth.uid()
  );

-- 강사: 학생 등록 (INSERT)
CREATE POLICY "profiles_instructor_create_student" ON profiles
  FOR INSERT WITH CHECK (
    is_instructor() AND instructor_id = auth.uid() AND role = 'student'
  );

-- 강사: 본인 소속 학생 정보 수정
CREATE POLICY "profiles_instructor_update_student" ON profiles
  FOR UPDATE USING (
    is_instructor() AND instructor_id = auth.uid()
  );

-- super_admin: 전체 조회/수정
CREATE POLICY "profiles_super_admin_all" ON profiles
  FOR ALL USING (is_super_admin());

-- 회원가입시 본인 프로필 INSERT 허용
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 공개 프로필 조회 (is_public=true)
CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (is_public = true);

-- ============================================
-- 11. RLS 정책 — uploaded_resumes (DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_select" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_insert" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_delete" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_admin_insert" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_admin_update" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_student_select" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_student_insert" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_student_update" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_instructor_all" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_resumes_super_admin_all" ON uploaded_resumes; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE uploaded_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploaded_resumes_student_select" ON uploaded_resumes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uploaded_resumes_student_insert" ON uploaded_resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploaded_resumes_student_update" ON uploaded_resumes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "uploaded_resumes_instructor_all" ON uploaded_resumes
  FOR ALL USING (is_instructor() AND instructor_id = auth.uid());
CREATE POLICY "uploaded_resumes_super_admin_all" ON uploaded_resumes
  FOR ALL USING (is_super_admin());

-- ============================================
-- 11-B. RLS 정책 — uploaded_cover_letters (DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_select" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_insert" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_delete" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_admin_insert" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_admin_update" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_student_select" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_student_insert" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_student_update" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_instructor_all" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "uploaded_cover_letters_super_admin_all" ON uploaded_cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE uploaded_cover_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uploaded_cover_letters_student_select" ON uploaded_cover_letters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "uploaded_cover_letters_student_insert" ON uploaded_cover_letters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploaded_cover_letters_student_update" ON uploaded_cover_letters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "uploaded_cover_letters_instructor_all" ON uploaded_cover_letters
  FOR ALL USING (is_instructor() AND instructor_id = auth.uid());
CREATE POLICY "uploaded_cover_letters_super_admin_all" ON uploaded_cover_letters
  FOR ALL USING (is_super_admin());

-- ============================================
-- 11-C. RLS 정책 — ai_review_results (DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_select" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_insert" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_update" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_delete" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_student_select" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_student_insert" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_student_update" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_instructor_all" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_review_results_super_admin_all" ON ai_review_results; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE ai_review_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_review_results_student_select" ON ai_review_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_review_results_student_insert" ON ai_review_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_review_results_student_update" ON ai_review_results
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ai_review_results_instructor_all" ON ai_review_results
  FOR ALL USING (is_instructor() AND instructor_id = auth.uid());
CREATE POLICY "ai_review_results_super_admin_all" ON ai_review_results
  FOR ALL USING (is_super_admin());

-- ============================================
-- 11-D. RLS 정책 — resume_data (DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_select_own" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_insert_own" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_update_own" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_delete_own" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_admin_select" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_student_select" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_student_insert" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_student_update" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_instructor_all" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "resume_data_super_admin_all" ON resume_data; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "resume_data_student_select" ON resume_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resume_data_student_insert" ON resume_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resume_data_student_update" ON resume_data
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "resume_data_instructor_all" ON resume_data
  FOR ALL USING (is_instructor() AND instructor_id = auth.uid());
CREATE POLICY "resume_data_super_admin_all" ON resume_data
  FOR ALL USING (is_super_admin());

-- ============================================
-- 11-E. RLS 정책 — cover_letter_data (신규 테이블)
-- ============================================
ALTER TABLE cover_letter_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cover_letter_data_student_select" ON cover_letter_data
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cover_letter_data_student_insert" ON cover_letter_data
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cover_letter_data_student_update" ON cover_letter_data
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "cover_letter_data_instructor_all" ON cover_letter_data
  FOR ALL USING (is_instructor() AND instructor_id = auth.uid());
CREATE POLICY "cover_letter_data_super_admin_all" ON cover_letter_data
  FOR ALL USING (is_super_admin());

-- ============================================
-- 12. RLS 정책 — counseling_records (DROP 후 재생성)
-- ============================================
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_records_select" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_records_insert" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_records_update" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_records_delete" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_student_select" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_instructor_all" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "counseling_super_admin_all" ON counseling_records; EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE counseling_records ENABLE ROW LEVEL SECURITY;

-- 학생: 본인 상담 기록 조회만 (user_id = auth.uid())
CREATE POLICY "counseling_student_select" ON counseling_records
  FOR SELECT USING (auth.uid() = user_id);

-- 강사: 본인 소속 학생 상담만 CRUD
CREATE POLICY "counseling_instructor_all" ON counseling_records
  FOR ALL USING (
    is_instructor() AND instructor_id = auth.uid()
  );

-- super_admin: 전체
CREATE POLICY "counseling_super_admin_all" ON counseling_records
  FOR ALL USING (is_super_admin());

-- ============================================
-- 13. RLS 정책 — email_logs (신규 테이블)
-- ============================================
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- 강사: 본인이 발송한 이메일만
CREATE POLICY "email_logs_instructor_all" ON email_logs
  FOR ALL USING (
    is_instructor() AND instructor_id = auth.uid()
  );

-- super_admin: 전체
CREATE POLICY "email_logs_super_admin_all" ON email_logs
  FOR ALL USING (is_super_admin());

-- ============================================
-- 14. 기존 학생 테이블 RLS 수정 — 강사/super_admin 조회 권한 추가
-- (기존 SELECT 정책을 DROP 후 재생성, 기존 INSERT/UPDATE/DELETE 유지)
-- ============================================

-- --- roadmap_goals ---
DO $$ BEGIN DROP POLICY IF EXISTS "goals_select" ON roadmap_goals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "goals_select_own" ON roadmap_goals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "roadmap_goals_instructor_read" ON roadmap_goals; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "roadmap_goals_super_admin_read" ON roadmap_goals; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "goals_select" ON roadmap_goals
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "roadmap_goals_instructor_read" ON roadmap_goals
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = roadmap_goals.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "roadmap_goals_super_admin_read" ON roadmap_goals
  FOR SELECT USING (is_super_admin());

-- --- milestones ---
DO $$ BEGIN DROP POLICY IF EXISTS "milestones_select" ON milestones; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "milestones_select_own" ON milestones; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "milestones_instructor_read" ON milestones; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "milestones_super_admin_read" ON milestones; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "milestones_select" ON milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
  );
CREATE POLICY "milestones_instructor_read" ON milestones
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM roadmap_goals
      JOIN profiles ON profiles.id = roadmap_goals.user_id
      WHERE roadmap_goals.id = milestones.goal_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "milestones_super_admin_read" ON milestones
  FOR SELECT USING (is_super_admin());

-- --- daily_logs ---
DO $$ BEGIN DROP POLICY IF EXISTS "logs_select" ON daily_logs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "logs_select_own" ON daily_logs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "daily_logs_instructor_read" ON daily_logs; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "daily_logs_super_admin_read" ON daily_logs; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "logs_select" ON daily_logs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "daily_logs_instructor_read" ON daily_logs
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = daily_logs.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "daily_logs_super_admin_read" ON daily_logs
  FOR SELECT USING (is_super_admin());

-- --- daily_tasks ---
DO $$ BEGIN DROP POLICY IF EXISTS "tasks_select" ON daily_tasks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "tasks_select_own" ON daily_tasks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "daily_tasks_instructor_read" ON daily_tasks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "daily_tasks_super_admin_read" ON daily_tasks; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "tasks_select" ON daily_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
  );
CREATE POLICY "daily_tasks_instructor_read" ON daily_tasks
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM daily_logs
      JOIN profiles ON profiles.id = daily_logs.user_id
      WHERE daily_logs.id = daily_tasks.daily_log_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "daily_tasks_super_admin_read" ON daily_tasks
  FOR SELECT USING (is_super_admin());

-- --- projects ---
DO $$ BEGIN DROP POLICY IF EXISTS "projects_select" ON projects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "projects_select_own" ON projects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "projects_instructor_read" ON projects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "projects_super_admin_read" ON projects; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_instructor_read" ON projects
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = projects.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "projects_super_admin_read" ON projects
  FOR SELECT USING (is_super_admin());

-- --- project_files ---
DO $$ BEGIN DROP POLICY IF EXISTS "files_select" ON project_files; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "files_select_own" ON project_files; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "project_files_instructor_read" ON project_files; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "project_files_super_admin_read" ON project_files; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "files_select" ON project_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );
CREATE POLICY "project_files_instructor_read" ON project_files
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM projects
      JOIN profiles ON profiles.id = projects.user_id
      WHERE projects.id = project_files.project_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "project_files_super_admin_read" ON project_files
  FOR SELECT USING (is_super_admin());

-- --- certificates ---
DO $$ BEGIN DROP POLICY IF EXISTS "certs_select" ON certificates; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "certs_select_own" ON certificates; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "certificates_instructor_read" ON certificates; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "certificates_super_admin_read" ON certificates; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "certs_select" ON certificates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "certificates_instructor_read" ON certificates
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = certificates.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "certificates_super_admin_read" ON certificates
  FOR SELECT USING (is_super_admin());

-- --- skills ---
DO $$ BEGIN DROP POLICY IF EXISTS "skills_select" ON skills; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "skills_select_own" ON skills; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "skills_instructor_read" ON skills; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "skills_super_admin_read" ON skills; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "skills_select" ON skills
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "skills_instructor_read" ON skills
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = skills.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "skills_super_admin_read" ON skills
  FOR SELECT USING (is_super_admin());

-- --- streaks ---
DO $$ BEGIN DROP POLICY IF EXISTS "streaks_select" ON streaks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "streaks_select_own" ON streaks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "streaks_instructor_read" ON streaks; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "streaks_super_admin_read" ON streaks; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "streaks_select" ON streaks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "streaks_instructor_read" ON streaks
  FOR SELECT USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = streaks.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "streaks_super_admin_read" ON streaks
  FOR SELECT USING (is_super_admin());

-- --- ai_student_analyses ---
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_select" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_insert" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_update" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_delete" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_instructor_all" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "ai_student_analyses_super_admin_all" ON ai_student_analyses; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE POLICY "ai_student_analyses_select" ON ai_student_analyses
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ai_student_analyses_instructor_all" ON ai_student_analyses
  FOR ALL USING (
    is_instructor() AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = ai_student_analyses.user_id
      AND profiles.instructor_id = auth.uid()
    )
  );
CREATE POLICY "ai_student_analyses_super_admin_all" ON ai_student_analyses
  FOR ALL USING (is_super_admin());

-- --- cover_letters (기존 자소서 테이블, 002 이전에 존재) ---
DO $$ BEGIN DROP POLICY IF EXISTS "cover_letters_select" ON cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "cover_letters_instructor_read" ON cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY IF EXISTS "cover_letters_super_admin_read" ON cover_letters; EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$
BEGIN
  -- cover_letters 테이블이 존재하는 경우에만 정책 생성
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cover_letters' AND table_schema = 'public') THEN
    EXECUTE 'CREATE POLICY "cover_letters_select" ON cover_letters FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "cover_letters_instructor_read" ON cover_letters FOR SELECT USING (
      is_instructor() AND EXISTS (
        SELECT 1 FROM profiles WHERE profiles.id = cover_letters.user_id AND profiles.instructor_id = auth.uid()
      )
    )';
    EXECUTE 'CREATE POLICY "cover_letters_super_admin_read" ON cover_letters FOR SELECT USING (is_super_admin())';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================
-- 15. Storage 버킷 안내 (Supabase 대시보드에서 수동 생성)
-- ============================================
-- Storage 버킷 생성 필요 (Supabase 대시보드):
-- 1. resumes (공개: false) — 이력서 파일
-- 2. cover-letters (공개: false) — 자소서 파일
--
-- Storage RLS:
-- 강사: 본인 소속 학생 파일 업로드/다운로드
-- 학생: 본인 파일 업로드/다운로드
-- 경로 규칙: {버킷}/{instructor_id}/{student_id}/{파일명}

-- ============================================
-- 16. Auth Trigger 수정 (handle_new_user)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, name, role, is_onboarded, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    false,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- DONE! 멀티테넌트 SaaS 재설계 마이그레이션 완료
-- 역할: super_admin / instructor / student
-- 데이터 격리: instructor_id 기반 RLS
-- ============================================
