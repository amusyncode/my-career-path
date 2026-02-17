"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type {
  RoadmapGoal,
  GoalCategory,
  GoalStatus,
  Milestone,
} from "@/lib/types";
import type { DropResult } from "react-beautiful-dnd";
import { Plus, Target, TrendingUp, CheckCircle2, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";

import { ALL_CATEGORIES, FILTER_LABELS } from "./_components/constants";
import GoalModal from "./_components/GoalModal";
import GoalDetailModal from "./_components/GoalDetailModal";
import TimelineView from "./_components/TimelineView";
import KanbanView from "./_components/KanbanView";

type ViewMode = "timeline" | "kanban";

export default function RoadmapPage() {
  const supabase = createClient();

  const [goals, setGoals] = useState<RoadmapGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [categoryFilter, setCategoryFilter] = useState<GoalCategory | "all">(
    "all"
  );

  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<RoadmapGoal | null>(null);
  const [detailGoal, setDetailGoal] = useState<RoadmapGoal | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  /* ==================== Fetch ==================== */
  const fetchGoals = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("roadmap_goals")
        .select("*, milestones(*)")
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      if (error) throw error;
      if (data) setGoals(data as RoadmapGoal[]);
    } catch {
      toast.error("목표를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  /* ==================== 필터 & 통계 ==================== */
  const filteredGoals =
    categoryFilter === "all"
      ? goals
      : goals.filter((g) => g.category === categoryFilter);

  const totalCount = goals.length;
  const inProgressCount = goals.filter(
    (g) => g.status === "in_progress"
  ).length;
  const completedCount = goals.filter(
    (g) => g.status === "completed"
  ).length;
  const progressPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  /* ==================== Save (Create / Update) ==================== */
  const handleSaveGoal = async (
    goalData: {
      title: string;
      description: string;
      category: GoalCategory;
      target_date: string;
      priority: number;
    },
    milestonesData: { id?: string; title: string; target_date: string }[],
    editingGoalId?: string
  ) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      if (editingGoalId) {
        const { error } = await supabase
          .from("roadmap_goals")
          .update({
            title: goalData.title,
            description: goalData.description || null,
            category: goalData.category,
            target_date: goalData.target_date || null,
            priority: goalData.priority,
          })
          .eq("id", editingGoalId);
        if (error) throw error;

        await supabase
          .from("milestones")
          .delete()
          .eq("goal_id", editingGoalId);

        if (milestonesData.length > 0) {
          const { error: msErr } = await supabase.from("milestones").insert(
            milestonesData.map((m, i) => ({
              goal_id: editingGoalId,
              title: m.title,
              target_date: m.target_date || null,
              order_index: i,
            }))
          );
          if (msErr) throw msErr;
        }
        toast.success("목표가 수정되었습니다.");
      } else {
        const maxOrder =
          goals.length > 0
            ? Math.max(...goals.map((g) => g.order_index))
            : -1;

        const { data: newGoal, error } = await supabase
          .from("roadmap_goals")
          .insert({
            user_id: user.id,
            title: goalData.title,
            description: goalData.description || null,
            category: goalData.category,
            target_date: goalData.target_date || null,
            priority: goalData.priority,
            order_index: maxOrder + 1,
          })
          .select()
          .single();
        if (error) throw error;

        if (newGoal && milestonesData.length > 0) {
          const { error: msErr } = await supabase.from("milestones").insert(
            milestonesData.map((m, i) => ({
              goal_id: newGoal.id,
              title: m.title,
              target_date: m.target_date || null,
              order_index: i,
            }))
          );
          if (msErr) throw msErr;
        }
        toast.success("새 목표가 추가되었습니다.");
      }

      setGoalModalOpen(false);
      setEditingGoal(null);
      fetchGoals();
    } catch {
      toast.error("저장에 실패했습니다.");
    }
  };

  /* ==================== Delete ==================== */
  const handleDeleteGoal = async (goalId: string) => {
    const prev = [...goals];
    setGoals((g) => g.filter((x) => x.id !== goalId));
    setDetailModalOpen(false);
    setDetailGoal(null);

    const { error } = await supabase
      .from("roadmap_goals")
      .delete()
      .eq("id", goalId);

    if (error) {
      toast.error("삭제에 실패했습니다.");
      setGoals(prev);
    } else {
      toast.success("목표가 삭제되었습니다.");
    }
  };

  /* ==================== Status Change ==================== */
  const handleStatusChange = async (goalId: string, status: GoalStatus) => {
    const prev = [...goals];
    const patch = {
      status,
      completed_at:
        status === "completed" ? new Date().toISOString() : null,
    };

    setGoals((g) =>
      g.map((x) => (x.id === goalId ? { ...x, ...patch } : x))
    );
    setDetailGoal((dg) =>
      dg && dg.id === goalId ? { ...dg, ...patch } : dg
    );

    const { error } = await supabase
      .from("roadmap_goals")
      .update(patch)
      .eq("id", goalId);

    if (error) {
      toast.error("상태 변경에 실패했습니다.");
      setGoals(prev);
    }
  };

  /* ==================== Toggle Milestone ==================== */
  const handleToggleMilestone = async (milestone: Milestone) => {
    const done = !milestone.is_completed;
    const prev = [...goals];
    const msPatch = {
      is_completed: done,
      completed_at: done ? new Date().toISOString() : null,
    };

    const patchMs = (ms: Milestone[] | undefined) =>
      ms?.map((m) => (m.id === milestone.id ? { ...m, ...msPatch } : m));

    setGoals((g) =>
      g.map((x) => ({ ...x, milestones: patchMs(x.milestones) }))
    );
    setDetailGoal((dg) =>
      dg ? { ...dg, milestones: patchMs(dg.milestones) } : dg
    );

    const { error } = await supabase
      .from("milestones")
      .update(msPatch)
      .eq("id", milestone.id);

    if (error) {
      toast.error("마일스톤 업데이트에 실패했습니다.");
      setGoals(prev);
    }
  };

  /* ==================== Kanban Drag & Drop ==================== */
  const handleDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    )
      return;

    const prev = [...goals];
    const newStatus = destination.droppableId as GoalStatus;
    const srcStatus = source.droppableId as GoalStatus;

    let updated = goals.map((g) =>
      g.id === draggableId
        ? {
            ...g,
            status: newStatus,
            completed_at:
              newStatus === "completed" ? new Date().toISOString() : null,
          }
        : g
    );

    // 목적지 컬럼 순서 재정렬
    const destItems = updated
      .filter((g) => g.status === newStatus && g.id !== draggableId)
      .sort((a, b) => a.order_index - b.order_index);
    const movedItem = updated.find((g) => g.id === draggableId)!;
    destItems.splice(destination.index, 0, movedItem);

    const orderUpdates: {
      id: string;
      order_index: number;
      status: GoalStatus;
    }[] = [];
    destItems.forEach((item, i) =>
      orderUpdates.push({ id: item.id, order_index: i, status: newStatus })
    );

    if (srcStatus !== newStatus) {
      updated
        .filter((g) => g.status === srcStatus && g.id !== draggableId)
        .sort((a, b) => a.order_index - b.order_index)
        .forEach((item, i) =>
          orderUpdates.push({
            id: item.id,
            order_index: i,
            status: srcStatus,
          })
        );
    }

    updated = updated.map((g) => {
      const u = orderUpdates.find((x) => x.id === g.id);
      return u ? { ...g, order_index: u.order_index, status: u.status } : g;
    });
    setGoals(updated);

    try {
      for (const u of orderUpdates) {
        const { error } = await supabase
          .from("roadmap_goals")
          .update({
            order_index: u.order_index,
            status: u.status,
            completed_at:
              u.status === "completed" ? new Date().toISOString() : null,
          })
          .eq("id", u.id);
        if (error) throw error;
      }
    } catch {
      toast.error("순서 변경에 실패했습니다.");
      setGoals(prev);
    }
  };

  /* ==================== 핸들러 ==================== */
  const openAddModal = () => {
    setEditingGoal(null);
    setGoalModalOpen(true);
  };
  const openEditModal = (goal: RoadmapGoal) => {
    setDetailModalOpen(false);
    setEditingGoal(goal);
    setGoalModalOpen(true);
  };
  const openDetail = (goal: RoadmapGoal) => {
    setDetailGoal(goal);
    setDetailModalOpen(true);
  };

  /* ==================== 로딩 스켈레톤 ==================== */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-7 w-10 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4">
              <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-4 w-1/3 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ==================== Render ==================== */
  return (
    <div className="space-y-6">
      {/* 상단 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">나의 취업 로드맵</h2>
        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <Plus className="w-4 h-4" />새 목표 추가
        </button>
      </div>

      {/* 뷰 전환 + 필터 */}
      <div className="space-y-3">
        <div className="flex gap-4 border-b border-gray-200">
          {(["timeline", "kanban"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`pb-2.5 text-sm font-medium transition-colors ${
                viewMode === mode
                  ? "text-primary border-b-2 border-primary"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {mode === "timeline" ? "타임라인" : "칸반"}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {ALL_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`text-sm rounded-full px-4 py-1.5 font-medium transition-colors ${
                categoryFilter === cat
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {FILTER_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Target, label: "전체 목표", value: totalCount, color: "text-blue-500", bg: "bg-blue-50" },
          { icon: TrendingUp, label: "진행중", value: inProgressCount, color: "text-orange-500", bg: "bg-orange-50" },
          { icon: CheckCircle2, label: "완료", value: completedCount, color: "text-green-500", bg: "bg-green-50" },
          { icon: BarChart3, label: "달성률", value: `${progressPercent}%`, color: "text-purple-500", bg: "bg-purple-50" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center flex-shrink-0`}>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 빈 상태 or 뷰 */}
      {filteredGoals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            아직 목표가 없어요
          </h3>
          <p className="text-gray-500 mb-6">
            첫 번째 취업 목표를 세워보세요!
          </p>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            목표 추가하기
          </button>
        </div>
      ) : viewMode === "timeline" ? (
        <TimelineView goals={filteredGoals} onGoalClick={openDetail} />
      ) : (
        <KanbanView
          goals={filteredGoals}
          onGoalClick={openDetail}
          onDragEnd={handleDragEnd}
        />
      )}

      {/* 모달 */}
      <GoalModal
        isOpen={goalModalOpen}
        onClose={() => {
          setGoalModalOpen(false);
          setEditingGoal(null);
        }}
        onSave={handleSaveGoal}
        editingGoal={editingGoal}
      />
      <GoalDetailModal
        isOpen={detailModalOpen}
        goal={detailGoal}
        onClose={() => {
          setDetailModalOpen(false);
          setDetailGoal(null);
        }}
        onEdit={openEditModal}
        onDelete={handleDeleteGoal}
        onStatusChange={handleStatusChange}
        onToggleMilestone={handleToggleMilestone}
      />
    </div>
  );
}
