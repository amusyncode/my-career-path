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
  "summary": "전체적인 종합 평가 (2~3문장)",
  "skill_scores": [
    { "category": "기술역량", "score": 0~100 },
    { "category": "자격증", "score": 0~100 },
    { "category": "포트폴리오", "score": 0~100 },
    { "category": "꾸준함", "score": 0~100 },
    { "category": "목표관리", "score": 0~100 },
    { "category": "직무적합성", "score": 0~100 }
  ],
  "suitable_jobs": ["추천 직무1", "추천 직무2", "추천 직무3"],
  "missing_skills": ["부족 역량1", "부족 역량2", "부족 역량3"]
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
  "suggested_topics": ["구체적 상담 주제1", "구체적 상담 주제2", "구체적 상담 주제3"],
  "key_observations": ["학생에 대한 핵심 관찰점1", "핵심 관찰점2", "핵심 관찰점3"],
  "action_suggestions": ["구체적 실행 제안1", "구체적 실행 제안2", "구체적 실행 제안3"],
  "concerns": ["우려사항1 (해당 없으면 빈 배열)"],
  "encouragement": "학생을 격려할 수 있는 긍정적 메시지 (2~3문장)"
}`;
}

export function buildJobMatchingPrompt(profileData: {
  name: string;
  school?: string | null;
  department?: string | null;
  grade?: number | null;
  target_field?: string | null;
  target_company?: string | null;
  goals?: { title: string; category: string; status: string }[];
  skills?: { name: string; level: number; category?: string | null }[];
  projects?: { title: string; tech_stack: string[]; status: string }[];
  certificates?: { name: string; type: string; issuer?: string | null }[];
  options?: {
    skillBased?: boolean;
    certBased?: boolean;
    portfolioBased?: boolean;
    personalityBased?: boolean;
  };
}): string {
  const optionDesc = [];
  if (profileData.options?.skillBased !== false) optionDesc.push("스킬 기반 매칭");
  if (profileData.options?.certBased !== false) optionDesc.push("자격증 기반 매칭");
  if (profileData.options?.portfolioBased !== false) optionDesc.push("포트폴리오 기반 매칭");
  if (profileData.options?.personalityBased) optionDesc.push("성격/적성 고려");

  return `당신은 한국 IT 취업 시장에 정통한 커리어 매칭 전문가입니다.
아래 학생의 프로필과 역량 데이터를 분석하여 최적의 직무를 매칭해주세요.

## 학생 프로필:
- 이름: ${profileData.name}
- 학교: ${profileData.school || "미입력"}
- 학과: ${profileData.department || "미입력"}
- 학년: ${profileData.grade || "미입력"}
- 관심 분야: ${profileData.target_field || "미입력"}
- 목표 기업: ${profileData.target_company || "미입력"}

## 로드맵 목표:
${profileData.goals?.map((g) => `- [${g.status}] ${g.title} (${g.category})`).join("\n") || "없음"}

## 보유 스킬:
${profileData.skills?.map((s) => `- ${s.name} (Lv.${s.level}${s.category ? `, ${s.category}` : ""})`).join("\n") || "없음"}

## 프로젝트:
${profileData.projects?.map((p) => `- [${p.status}] ${p.title} (${p.tech_stack.join(", ")})`).join("\n") || "없음"}

## 자격증/수상:
${profileData.certificates?.map((c) => `- ${c.name} (${c.type}${c.issuer ? `, ${c.issuer}` : ""})`).join("\n") || "없음"}

## 분석 기준: ${optionDesc.join(", ")}

## 반드시 아래 JSON 형식으로만 응답하세요:
{
  "matches": [
    {
      "job_title": "직무명",
      "match_rate": 0~100 사이 정수,
      "reasons": ["매칭 근거1", "매칭 근거2"],
      "required_skills": ["필요 스킬1", "필요 스킬2"],
      "student_has": ["보유 스킬1", "보유 스킬2"],
      "student_lacks": ["부족 스킬1"],
      "preparation_tips": "준비 조언 (1~2문장)"
    }
  ],
  "overall_readiness": 0~100 사이 정수,
  "top_recommendation": "가장 추천하는 직무와 이유 (2~3문장)",
  "growth_plan": "성장 로드맵 제안 (3~5문장)"
}

매칭 직무는 3~5개를 추천하고, match_rate가 높은 순서로 정렬해주세요.`;
}
