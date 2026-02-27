export function buildResumeReviewPrompt(text: string): string {
  return `당신은 한국 취업 시장에 정통한 전문 이력서 컨설턴트입니다.
아래 이력서를 분석하고 상세한 피드백을 제공해주세요.

## 이력서 내용:
${text}

## 분석 기준:
1. 경력사항 - 성과 중심 서술, 구체적 수치 포함 여부
2. 학력/자격증 - 관련성, 기재 방식
3. 기술스택 - 직무 적합성, 최신성
4. 자기소개 - 차별화 요소, 간결성
5. 전체 구성 - 가독성, 논리적 흐름

## 반드시 아래 JSON 형식으로만 응답하세요:
{
  "overall_score": 0~100 사이 정수,
  "sections": [
    {
      "name": "섹션명",
      "score": 0~100 사이 정수,
      "feedback": "해당 섹션에 대한 구체적 피드백"
    }
  ],
  "improvement_points": ["개선점1", "개선점2", "개선점3"],
  "reviewer_comment": "전체적인 종합 코멘트"
}`;
}

export function buildCoverLetterReviewPrompt(text: string): string {
  return `당신은 한국 기업 채용 담당자 경력 10년 이상의 자기소개서 전문 컨설턴트입니다.
아래 자기소개서를 분석하고 상세한 피드백을 제공해주세요.

## 자기소개서 내용:
${text}

## 분석 기준:
1. 성장과정 - 진정성, 직무 연관성
2. 성격/장단점 - 구체적 사례, 직무 적합성
3. 지원동기 - 기업 이해도, 열정 표현
4. 입사 후 포부 - 구체성, 실현 가능성
5. 전체 구성 - 논리적 흐름, 문장력, 맞춤법

## 반드시 아래 JSON 형식으로만 응답하세요:
{
  "overall_score": 0~100 사이 정수,
  "sections": [
    {
      "name": "섹션명",
      "score": 0~100 사이 정수,
      "feedback": "해당 섹션에 대한 구체적 피드백"
    }
  ],
  "improvement_points": ["개선점1", "개선점2", "개선점3"],
  "reviewer_comment": "전체적인 종합 코멘트"
}`;
}

export function buildStudentAnalysisPrompt(profileData: {
  name: string;
  school?: string | null;
  department?: string | null;
  grade?: number | null;
  target_field?: string | null;
  target_company?: string | null;
  bio?: string | null;
  goals?: { title: string; category: string; status: string }[];
  skills?: { name: string; level: number; category?: string | null }[];
  projects?: { title: string; tech_stack: string[]; status: string }[];
  certificates?: { name: string; type: string; issuer?: string | null }[];
}): string {
  return `당신은 대학생 진로 상담 전문가입니다.
아래 학생의 프로필과 활동 데이터를 종합 분석하여 진로 역량 평가를 해주세요.

## 학생 프로필:
- 이름: ${profileData.name}
- 학교: ${profileData.school || "미입력"}
- 학과: ${profileData.department || "미입력"}
- 학년: ${profileData.grade || "미입력"}
- 관심 분야: ${profileData.target_field || "미입력"}
- 목표 기업: ${profileData.target_company || "미입력"}
- 자기소개: ${profileData.bio || "미입력"}

## 로드맵 목표:
${profileData.goals?.map((g) => `- [${g.status}] ${g.title} (${g.category})`).join("\n") || "없음"}

## 보유 스킬:
${profileData.skills?.map((s) => `- ${s.name} (Lv.${s.level}${s.category ? `, ${s.category}` : ""})`).join("\n") || "없음"}

## 프로젝트:
${profileData.projects?.map((p) => `- [${p.status}] ${p.title} (${p.tech_stack.join(", ")})`).join("\n") || "없음"}

## 자격증/수상:
${profileData.certificates?.map((c) => `- ${c.name} (${c.type}${c.issuer ? `, ${c.issuer}` : ""})`).join("\n") || "없음"}

## 반드시 아래 JSON 형식으로만 응답하세요:
{
  "strengths": ["강점1", "강점2", "강점3"],
  "weaknesses": ["보완점1", "보완점2", "보완점3"],
  "recommendations": ["추천 활동1", "추천 활동2", "추천 활동3"],
  "career_fit_score": 0~100 사이 정수,
  "summary": "전체적인 종합 평가 (2~3문장)"
}`;
}

export function buildCounselingSuggestionPrompt(studentData: {
  name: string;
  school?: string | null;
  department?: string | null;
  grade?: number | null;
  target_field?: string | null;
  target_company?: string | null;
  goals?: { title: string; category: string; status: string }[];
  skills?: { name: string; level: number }[];
  projects?: { title: string; status: string }[];
  certificates?: { name: string }[];
  recent_logs?: { log_date: string; daily_goal?: string | null; study_hours: number }[];
}): string {
  return `당신은 대학생 취업 상담 전문가입니다.
아래 학생의 데이터를 기반으로 효과적인 상담을 위한 제안을 해주세요.

## 학생 정보:
- 이름: ${studentData.name}
- 학교: ${studentData.school || "미입력"}
- 학과: ${studentData.department || "미입력"}
- 학년: ${studentData.grade || "미입력"}
- 관심 분야: ${studentData.target_field || "미입력"}
- 목표 기업: ${studentData.target_company || "미입력"}

## 로드맵 목표:
${studentData.goals?.map((g) => `- [${g.status}] ${g.title} (${g.category})`).join("\n") || "없음"}

## 보유 스킬:
${studentData.skills?.map((s) => `- ${s.name} (Lv.${s.level})`).join("\n") || "없음"}

## 프로젝트:
${studentData.projects?.map((p) => `- [${p.status}] ${p.title}`).join("\n") || "없음"}

## 자격증:
${studentData.certificates?.map((c) => `- ${c.name}`).join("\n") || "없음"}

## 최근 활동 기록:
${studentData.recent_logs?.map((l) => `- ${l.log_date}: ${l.daily_goal || "목표 미설정"} (${l.study_hours}시간)`).join("\n") || "없음"}

## 반드시 아래 JSON 형식으로만 응답하세요:
{
  "suggested_topics": ["상담 주제1", "상담 주제2", "상담 주제3"],
  "priority_areas": ["우선 개선 영역1", "우선 개선 영역2"],
  "talking_points": ["대화 포인트1", "대화 포인트2", "대화 포인트3"],
  "overall_assessment": "종합 평가 및 상담 방향 제안 (2~3문장)"
}`;
}
