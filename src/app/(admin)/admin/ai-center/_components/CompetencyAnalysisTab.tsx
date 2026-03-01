"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import type { CompetencyAnalysisResult, AIStudentAnalysis } from "@/lib/types";
import {
  Search,
  Loader2,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Briefcase,
  AlertTriangle,
  Clock,
} from "lucide-react";

const RechartsRadarChart = dynamic(
  () => import("recharts").then((m) => m.RadarChart),
  { ssr: false }
);
const Radar = dynamic(() => import("recharts").then((m) => m.Radar), {
  ssr: false,
});
const PolarGrid = dynamic(
  () => import("recharts").then((m) => m.PolarGrid),
  { ssr: false }
);
const PolarAngleAxis = dynamic(
  () => import("recharts").then((m) => m.PolarAngleAxis),
  { ssr: false }
);
const PolarRadiusAxis = dynamic(
  () => import("recharts").then((m) => m.PolarRadiusAxis),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const strokeColor =
    score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : "#ef4444";
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
      ? "text-yellow-500"
      : "text-red-500";

  const grade =
    score >= 90
      ? "최우수"
      : score >= 70
      ? "우수"
      : score >= 50
      ? "보통"
      : "노력필요";

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50" cy="50" r={radius}
          stroke="#e5e7eb" strokeWidth="8" fill="none"
        />
        <circle
          cx="50" cy="50" r={radius}
          stroke={strokeColor} strokeWidth="8" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-gray-400">{grade}</span>
      </div>
    </div>
  );
}

export default function CompetencyAnalysisTab() {
  const supabase = createClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CompetencyAnalysisResult | null>(null);
  const [history, setHistory] = useState<AIStudentAnalysis[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  // 디바운스 검색
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    const timer = setTimeout(() => searchStudents(value), 300);
    return () => clearTimeout(timer);
  };

  const selectStudent = async (student: StudentOption) => {
    setSelectedStudent(student);
    setSearchQuery("");
    setStudents([]);
    setResult(null);
    setError(null);

    // 이력 조회
    try {
      const { data } = await supabase
        .from("ai_student_analyses")
        .select("*")
        .eq("user_id", student.id)
        .eq("analysis_type", "competency")
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((data as AIStudentAnalysis[]) || []);
    } catch {
      setHistory([]);
    }
  };

  const runAnalysis = async () => {
    if (!selectedStudent) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/gemini/analyze-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedStudent.id }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "분석 실패");
      }

      setResult(data as CompetencyAnalysisResult);

      // 이력 갱신
      const { data: historyData } = await supabase
        .from("ai_student_analyses")
        .select("*")
        .eq("user_id", selectedStudent.id)
        .eq("analysis_type", "competency")
        .order("created_at", { ascending: false })
        .limit(10);
      setHistory((historyData as AIStudentAnalysis[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      {/* 학생 검색 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          학생 선택
        </h3>
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

        {/* 검색 결과 */}
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

        {/* 선택된 학생 */}
        {selectedStudent && (
          <div className="mt-3 flex items-center justify-between bg-purple-50 rounded-xl px-4 py-3">
            <div>
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
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isAnalyzing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {isAnalyzing ? "분석 중..." : "AI 역량 분석"}
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

      {/* 분석 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 종합 점수 + 레이더 차트 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 종합 점수 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">
                종합 역량 점수
              </h3>
              <ScoreCircle score={result.career_fit_score} />
            </div>

            {/* 레이더 차트 */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 text-center">
                역량 분포
              </h3>
              {result.skill_scores && result.skill_scores.length > 0 ? (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsRadarChart data={result.skill_scores}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis
                        dataKey="category"
                        tick={{ fontSize: 11, fill: "#6b7280" }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                      />
                      <Radar
                        dataKey="score"
                        stroke="#8b5cf6"
                        fill="#8b5cf6"
                        fillOpacity={0.3}
                      />
                    </RechartsRadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-gray-400 text-sm py-8">
                  역량 점수 데이터가 없습니다.
                </p>
              )}
            </div>
          </div>

          {/* 강점 / 보완점 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-green-700 mb-3">
                <TrendingUp className="w-4 h-4" />
                강점
              </h3>
              <ul className="space-y-2">
                {result.strengths.map((s, i) => (
                  <li
                    key={i}
                    className="bg-green-50 text-green-800 text-sm px-3 py-2 rounded-lg"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-orange-700 mb-3">
                <TrendingDown className="w-4 h-4" />
                보완점
              </h3>
              <ul className="space-y-2">
                {result.weaknesses.map((w, i) => (
                  <li
                    key={i}
                    className="bg-orange-50 text-orange-800 text-sm px-3 py-2 rounded-lg"
                  >
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 추천 활동 */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-purple-700 mb-3">
              <Lightbulb className="w-4 h-4" />
              추천 활동
            </h3>
            <ol className="space-y-2">
              {result.recommendations.map((r, i) => (
                <li
                  key={i}
                  className="bg-purple-50 text-purple-800 text-sm px-3 py-2 rounded-lg flex items-start gap-2"
                >
                  <span className="flex-shrink-0 w-5 h-5 bg-purple-200 text-purple-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  {r}
                </li>
              ))}
            </ol>
          </div>

          {/* 적합 직무 + 부족 역량 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <Briefcase className="w-4 h-4" />
                적합 직무
              </h3>
              <div className="flex flex-wrap gap-2">
                {(result.suitable_jobs || []).map((job, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded-full"
                  >
                    {job}
                  </span>
                ))}
                {(!result.suitable_jobs || result.suitable_jobs.length === 0) && (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                )}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <AlertTriangle className="w-4 h-4" />
                부족 역량
              </h3>
              <div className="flex flex-wrap gap-2">
                {(result.missing_skills || []).map((skill, i) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-red-100 text-red-700 text-sm rounded-full"
                  >
                    {skill}
                  </span>
                ))}
                {(!result.missing_skills || result.missing_skills.length === 0) && (
                  <p className="text-gray-400 text-sm">데이터 없음</p>
                )}
              </div>
            </div>
          </div>

          {/* 종합 분석 */}
          {result.summary && (
            <div className="bg-gray-50 rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">
                종합 분석
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {result.summary}
              </p>
            </div>
          )}
        </div>
      )}

      {/* 분석 이력 */}
      {selectedStudent && history.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
            <Clock className="w-4 h-4" />
            분석 이력
          </h3>
          <div className="space-y-2">
            {history.map((h) => {
              const r = h.result as CompetencyAnalysisResult;
              return (
                <button
                  key={h.id}
                  onClick={() => setResult(r)}
                  className="w-full text-left flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-purple-50 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">
                      {formatDate(h.created_at)}
                    </span>
                    <span className="text-sm text-gray-700">역량 분석</span>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      r.career_fit_score >= 80
                        ? "text-green-600"
                        : r.career_fit_score >= 60
                        ? "text-yellow-600"
                        : "text-red-500"
                    }`}
                  >
                    {r.career_fit_score}점
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!selectedStudent && !result && (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
          <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">학생을 선택하여 AI 역량 분석을 실행하세요.</p>
          <p className="text-sm text-gray-400 mt-1">
            학생의 스킬, 프로젝트, 자격증 등을 종합 분석합니다.
          </p>
        </div>
      )}
    </div>
  );
}
