-- ============================================================
-- Career Map - Supabase Database Migration
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ─── 1. PROFILES ───
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  school TEXT,
  department TEXT,
  grade INTEGER,
  target_field TEXT,
  target_company TEXT,
  bio TEXT,
  avatar_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. ROADMAP_GOALS ───
CREATE TABLE IF NOT EXISTS roadmap_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('certificate','skill','project','experience','education','other')),
  target_date DATE,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','paused')),
  priority INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roadmap_goals_user ON roadmap_goals(user_id);

-- ─── 3. MILESTONES ───
CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES roadmap_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  target_date DATE,
  completed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id);

-- ─── 4. DAILY_LOGS ───
CREATE TABLE IF NOT EXISTS daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_goal TEXT,
  reflection TEXT,
  mood INTEGER CHECK (mood >= 1 AND mood <= 5),
  study_hours NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (study_hours >= 0 AND study_hours <= 24),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);

-- ─── 5. DAILY_TASKS ───
CREATE TABLE IF NOT EXISTS daily_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES daily_logs(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES roadmap_goals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_daily_tasks_log ON daily_tasks(daily_log_id);

-- ─── 6. PROJECTS ───
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  category TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planning'
    CHECK (status IN ('planning','in_progress','completed')),
  thumbnail_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);

-- ─── 7. PROJECT_FILES ───
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_files_project ON project_files(project_id);

-- ─── 8. CERTIFICATES ───
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'certificate'
    CHECK (type IN ('certificate','award','completion')),
  issuer TEXT,
  acquired_date DATE,
  expiry_date DATE,
  score TEXT,
  certificate_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);

-- ─── 9. SKILLS ───
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1 AND level <= 5),
  category TEXT
);

CREATE INDEX IF NOT EXISTS idx_skills_user ON skills(user_id);

-- ─── 10. STREAKS ───
CREATE TABLE IF NOT EXISTS streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  total_active_days INTEGER NOT NULL DEFAULT 0,
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_streaks_user ON streaks(user_id);


-- ============================================================
-- TRIGGER: Auto-create profile + streak on user signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, school, department, grade)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'school',
    NEW.raw_user_meta_data->>'department',
    (NEW.raw_user_meta_data->>'grade')::INTEGER
  );

  INSERT INTO public.streaks (user_id, current_streak, longest_streak, total_active_days)
  VALUES (NEW.id, 0, 0, 0);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- TRIGGER: Auto-update updated_at on profiles
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadmap_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES ───
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- ─── ROADMAP_GOALS ───
CREATE POLICY "Users can view own goals"
  ON roadmap_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals"
  ON roadmap_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals"
  ON roadmap_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals"
  ON roadmap_goals FOR DELETE USING (auth.uid() = user_id);

-- ─── MILESTONES ───
CREATE POLICY "Users can view own milestones"
  ON milestones FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own milestones"
  ON milestones FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own milestones"
  ON milestones FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own milestones"
  ON milestones FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM roadmap_goals WHERE roadmap_goals.id = milestones.goal_id AND roadmap_goals.user_id = auth.uid()
  ));

-- ─── DAILY_LOGS ───
CREATE POLICY "Users can view own daily logs"
  ON daily_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own daily logs"
  ON daily_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own daily logs"
  ON daily_logs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own daily logs"
  ON daily_logs FOR DELETE USING (auth.uid() = user_id);

-- ─── DAILY_TASKS ───
CREATE POLICY "Users can view own daily tasks"
  ON daily_tasks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own daily tasks"
  ON daily_tasks FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own daily tasks"
  ON daily_tasks FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own daily tasks"
  ON daily_tasks FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM daily_logs WHERE daily_logs.id = daily_tasks.daily_log_id AND daily_logs.user_id = auth.uid()
  ));

-- ─── PROJECTS ───
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects"
  ON projects FOR DELETE USING (auth.uid() = user_id);

-- ─── PROJECT_FILES ───
CREATE POLICY "Users can view own project files"
  ON project_files FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert own project files"
  ON project_files FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own project files"
  ON project_files FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));
CREATE POLICY "Users can delete own project files"
  ON project_files FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()
  ));

-- ─── CERTIFICATES ───
CREATE POLICY "Users can view own certificates"
  ON certificates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own certificates"
  ON certificates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own certificates"
  ON certificates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own certificates"
  ON certificates FOR DELETE USING (auth.uid() = user_id);

-- ─── SKILLS ───
CREATE POLICY "Users can view own skills"
  ON skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills"
  ON skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills"
  ON skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills"
  ON skills FOR DELETE USING (auth.uid() = user_id);

-- ─── STREAKS ───
CREATE POLICY "Users can view own streak"
  ON streaks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streak"
  ON streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak"
  ON streaks FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Create storage buckets (run these separately if they error)
INSERT INTO storage.buckets (id, name, public) VALUES ('thumbnails', 'thumbnails', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies for thumbnails
CREATE POLICY "Users can upload thumbnails"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own thumbnails"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own thumbnails"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'thumbnails' AND auth.uid() IS NOT NULL);
CREATE POLICY "Public can view thumbnails"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

-- Storage policies for project-files
CREATE POLICY "Users can upload project files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own project files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own project files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-files' AND auth.uid() IS NOT NULL);
CREATE POLICY "Public can view project files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-files');

-- Storage policies for avatars
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');


-- ============================================================
-- DONE! All tables, triggers, RLS policies, and storage buckets created.
-- ============================================================
