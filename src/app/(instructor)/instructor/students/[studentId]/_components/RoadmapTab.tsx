"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Map, CheckCircle2, Circle, Clock, Target } from "lucide-react";
import { format } from "date-fns";

interface RoadmapGoal {
  id: string;
  title: string;
  category: string;
  status: string;
  target_date: string | null;
  milestones?: { id: string; title: string; is_completed: boolean }[];
}

interface RoadmapTabProps {
  studentId: string;
  hasAuth?: boolean;
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  planned: { label: "계획됨", className: "bg-gray-100 text-gray-600" },
  in_progress: { label: "진행중", className: "bg-blue-100 text-blue-700" },
  completed: { label: "완료", className: "bg-green-100 text-green-700" },
  paused: { label: "일시중지", className: "bg-yellow-100 text-yellow-700" },
};

const CATEGORY_LABEL: Record<string, string> = {
  certificate: "자격증",
  skill: "스킬",
  project: "프로젝트",
  experience: "경험",
  education: "교육",
  other: "기타",
};

export default function RoadmapTab({ studentId, hasAuth }: RoadmapTabProps) {
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
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGoals((data as RoadmapGoal[]) ?? []);
    } catch (err) {
      console.error("로드맵 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse dark:bg-gray-800">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (hasAuth === false) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <Map className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          이 학생은 아직 가입하지 않아 로드맵 데이터가 없습니다
        </p>
      </div>
    );
  }

  if (goals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <Map className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          설정된 로드맵 목표가 없습니다
        </h3>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {goals.map((goal) => {
        const statusConf = STATUS_LABEL[goal.status] ?? STATUS_LABEL.planned;
        const completedMilestones =
          goal.milestones?.filter((m) => m.is_completed).length ?? 0;
        const totalMilestones = goal.milestones?.length ?? 0;
        const progress =
          totalMilestones > 0
            ? Math.round((completedMilestones / totalMilestones) * 100)
            : 0;

        return (
          <div
            key={goal.id}
            className="bg-white rounded-xl shadow-sm p-4 dark:bg-gray-800"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                <h4 className="font-medium text-gray-900 dark:text-white">
                  {goal.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-300">
                  {CATEGORY_LABEL[goal.category] ?? goal.category}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${statusConf.className}`}
                >
                  {statusConf.label}
                </span>
              </div>
            </div>

            {goal.target_date && (
              <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                <Clock className="w-3 h-3" />
                마감: {format(new Date(goal.target_date), "yyyy.MM.dd")}
              </div>
            )}

            {/* Progress bar */}
            {totalMilestones > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1 dark:text-gray-400">
                  <span>
                    {completedMilestones}/{totalMilestones} 마일스톤
                  </span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full dark:bg-gray-700">
                  <div
                    className="h-2 bg-purple-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Milestones */}
            {goal.milestones && goal.milestones.length > 0 && (
              <div className="mt-3 space-y-1">
                {goal.milestones.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                  >
                    {m.is_completed ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    <span
                      className={m.is_completed ? "line-through text-gray-400" : ""}
                    >
                      {m.title}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
