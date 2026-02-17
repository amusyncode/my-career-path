"use client";

import type { RoadmapGoal, GoalStatus, Milestone } from "@/lib/types";
import {
  X,
  Edit3,
  Trash2,
  Star,
  Calendar,
  CheckCircle2,
  Circle,
} from "lucide-react";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  STATUS_LABELS,
} from "./constants";
import { format, parseISO, differenceInDays } from "date-fns";

interface GoalDetailModalProps {
  isOpen: boolean;
  goal: RoadmapGoal | null;
  onClose: () => void;
  onEdit: (goal: RoadmapGoal) => void;
  onDelete: (goalId: string) => void;
  onStatusChange: (goalId: string, status: GoalStatus) => void;
  onToggleMilestone: (milestone: Milestone) => void;
}

export default function GoalDetailModal({
  isOpen,
  goal,
  onClose,
  onEdit,
  onDelete,
  onStatusChange,
  onToggleMilestone,
}: GoalDetailModalProps) {
  if (!isOpen || !goal) return null;

  const milestones = goal.milestones || [];
  const completedMs = milestones.filter((m) => m.is_completed).length;
  const msProgress =
    milestones.length > 0
      ? Math.round((completedMs / milestones.length) * 100)
      : 0;

  const handleDelete = () => {
    if (window.confirm("이 목표를 삭제하시겠습니까? 관련 마일스톤도 모두 삭제됩니다.")) {
      onDelete(goal.id);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 truncate pr-4">
              {goal.title}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onEdit(goal)}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg"
                title="수정"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* 메타 정보 */}
            <div className="flex flex-wrap gap-2">
              <span
                className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                  CATEGORY_COLORS[goal.category]
                }`}
              >
                {CATEGORY_LABELS[goal.category]}
              </span>
              {goal.target_date && (
                <span className="text-xs rounded-full px-2.5 py-1 bg-gray-100 text-gray-600 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(parseISO(goal.target_date), "yyyy.MM.dd")}
                  {(() => {
                    const d = differenceInDays(
                      parseISO(goal.target_date),
                      new Date()
                    );
                    if (d >= 0) return ` (D-${d})`;
                    return ` (D+${Math.abs(d)})`;
                  })()}
                </span>
              )}
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`w-3.5 h-3.5 ${
                      n <= goal.priority
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* 상태 변경 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                상태
              </label>
              <select
                value={goal.status}
                onChange={(e) =>
                  onStatusChange(goal.id, e.target.value as GoalStatus)
                }
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
              >
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* 설명 */}
            {goal.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  설명
                </label>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {goal.description}
                </p>
              </div>
            )}

            {/* 마일스톤 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">
                  마일스톤
                </label>
                {milestones.length > 0 && (
                  <span className="text-xs text-gray-500">
                    {completedMs}/{milestones.length} 완료
                  </span>
                )}
              </div>

              {milestones.length > 0 && (
                <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${msProgress}%` }}
                  />
                </div>
              )}

              {milestones.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">
                  등록된 마일스톤이 없습니다.
                </p>
              ) : (
                <ul className="space-y-2">
                  {milestones.map((ms) => (
                    <li key={ms.id} className="flex items-start gap-3 group">
                      <button
                        onClick={() => onToggleMilestone(ms)}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {ms.is_completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                          <Circle className="w-5 h-5 text-gray-300 group-hover:text-primary transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-sm ${
                            ms.is_completed
                              ? "line-through text-gray-400"
                              : "text-gray-700"
                          }`}
                        >
                          {ms.title}
                        </p>
                        {ms.target_date && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {format(parseISO(ms.target_date), "yyyy.MM.dd")}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
