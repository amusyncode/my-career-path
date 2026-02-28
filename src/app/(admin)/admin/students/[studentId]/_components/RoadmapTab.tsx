"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Target, Check } from "lucide-react";
import type { RoadmapGoal, GoalCategory, GoalStatus } from "@/lib/types";

interface RoadmapTabProps {
  studentId: string;
}

const CATEGORY_COLORS: Record<GoalCategory, { bg: string; text: string }> = {
  certificate: { bg: "bg-blue-50", text: "text-blue-700" },
  skill: { bg: "bg-green-50", text: "text-green-700" },
  project: { bg: "bg-purple-50", text: "text-purple-700" },
  experience: { bg: "bg-orange-50", text: "text-orange-700" },
  education: { bg: "bg-pink-50", text: "text-pink-700" },
  other: { bg: "bg-gray-50", text: "text-gray-700" },
};

const CATEGORY_LABELS: Record<GoalCategory, string> = {
  certificate: "자격증",
  skill: "스킬",
  project: "프로젝트",
  experience: "경험",
  education: "교육",
  other: "기타",
};

const STATUS_DOT_COLORS: Record<GoalStatus, string> = {
  planned: "bg-gray-400",
  in_progress: "bg-blue-500",
  completed: "bg-green-500",
  paused: "bg-yellow-500",
};

const STATUS_LABELS: Record<GoalStatus, string> = {
  planned: "계획",
  in_progress: "진행중",
  completed: "완료",
  paused: "일시중지",
};

const STATUS_BADGE_COLORS: Record<GoalStatus, { bg: string; text: string }> = {
  planned: { bg: "bg-gray-100", text: "text-gray-600" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-700" },
  completed: { bg: "bg-green-50", text: "text-green-700" },
  paused: { bg: "bg-yellow-50", text: "text-yellow-700" },
};

export default function RoadmapTab({ studentId }: RoadmapTabProps) {
  const supabase = createClient();
  const [goals, setGoals] = useState<RoadmapGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("roadmap_goals")
        .select("*, milestones(*)")
        .eq("user_id", studentId)
        .order("order_index");

      if (error) throw error;
      setGoals((data as RoadmapGoal[]) ?? []);
    } catch (err) {
      console.error("로드맵 목표 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="flex flex-col items-center">
              <div className="w-4 h-4 rounded-full bg-gray-200" />
              <div className="w-0.5 flex-1 bg-gray-100 mt-1" />
            </div>
            <div className="flex-1 bg-white rounded-xl p-4">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-2 bg-gray-100 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          설정된 로드맵 목표가 없습니다
        </h3>
        <p className="text-gray-500 text-sm">
          학생이 로드맵 목표를 설정하면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {goals.map((goal, index) => {
        const milestones = goal.milestones ?? [];
        const completedMilestones = milestones.filter(
          (m) => m.is_completed
        ).length;
        const totalMilestones = milestones.length;
        const progressPercent =
          totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : 0;

        const catColor = CATEGORY_COLORS[goal.category] ?? CATEGORY_COLORS.other;
        const statusBadge = STATUS_BADGE_COLORS[goal.status] ?? STATUS_BADGE_COLORS.planned;
        const isLast = index === goals.length - 1;

        return (
          <div key={goal.id} className="flex gap-4">
            {/* Timeline left: dot + vertical line */}
            <div className="flex flex-col items-center pt-1">
              <div
                className={`w-4 h-4 rounded-full border-2 border-white shadow ${STATUS_DOT_COLORS[goal.status]}`}
              />
              {!isLast && (
                <div className="w-0.5 flex-1 bg-gray-200 mt-1" />
              )}
            </div>

            {/* Timeline right: content */}
            <div className="flex-1 bg-white rounded-xl shadow-sm p-4 mb-4">
              {/* Title + Category badge */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="font-medium text-gray-900">
                  {goal.title}
                </span>
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${catColor.bg} ${catColor.text}`}
                >
                  {CATEGORY_LABELS[goal.category] ?? goal.category}
                </span>
              </div>

              {/* Status badge + target date */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className={`text-xs rounded-full px-2 py-0.5 ${statusBadge.bg} ${statusBadge.text}`}
                >
                  {STATUS_LABELS[goal.status]}
                </span>
                {goal.target_date && (
                  <span className="text-xs text-gray-400">
                    목표: {goal.target_date}
                  </span>
                )}
              </div>

              {/* Priority stars */}
              <div className="flex items-center gap-0.5 mb-3">
                {[...Array(5)].map((_, i) => (
                  <span
                    key={i}
                    className={`text-sm ${
                      i < goal.priority
                        ? "text-yellow-400"
                        : "text-gray-200"
                    }`}
                  >
                    ★
                  </span>
                ))}
                <span className="text-xs text-gray-400 ml-1">
                  우선순위
                </span>
              </div>

              {/* Progress bar */}
              {totalMilestones > 0 && (
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">
                      마일스톤 진행률
                    </span>
                    <span className="text-xs text-gray-500">
                      {completedMilestones}/{totalMilestones} ({progressPercent}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Milestones checklist */}
              {milestones.length > 0 && (
                <div className="space-y-1.5">
                  {milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ${
                          milestone.is_completed
                            ? "bg-green-500 text-white"
                            : "border border-gray-300 bg-white"
                        }`}
                      >
                        {milestone.is_completed && (
                          <Check className="w-3 h-3" />
                        )}
                      </div>
                      <span
                        className={
                          milestone.is_completed
                            ? "text-gray-400 line-through"
                            : "text-gray-700"
                        }
                      >
                        {milestone.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
