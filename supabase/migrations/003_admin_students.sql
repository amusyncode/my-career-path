-- ============================================
-- 003: Admin Students Enhancement Migration
-- ============================================
-- profiles에 email 추가, upload 테이블 확장, 관리자 RLS 추가

-- ============================================
-- 1. profiles에 email 컬럼 추가
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 기존 데이터 backfill (auth.users에서 email 가져오기)
UPDATE profiles SET email = au.email
FROM auth.users au
WHERE profiles.id = au.id AND profiles.email IS NULL;

-- handle_new_user 트리거 업데이트 (회원가입시 email도 저장)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. uploaded_resumes 테이블 확장
-- ============================================
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE uploaded_resumes ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

-- status 체크 제약조건 추가 (IF NOT EXISTS 불가능하므로 DROP 후 생성)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'uploaded_resumes_status_check'
  ) THEN
    ALTER TABLE uploaded_resumes ADD CONSTRAINT uploaded_resumes_status_check
      CHECK (status IN ('uploaded', 'reviewing', 'reviewed', 'failed'));
  END IF;
END $$;

-- ============================================
-- 3. uploaded_cover_letters 테이블 확장
-- ============================================
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'uploaded';
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE uploaded_cover_letters ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'uploaded_cover_letters_status_check'
  ) THEN
    ALTER TABLE uploaded_cover_letters ADD CONSTRAINT uploaded_cover_letters_status_check
      CHECK (status IN ('uploaded', 'reviewing', 'reviewed', 'failed'));
  END IF;
END $$;

-- ============================================
-- 4. 관리자용 INSERT/UPDATE RLS 정책 추가
-- ============================================

-- uploaded_resumes: 관리자가 학생 대신 업로드 가능
DO $$ BEGIN
  CREATE POLICY "uploaded_resumes_admin_insert" ON uploaded_resumes
    FOR INSERT WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "uploaded_resumes_admin_update" ON uploaded_resumes
    FOR UPDATE USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- uploaded_cover_letters: 관리자가 학생 대신 업로드 가능
DO $$ BEGIN
  CREATE POLICY "uploaded_cover_letters_admin_insert" ON uploaded_cover_letters
    FOR INSERT WITH CHECK (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "uploaded_cover_letters_admin_update" ON uploaded_cover_letters
    FOR UPDATE USING (is_admin());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- DONE! profiles.email 추가, upload 테이블 확장, 관리자 RLS 완료
-- ============================================
