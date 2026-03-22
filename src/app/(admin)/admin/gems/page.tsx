"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Gem, GemCategory, EducationLevelWithAll } from "@/lib/types";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  ChevronDown,
  X,
  Save,
  GraduationCap,
  School,
  Globe,
} from "lucide-react";
import toast from "react-hot-toast";

const CATEGORY_LABELS: Record<GemCategory, string> = {
  resume: "이력서 첨삭",
  cover_letter: "자소서 첨삭",
  analysis: "역량 분석",
  counseling: "상담 제안",
};

const EDUCATION_LABELS: Record<EducationLevelWithAll, string> = {
  high_school: "특성화고",
  university: "대학생",
  all: "공통",
};

const EDUCATION_ICONS: Record<EducationLevelWithAll, typeof School> = {
  high_school: School,
  university: GraduationCap,
  all: Globe,
};

const EDUCATION_COLORS: Record<EducationLevelWithAll, string> = {
  high_school: "bg-green-100 text-green-700",
  university: "bg-blue-100 text-blue-700",
  all: "bg-gray-100 text-gray-700",
};

interface GemFormData {
  name: string;
  description: string;
  category: GemCategory;
  education_level: EducationLevelWithAll;
  department: string;
  system_prompt: string;
  is_default: boolean;
  sort_order: number;
}

const EMPTY_FORM: GemFormData = {
  name: "",
  description: "",
  category: "resume",
  education_level: "all",
  department: "",
  system_prompt: "",
  is_default: true,
  sort_order: 100,
};

