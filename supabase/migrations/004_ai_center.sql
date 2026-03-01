-- 004_ai_center.sql
-- AI 분석센터 기능을 위한 마이그레이션

-- 1. ai_review_results 테이블에 토큰 추적 컬럼 추가
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS input_tokens INTEGER DEFAULT 0;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS output_tokens INTEGER DEFAULT 0;
ALTER TABLE ai_review_results ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gemini-2.5-flash';

-- 월별 토큰 집계용 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_review_results_reviewed_at ON ai_review_results(reviewed_at);

-- 2. AI 학생 분석 결과 저장 테이블
CREATE TABLE IF NOT EXISTS ai_student_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('competency', 'job_matching')),
  result JSONB NOT NULL DEFAULT '{}',
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  model_name TEXT DEFAULT 'gemini-2.5-flash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_student_analyses_user ON ai_student_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_student_analyses_type ON ai_student_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_ai_student_analyses_created ON ai_student_analyses(created_at);

-- 3. RLS 정책
ALTER TABLE ai_student_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_student_analyses_select" ON ai_student_analyses
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "ai_student_analyses_insert" ON ai_student_analyses
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "ai_student_analyses_update" ON ai_student_analyses
  FOR UPDATE USING (is_admin());

CREATE POLICY "ai_student_analyses_delete" ON ai_student_analyses
  FOR DELETE USING (is_admin());
