"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { JobMatchingResult, JobMatch } from "@/lib/types";
import {
  Search,
  Loader2,
  Target,
  CheckSquare,
  Star,
  ArrowRight,
  Briefcase,
} from "lucide-react";

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
}

interface MatchingOptions {
  skillBased: boolean;
  certBased: boolean;
  portfolioBased: boolean;
  personalityBased: boolean;
}

function MatchRateBadge({ rate }: { rate: number }) {
  const color =
    rate >= 80
      ? "bg-green-100 text-green-700"
      : rate >= 60
      ? "bg-yellow-100 text-yellow-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${color}`}>
      {rate}%
    </span>
  );
}

function JobMatchCard({ match }: { match: JobMatch }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-500" />
          {match.job_title}
        </h4>
        <MatchRateBadge rate={match.match_rate} />
      </div>

      {/* 매칭 근거 */}
      {match.reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 mb-1">매칭 근거</p>
          <ul className="space-y-1">
            {match.reasons.map((r, i) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-1.5">
                <span className="text-purple-400 mt-0.5">•</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 보유 스킬 vs 부족 스킬 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <p className="text-xs text-green-600 font-medium mb-1">보유 스킬</p>
          <div className="flex flex-wrap gap-1">
            {match.student_has.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full"
              >
                {s}
              </span>
            ))}
            {match.student_has.length === 0 && (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        </div>
        <div>
          <p className="text-xs text-red-600 font-medium mb-1">부족 스킬</p>
          <div className="flex flex-wrap gap-1">
            {match.student_lacks.map((s, i) => (
              <span
                key={i}
                className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
              >
                {s}
              </span>
            ))}
            {match.student_lacks.length === 0 && (
              <span className="text-xs text-gray-400">-</span>
            )}
          </div>
        </div>
      </div>

      {/* 준비 조언 */}
      {match.preparation_tips && (
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-500 mb-1">준비 조언</p>
          <p className="text-sm text-gray-700">{match.preparation_tips}</p>
        </div>
      )}
    </div>
  );
}

export default function JobMatchingTab() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [result, setResult] = useState<JobMatchingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<MatchingOptions>({
    skillBased: true,
    certBased: true,
    portfolioBased: true,
    personalityBased: false,
  });

  const searchStudents = useCallback(
    async (query: string) => {
      if (query.length < 1) {
        setStudents([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, school, department")
          .eq("role", "user")
          .ilike("name", `%${query}%`)
          .limit(10);
        setStudents(
          (data || []).map((p) => ({
            id: p.id,
            name: p.name || "이름없음",
            school: p.school,
            department: p.department,
          }))
        );
      } catch {
        setStudents([]);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase]
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => searchStudents(value), 300);
    return () => clearTimeout(timer);
  };

  const selectStudent = (student: StudentOption) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setStudents([]);
    setResult(null);
    setError(null);
  };

  const runMatching = async () => {
    if (!selectedStudent) return;
    setIsMatching(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/gemini/job-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedStudent.id,
          options,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "매칭 분석 실패");
      }

      setResult(data as JobMatchingResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "매칭 중 오류가 발생했습니다.");
    } finally {
      setIsMatching(false);
    }
  };

  const optionItems = [
    { key: "skillBased" as const, label: "스킬 기반 매칭" },
    { key: "certBased" as const, label: "자격증 기반 매칭" },
    { key: "portfolioBased" as const, label: "포트폴리오 기반 매칭" },
    { key: "personalityBased" as const, label: "성격/적성 고려" },
  ];

  return (
    <div className="space-y-6">
      {/* 학생 검색 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">학생 선택</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="학생 이름으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
          )}
        </div>

        {students.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => selectStudent(s)}
                className="w-full text-left px-4 py-3 hover:bg-purple-50 transition-colors text-sm border-b border-gray-50 last:border-b-0"
              >
                <span className="font-medium text-gray-900">{s.name}</span>
                {(s.school || s.department) && (
                  <span className="text-gray-400 ml-2">
                    {[s.school, s.department].filter(Boolean).join(" · ")}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* 선택된 학생 + 매칭 옵션 */}
        {selectedStudent && (
          <div className="mt-3 space-y-3">
            <div className="bg-purple-50 rounded-xl px-4 py-3">
              <span className="font-medium text-purple-700">
                {selectedStudent.name}
              </span>
              {(selectedStudent.school || selectedStudent.department) && (
                <span className="text-purple-400 text-sm ml-2">
                  {[selectedStudent.school, selectedStudent.department]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              )}
            </div>

            {/* 매칭 옵션 */}
            <div className="flex flex-wrap gap-3">
              {optionItems.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={options[item.key]}
                    onChange={(e) =>
                      setOptions((prev) => ({
                        ...prev,
                        [item.key]: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-600">{item.label}</span>
                </label>
              ))}
            </div>

            <button
              onClick={runMatching}
              disabled={isMatching}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isMatching ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Target className="w-4 h-4" />
              )}
              {isMatching ? "매칭 중..." : "AI 취업 매칭 분석"}
            </button>
          </div>
        )}
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 매칭 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 취업 준비도 */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-6 text-white">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">취업 준비도</h3>
              <span className="text-3xl font-bold">
                {result.overall_readiness}%
              </span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white h-3 rounded-full transition-all duration-1000"
                style={{ width: `${result.overall_readiness}%` }}
              />
            </div>
          </div>

          {/* AI 최우선 추천 */}
          {result.top_recommendation && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-5 h-5 text-yellow-500" />
                <h3 className="font-semibold text-yellow-800">
                  AI 최우선 추천
                </h3>
              </div>
              <p className="text-sm text-yellow-700">
                {result.top_recommendation}
              </p>
            </div>
          )}

          {/* 직무 매칭 카드 */}
          {result.matches && result.matches.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckSquare className="w-4 h-4" />
                직무별 매칭 결과 ({result.matches.length}건)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.matches.map((match, i) => (
                  <JobMatchCard key={i} match={match} />
                ))}
              </div>
            </div>
          )}

          {/* 성장 로드맵 */}
          {result.growth_plan && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <ArrowRight className="w-4 h-4" />
                성장 로드맵
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {result.growth_plan}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {!selectedStudent && !result && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Target className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            학생을 선택하여 AI 취업 매칭 분석을 실행하세요.
          </p>
          <p className="text-sm text-gray-400 mt-1">
            학생의 역량과 희망 직무를 기반으로 최적 매칭을 추천합니다.
          </p>
        </div>
      )}
    </div>
  );
}
