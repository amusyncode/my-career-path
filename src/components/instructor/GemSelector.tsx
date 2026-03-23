"use client";

import { useState, useEffect } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Gem, GemCategory, EducationLevel } from "@/lib/types";

interface GemSelectorProps {
  category: GemCategory;
  educationLevel: EducationLevel;
  department?: string;
  value: string | null;
  onChange: (gemId: string) => void;
}

export default function GemSelector({
  category,
  educationLevel,
  department,
  value,
  onChange,
}: GemSelectorProps) {
  const [gems, setGems] = useState<Gem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

          // Auto-select default gem if no value set
          if (!value && data.data.length > 0) {
            const defaultGem = data.data.find((g: Gem) => g.is_default);
            if (defaultGem) {
              onChange(defaultGem.id);
            } else {
              onChange(data.data[0].id);
            }
          }
        }
      } catch (err) {
        console.error("Gem 목록 조회 실패:", err);
      }
      setIsLoading(false);
    };

    fetchGems();
  }, [category, educationLevel, department]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        Gem 로딩 중...
      </div>
    );
  }

  if (gems.length === 0) {
    return (
      <p className="text-sm text-gray-400">사용 가능한 Gem이 없습니다.</p>
    );
  }

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
    (g) => g.scope === "instructor" && !recommended.includes(g) && !general.includes(g)
  );
  const others = gems.filter(
    (g) => !recommended.includes(g) && !general.includes(g) && !custom.includes(g)
  );

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        <Sparkles className="w-4 h-4 inline mr-1 text-purple-500" />
        AI 첨삭에 사용할 Gem 선택
      </label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
      >
        {recommended.length > 0 && (
          <optgroup label="추천 (학생 전공 매칭)">
            {recommended.map((g) => (
              <option key={g.id} value={g.id}>
                {g.is_default ? "⭐ " : ""}
                {g.name}
                {g.department ? ` · ${g.department}` : ""}
                {g.education_level !== "all"
                  ? ` · ${g.education_level === "high_school" ? "특성화고" : "대학교"}`
                  : ""}
                {g.usage_count > 0 ? ` (${g.usage_count}회)` : ""}
              </option>
            ))}
          </optgroup>
        )}
        {general.length > 0 && (
          <optgroup label="범용">
            {general.map((g) => (
              <option key={g.id} value={g.id}>
                {g.is_default ? "⭐ " : ""}
                {g.name}
                {g.usage_count > 0 ? ` (${g.usage_count}회)` : ""}
              </option>
            ))}
          </optgroup>
        )}
        {custom.length > 0 && (
          <optgroup label="내 커스텀 Gem">
            {custom.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.usage_count > 0 ? ` (${g.usage_count}회)` : ""}
              </option>
            ))}
          </optgroup>
        )}
        {others.length > 0 && (
          <optgroup label="기타">
            {others.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
                {g.usage_count > 0 ? ` (${g.usage_count}회)` : ""}
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );
}
