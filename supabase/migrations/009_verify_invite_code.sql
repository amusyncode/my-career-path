-- ============================================
-- 009: verify_invite_code DB 함수
-- 회원가입 시 초대코드 검증용 (SECURITY DEFINER로 RLS 우회)
-- ============================================

CREATE OR REPLACE FUNCTION verify_invite_code(p_code TEXT)
RETURNS TABLE (valid BOOLEAN, instructor_name TEXT, instructor_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT true, p.name::TEXT, p.id
  FROM profiles p
  WHERE p.invite_code = p_code
    AND p.role = 'instructor'
    AND p.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 익명 사용자도 호출 가능 (회원가입 페이지에서 사용)
GRANT EXECUTE ON FUNCTION verify_invite_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION verify_invite_code(TEXT) TO authenticated;
