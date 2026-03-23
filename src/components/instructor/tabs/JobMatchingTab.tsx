"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  Target,
  Loader2,
  Search,
  CheckCircle,
  Mail,
  MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import type { EducationLevel, JobMatchingResult, JobMatch } from "@/lib/types";

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

export default function JobMatchingTab({ instructorId, hasApiKey }: Props) {
  const supabase = createClient();
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    null
  );
  const [showDropdown, setShowDropdown] = useState(false);

  // Options
  const [options, setOptions] = useState({
    skillBased: true,
    certBased: true,
    portfolioBased: true,
    personalityBased: false,
  });

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<JobMatchingResult | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, name, school, department, education_level, grade, avatar_url"
        )
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
      const res = await fetch("/api/gemini/job-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: selectedStudent.id,
          options,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "분석 실패");
      }

      const data = await res.json();
      setResult(data as JobMatchingResult);
      toast.success("AI 취업 매칭 분석이 완료되었습니다");
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

  const getMatchColor = (rate: number) => {
    if (rate >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (rate >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
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
      </div>

      {/* 분석 옵션 */}
      {selectedStudent && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
            분석 옵션
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { key: "skillBased", label: "스킬 기반 매칭" },
              { key: "certBased", label: "자격증 기반 매칭" },
              { key: "portfolioBased", label: "포트폴리오 기반 매칭" },
              { key: "personalityBased", label: "성격/적성 고려" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={options[key as keyof typeof options]}
                  onChange={(e) =>
                    setOptions((prev) => ({
                      ...prev,
                      [key]: e.target.checked,
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-purple-500 focus:ring-purple-400"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {label}
                </span>
              </label>
            ))}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!hasApiKey || isAnalyzing}
            className="w-full mt-4 bg-purple-500 text-white rounded-lg px-6 py-2.5 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                AI가 취업 매칭을 분석하고 있습니다...
              </>
            ) : (
              <>
                <Target className="w-4 h-4" />
                AI 취업 매칭 분석
              </>
            )}
          </button>
          {!hasApiKey && (
            <p className="text-xs text-red-400 mt-1">
              API 키가 설정되지 않았습니다.
            </p>
          )}
        </div>
      )}

      {/* 매칭 결과 */}
      {result && (
        <div className="space-y-6">
          {/* 전체 준비도 */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl p-6 text-white">
            <div className="text-center mb-4">
              <p className="text-5xl font-bold mb-2">
                {result.overall_readiness}
              </p>
              <p className="text-purple-100">취업 준비도</p>
            </div>
            <div className="bg-white/30 h-3 rounded-full overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${result.overall_readiness}%` }}
              />
            </div>
          </div>

          {/* 최우선 추천 */}
          {result.top_recommendation && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-6">
              <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2">
                ⭐ AI 최우선 추천
              </p>
              <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                {result.top_recommendation}
              </p>
            </div>
          )}

          {/* 직무 매칭 카드 */}
          <div className="grid md:grid-cols-2 gap-4">
            {(result.matches || []).map((match: JobMatch, i: number) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                    {match.job_title}
                  </h4>
                  <span
                    className={`text-sm font-bold px-3 py-1 rounded-full ${getMatchColor(
                      match.match_rate
                    )}`}
                  >
                    {match.match_rate}%
                  </span>
                </div>

                {/* 매칭 근거 */}
                <div className="space-y-1 mb-3">
                  {(match.reasons || []).map((r, j) => (
                    <p
                      key={j}
                      className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      {r}
                    </p>
                  ))}
                </div>

                {/* 보유/부족 스킬 */}
                <div className="space-y-2 mb-3">
                  {(match.student_has || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {match.student_has.map((s, j) => (
                        <span
                          key={j}
                          className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-xs px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  {(match.student_lacks || []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {match.student_lacks.map((s, j) => (
                        <span
                          key={j}
                          className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-xs px-2 py-0.5 rounded-full"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* 준비 조언 */}
                {match.preparation_tips && (
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {match.preparation_tips}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 성장 로드맵 */}
          {result.growth_plan && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                📈 성장 로드맵 제안
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {result.growth_plan}
              </p>
            </div>
          )}

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
          </div>
        </div>
      )}

      {/* 빈 상태 */}
      {!result && !isAnalyzing && (
        <div className="text-center py-12">
          <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            학생을 선택하고 AI 취업 매칭 분석을 시작해보세요
          </p>
        </div>
      )}
    </div>
  );
}
