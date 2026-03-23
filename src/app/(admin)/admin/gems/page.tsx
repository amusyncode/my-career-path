"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Gem, GemCategory, EducationLevelWithAll } from "@/lib/types";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronDown,
  GraduationCap,
  School,
  Globe,
  Loader2,
  Users,
  X,
  Save,
} from "lucide-react";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import toast from "react-hot-toast";
import { format } from "date-fns";

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

const EDUCATION_EMOJI: Record<EducationLevelWithAll, string> = {
  high_school: "📚",
  university: "🎓",
  all: "🌐",
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
  sort_order: number;
}

const EMPTY_FORM: GemFormData = {
  name: "",
  description: "",
  category: "resume",
  education_level: "all",
  department: "",
  system_prompt: "",
  sort_order: 100,
};

type TabKey = "global" | "instructor";

export default function GemsPage() {
  const supabase = createClient();
  const [gems, setGems] = useState<Gem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("global");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");

  // Instructor list for custom gems filter
  const [instructorOptions, setInstructorOptions] = useState<
    { id: string; name: string }[]
  >([]);

  // Global gem form modal
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

  // Fetch instructor options
  useEffect(() => {
    const fetchInstructors = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "instructor")
        .order("name");
      if (data) setInstructorOptions(data);
    };
    fetchInstructors();
  }, [supabase]);

  // Separate global and instructor gems
  const globalGems = gems.filter((g) => g.scope === "global");
  const instructorGems = gems.filter((g) => g.scope === "instructor");

  // Filter global gems by search
  const filteredGlobalGems = globalGems.filter((gem) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      gem.name.toLowerCase().includes(q) ||
      gem.description?.toLowerCase().includes(q) ||
      gem.department?.toLowerCase().includes(q)
    );
  });

  // Group global gems by education_level + category
  const groupedGlobalGems = new Map<string, Gem[]>();
  filteredGlobalGems.forEach((gem) => {
    const key = `${gem.education_level}:${gem.category}`;
    if (!groupedGlobalGems.has(key)) {
      groupedGlobalGems.set(key, []);
    }
    groupedGlobalGems.get(key)!.push(gem);
  });

  const eduOrder: EducationLevelWithAll[] = ["high_school", "university", "all"];
  const catOrder: GemCategory[] = ["resume", "cover_letter", "analysis", "counseling"];
  const sortedGroupKeys = Array.from(groupedGlobalGems.keys()).sort((a, b) => {
    const [aEdu, aCat] = a.split(":");
    const [bEdu, bCat] = b.split(":");
    const eduDiff =
      eduOrder.indexOf(aEdu as EducationLevelWithAll) -
      eduOrder.indexOf(bEdu as EducationLevelWithAll);
    if (eduDiff !== 0) return eduDiff;
    return (
      catOrder.indexOf(aCat as GemCategory) -
      catOrder.indexOf(bCat as GemCategory)
    );
  });

  // Filter instructor gems
  const filteredInstructorGems = instructorGems.filter((gem) => {
    if (instructorFilter !== "all" && gem.created_by !== instructorFilter)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        gem.name.toLowerCase().includes(q) ||
        gem.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const instrNameMap = new Map(instructorOptions.map((i) => [i.id, i.name]));

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

  const handleCreateGlobal = () => {
    setEditingGem(null);
    setFormData(EMPTY_FORM);
    setShowForm(true);
  };

  const handleEditGem = (gem: Gem) => {
    setEditingGem(gem);
    setFormData({
      name: gem.name,
      description: gem.description || "",
      category: gem.category,
      education_level: gem.education_level,
      department: gem.department || "",
      system_prompt: gem.system_prompt,
      sort_order: gem.sort_order,
    });
    setShowForm(true);
  };

  const handleSaveForm = async () => {
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
      sort_order: formData.sort_order,
      scope: "global" as const,
      is_default: true,
      is_active: true,
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gem 관리</h2>
          <p className="text-sm text-gray-500 mt-1">
            AI 첨삭에 사용되는 시스템 프롬프트를 관리합니다
          </p>
        </div>
        {activeTab === "global" && (
          <button
            onClick={handleCreateGlobal}
            className="flex items-center gap-2 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            기본 Gem 추가
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-0">
          <button
            onClick={() => {
              setActiveTab("global");
              setSearchQuery("");
            }}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "global"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            기본 Gem ({globalGems.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("instructor");
              setSearchQuery("");
            }}
            className={`pb-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "instructor"
                ? "text-red-600 border-b-2 border-red-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            강사 커스텀 Gem ({instructorGems.length})
          </button>
        </div>
      </div>

      {/* Search / filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Gem 이름, 설명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-3 py-2 w-full bg-gray-50 border rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          {activeTab === "instructor" && (
            <div className="relative">
              <select
                value={instructorFilter}
                onChange={(e) => setInstructorFilter(e.target.value)}
                className="appearance-none bg-gray-50 border rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
              >
                <option value="all">전체 강사</option>
                {instructorOptions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Global Gems Tab */}
      {activeTab === "global" && (
        <div className="space-y-6">
          {sortedGroupKeys.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm text-center text-gray-500">
              <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>조건에 맞는 Gem이 없습니다.</p>
            </div>
          ) : (
            sortedGroupKeys.map((groupKey) => {
              const [edu, cat] = groupKey.split(":") as [
                EducationLevelWithAll,
                GemCategory,
              ];
              const gemsInGroup = groupedGlobalGems.get(groupKey)!;

              return (
                <div key={groupKey}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>{EDUCATION_EMOJI[edu]}</span>
                    {EDUCATION_LABELS[edu]} {CATEGORY_LABELS[cat]}
                    <span className="text-xs text-gray-400 font-normal">
                      ({gemsInGroup.length})
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {gemsInGroup.map((gem) => {
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
                                <h4 className="font-semibold text-gray-900">
                                  {gem.name}
                                </h4>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                                    EDUCATION_COLORS[gem.education_level]
                                  }`}
                                >
                                  <EduIcon className="w-3 h-3" />
                                  {EDUCATION_LABELS[gem.education_level]}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  {CATEGORY_LABELS[gem.category]}
                                </span>
                                {gem.department && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                                    {gem.department}
                                  </span>
                                )}
                              </div>
                              {gem.description && (
                                <p className="text-sm text-gray-600 mb-2">
                                  {gem.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-400">
                                <span>사용: {gem.usage_count}회</span>
                                <span>정렬: {gem.sort_order}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <ToggleSwitch
                                checked={gem.is_active}
                                onChange={() => handleToggleActive(gem)}
                              />
                              <button
                                onClick={() => handleEditGem(gem)}
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

                          <details className="mt-3">
                            <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                              프롬프트 보기
                            </summary>
                            <pre className="mt-2 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto border">
                              {gem.system_prompt}
                            </pre>
                          </details>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Instructor Custom Gems Tab (read-only) */}
      {activeTab === "instructor" && (
        <div>
          {filteredInstructorGems.length === 0 ? (
            <div className="bg-white rounded-xl p-12 shadow-sm text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>강사가 만든 커스텀 Gem이 없습니다.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        Gem 이름
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        강사
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        학교급
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        카테고리
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        학과
                      </th>
                      <th className="text-center py-3 px-4 font-medium text-gray-600">
                        사용횟수
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-gray-600">
                        생성일
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInstructorGems.map((gem) => (
                      <tr key={gem.id}>
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-gray-900">
                              {gem.name}
                            </p>
                            {gem.description && (
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">
                                {gem.description}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-700">
                          {gem.created_by
                            ? instrNameMap.get(gem.created_by) || "-"
                            : "-"}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              EDUCATION_COLORS[gem.education_level]
                            }`}
                          >
                            {EDUCATION_LABELS[gem.education_level]}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {CATEGORY_LABELS[gem.category]}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {gem.department || "-"}
                        </td>
                        <td className="py-3 px-4 text-center text-gray-700">
                          {gem.usage_count}
                        </td>
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {format(new Date(gem.created_at), "yyyy.MM.dd")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Expandable prompts */}
              <div className="border-t px-4 py-3 space-y-2">
                {filteredInstructorGems.map((gem) => (
                  <details key={`prompt-${gem.id}`}>
                    <summary className="text-xs text-red-600 cursor-pointer hover:underline">
                      {gem.name} - 프롬프트 보기
                    </summary>
                    <pre className="mt-1 p-3 bg-gray-50 rounded-lg text-xs text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto border">
                      {gem.system_prompt}
                    </pre>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Global Gem Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-900">
                {editingGem ? "기본 Gem 수정" : "새 기본 Gem 추가"}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="예: 특성화고 IT 이력서 첨삭"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Gem에 대한 간단한 설명"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리 *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        category: e.target.value as GemCategory,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    교육수준 *
                  </label>
                  <select
                    value={formData.education_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        education_level: e.target
                          .value as EducationLevelWithAll,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  >
                    {Object.entries(EDUCATION_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    학과 (선택)
                  </label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="미입력 시 범용"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    정렬 순서
                  </label>
                  <input
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sort_order: parseInt(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  시스템 프롬프트 *
                </label>
                <textarea
                  value={formData.system_prompt}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      system_prompt: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent font-mono text-sm"
                  rows={12}
                  placeholder="AI에게 전달할 시스템 프롬프트를 입력하세요..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  {formData.system_prompt.length}자
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t sticky bottom-0 bg-white rounded-b-2xl">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSaveForm}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 text-sm font-medium"
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
