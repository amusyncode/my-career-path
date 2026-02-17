import type { GoalCategory, GoalStatus } from "@/lib/types";

export const CATEGORY_LABELS: Record<GoalCategory, string> = {
  certificate: "자격증",
  skill: "스킬",
  project: "프로젝트",
  experience: "경험",
  education: "학업",
  other: "기타",
};

export const CATEGORY_COLORS: Record<GoalCategory, string> = {
  certificate: "bg-purple-100 text-purple-700",
  skill: "bg-blue-100 text-blue-700",
  project: "bg-green-100 text-green-700",
  experience: "bg-orange-100 text-orange-700",
  education: "bg-pink-100 text-pink-700",
  other: "bg-gray-100 text-gray-700",
};

export const STATUS_LABELS: Record<GoalStatus, string> = {
  planned: "계획됨",
  in_progress: "진행중",
  completed: "완료",
  paused: "보류",
};

export const STATUS_NODE_COLORS: Record<GoalStatus, string> = {
  planned: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  paused: "bg-yellow-500",
};

export const STATUS_COLUMN_COLORS: Record<GoalStatus, string> = {
  planned: "border-t-gray-400",
  in_progress: "border-t-blue-500",
  completed: "border-t-green-500",
  paused: "border-t-yellow-500",
};

export const ALL_CATEGORIES: (GoalCategory | "all")[] = [
  "all",
  "certificate",
  "skill",
  "project",
  "experience",
  "education",
  "other",
];

export const FILTER_LABELS: Record<string, string> = {
  all: "전체",
  ...CATEGORY_LABELS,
};

export const KANBAN_COLUMNS: GoalStatus[] = [
  "planned",
  "in_progress",
  "completed",
  "paused",
];
