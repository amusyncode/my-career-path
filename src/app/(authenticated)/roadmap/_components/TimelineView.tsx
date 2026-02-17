"use client";

import type { RoadmapGoal } from "@/lib/types";
import { Star, Calendar } from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_NODE_COLORS,
} from "./constants";
import { format, parseISO } from "date-fns";

interface TimelineViewProps {
  goals: RoadmapGoal[];
  onGoalClick: (goal: RoadmapGoal) => void;
}

export default function TimelineView({ goals, onGoalClick }: TimelineViewProps) {
  return (
    <div className="relative">
      {/* 세로선 */}
      <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-blue-200" />

      <div className="space-y-4">
        {goals.map((goal) => {
          const milestones = goal.milestones || [];
          const completedMs = milestones.filter((m) => m.is_completed).length;
          const msProgress =
            milestones.length > 0
              ? Math.round((completedMs / milestones.length) * 100)
              : 0;

          return (
            <div key={goal.id} className="relative pl-10">
              {/* 노드 */}
              <div
                className={`absolute left-[9px] top-5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm ${
                  STATUS_NODE_COLORS[goal.status]
                }`}
              />

              {/* 카드 */}
              <div
                onClick={() => onGoalClick(goal)}
                className="bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow border border-gray-100"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {goal.title}
                    </h4>
                    {goal.description && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">
                        {goal.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {Array.from({ length: goal.priority }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-3 h-3 fill-yellow-400 text-yellow-400"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span
                    className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                      CATEGORY_COLORS[goal.category]
                    }`}
                  >
                    {CATEGORY_LABELS[goal.category]}
                  </span>
                  {goal.target_date && (
                    <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                      <Calendar className="w-3 h-3" />
                      {format(parseISO(goal.target_date), "yyyy.MM.dd")}
                    </span>
                  )}
                  {milestones.length > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-green-500 h-1.5 rounded-full transition-all"
                          style={{ width: `${msProgress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {completedMs}/{milestones.length}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