export default function GemsPage() {
  const supabase = createClient();
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<GemCategory | "all">("all");
  const [filterEducation, setFilterEducation] = useState<EducationLevelWithAll | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingGem, setEditingGem] = useState<Gem | null>(null);
  const [formData, setFormData] = useState<GemFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchGems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gems")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      toast.error("Gem 목록 조회 실패");
      console.error(error);
    } else {
      setGems((data || []) as Gem[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchGems();
  }, [fetchGems]);

  const filteredGems = gems.filter((gem) => {
    if (filterCategory !== "all" && gem.category !== filterCategory) return false;
    if (filterEducation !== "all" && gem.education_level !== filterEducation) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        gem.name.toLowerCase().includes(q) ||
        gem.description?.toLowerCase().includes(q) ||
        gem.department?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleEdit = (gem: Gem) => {
    setEditingGem(gem);
    setFormData({
      name: gem.name,
      description: gem.description || "",
      category: gem.category,
      education_level: gem.education_level,
      department: gem.department || "",
      system_prompt: gem.system_prompt,
      is_default: gem.is_default,
      sort_order: gem.sort_order,
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingGem(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.system_prompt.trim()) {
      toast.error("이름과 시스템 프롬프트는 필수입니다.");
      return;
    }

    setSaving(true);
    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      category: formData.category,
      education_level: formData.education_level,
      department: formData.department.trim() || null,
      system_prompt: formData.system_prompt.trim(),
      is_default: formData.is_default,
      sort_order: formData.sort_order,
    };

    if (editingGem) {
      const { error } = await supabase
        .from("gems")
        .update(payload)
        .eq("id", editingGem.id);

      if (error) {
        toast.error("수정 실패: " + error.message);
      } else {
        toast.success("Gem이 수정되었습니다.");
        setShowForm(false);
        fetchGems();
      }
    } else {
      const { error } = await supabase.from("gems").insert(payload);

      if (error) {
        toast.error("생성 실패: " + error.message);
      } else {
        toast.success("새 Gem이 생성되었습니다.");
        setShowForm(false);
        fetchGems();
      }
    }
    setSaving(false);
  };

  const handleToggleActive = async (gem: Gem) => {
    const { error } = await supabase
      .from("gems")
      .update({ is_active: !gem.is_active })
      .eq("id", gem.id);

    if (error) {
      toast.error("상태 변경 실패");
    } else {
      toast.success(gem.is_active ? "비활성화됨" : "활성화됨");
      fetchGems();
    }
  };

  const handleDelete = async (gem: Gem) => {
    if (!confirm(`"${gem.name}" Gem을 삭제하시겠습니까?`)) return;

    const { error } = await supabase.from("gems").delete().eq("id", gem.id);
    if (error) {
      toast.error("삭제 실패: " + error.message);
    } else {
      toast.success("Gem이 삭제되었습니다.");
      fetchGems();
    }
  };

  // 카운트 통계
  const counts = {
    total: gems.length,
    active: gems.filter((g) => g.is_active).length,
    high_school: gems.filter((g) => g.education_level === "high_school").length,
    university: gems.filter((g) => g.education_level === "university").length,
    common: gems.filter((g) => g.education_level === "all").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">전체</p>
          <p className="text-2xl font-bold text-gray-900">{counts.total}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">활성</p>
          <p className="text-2xl font-bold text-green-600">{counts.active}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">특성화고</p>
          <p className="text-2xl font-bold text-green-700">{counts.high_school}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">대학생</p>
          <p className="text-2xl font-bold text-blue-600">{counts.university}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <p className="text-sm text-gray-500">공통</p>
          <p className="text-2xl font-bold text-gray-600">{counts.common}</p>
        </div>
      </div>

      {/* 필터 + 검색 + 추가 버튼 */}
      <div className="bg-white rounded-xl p-4 shadow-sm border space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {/* 카테고리 필터 */}
            <div className="relative">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value as GemCategory | "all")}
                className="appearance-none bg-gray-50 border rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">모든 카테고리</option>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* 교육수준 필터 */}
            <div className="relative">
              <select
                value={filterEducation}
                onChange={(e) => setFilterEducation(e.target.value as EducationLevelWithAll | "all")}
                className="appearance-none bg-gray-50 border rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="all">모든 교육수준</option>
                {Object.entries(EDUCATION_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-2 bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent w-48"
              />
            </div>
          </div>

          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            새 Gem 추가
          </button>
        </div>
      </div>

      {/* Gem 목록 */}
      <div className="space-y-3">
        {filteredGems.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border text-center text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>조건에 맞는 Gem이 없습니다.</p>
          </div>
        ) : (
          filteredGems.map((gem) => {
            const EduIcon = EDUCATION_ICONS[gem.education_level];
            return (
              <div
                key={gem.id}
                className={`bg-white rounded-xl p-5 shadow-sm border transition-all ${
                  !gem.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-semibold text-gray-900">{gem.name}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${EDUCATION_COLORS[gem.education_level]}`}>
                        <EduIcon className="w-3 h-3" />
                        {EDUCATION_LABELS[gem.education_level]}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                        {CATEGORY_LABELS[gem.category]}
                      </span>
                      {gem.department && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          {gem.department}
                        </span>
                      )}
                      {gem.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                          기본
                        </span>
                      )}
                      {!gem.is_active && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          비활성
                        </span>
                      )}
                    </div>
                    {gem.description && (
                      <p className="text-sm text-gray-600 mb-2">{gem.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>정렬: {gem.sort_order}</span>
                      <span>사용: {gem.usage_count}회</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggleActive(gem)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title={gem.is_active ? "비활성화" : "활성화"}
                    >
                      {gem.is_active ? (
                        <ToggleRight className="w-5 h-5 text-green-600" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleEdit(gem)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Pencil className="w-4 h-4 text-gray-600" />
                    </button>
                    <button
                      onClick={() => handleDelete(gem)}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* 프롬프트 미리보기 */}
                <details className="mt-3">
                  <summary className="text-xs text-purple-600 cursor-pointer hover:underline">
                    시스템 프롬프트 보기
                  </summary>
                  <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto border">
                    {gem.system_prompt}
                  </pre>
                </details>
              </div>
            );
          })
        )}
      </div>

      {/* 생성/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">
                {editingGem ? "Gem 수정" : "새 Gem 추가"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="예: 특성화고 IT 이력서 첨삭"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Gem에 대한 간단한 설명"
                />
              </div>

              {/* 카테고리 + 교육수준 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as GemCategory })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">교육수준 *</label>
                  <select
                    value={formData.education_level}
                    onChange={(e) => setFormData({ ...formData, education_level: e.target.value as EducationLevelWithAll })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {Object.entries(EDUCATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 학과 + 정렬순서 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">학과 (선택)</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="미입력 시 범용"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* 기본 Gem 여부 */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_default: !formData.is_default })}
                  className="flex items-center gap-2"
                >
                  {formData.is_default ? (
                    <ToggleRight className="w-6 h-6 text-purple-600" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                  <span className="text-sm text-gray-700">기본 Gem으로 설정</span>
                </button>
              </div>

              {/* 시스템 프롬프트 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시스템 프롬프트 *
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  rows={12}
                  placeholder="AI에게 전달할 시스템 프롬프트를 입력하세요..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  {formData.system_prompt.length}자
                </p>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
              >
                <Save className="w-4 h-4" />
                {saving ? "저장 중..." : editingGem ? "수정" : "생성"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
