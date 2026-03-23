"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { CounselingType, CounselingRecord, AICounselingSuggestion as AISuggestionType } from "@/lib/types";
import { format } from "date-fns";
import {
  ArrowLeft,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  Clock,
  Calendar,
  MessageSquareHeart,
  Sparkles,
  Loader2,
  Copy,
  FileDown,
  Mail,
  X,
  Lightbulb,
  Eye,
  Target,
  AlertTriangle,
  MessageCircle,
  Paperclip,
} from "lucide-react";
import toast from "react-hot-toast";
import { copyCounselingToClipboard, copySuggestionToClipboard } from "@/lib/clipboard";
import { generateCounselingPDF, generateSuggestionPDF, downloadPDF } from "@/lib/pdf-generator";

const TYPE_COLORS: Record<string, string> = {
  career: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  resume: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  interview: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  mental: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const TYPE_LABELS: Record<string, string> = {
  career: "진로상담",
  resume: "이력서상담",
  interview: "면접준비",
  mental: "고충상담",
  other: "기타",
};

const TYPE_OPTIONS: { value: CounselingType; label: string }[] = [
  { value: "career", label: "진로상담" },
  { value: "resume", label: "이력서상담" },
  { value: "interview", label: "면접준비" },
  { value: "mental", label: "고충상담" },
  { value: "other", label: "기타" },
];

interface StudentProfile {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
  grade: number | null;
  avatar_url: string | null;
  target_field: string | null;
  education_level: string;
  email: string | null;
  student_email: string | null;
}

export default function StudentCounselingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = params.studentId as string;
  const highlightId = searchParams.get("highlight");
  const supabase = createClient();

  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CounselingRecord | null>(null);

  // AI suggestion
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestionType | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  const highlightRef = useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, name")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "instructor" && profile?.role !== "super_admin") {
        router.push("/dashboard"); return;
      }
      setInstructorId(user.id);
      setInstructorName(profile?.name || "강사");
    };
    check();
  }, [supabase, router]);

  // Fetch student + records
  const fetchData = useCallback(async () => {
    if (!instructorId) return;
    setIsLoading(true);

    try {
      const [profileRes, recordsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, name, school, department, grade, avatar_url, target_field, education_level, email, student_email")
          .eq("id", studentId)
          .single(),
        supabase
          .from("counseling_records")
          .select("*")
          .eq("user_id", studentId)
          .order("counseling_date", { ascending: false }),
      ]);

      if (profileRes.data) setStudent(profileRes.data as StudentProfile);
      setRecords((recordsRes.data || []) as CounselingRecord[]);
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("데이터 조회에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId, studentId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Scroll to highlighted record
  useEffect(() => {
    if (highlightId && highlightRef.current && !isLoading) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [highlightId, isLoading]);

  // AI Suggestion
  const fetchSuggestion = async () => {
    setIsLoadingSuggestion(true);
    setSuggestionError(null);
    setShowSuggestion(true);

    try {
      const res = await fetch("/api/gemini/suggest-counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI 상담 제안 생성 실패");
      setAiSuggestion(data as AISuggestionType);
    } catch (err) {
      setSuggestionError(err instanceof Error ? err.message : "오류 발생");
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  // Delete record
  const handleDelete = async (recordId: string) => {
    if (!confirm("이 상담 기록을 삭제하시겠습니까?")) return;
    const { error } = await supabase
      .from("counseling_records")
      .delete()
      .eq("id", recordId);
    if (error) {
      toast.error("삭제에 실패했습니다.");
    } else {
      toast.success("삭제되었습니다.");
      fetchData();
    }
  };

  // Toggle completion
  const toggleComplete = async (record: CounselingRecord) => {
    const { error } = await supabase
      .from("counseling_records")
      .update({ is_completed: !record.is_completed })
      .eq("id", record.id);
    if (error) {
      toast.error("업데이트에 실패했습니다.");
    } else {
      fetchData();
    }
  };

  // Copy counseling
  const handleCopyCounseling = (record: CounselingRecord) => {
    copyCounselingToClipboard({
      studentName: student?.name || "",
      title: record.title,
      counselingType: record.counseling_type,
      counselingDate: record.counseling_date,
      content: record.content,
      actionItems: record.action_items,
      nextCounselingDate: record.next_counseling_date,
    });
  };

  // PDF counseling
  const handlePDFCounseling = (record: CounselingRecord) => {
    const doc = generateCounselingPDF({
      studentName: student?.name || "",
      instructorName,
      title: record.title,
      counselingType: record.counseling_type,
      counselingDate: record.counseling_date,
      content: record.content,
      actionItems: record.action_items,
      nextCounselingDate: record.next_counseling_date,
    });
    downloadPDF(doc, `상담기록_${student?.name}_${record.counseling_date}`);
  };

  // Email counseling
  const handleEmailCounseling = async (record: CounselingRecord) => {
    const email = student?.student_email || student?.email;
    if (!email) {
      toast.error("학생 이메일이 등록되어 있지 않습니다.");
      return;
    }

    // Dynamic import to avoid SSR issues
    const { buildCounselingEmailHTML } = await import("@/lib/email-templates");
    const { subject, html } = buildCounselingEmailHTML({
      studentName: student?.name || "",
      instructorName,
      title: record.title,
      counselingType: record.counseling_type,
      counselingDate: record.counseling_date,
      content: record.content,
      actionItems: record.action_items,
      nextCounselingDate: record.next_counseling_date,
    });

    try {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email,
          subject,
          html,
          content_type: "counseling",
          student_id: studentId,
        }),
      });
      if (!res.ok) throw new Error("이메일 발송 실패");
      toast.success(`${email}로 이메일이 발송되었습니다.`);
    } catch {
      toast.error("이메일 발송에 실패했습니다.");
    }
  };

  // Copy suggestion
  const handleCopySuggestion = () => {
    if (!aiSuggestion) return;
    copySuggestionToClipboard({
      studentName: student?.name || "",
      suggestedTopics: aiSuggestion.suggested_topics,
      keyObservations: aiSuggestion.key_observations,
      actionSuggestions: aiSuggestion.action_suggestions,
      concerns: aiSuggestion.concerns,
      encouragement: aiSuggestion.encouragement,
    });
  };

  // PDF suggestion
  const handlePDFSuggestion = () => {
    if (!aiSuggestion) return;
    const doc = generateSuggestionPDF({
      studentName: student?.name || "",
      instructorName,
      suggestedTopics: aiSuggestion.suggested_topics,
      keyObservations: aiSuggestion.key_observations,
      actionSuggestions: aiSuggestion.action_suggestions,
      concerns: aiSuggestion.concerns,
      encouragement: aiSuggestion.encouragement,
    });
    downloadPDF(doc, `AI상담제안_${student?.name}`);
  };

  if (isLoading || !instructorId) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/instructor/counseling"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {student?.name || "학생"} 상담 기록
          </h1>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-purple-500 text-white rounded-lg px-4 py-2 hover:bg-purple-600 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록
        </button>
      </div>

      {/* Student Profile Card */}
      {student && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            {student.avatar_url ? (
              <img src={student.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
                {student.name[0]}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{student.name}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {[student.school, student.department, student.grade ? `${student.grade}학년` : null].filter(Boolean).join(" · ")}
              </p>
              {student.target_field && (
                <p className="text-sm text-purple-500 mt-1">희망분야: {student.target_field}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 dark:text-gray-400">상담 {records.length}건</p>
              <p className="text-sm text-green-600">
                완료 {records.filter((r) => r.is_completed).length}건
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Suggestion */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            AI 상담 제안
          </h3>
          {aiSuggestion && (
            <div className="flex items-center gap-2">
              <button onClick={handleCopySuggestion} className="p-1.5 text-purple-500 hover:text-purple-700 rounded" title="복사">
                <Copy className="w-4 h-4" />
              </button>
              <button onClick={handlePDFSuggestion} className="p-1.5 text-purple-500 hover:text-purple-700 rounded" title="PDF">
                <FileDown className="w-4 h-4" />
              </button>
              <button onClick={fetchSuggestion} disabled={isLoadingSuggestion} className="text-xs text-purple-500 hover:text-purple-700">
                다시 생성
              </button>
            </div>
          )}
        </div>

        {!showSuggestion && !aiSuggestion ? (
          <button
            onClick={fetchSuggestion}
            disabled={isLoadingSuggestion}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            AI 상담 제안 받기
          </button>
        ) : isLoadingSuggestion ? (
          <div className="flex items-center justify-center py-8 gap-3">
            <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
            <span className="text-sm text-purple-600 dark:text-purple-400">AI가 학생 데이터를 분석하고 있습니다...</span>
          </div>
        ) : suggestionError ? (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
            {suggestionError}
          </div>
        ) : aiSuggestion ? (
          <div className="space-y-4">
            {aiSuggestion.suggested_topics?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-500" /> 추천 상담 주제
                </h4>
                <div className="space-y-2">
                  {aiSuggestion.suggested_topics.map((topic, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm text-sm text-gray-700 dark:text-gray-300">
                      <span className="text-purple-500 font-medium mr-2">{i + 1}.</span>{topic}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiSuggestion.key_observations?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                  <Eye className="w-4 h-4 text-blue-500" /> 주요 관찰 사항
                </h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
                  <ul className="space-y-1.5">
                    {aiSuggestion.key_observations.map((obs, i) => (
                      <li key={i} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5">•</span>{obs}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {aiSuggestion.action_suggestions?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                  <Target className="w-4 h-4 text-green-500" /> 추천 활동
                </h4>
                <div className="space-y-2">
                  {aiSuggestion.action_suggestions.map((action, i) => (
                    <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                      <input type="checkbox" disabled className="mt-0.5 rounded" />{action}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiSuggestion.concerns && aiSuggestion.concerns.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" /> 주의 사항
                </h4>
                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                  <ul className="space-y-1.5">
                    {aiSuggestion.concerns.map((c, i) => (
                      <li key={i} className="text-sm text-orange-700 dark:text-orange-300">{c}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            {aiSuggestion.encouragement && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-2">
                  <MessageCircle className="w-4 h-4 text-green-500" /> 격려 메시지
                </h4>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm text-green-700 dark:text-green-300 italic">
                  {aiSuggestion.encouragement}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-500" />
          상담 기록 ({records.length}건)
        </h3>

        {records.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquareHeart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">아직 상담 기록이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map((record) => {
              const isHighlighted = record.id === highlightId;
              return (
                <div
                  key={record.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5 transition-all ${
                    isHighlighted
                      ? "border-purple-400 dark:border-purple-500 ring-2 ring-purple-200 dark:ring-purple-800"
                      : "border-gray-100 dark:border-gray-700"
                  }`}
                >
                  {/* Record header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[record.counseling_type]}`}>
                        {TYPE_LABELS[record.counseling_type]}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {record.counseling_date}
                      </span>
                      {record.is_completed ? (
                        <span className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> 완료
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> 진행중
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleComplete(record)}
                        className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                          record.is_completed ? "text-green-500" : "text-gray-300"
                        }`}
                        title={record.is_completed ? "미완료로 변경" : "완료로 변경"}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingRecord(record)}
                        className="p-1.5 text-gray-400 hover:text-purple-500 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & content */}
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">{record.title}</h4>
                  {record.content && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mb-3 leading-relaxed">
                      {record.content}
                    </p>
                  )}

                  {/* Action items */}
                  {record.action_items && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-green-700 dark:text-green-300 mb-1">✅ 후속 조치</p>
                      <p className="text-sm text-green-600 dark:text-green-400 whitespace-pre-wrap">{record.action_items}</p>
                    </div>
                  )}

                  {/* Next date */}
                  {record.next_counseling_date && (
                    <p className="text-xs text-purple-500 flex items-center gap-1 mb-3">
                      <Clock className="w-3 h-3" />
                      다음 상담 예정: {record.next_counseling_date}
                    </p>
                  )}

                  {/* AI suggestion attached */}
                  {record.ai_suggestion && (
                    <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3 mb-3">
                      <p className="text-xs font-medium text-purple-600 dark:text-purple-400 flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3" /> AI 제안 첨부됨
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {record.ai_suggestion.suggested_topics?.join(" · ")}
                      </p>
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={() => handleCopyCounseling(record)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-500 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Copy className="w-3.5 h-3.5" /> 복사
                    </button>
                    <button
                      onClick={() => handlePDFCounseling(record)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-500 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </button>
                    <button
                      onClick={() => handleEmailCounseling(record)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-purple-500 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <Mail className="w-3.5 h-3.5" /> 이메일
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* New/Edit Modal */}
      {(showNewModal || editingRecord) && (
        <CounselingModal
          mode={editingRecord ? "edit" : "create"}
          record={editingRecord}
          studentId={studentId}
          studentName={student?.name || ""}
          instructorId={instructorId}
          aiSuggestion={aiSuggestion}
          onClose={() => { setShowNewModal(false); setEditingRecord(null); }}
          onSave={() => {
            setShowNewModal(false);
            setEditingRecord(null);
            fetchData();
            toast.success(editingRecord ? "상담 기록이 수정되었습니다" : "상담 기록이 저장되었습니다");
          }}
        />
      )}
    </div>
  );
}

// Counseling Create/Edit Modal
function CounselingModal({
  mode,
  record,
  studentId,
  studentName,
  instructorId,
  aiSuggestion: existingSuggestion,
  onClose,
  onSave,
}: {
  mode: "create" | "edit";
  record: CounselingRecord | null;
  studentId: string;
  studentName: string;
  instructorId: string;
  aiSuggestion: AISuggestionType | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();

  const [counselingType, setCounselingType] = useState<CounselingType>(record?.counseling_type || "career");
  const [title, setTitle] = useState(record?.title || "");
  const [content, setContent] = useState(record?.content || "");
  const [counselingDate, setCounselingDate] = useState(record?.counseling_date || format(new Date(), "yyyy-MM-dd"));
  const [actionItems, setActionItems] = useState(record?.action_items || "");
  const [nextDate, setNextDate] = useState(record?.next_counseling_date || "");
  const [attachedSuggestion, setAttachedSuggestion] = useState<AISuggestionType | null>(record?.ai_suggestion || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }
    setIsSaving(true);
    setError(null);

    try {
      const payload = {
        user_id: studentId,
        counselor_id: instructorId,
        instructor_id: instructorId,
        title: title.trim(),
        content: content.trim() || null,
        counseling_type: counselingType,
        counseling_date: counselingDate,
        action_items: actionItems.trim() || null,
        next_counseling_date: nextDate || null,
        ai_suggestion: attachedSuggestion,
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
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {mode === "create" ? "새 상담 기록" : "상담 기록 수정"} — {studentName}
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담 유형</label>
              <select value={counselingType} onChange={(e) => setCounselingType(e.target.value as CounselingType)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500">
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목 *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="상담 제목"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담 내용</label>
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="상담 내용을 기록하세요..." rows={4}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담일</label>
              <input type="date" value={counselingDate} onChange={(e) => setCounselingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">후속 조치</label>
              <textarea value={actionItems} onChange={(e) => setActionItems(e.target.value)} placeholder="후속 조치 사항..." rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">다음 상담 예정일</label>
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>

            {/* AI suggestion attach */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">AI 상담 제안</label>
              {attachedSuggestion ? (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> AI 제안 첨부됨
                    </span>
                    <button onClick={() => setAttachedSuggestion(null)} className="text-xs text-red-400 hover:text-red-600">제거</button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{attachedSuggestion.suggested_topics?.join(", ")}</p>
                </div>
              ) : existingSuggestion ? (
                <button
                  onClick={() => setAttachedSuggestion(existingSuggestion)}
                  className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400 text-sm font-medium hover:text-purple-800"
                >
                  <Paperclip className="w-4 h-4" />
                  현재 AI 제안 첨부하기
                </button>
              ) : (
                <p className="text-xs text-gray-400">AI 제안을 먼저 생성하면 여기에 첨부할 수 있습니다.</p>
              )}
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">취소</button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors">
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "create" ? "기록 저장" : "수정 저장"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
