// ============================================
// MyCareerPath 멀티테넌트 SaaS 타입 정의
// ============================================

// --- 공통 타입 ---

export type UserRole = 'super_admin' | 'instructor' | 'student';

export type GoalCategory =
  | "certificate"
  | "skill"
  | "project"
  | "experience"
  | "education"
  | "other";

export type GoalStatus = "planned" | "in_progress" | "completed" | "paused";

export type ProjectStatus = "planning" | "in_progress" | "completed";

export type CertificateType = "certificate" | "award" | "completion";

export type UploadDocumentStatus = 'uploaded' | 'reviewing' | 'reviewed' | 'failed';

export type CounselingType = 'career' | 'resume' | 'interview' | 'mental' | 'other';

export type FileType = 'pdf' | 'docx' | 'hwp' | 'txt' | 'other';

export type EducationLevel = 'high_school' | 'university';

export type EducationLevelWithAll = 'high_school' | 'university' | 'all';

export type GemCategory = 'resume' | 'cover_letter' | 'analysis' | 'counseling';

export type GemScope = 'global' | 'instructor' | 'student';

// --- 프로필 ---

export interface Profile {
  id: string;
  email: string | null;
  name: string;
  school: string | null;
  department: string | null;
  grade: number | null;
  target_field: string | null;
  target_company: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  role: UserRole;
  instructor_id: string | null;
  gemini_api_key: string | null;
  invite_code: string | null;
  is_active: boolean;
  phone: string | null;
  student_email: string | null;
  is_onboarded: boolean;
  education_level: EducationLevel;
  created_at: string;
  updated_at: string;
}

// --- Gems ---

export interface Gem {
  id: string;
  name: string;
  description: string | null;
  category: GemCategory;
  department: string | null;
  education_level: EducationLevelWithAll;
  system_prompt: string;
  is_default: boolean;
  is_active: boolean;
  created_by: string | null;
  scope: GemScope;
  sort_order: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

// --- 로드맵 ---

export interface RoadmapGoal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: GoalCategory;
  target_date: string | null;
  status: GoalStatus;
  priority: number;
  order_index: number;
  completed_at: string | null;
  created_at: string;
  milestones?: Milestone[];
}

export interface Milestone {
  id: string;
  goal_id: string;
  title: string;
  is_completed: boolean;
  target_date: string | null;
  completed_at: string | null;
  order_index: number;
}

// --- 일일 기록 ---

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  daily_goal: string | null;
  reflection: string | null;
  mood: number | null;
  study_hours: number;
  created_at: string;
  tasks?: DailyTask[];
}

export interface DailyTask {
  id: string;
  daily_log_id: string;
  goal_id: string | null;
  title: string;
  is_completed: boolean;
  completed_at: string | null;
  order_index: number;
}

// --- 포트폴리오 ---

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  tech_stack: string[];
  category: string | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  thumbnail_url: string | null;
  github_url: string | null;
  demo_url: string | null;
  is_featured: boolean;
  created_at: string;
  files?: ProjectFile[];
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

// --- 자격증 & 스킬 ---

export interface Certificate {
  id: string;
  user_id: string;
  name: string;
  type: CertificateType;
  issuer: string | null;
  acquired_date: string | null;
  expiry_date: string | null;
  score: string | null;
  certificate_url: string | null;
  created_at: string;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  level: number;
  category: string | null;
}

export interface Streak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  total_active_days: number;
}

// --- 업로드 문서 ---

