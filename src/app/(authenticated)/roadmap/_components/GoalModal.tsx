"use client";

import { useState, useEffect } from "react";
import type { RoadmapGoal, GoalCategory } from "@/lib/types";
import { X, Plus, Trash2, Star } from "lucide-react";
import { CATEGORY_LABELS } from "./constants";

interface MilestoneInput {
  id?: string;
  title: string;
  target_date: string;
}

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    goal: {
      title: string;
      description: string;
      category: GoalCategory;
      target_date: string;
      priority: number;
    },
    milestones: MilestoneInput[],
    editingGoalId?: string
  ) => void;
  editingGoal?: RoadmapGoal | null;
}

export default function GoalModal({
  isOpen,
  onClose,
  onSave,
  editingGoal,
}: GoalModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<GoalCategory>("other");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState(3);
  const [milestones, setMilestones] = useState<MilestoneInput[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingGoal) {
      setTitle(editingGoal.title);
      setDescription(editingGoal.description || "");
      setCategory(editingGoal.category);
      setTargetDate(editingGoal.target_date || "");
      setPriority(editingGoal.priority);
      setMilestones(
        (editingGoal.milestones || []).map((m) => ({
          id: m.id,
          title: m.title,
          target_date: m.target_date || "",
        }))
      );
    } else {
      setTitle("");
      setDescription("");
      setCategory("other");
      setTargetDate("");
      setPriority(3);
      setMilestones([]);
    }
  }, [editingGoal, isOpen]);

  const addMilestone = () => {
    setMilestones((prev) => [...prev, { title: "", target_date: "" }]);
  };

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMilestone = (
    index: number,
    field: keyof MilestoneInput,
    value: string
  ) => {
    setMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await onSave(
      { title: title.trim(), description, category, target_date: targetDate, priority },
      milestones.filter((m) => m.title.trim()),
      editingGoal?.id
    );
    setSaving(false);
  };

  if (!isOpen) return null;

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
            <h2 className="text-lg font-bold text-gray-900">
              {editingGoal ? "목표 수정" : "새 목표 추가"}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 정보처리기사 취득"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                required
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="목표에 대한 상세 설명"
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm resize-none"
              />
            </div>

            {/* 카테고리 + 마감일 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  카테고리
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as GoalCategory)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm bg-white"
                >
                  {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  마감일
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                />
              </div>
            </div>

            {/* 우선순위 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                우선순위
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPriority(n)}
                    className="p-1"
                  >
                    <Star
                      className={`w-6 h-6 transition-colors ${
                        n <= priority
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* 마일스톤 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  마일스톤
                </label>
                <button
                  type="button"
                  onClick={addMilestone}
                  className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  마일스톤 추가
                </button>
              </div>
              {milestones.length === 0 ? (
                <p className="text-xs text-gray-400 py-3 text-center">
                  마일스톤을 추가하여 세부 단계를 관리하세요.
                </p>
              ) : (
                <div className="space-y-2">
                  {milestones.map((ms, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={ms.title}
                        onChange={(e) =>
                          updateMilestone(i, "title", e.target.value)
                        }
                        placeholder={`마일스톤 ${i + 1}`}
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      />
                      <input
                        type="date"
                        value={ms.target_date}
                        onChange={(e) =>
                          updateMilestone(i, "target_date", e.target.value)
                        }
                        className="w-36 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeMilestone(i)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
