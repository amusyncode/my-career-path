-- ============================================
-- 010: Email Invite & Profile Merge
-- ============================================

-- 학생 프로필 병합 함수
-- 강사가 수동 등록한 학생(email IS NULL)과 실제 가입한 학생을 병합
CREATE OR REPLACE FUNCTION merge_student_profile(
  p_new_user_id UUID,
  p_instructor_id UUID,
  p_name TEXT,
  p_email TEXT,
  p_school TEXT,
  p_department TEXT,
  p_grade TEXT,
  p_education_level TEXT
) RETURNS VOID AS $$
DECLARE
  v_old_id UUID;
BEGIN
  SELECT id INTO v_old_id FROM profiles
  WHERE instructor_id = p_instructor_id
    AND name ILIKE p_name
    AND email IS NULL
    AND role = 'student'
  LIMIT 1;

  IF v_old_id IS NOT NULL THEN
    UPDATE uploaded_resumes SET user_id = p_new_user_id WHERE user_id = v_old_id;
    UPDATE uploaded_cover_letters SET user_id = p_new_user_id WHERE user_id = v_old_id;
    UPDATE ai_review_results SET user_id = p_new_user_id WHERE user_id = v_old_id;
    UPDATE counseling_records SET student_id = p_new_user_id WHERE student_id = v_old_id;
    UPDATE resume_data SET user_id = p_new_user_id WHERE user_id = v_old_id;
    UPDATE cover_letter_data SET user_id = p_new_user_id WHERE user_id = v_old_id;

    UPDATE profiles SET
      instructor_id = p_instructor_id,
      school = COALESCE(p_school, (SELECT school FROM profiles WHERE id = v_old_id)),
      department = COALESCE(p_department, (SELECT department FROM profiles WHERE id = v_old_id)),
      grade = COALESCE(p_grade::int, (SELECT grade FROM profiles WHERE id = v_old_id)),
      education_level = COALESCE(p_education_level, (SELECT education_level FROM profiles WHERE id = v_old_id)),
      target_field = (SELECT target_field FROM profiles WHERE id = v_old_id),
      student_email = (SELECT student_email FROM profiles WHERE id = v_old_id),
      phone = (SELECT phone FROM profiles WHERE id = v_old_id),
      name = p_name,
      email = p_email,
      role = 'student'
    WHERE id = p_new_user_id;

    DELETE FROM profiles WHERE id = v_old_id;
  ELSE
    UPDATE profiles SET
      instructor_id = p_instructor_id,
      school = p_school,
      department = p_department,
      grade = CASE WHEN p_grade IS NOT NULL AND p_grade != '' THEN p_grade::int ELSE NULL END,
      education_level = p_education_level,
      name = p_name,
      email = p_email,
      role = 'student'
    WHERE id = p_new_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- email_logs content_type에 invite, instructor_welcome 추가 (CHECK 제약 수정)
ALTER TABLE email_logs DROP CONSTRAINT IF EXISTS email_logs_content_type_check;
ALTER TABLE email_logs ADD CONSTRAINT email_logs_content_type_check
  CHECK (content_type IN ('ai_review', 'counseling', 'custom', 'invite', 'instructor_welcome'));
