# MyCareerPath 초기 설정 가이드

## 1. Supabase 이메일 인증 설정

Supabase 대시보드 → Authentication → Settings → Email Auth

- **"Confirm email" 토글**:
  - OFF: 가입 즉시 로그인 가능 (개발/테스트시 편리)
  - ON: 이메일 인증 후 로그인 (운영 환경 권장)
- **"Enable email signup" 토글**: ON 유지

## 2. 환경변수 설정

`.env.local` 파일에 아래 환경변수를 설정하세요:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
API_KEY_ENCRYPTION_SECRET=your_secret_min_32_chars
GEMINI_API_KEY=optional_fallback_api_key
RESEND_API_KEY=your_resend_key
NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE=your_instructor_signup_code
```

Vercel 배포 시에도 동일한 환경변수를 Settings → Environment Variables에 추가하세요.

## 3. Super Admin 계정 생성

1. `/signup`에서 강사로 회원가입 (강사 가입 코드 입력)
2. Supabase SQL Editor에서 아래 쿼리 실행:

```sql
UPDATE profiles SET role = 'super_admin' WHERE email = 'your@email.com';
```

## 4. 첫 강사 계정 테스트

1. `/signup`에서 강사로 가입 (강사 가입 코드 입력)
2. `/admin/settings`에서 Gemini API 키 등록
3. 초대 코드 확인 후 학생에게 공유
4. 학생 등록 테스트
5. 이력서 업로드 + AI 첨삭 테스트

## 5. Storage 버킷 생성

Supabase Storage에서 아래 버킷을 생성하세요:

| 버킷 이름 | 접근 권한 | 용도 |
|-----------|----------|------|
| resumes | private | 이력서 파일 |
| cover-letters | private | 자기소개서 파일 |
| avatars | public | 프로필 이미지 |
| thumbnails | public | 프로젝트 썸네일 |
| project-files | private | 프로젝트 첨부 파일 |
| certificates | public | 자격증/수상 이미지 |

## 6. DB 마이그레이션

`supabase/migrations/` 폴더의 SQL 파일을 순서대로 Supabase SQL Editor에서 실행하세요:

1. `001_initial.sql` - 핵심 테이블
2. `002_gemini.sql` - AI 리뷰 테이블
3. `003_admin_student.sql` - 관리자 학생 관리
4. `004_ai_center.sql` - AI 센터 (토큰 추적)
5. `007_multi_tenant_redesign.sql` - 멀티테넌트 3역할 구조
6. `008_gems_system.sql` - Gems 시스템
7. `009_verify_invite_code.sql` - 초대코드 검증 함수

## 7. 역할 구조

| 역할 | 설명 | 접근 경로 |
|------|------|----------|
| super_admin | 플랫폼 운영자 | /admin/* (전체 데이터 접근) |
| instructor | 강사 (유료 고객) | /admin/* (본인 학생만) |
| student | 학생 | /dashboard, /roadmap 등 |
