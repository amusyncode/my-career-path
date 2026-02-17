-- ============================================
-- My Career Path - Database Schema
-- ============================================

-- 1. Custom ENUM types
CREATE TYPE goal_category AS ENUM ('certificate', 'skill', 'project', 'experience', 'education', 'other');
CREATE TYPE goal_status AS ENUM ('planned', 'in_progress', 'completed', 'paused');
CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'completed');
CREATE TYPE certificate_type AS ENUM ('certificate', 'award', 'completion');

-- ============================================
-- 2. profiles - 사용자 프로필
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school TEXT,
  department TEXT,
  grade SMALLINT CHECK (grade BETWEEN 1 AND 3),
  target_field TEXT,
  target_company TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 3. roadmap_goals - 로드맵 장기 목표
-- ============================================
CREATE TABLE roadmap_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category goal_category NOT NULL DEFAULT 'other',
  target_date DATE,
  status goal_status NOT NULL DEFAULT 'planned',
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  order_index INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 4. milestones - 목표 하위 단계
-- ============================================
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES roadmap_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- 5. daily_logs - 일일 기록
-- ============================================
CREATE TABLE daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_goal TEXT,
  reflection TEXT,
  mood SMALLINT CHECK (mood BETWEEN 1 AND 5),
  study_hours DECIMAL(4, 1) DEFAULT 0 CHECK (study_hours >= 0),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (user_id, log_date)
);

-- ============================================
-- 6. daily_tasks - 일일 할 일
-- ============================================
CREATE TABLE daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES roadmap_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0
);

-- ============================================
-- 7. projects - 포트폴리오 프로젝트
-- ============================================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  category TEXT,
  start_date DATE,
  end_date DATE,
  status project_status NOT NULL DEFAULT 'planning',
  thumbnail_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 8. project_files - 프로젝트 첨부파일
-- ============================================
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 9. certificates - 자격증 & 수상
-- ============================================
CREATE TABLE certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type certificate_type NOT NULL DEFAULT 'certificate',
  issuer TEXT,
  acquired_date DATE,
  expiry_date DATE,
  score TEXT,
  certificate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- 10. skills - 스킬
-- ============================================
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  category TEXT,
  UNIQUE (user_id, name)
);

-- ============================================
-- 11. streaks - 연속 기록
-- ============================================
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  total_active_days INTEGER DEFAULT 0
);

-- ============================================
-- 12. Indexes
-- ============================================
CREATE INDEX idx_roadmap_goals_user ON roadmap_goals(user_id);
CREATE INDEX idx_milestones_goal ON milestones(goal_id);
CREATE INDEX idx_daily_logs_user_date ON daily_logs(user_id, log_date DESC);
CREATE INDEX idx_daily_tasks_log ON daily_tasks(daily_log_id);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_project_files_project ON project_files(project_id);
CREATE INDEX idx_certificates_user ON certificates(user_id);
CREATE INDEX idx_skills_user ON skills(user_id);

-- ============================================
-- 13. updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 14. 회원가입 시 profiles 자동 생성 트리거
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 15. RLS (Row Level Security) 활성화 및 정책
-- ============================================

-- profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_select_public" ON profiles
  FOR SELECT USING (is_public = true);

-- roadmap_goals
ALTER TABLE roadmap_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON roadmap_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goals_insert_own" ON roadmap_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON roadmap_goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON roadmap_goals
  FOR DELETE USING (auth.uid() = user_id);

-- milestones
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "milestones_select_own" ON milestones
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
  );

CREATE POLICY "milestones_insert_own" ON milestones
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
  );

CREATE POLICY "milestones_update_own" ON milestones
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
  );

CREATE POLICY "milestones_delete_own" ON milestones
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid())
  );

-- daily_logs
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select_own" ON daily_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "logs_insert_own" ON daily_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "logs_update_own" ON daily_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "logs_delete_own" ON daily_logs
  FOR DELETE USING (auth.uid() = user_id);

-- daily_tasks
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON daily_tasks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
  );

CREATE POLICY "tasks_insert_own" ON daily_tasks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
  );

CREATE POLICY "tasks_update_own" ON daily_tasks
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
  );

CREATE POLICY "tasks_delete_own" ON daily_tasks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid())
  );

-- projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- project_files
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "files_select_own" ON project_files
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "files_insert_own" ON project_files
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

CREATE POLICY "files_delete_own" ON project_files
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid())
  );

-- certificates
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "certs_select_own" ON certificates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "certs_insert_own" ON certificates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "certs_update_own" ON certificates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "certs_delete_own" ON certificates
  FOR DELETE USING (auth.uid() = user_id);

-- skills
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skills_select_own" ON skills
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "skills_insert_own" ON skills
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "skills_update_own" ON skills
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "skills_delete_own" ON skills
  FOR DELETE USING (auth.uid() = user_id);

-- streaks
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks_select_own" ON streaks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "streaks_insert_own" ON streaks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "streaks_update_own" ON streaks
  FOR UPDATE USING (auth.uid() = user_id);