export interface UploadedResume {
  id: string;
  user_id: string;
  uploaded_by: string | null;
  instructor_id: string | null;
  title: string;
  file_name: string;
  file_url: string;
  file_type: FileType | null;
  file_size: number | null;
  version: number;
  status: UploadDocumentStatus;
  ai_review_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadedCoverLetter {
  id: string;
  user_id: string;
  uploaded_by: string | null;
  instructor_id: string | null;
  title: string;
  target_company: string | null;
  file_name: string | null;
  file_url: string | null;
  file_type: FileType | null;
  file_size: number | null;
  content: string | null;
  version: number;
  status: UploadDocumentStatus;
  ai_review_id: string | null;
  created_at: string;
  updated_at: string;
}

// --- AI 리뷰 ---

export interface AIReviewResult {
  id: string;
  user_id: string;
  instructor_id: string | null;
  document_type: 'resume' | 'cover_letter';
  document_id: string;
  original_content: string | null;
  revised_content: string | null;
  feedback: string | null;
  improvement_points: Record<string, unknown>[];
  score: number | null;
  model_used: string;
  tokens_used: number | null;
  processing_time: number | null;
  requested_by: string | null;
  created_at: string;
  // 레거시 호환 (기존 컬럼)
  overall_score?: number | null;
  reviewer_comment?: string | null;
  reviewed_at?: string;
  input_tokens?: number;
  output_tokens?: number;
  model_name?: string;
}

// --- 상담 기록 ---

export interface CounselingRecord {
  id: string;
  user_id: string;
  counselor_id: string;
  instructor_id: string | null;
  title: string;
  content: string | null;
  counseling_type: CounselingType;
  counseling_date: string;
  is_completed: boolean;
  action_items: string | null;
  next_counseling_date: string | null;
  ai_suggestion: AICounselingSuggestion | null;
  created_at: string;
  updated_at: string;
}

export interface CounselingRecordWithStudent extends CounselingRecord {
  profiles: {
    name: string;
    school: string | null;
    department: string | null;
    grade: number | null;
    avatar_url: string | null;
    target_field: string | null;
  };
}

export interface AICounselingSuggestion {
  suggested_topics: string[];
  key_observations: string[];
  action_suggestions: string[];
  concerns?: string[];
  encouragement: string;
}

// --- 이력서 직접 작성 ---

export interface Experience {
  id: string;
  title: string;
  organization: string;
  period: string;
  description: string;
}

export interface ResumeDataRow {
  id: string;
  user_id: string;
  instructor_id: string | null;
  name: string;
  email: string;
  phone: string;
  address: string;
  target_field: string;
  intro: string;
  avatar_url: string | null;
  school_name: string;
  department: string;
  grade: number | null;
  enrollment_period: string;
  gpa: string;
  courses: string[];
  selected_cert_ids: string[];
  cert_order: string[];
  selected_project_ids: string[];
  project_order: string[];
  selected_skill_ids: string[];
  experiences: Experience[];
  self_pr: string;
  created_at: string;
  updated_at: string;
}

// --- 자소서 직접 작성 ---

export interface CoverLetterData {
  id: string;
  user_id: string;
  instructor_id: string | null;
  title: string;
  target_company: string | null;
  growth: string | null;
  personality: string | null;
  motivation: string | null;
  aspiration: string | null;
  created_at: string;
  updated_at: string;
}

// 레거시 호환 (기존 CoverLetter 타입)
export interface CoverLetter {
  id: string;
  user_id: string;
  title: string;
  target_company: string | null;
  growth: string | null;
  personality: string | null;
  motivation: string | null;
  aspiration: string | null;
  created_at: string;
  updated_at: string;
}

// --- 이메일 로그 ---

export interface EmailLog {
  id: string;
  instructor_id: string;
  student_id: string;
  recipient_email: string;
  subject: string;
  content_type: 'ai_review' | 'counseling' | 'custom';
  document_id: string | null;
  status: 'pending' | 'sent' | 'failed';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

// --- AI 분석센터 ---

export interface AIStudentAnalysis {
  id: string;
  user_id: string;
  analysis_type: 'competency' | 'job_matching';
  result: CompetencyAnalysisResult | JobMatchingResult;
  input_tokens: number;
  output_tokens: number;
  model_name: string;
  created_at: string;
}

export interface CompetencyAnalysisResult {
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  career_fit_score: number;
  summary: string;
  skill_scores: { category: string; score: number }[];
  suitable_jobs: string[];
  missing_skills: string[];
}

export interface JobMatchingResult {
  matches: JobMatch[];
  overall_readiness: number;
  top_recommendation: string;
  growth_plan: string;
}

export interface JobMatch {
  job_title: string;
  match_rate: number;
  reasons: string[];
  required_skills: string[];
  student_has: string[];
  student_lacks: string[];
  preparation_tips: string;
}

// --- 학생 목록 (강사/관리자용) ---

export interface StudentListItem {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  department: string | null;
  grade: number | null;
  target_field: string | null;
  avatar_url: string | null;
  created_at: string;
  project_count: number;
  certificate_count: number;
  last_active_date: string | null;
  current_streak: number;
}
