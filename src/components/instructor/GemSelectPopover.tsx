"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Star, X } from "lucide-react";
import type { Gem, GemCategory, EducationLevel } from "@/lib/types";

interface GemSelectPopoverProps {
  category: GemCategory;
  educationLevel: EducationLevel;
  department?: string;
  onSelect: (gemId: string) => void;
  onCancel: () => void;
}

export default function GemSelectPopover({
  category,
  educationLevel,
  department,
  onSelect,
  onCancel,
}: GemSelectPopoverProps) {
  const [gems, setGems] = useState<Gem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchGems = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("category", category);
        if (educationLevel) params.set("educationLevel", educationLevel);
        if (department) params.set("department", department);

        const res = await fetch(`/api/gems?${params.toString()}`);
        const data = await res.json();
        if (data.data) {
          setGems(data.data);
          const defaultGem = data.data.find((g: Gem) => g.is_default);
          setSelectedId(defaultGem?.id || data.data[0]?.id || null);
        }
      } catch {
        console.error("Gem 목록 조회 실패");
      }
      setIsLoading(false);
    };
    fetchGems();
  }, [category, educationLevel, department]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onCancel]);

  // Group gems
  const recommended = gems.filter(
    (g) =>
      (g.education_level === educationLevel || g.education_level === "all") &&
      g.department === department
  );
  const general = gems.filter(
    (g) => !g.department && !recommended.includes(g)
  );
  const custom = gems.filter(
    (g) =>
      g.scope === "instructor" &&
      !recommended.includes(g) &&
      !general.includes(g)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={ref}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-72"
      >
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
            Gem 선택
          </h4>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
          </div>
        ) : gems.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            사용 가능한 Gem이 없습니다
          </p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {recommended.length > 0 && (
              <GemGroup
                label="추천"
                gems={recommended}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
            {general.length > 0 && (
              <GemGroup
                label="범용"
                gems={general}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
            {custom.length > 0 && (
              <GemGroup
                label="내 커스텀 Gem"
                gems={custom}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
          >
            취소
          </button>
          <button
            onClick={() => selectedId && onSelect(selectedId)}
            disabled={!selectedId}
            className="bg-purple-500 text-white text-sm rounded-lg px-3 py-1.5 hover:bg-purple-600 disabled:opacity-50 transition-colors"
          >
            첨삭 시작
          </button>
        </div>
      </div>
    </div>
  );
}

function GemGroup({
  label,
  gems,
  selectedId,
  onSelect,
}: {
  label: string;
  gems: Gem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-2">
      <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1 px-1">
        {label}
      </p>
      {gems.map((g) => (
        <button
          key={g.id}
          onClick={() => onSelect(g.id)}
          className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors ${
            selectedId === g.id
              ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700"
              : "hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
            {g.name}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {g.is_default && (
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                g.education_level === "high_school"
                  ? "bg-purple-50 text-purple-600"
                  : g.education_level === "university"
                  ? "bg-blue-50 text-blue-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {g.education_level === "high_school"
                ? "특성화고"
                : g.education_level === "university"
                ? "대학교"
                : "전체"}
            </span>
            {g.usage_count > 0 && (
              <span className="text-[10px] text-gray-400">
                {g.usage_count}회
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
