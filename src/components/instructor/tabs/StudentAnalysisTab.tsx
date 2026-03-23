"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Mail,
  MessageSquare,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import GemSelector from "@/components/instructor/GemSelector";
import type { CompetencyAnalysisResult, EducationLevel } from "@/lib/types";

const RadarChart = dynamic(
  () => import("recharts").then((m) => m.RadarChart),
  { ssr: false }
);
const Radar = dynamic(
  () => import("recharts").then((m) => m.Radar),
  { ssr: false }
);
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

interface Props {
  instructorId: string;
  hasApiKey: boolean;
}

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
  education_level: EducationLevel;
  grade: number | null;
  avatar_url: string | null;
}

export default function StudentAnalysisTab({
  instructorId,
  hasApiKey,
}: Props) {
  const supabase = createClient();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null
  );
  const [gemId, setGemId] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<CompetencyAnalysisResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch students
  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, school, department, education_level, grade, avatar_url")
        .eq("instructor_id", instructorId)
        .eq("role", "student")
        .order("name");
      setStudents((data || []) as StudentOption[]);
    };
    fetch();
  }, [supabase, instructorId]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.includes(searchQuery) ||
      s.school?.includes(searchQuery) ||
      s.department?.includes(searchQuery)
  );

  const handleAnalyze = async () => {
    if (!selectedStudent) return;
    setIsAnalyzing(true);
    setResult(null);

    try {
      const res = await fetch("/api/gemini/analyze-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedStudent.id,
          gem_id: gemId || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "분석 실패");
      }

      const data = await res.json();
      setResult(data as CompetencyAnalysisResult);
      toast.success("AI 역량 분석이 완료되었습니다");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "AI 분석에 실패했습니다";
      if (msg.includes("API")) {
        toast.error("API 키가 유효하지 않습니다. 키를 재등록해주세요.");
      } else {
        toast.error(msg);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getGradeLabel = (score: number) => {
    if (score >= 90) return { label: "최우수", emoji: "🌟" };
    if (score >= 70) return { label: "우수", emoji: "✅" };
    if (score >= 50) return { label: "양호", emoji: "📈" };
    if (score >= 30) return { label: "노력필요", emoji: "⚠️" };
    return { label: "시작단계", emoji: "🚨" };
  };

  return (
    <div className="space-y-6">
      {/* 학생 선택 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
          분석할 학생을 선택하세요
        </h3>

        {!selectedStudent ? (
          <div className="relative">
            <div className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2">
              <Search className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="이름, 학교, 학과로 검색..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="flex-1 text-sm outline-none bg-transparent dark:text-white"
              />
            </div>
            {showDropdown && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredStudents.length === 0 ? (
                  <p className="text-sm text-gray-400 p-3">
                    검색 결과가 없습니다
                  </p>
                ) : (
                  filteredStudents.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(s);
                        setShowDropdown(false);
                        setSearchQuery("");
                        setResult(null);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors text-left"
                    >
                      {s.avatar_url ? (
                        <img
                          src={s.avatar_url}
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                          {s.name[0]}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {s.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {s.school} · {s.department} · {s.grade}학년
                        </p>
                      </div>
                      <span
                        className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                          s.education_level === "high_school"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {s.education_level === "high_school"
                          ? "특성화고"
                          : "대학교"}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
            {selectedStudent.avatar_url ? (
              <img
                src={selectedStudent.avatar_url}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-lg font-medium">
                {selectedStudent.name[0]}
              </div>
            )}
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedStudent.name}
              </p>
              <p className="text-sm text-gray-500">
                {selectedStudent.school} · {selectedStudent.department} ·{" "}
                {selectedStudent.grade}학년
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStudent(null);
                setResult(null);
              }}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              변경
            </button>
          </div>
        )}

        {selectedStudent && (
          <>
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                분석에 사용할 Gem (선택)
              </p>
              <GemSelector
                category="analysis"
                educationLevel={selectedStudent.education_level}
                department={selectedStudent.department || undefined}
                value={gemId}
                onChange={setGemId}
              />
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!hasApiKey || isAnalyzing}
              className="w-full mt-4 bg-purple-500 text-white rounded-lg px-6 py-2.5 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI가 학생 데이터를 분석하고 있습니다...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 역량 분석 시작
                </>
              )}
            </button>
            {!hasApiKey && (
              <p className="text-xs text-red-400 mt-1">
                API 키가 설정되지 않았습니다. 설정 페이지에서 등록해주세요.
              </p>
            )}
          </>
        )}
      </div>

      {/* 분석 결과 */}
      {result && (
        <div className="space-y-6">
          {/* 종합 점수 */}
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white text-center">
            <p className="text-5xl font-bold mb-2">
              {result.career_fit_score}
            </p>
            <p className="text-purple-100 text-sm mb-1">종합 역량 점수</p>
            <p className="text-lg">
              {getGradeLabel(result.career_fit_score).emoji}{" "}
              {getGradeLabel(result.career_fit_score).label}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 레이더 차트 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                역량 레이더
              </h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={result.skill_scores || []}>
                    <PolarGrid stroke="#e5e7eb" />
                    <PolarAngleAxis
                      dataKey="category"
                      tick={{ fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                    />
                    <Radar
                      name="역량"
                      dataKey="score"
                      stroke="#8b5cf6"
                      fill="#c4b5fd"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 강점/약점 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  💪 강점
                </h4>
                <ul className="space-y-1.5">
                  {(result.strengths || []).map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  📋 보완점
                </h4>
                <ul className="space-y-1.5">
                  {(result.weaknesses || []).map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* 추천 활동 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                🎯 추천 활동
              </h4>
              <div className="space-y-2">
                {(result.recommendations || []).map((r, i) => (
                  <div
                    key={i}
                    className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <span className="font-medium text-purple-600 dark:text-purple-400 mr-2">
                      {i + 1}.
                    </span>
                    {r}
                  </div>
                ))}
              </div>
            </div>

            {/* 적합 직무 & 부족 역량 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  💼 적합 직무
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(result.suitable_jobs || []).map((j, i) => (
                    <span
                      key={i}
                      className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-2.5 py-1 rounded-full"
                    >
                      {j}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  📚 부족 역량
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(result.missing_skills || []).map((s, i) => (
                    <span
                      key={i}
                      className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs px-2.5 py-1 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 종합 요약 */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
              📝 종합 분석
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {result.summary}
            </p>
          </div>

          {/* 결과 액션 */}
          <div className="flex gap-3 flex-wrap">
            <button className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 transition-colors flex items-center gap-1.5">
              <Mail className="w-4 h-4" />
              이메일로 발송
            </button>
            <button className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5 text-gray-700 dark:text-gray-300">
              <MessageSquare className="w-4 h-4" />
              상담 기록에 첨부
            </button>
            <button
              disabled
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 text-sm opacity-50 cursor-not-allowed flex items-center gap-1.5 text-gray-700 dark:text-gray-300"
            >
              PDF 다운로드
            </button>
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!result && !isAnalyzing && (
        <div className="text-center py-12">
          <Sparkles className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            학생을 선택하고 AI 역량 분석을 시작해보세요
          </p>
        </div>
      )}
    </div>
  );
}
