-- cover_letters 테이블 생성
CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_company TEXT,
  growth TEXT,
  personality TEXT,
  motivation TEXT,
  aspiration TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_cover_letters_user ON cover_letters(user_id);

-- RLS 활성화
ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Users can view own cover letters"
  ON cover_letters FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cover letters"
  ON cover_letters FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cover letters"
  ON cover_letters FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cover letters"
  ON cover_letters FOR DELETE USING (auth.uid() = user_id);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER set_cover_letters_updated_at
  BEFORE UPDATE ON cover_letters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
