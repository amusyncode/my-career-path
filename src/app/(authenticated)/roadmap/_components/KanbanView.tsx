"use client";

import type { RoadmapGoal, GoalStatus } from "@/lib/types";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "react-beautiful-dnd";
import { Star, Calendar } from "lucide-react";
import {
  STATUS_LABELS,
  STATUS_COLUMN_COLORS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  KANBAN_COLUMNS,
} from "./constants";
import { format, parseISO } from "date-fns";

interface KanbanViewProps {
  goals: RoadmapGoal[];
  onGoalClick: (goal: RoadmapGoal) => void;
  onDragEnd: (result: DropResult) => void;
}

export default function KanbanView({
  goals,
  onGoalClick,
  onDragEnd,
}: KanbanViewProps) {
  const columnGoals = (status: GoalStatus) =>
    goals
      .filter((g) => g.status === status)
      .sort((a, b) => a.order_index - b.order_index);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {KANBAN_COLUMNS.map((status) => {
          const items = columnGoals(status);
          return (
            <div
              key={status}
              className={`bg-gray-50 rounded-xl p-3 border-t-4 ${STATUS_COLUMN_COLORS[status]}`}
            >
              {/* 컬럼 헤더 */}
              <div className="flex items-center justify-between mb-3 px-1">
                <h3 className="text-sm font-semibold text-gray-700">
                  {STATUS_LABELS[status]}
                </h3>
                <span className="text-xs bg-white text-gray-500 rounded-full px-2 py-0.5 font-medium shadow-sm">
                  {items.length}
                </span>
              </div>

              {/* 드래그 영역 */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`space-y-2 min-h-[100px] rounded-lg transition-colors ${
                      snapshot.isDraggingOver ? "bg-blue-50" : ""
                    }`}
                  >
                    {items.map((goal, index) => {
                      const milestones = goal.milestones || [];
                      const completedMs = milestones.filter(
                        (m) => m.is_completed
                      ).length;
                      const msProgress =
                        milestones.length > 0
                          ? Math.round(
                              (completedMs / milestones.length) * 100
                            )
                          : 0;

                      return (
                        <Draggable
                          key={goal.id}
                          draggableId={goal.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => onGoalClick(goal)}
                              className={`bg-white rounded-lg shadow-sm p-3 cursor-grab active:cursor-grabbing border border-gray-100 ${
                                snapshot.isDragging ? "shadow-lg rotate-2" : ""
                              }`}
                            >
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
                                {goal.title}
                              </h4>

                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span
                                  className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                                    CATEGORY_COLORS[goal.category]
                                  }`}
                                >
                                  {CATEGORY_LABELS[goal.category]}
                                </span>
                                <div className="flex items-center gap-0.5">
                                  {Array.from({ length: goal.priority }).map(
                                    (_, i) => (
                                      <Star
                                        key={i}
                                        className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400"
                                      />
                                    )
                                  )}
                                </div>
                              </div>

                              {goal.target_date && (
                                <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-2">
                                  <Calendar className="w-3 h-3" />
                                  {format(
                                    parseISO(goal.target_date),
                                    "MM.dd"
                                  )}
                                </p>
                              )}

                              {milestones.length > 0 && (
                                <div className="flex items-center gap-1.5 mt-2">
                                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
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
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}
