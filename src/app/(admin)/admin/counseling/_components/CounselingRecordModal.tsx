"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { X, Loader2, Search } from "lucide-react";
import type { CounselingRecord, CounselingType, AICounselingSuggestion } from "@/lib/types";
import AICounselingSuggestionComponent from "./AICounselingSuggestion";

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
}

const TYPE_OPTIONS: { value: CounselingType; label: string }[] = [
  { value: "career", label: "진로상담" },
  { value: "resume", label: "이력서상담" },
  { value: "interview", label: "면접준비" },
  { value: "mental", label: "고충상담" },
  { value: "other", label: "기타" },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CounselingRecordModal({
  mode,
  record,
  preselectedStudentId,
  preselectedStudentName,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  record?: CounselingRecord | null;
  preselectedStudentId?: string | null;
  preselectedStudentName?: string | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();

  // 학생 검색
  const [studentSearch, setStudentSearch] = useState("");
  const [studentResults, setStudentResults] = useState<StudentOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(
    preselectedStudentId
      ? { id: preselectedStudentId, name: preselectedStudentName || "", school: null, department: null }
      : null
  );

  // 폼 필드
  const [counselingType, setCounselingType] = useState<CounselingType>(
    record?.counseling_type || "career"
  );
  const [title, setTitle] = useState(record?.title || "");
  const [content, setContent] = useState(record?.content || "");
  const [counselingDate, setCounselingDate] = useState(
    record?.counseling_date || todayStr()
  );
  const [actionItems, setActionItems] = useState(record?.action_items || "");
  const [nextCounselingDate, setNextCounselingDate] = useState(
    record?.next_counseling_date || ""
  );
  const [aiSuggestion, setAiSuggestion] = useState<AICounselingSuggestion | null>(
    record?.ai_suggestion || null
  );

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 학생 검색
  const searchStudents = useCallback(
    async (query: string) => {
      if (query.length < 1) {
        setStudentResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const { data } = await supabase
          .from("profiles")
          .select("id, name, school, department")
          .eq("role", "user")
          .ilike("name", `%${query}%`)
          .limit(8);
        setStudentResults(
          (data || []).map((p) => ({
            id: p.id,
            name: p.name || "이름없음",
            school: p.school,
            department: p.department,
          }))
        );
      } catch {
        setStudentResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    const timer = setTimeout(() => searchStudents(studentSearch), 300);
    return () => clearTimeout(timer);
  }, [studentSearch, searchStudents]);

  const handleSave = async () => {
    const studentId = mode === "edit" ? record?.user_id : selectedStudent?.id;
    if (!studentId) {
      setError("학생을 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("인증 정보를 확인할 수 없습니다.");

      const payload = {
        user_id: studentId,
        counselor_id: user.id,
        title: title.trim(),
        content: content.trim() || null,
        counseling_type: counselingType,
        counseling_date: counselingDate,
        action_items: actionItems.trim() || null,
        next_counseling_date: nextCounselingDate || null,
        ai_suggestion: aiSuggestion,
      };

      if (mode === "edit" && record) {
        const { error: err } = await supabase
          .from("counseling_records")
          .update(payload)
          .eq("id", record.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase
          .from("counseling_records")
          .insert(payload);
        if (err) throw err;
      }

      onSave();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "저장 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              {mode === "create" ? "새 상담 기록" : "상담 기록 수정"}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 바디 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 학생 선택 (create 모드) */}
            {mode === "create" && !preselectedStudentId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  학생 선택 *
                </label>
                {selectedStudent ? (
                  <div className="flex items-center justify-between bg-purple-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium text-purple-700">
                      {selectedStudent.name}
                      {selectedStudent.school && (
                        <span className="text-purple-400 ml-1">
                          {selectedStudent.school}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => setSelectedStudent(null)}
                      className="text-xs text-purple-500 hover:text-purple-700"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="학생 이름 검색..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {isSearching && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                    )}
                    {studentResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {studentResults.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedStudent(s);
                              setStudentSearch("");
                              setStudentResults([]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-purple-50 text-sm"
                          >
                            <span className="font-medium">{s.name}</span>
                            {(s.school || s.department) && (
                              <span className="text-gray-400 ml-2">
                                {[s.school, s.department].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 선택된 학생 표시 (preselected) */}
            {mode === "create" && preselectedStudentId && (
              <div className="bg-purple-50 rounded-lg px-3 py-2">
                <span className="text-sm font-medium text-purple-700">
                  {preselectedStudentName || "학생"}
                </span>
              </div>
            )}

            {/* 상담 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담 유형
              </label>
              <select
                value={counselingType}
                onChange={(e) => setCounselingType(e.target.value as CounselingType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 제목 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                제목 *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="상담 제목을 입력하세요"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* 상담 내용 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담 내용
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="상담 내용을 기록하세요..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* 상담일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상담일
              </label>
              <input
                type="date"
                value={counselingDate}
                onChange={(e) => setCounselingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* 후속 조치 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                후속 조치
              </label>
              <textarea
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="후속 조치 사항을 기록하세요..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* 다음 상담일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                다음 상담 예정일
              </label>
              <input
                type="date"
                value={nextCounselingDate}
                onChange={(e) => setNextCounselingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* AI 제안 첨부 */}
            {(selectedStudent || preselectedStudentId || record) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI 상담 제안
                </label>
                {aiSuggestion ? (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-purple-600 font-medium">
                        AI 제안 첨부됨
                      </span>
                      <button
                        onClick={() => setAiSuggestion(null)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        제거
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">
                      {aiSuggestion.suggested_topics?.join(", ")}
                    </p>
                  </div>
                ) : (
                  <AICounselingSuggestionComponent
                    studentId={
                      selectedStudent?.id ||
                      preselectedStudentId ||
                      record?.user_id ||
                      ""
                    }
                    onAttach={(sug) => setAiSuggestion(sug)}
                  />
                )}
              </div>
            )}

            {/* 에러 */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "create" ? "기록 저장" : "수정 저장"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
