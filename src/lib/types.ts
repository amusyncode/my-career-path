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

export interface Profile {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  department: string | null;
  grade: number | null;
  target_field: string | null;
  target_company: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_public: boolean;
  role: 'user' | 'admin';
  is_onboarded: boolean;
  created_at: string;
  updated_at: string;
}

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

export type UploadDocumentStatus = 'uploaded' | 'reviewing' | 'reviewed' | 'failed';

export interface UploadedResume {
  id: string;
  user_id: string;
  title: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  status: UploadDocumentStatus;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface UploadedCoverLetter {
  id: string;
  user_id: string;
  title: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  file_type: string | null;
  status: UploadDocumentStatus;
  uploaded_by: string | null;
  uploaded_at: string;
}

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

export interface AIReviewResult {
  id: string;
  user_id: string;
  document_type: 'resume' | 'cover_letter';
  document_id: string;
  overall_score: number | null;
  improvement_points: Record<string, unknown>[];
  reviewer_comment: string | null;
  reviewed_at: string;
}

export interface CounselingRecord {
  id: string;
  user_id: string;
  counselor_id: string;
  title: string;
  content: string | null;
  counseling_date: string;
  created_at: string;
  updated_at: string;
}
