-- ============================================
-- 002: Admin System & Upload Tables Migration
-- ============================================
-- 모든 명령어는 IF NOT EXISTS / IF EXISTS 사용으로 멱등(idempotent) 실행 가능

-- ============================================
-- 1. profiles 테이블 수정 (먼저 컬럼 추가)
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 2. is_admin() 헬퍼 함수 (role 컬럼 추가 후 생성)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- 3. 새 테이블: uploaded_resumes
-- ============================================
CREATE TABLE IF NOT EXISTS uploaded_resumes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_resumes_user ON uploaded_resumes(user_id);

-- ============================================
-- 4. 새 테이블: uploaded_cover_letters
-- ============================================
CREATE TABLE IF NOT EXISTS uploaded_cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uploaded_cover_letters_user ON uploaded_cover_letters(user_id);

-- ============================================
-- 5. 새 테이블: ai_review_results
-- ============================================
CREATE TABLE IF NOT EXISTS ai_review_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('resume', 'cover_letter')),
  document_id UUID NOT NULL,
  overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
  improvement_points JSONB DEFAULT '[]',
  reviewer_comment TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_review_results_user ON ai_review_results(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_results_document ON ai_review_results(document_type, document_id);

-- ============================================
-- 6. 새 테이블: counseling_records
-- ============================================
CREATE TABLE IF NOT EXISTS counseling_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counselor_id UUID NOT NULL REFERENCES auth.users(id),
  title TEXT NOT NULL,
  content TEXT,
  counseling_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_counseling_records_user ON counseling_records(user_id);
CREATE INDEX IF NOT EXISTS idx_counseling_records_counselor ON counseling_records(counselor_id);

-- updated_at 트리거
DROP TRIGGER IF EXISTS counseling_records_updated_at ON counseling_records;
CREATE TRIGGER counseling_records_updated_at
  BEFORE UPDATE ON counseling_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- 7. 새 테이블 RLS 활성화 + 정책
-- ============================================

-- uploaded_resumes
ALTER TABLE uploaded_resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploaded_resumes_select" ON uploaded_resumes
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "uploaded_resumes_insert" ON uploaded_resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploaded_resumes_delete" ON uploaded_resumes
  FOR DELETE USING (auth.uid() = user_id);

-- uploaded_cover_letters
ALTER TABLE uploaded_cover_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uploaded_cover_letters_select" ON uploaded_cover_letters
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "uploaded_cover_letters_insert" ON uploaded_cover_letters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uploaded_cover_letters_delete" ON uploaded_cover_letters
  FOR DELETE USING (auth.uid() = user_id);

-- ai_review_results
ALTER TABLE ai_review_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_review_results_select" ON ai_review_results
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "ai_review_results_insert" ON ai_review_results
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "ai_review_results_update" ON ai_review_results
  FOR UPDATE USING (is_admin());
CREATE POLICY "ai_review_results_delete" ON ai_review_results
  FOR DELETE USING (is_admin());

-- counseling_records
ALTER TABLE counseling_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "counseling_records_select" ON counseling_records
  FOR SELECT USING (auth.uid() = user_id OR is_admin());
CREATE POLICY "counseling_records_insert" ON counseling_records
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "counseling_records_update" ON counseling_records
  FOR UPDATE USING (is_admin());
CREATE POLICY "counseling_records_delete" ON counseling_records
  FOR DELETE USING (is_admin());

-- ============================================
-- 8. 기존 테이블 SELECT 정책에 관리자 읽기 권한 추가
-- (양쪽 명명 규칙 모두 DROP 후 새로 생성)
-- ============================================

-- profiles SELECT
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_public = true OR is_admin());

-- profiles_select_public 정책 제거 (새 profiles_select에 is_public 조건 포함됨)
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;

-- roadmap_goals SELECT
DROP POLICY IF EXISTS "goals_select_own" ON roadmap_goals;
DROP POLICY IF EXISTS "Users can view own goals" ON roadmap_goals;
CREATE POLICY "goals_select" ON roadmap_goals
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- milestones SELECT
DROP POLICY IF EXISTS "milestones_select_own" ON milestones;
DROP POLICY IF EXISTS "Users can view own milestones" ON milestones;
CREATE POLICY "milestones_select" ON milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
    OR is_admin()
  );

-- daily_logs SELECT
DROP POLICY IF EXISTS "logs_select_own" ON daily_logs;
DROP POLICY IF EXISTS "Users can view own daily logs" ON daily_logs;
CREATE POLICY "logs_select" ON daily_logs
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- daily_tasks SELECT
DROP POLICY IF EXISTS "tasks_select_own" ON daily_tasks;
DROP POLICY IF EXISTS "Users can view own daily tasks" ON daily_tasks;
CREATE POLICY "tasks_select" ON daily_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
    OR is_admin()
  );

-- projects SELECT
DROP POLICY IF EXISTS "projects_select_own" ON projects;
DROP POLICY IF EXISTS "Users can view own projects" ON projects;
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- project_files SELECT
DROP POLICY IF EXISTS "files_select_own" ON project_files;
DROP POLICY IF EXISTS "Users can view own project files" ON project_files;
CREATE POLICY "files_select" ON project_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
    OR is_admin()
  );

-- certificates SELECT
DROP POLICY IF EXISTS "certs_select_own" ON certificates;
DROP POLICY IF EXISTS "Users can view own certificates" ON certificates;
CREATE POLICY "certs_select" ON certificates
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- skills SELECT
DROP POLICY IF EXISTS "skills_select_own" ON skills;
DROP POLICY IF EXISTS "Users can view own skills" ON skills;
CREATE POLICY "skills_select" ON skills
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- streaks SELECT
DROP POLICY IF EXISTS "streaks_select_own" ON streaks;
DROP POLICY IF EXISTS "Users can view own streak" ON streaks;
CREATE POLICY "streaks_select" ON streaks
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- cover_letters SELECT
DROP POLICY IF EXISTS "Users can view own cover letters" ON cover_letters;
CREATE POLICY "cover_letters_select" ON cover_letters
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- ============================================
-- 9. 스토리지 버킷 추가
-- ============================================
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('cover-letters', 'cover-letters', false)
  ON CONFLICT (id) DO NOTHING;

-- resumes 버킷 정책
CREATE POLICY "Users can upload resumes"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own resumes"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resumes' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
CREATE POLICY "Users can delete own resumes"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- cover-letters 버킷 정책
CREATE POLICY "Users can upload cover letter files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cover-letters' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can view own cover letter files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cover-letters' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_admin()));
CREATE POLICY "Users can delete own cover letter files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cover-letters' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- DONE! Admin system tables, functions, RLS policies, and storage buckets created.
-- ============================================
