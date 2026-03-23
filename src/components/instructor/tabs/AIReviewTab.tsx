"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  Trash2,
  Eye,
  RotateCcw,
  Mail,
} from "lucide-react";
import toast from "react-hot-toast";
import AIReviewModal from "@/components/instructor/AIReviewModal";
import GemSelectPopover from "@/components/instructor/GemSelectPopover";
import BatchReviewModal from "@/components/instructor/BatchReviewModal";
import type { EducationLevel, UploadDocumentStatus } from "@/lib/types";

const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface Props {
  instructorId: string;
  hasApiKey: boolean;
  onStatsUpdate: () => void;
}

interface ReviewRow {
  id: string;
  user_id: string;
  document_type: "resume" | "cover_letter";
  document_id: string;
  title: string;
  status: UploadDocumentStatus;
  overall_score: number | null;
  feedback: string | null;
  reviewed_at: string | null;
  created_at: string;
  gem_name: string | null;
  student_name: string;
  student_school: string | null;
  student_department: string | null;
  student_email: string | null;
  student_avatar: string | null;
  education_level: EducationLevel;
}

const PAGE_SIZE = 15;

export default function AIReviewTab({
  instructorId,
  hasApiKey,
  onStatsUpdate,
}: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [eduFilter, setEduFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [periodFilter, setPeriodFilter] = useState("all");

  // Modals
  const [reviewModal, setReviewModal] = useState<ReviewRow | null>(null);
  const [gemPopover, setGemPopover] = useState<{
    row: ReviewRow;
    x: number;
    y: number;
  } | null>(null);
  const [batchModal, setBatchModal] = useState(false);
  const [pendingDocs, setPendingDocs] = useState<ReviewRow[]>([]);

  // Score distribution chart
  const [scoreDistribution, setScoreDistribution] = useState<
    { range: string; 이력서: number; 자소서: number }[]
  >([]);

  // Gem usage stats
  const [gemStats, setGemStats] = useState<
    { name: string; count: number; avgScore: number }[]
  >([]);

  // Processing states
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 내 소속 학생 ID 조회
      const { data: students } = await supabase
        .from("profiles")
        .select("id, name, school, department, student_email, avatar_url, education_level")
        .eq("instructor_id", instructorId);

      const studentMap = new Map(
        (students || []).map((s) => [s.id, s])
      );
      const studentIds = Array.from(studentMap.keys());

      if (studentIds.length === 0) {
        setRows([]);
        setTotalCount(0);
        setIsLoading(false);
        return;
      }

      // 이력서 + 자소서 조회
      let resumeQuery = supabase
        .from("uploaded_resumes")
        .select("id, user_id, title, file_name, status, ai_review_id, created_at, updated_at")
        .in("user_id", studentIds);

      let coverQuery = supabase
        .from("uploaded_cover_letters")
        .select("id, user_id, title, file_name, status, ai_review_id, created_at, updated_at")
        .in("user_id", studentIds);

      // Status filter
      if (statusFilter !== "all") {
        resumeQuery = resumeQuery.eq("status", statusFilter);
        coverQuery = coverQuery.eq("status", statusFilter);
      }

      // Period filter
      if (periodFilter !== "all") {
        const now = new Date();
        let since: Date;
        if (periodFilter === "week")
          since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        else if (periodFilter === "month")
          since = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        else
          since = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        resumeQuery = resumeQuery.gte("created_at", since.toISOString());
        coverQuery = coverQuery.gte("created_at", since.toISOString());
      }

      const [resumeRes, coverRes] = await Promise.all([
        resumeQuery,
        coverQuery,
      ]);

      // AI review IDs
      const reviewIds = [
        ...((resumeRes.data || []).filter((r) => r.ai_review_id).map((r) => r.ai_review_id)),
        ...((coverRes.data || []).filter((r) => r.ai_review_id).map((r) => r.ai_review_id)),
      ].filter(Boolean) as string[];

      const { data: reviews } = reviewIds.length > 0
        ? await supabase
            .from("ai_review_results")
            .select("id, overall_score, feedback, reviewed_at, model_name, reviewer_comment")
            .in("id", reviewIds)
        : { data: [] };

      const reviewMap = new Map(
        (reviews || []).map((r) => [r.id, r])
      );

      // Build unified rows
      const allRows: ReviewRow[] = [];

      for (const doc of resumeRes.data || []) {
        const student = studentMap.get(doc.user_id);
        if (!student) continue;
        if (docTypeFilter !== "all" && docTypeFilter !== "resume") continue;
        if (
          eduFilter !== "all" &&
          student.education_level !== eduFilter
        )
          continue;

        const review = doc.ai_review_id ? reviewMap.get(doc.ai_review_id) : null;
        allRows.push({
          id: doc.id,
          user_id: doc.user_id,
          document_type: "resume",
          document_id: doc.id,
          title: doc.title || doc.file_name,
          status: doc.status,
          overall_score: review?.overall_score ?? null,
          feedback: review?.feedback ?? null,
          reviewed_at: review?.reviewed_at ?? null,
          created_at: doc.created_at,
          gem_name: null,
          student_name: student.name,
          student_school: student.school,
          student_department: student.department,
          student_email: student.student_email,
          student_avatar: student.avatar_url,
          education_level: student.education_level,
        });
      }

      for (const doc of coverRes.data || []) {
        const student = studentMap.get(doc.user_id);
        if (!student) continue;
        if (docTypeFilter !== "all" && docTypeFilter !== "cover_letter") continue;
        if (
          eduFilter !== "all" &&
          student.education_level !== eduFilter
        )
          continue;

        const review = doc.ai_review_id ? reviewMap.get(doc.ai_review_id) : null;
        allRows.push({
          id: doc.id,
          user_id: doc.user_id,
          document_type: "cover_letter",
          document_id: doc.id,
          title: doc.title || doc.file_name || "자기소개서",
          status: doc.status,
          overall_score: review?.overall_score ?? null,
          feedback: review?.feedback ?? null,
          reviewed_at: review?.reviewed_at ?? null,
          created_at: doc.created_at,
          gem_name: null,
          student_name: student.name,
          student_school: student.school,
          student_department: student.department,
          student_email: student.student_email,
          student_avatar: student.avatar_url,
          education_level: student.education_level,
        });
      }

      // Sort by created_at desc
      allRows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setTotalCount(allRows.length);

      // Score distribution for chart
      const dist = [
        { range: "0-20", 이력서: 0, 자소서: 0 },
        { range: "21-40", 이력서: 0, 자소서: 0 },
        { range: "41-60", 이력서: 0, 자소서: 0 },
        { range: "61-80", 이력서: 0, 자소서: 0 },
        { range: "81-100", 이력서: 0, 자소서: 0 },
      ];
      for (const r of allRows) {
        if (r.overall_score == null) continue;
        const idx = Math.min(Math.floor(r.overall_score / 20), 4);
        const safeIdx = r.overall_score === 0 ? 0 : idx === 0 ? 0 : idx;
        const key = r.document_type === "resume" ? "이력서" : "자소서";
        dist[safeIdx][key]++;
      }
      setScoreDistribution(dist);

      // Gem usage stats
      const gemMap = new Map<string, { count: number; totalScore: number }>();
      for (const r of allRows) {
        if (!r.gem_name || r.overall_score == null) continue;
        const existing = gemMap.get(r.gem_name) || { count: 0, totalScore: 0 };
        existing.count++;
        existing.totalScore += r.overall_score;
        gemMap.set(r.gem_name, existing);
      }
      setGemStats(
        Array.from(gemMap.entries())
          .map(([name, { count, totalScore }]) => ({
            name,
            count,
            avgScore: Math.round(totalScore / count),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      // Pending docs for batch
      setPendingDocs(allRows.filter((r) => r.status === "uploaded"));

      // Paginate
      const start = (page - 1) * PAGE_SIZE;
      setRows(allRows.slice(start, start + PAGE_SIZE));
    } catch (err) {
      console.error("데이터 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId, page, docTypeFilter, eduFilter, statusFilter, periodFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [docTypeFilter, eduFilter, statusFilter, periodFilter]);

  const handleReview = async (row: ReviewRow, gemId: string) => {
    setGemPopover(null);
    setProcessingIds((prev) => new Set(prev).add(row.id));
    try {
      const endpoint =
        row.document_type === "resume"
          ? "/api/gemini/review-resume"
          : "/api/gemini/review-cover-letter";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_id: row.document_id, gem_id: gemId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "첨삭 실패");
      }

      toast.success("AI 첨삭이 완료되었습니다");
      fetchData();
      onStatsUpdate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "AI 첨삭에 실패했습니다"
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.id);
        return next;
      });
    }
  };

  const handleDelete = async (row: ReviewRow) => {
    if (!confirm(`"${row.title}" 문서를 삭제하시겠습니까?`)) return;

    const table =
      row.document_type === "resume"
        ? "uploaded_resumes"
        : "uploaded_cover_letters";
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) {
      toast.error("삭제에 실패했습니다");
    } else {
      toast.success("삭제되었습니다");
      fetchData();
      onStatsUpdate();
    }
  };

  const getRelativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return "방금 전";
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "어제";
    if (days < 7) return `${days}일 전`;
    if (days < 30) return `${Math.floor(days / 7)}주 전`;
    return `${Math.floor(days / 30)}개월 전`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 71) return "text-green-500";
    if (score >= 41) return "text-yellow-500";
    return "text-red-500";
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          <select
            value={docTypeFilter}
            onChange={(e) => setDocTypeFilter(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            <option value="all">전체 유형</option>
            <option value="resume">이력서</option>
            <option value="cover_letter">자기소개서</option>
          </select>
          <select
            value={eduFilter}
            onChange={(e) => setEduFilter(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            <option value="all">전체 학교급</option>
            <option value="high_school">특성화고</option>
            <option value="university">대학교</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            <option value="all">전체 상태</option>
            <option value="uploaded">대기중</option>
            <option value="reviewing">분석중</option>
            <option value="reviewed">완료</option>
            <option value="failed">실패</option>
          </select>
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value)}
            className="text-sm rounded-lg border border-gray-200 px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200"
          >
            <option value="all">전체 기간</option>
            <option value="week">최근 1주</option>
            <option value="month">최근 1개월</option>
            <option value="quarter">최근 3개월</option>
          </select>
        </div>
        <button
          onClick={() => {
            if (pendingDocs.length === 0) {
              toast.error("대기중인 문서가 없습니다");
              return;
            }
            setBatchModal(true);
          }}
          disabled={!hasApiKey}
          title={!hasApiKey ? "API 키를 먼저 등록해주세요" : undefined}
          className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4" />
          대기 문서 일괄 첨삭 ({pendingDocs.length}건)
        </button>
      </div>

      {/* 테이블 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center">
          <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">
            아직 AI 첨삭 기록이 없습니다
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            학생관리에서 이력서를 업로드하고 AI 첨삭을 시작해보세요
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 font-medium">
                  <th className="px-4 py-3">학생</th>
                  <th className="px-4 py-3">학교급</th>
                  <th className="px-4 py-3">문서유형</th>
                  <th className="px-4 py-3">제목</th>
                  <th className="px-4 py-3">Gem</th>
                  <th className="px-4 py-3">점수</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">처리일</th>
                  <th className="px-4 py-3">액션</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.document_type}-${row.id}`}
                    className="border-t border-gray-100 dark:border-gray-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors"
                  >
                    {/* 학생 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.student_avatar ? (
                          <img
                            src={row.student_avatar}
                            alt=""
                            className="w-7 h-7 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                            {row.student_name?.[0]}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {row.student_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {row.student_school}
                            {row.student_department
                              ? ` · ${row.student_department}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* 학교급 */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.education_level === "high_school"
                            ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        }`}
                      >
                        {row.education_level === "high_school"
                          ? "특성화고"
                          : "대학교"}
                      </span>
                    </td>

                    {/* 문서유형 */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          row.document_type === "resume"
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                        }`}
                      >
                        {row.document_type === "resume" ? "이력서" : "자소서"}
                      </span>
                    </td>

                    {/* 제목 */}
                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-700 dark:text-gray-300 max-w-[200px] truncate">
                        {row.title}
                      </p>
                    </td>

                    {/* Gem */}
                    <td className="px-4 py-3">
                      {row.gem_name ? (
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {row.gem_name}
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 점수 */}
                    <td className="px-4 py-3">
                      {row.overall_score != null ? (
                        <span
                          className={`font-bold text-sm ${getScoreColor(
                            row.overall_score
                          )}`}
                        >
                          {row.overall_score}점
                        </span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>

                    {/* 상태 */}
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={row.status}
                        isProcessing={processingIds.has(row.id)}
                      />
                    </td>

                    {/* 처리일 */}
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {getRelativeTime(row.reviewed_at || row.created_at)}
                    </td>

                    {/* 액션 */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {row.status === "uploaded" && (
                          <button
                            onClick={(e) => {
                              setGemPopover({
                                row,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            disabled={!hasApiKey || processingIds.has(row.id)}
                            className="text-purple-600 dark:text-purple-400 text-sm font-medium hover:text-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            AI 첨삭
                          </button>
                        )}
                        {row.status === "reviewed" && (
                          <>
                            <button
                              onClick={() => setReviewModal(row)}
                              className="text-purple-600 dark:text-purple-400 text-sm hover:text-purple-700"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {row.student_email && (
                              <button
                                className="text-blue-500 text-sm hover:text-blue-600"
                                title="이메일 발송"
                              >
                                <Mail className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                        {row.status === "failed" && (
                          <button
                            onClick={(e) => {
                              setGemPopover({
                                row,
                                x: e.clientX,
                                y: e.clientY,
                              });
                            }}
                            disabled={!hasApiKey}
                            className="text-orange-500 text-sm hover:text-orange-600 disabled:opacity-50"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(row)}
                          className="text-red-400 text-sm hover:text-red-500 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <div
                key={`m-${row.document_type}-${row.id}`}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium">
                      {row.student_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {row.student_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {row.student_school}
                      </p>
                    </div>
                  </div>
                  <StatusBadge
                    status={row.status}
                    isProcessing={processingIds.has(row.id)}
                  />
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 truncate mb-2">
                  {row.title}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        row.document_type === "resume"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-green-50 text-green-700"
                      }`}
                    >
                      {row.document_type === "resume" ? "이력서" : "자소서"}
                    </span>
                    {row.overall_score != null && (
                      <span
                        className={`text-sm font-bold ${getScoreColor(
                          row.overall_score
                        )}`}
                      >
                        {row.overall_score}점
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {row.status === "uploaded" && (
                      <button
                        onClick={(e) =>
                          setGemPopover({
                            row,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        disabled={!hasApiKey}
                        className="text-purple-600 text-xs font-medium disabled:opacity-50"
                      >
                        AI 첨삭
                      </button>
                    )}
                    {row.status === "reviewed" && (
                      <button
                        onClick={() => setReviewModal(row)}
                        className="text-purple-600 text-xs"
                      >
                        결과 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 px-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                총 {totalCount}건 중 {(page - 1) * PAGE_SIZE + 1}-
                {Math.min(page * PAGE_SIZE, totalCount)}건
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* 점수 분포 차트 */}
      {scoreDistribution.some(
        (d) => d["이력서"] > 0 || d["자소서"] > 0
      ) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            AI 첨삭 점수 분포
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="이력서"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="자소서"
                  fill="#22c55e"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Gem 사용 통계 */}
      {gemStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Gem 사용 통계
          </h3>
          <div className="space-y-3">
            {gemStats.map((gem, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 w-5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {gem.name}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {gem.count}회 사용
                  </span>
                  <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                    평균 {gem.avgScore}점
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gem 선택 팝오버 */}
      {gemPopover && (
        <GemSelectPopover
          category={
            gemPopover.row.document_type === "resume"
              ? "resume"
              : "cover_letter"
          }
          educationLevel={gemPopover.row.education_level}
          department={gemPopover.row.student_department || undefined}
          onSelect={(gemId) => handleReview(gemPopover.row, gemId)}
          onCancel={() => setGemPopover(null)}
        />
      )}

      {/* AI 결과 모달 */}
      {reviewModal && (
        <AIReviewModal
          isOpen={true}
          onClose={() => setReviewModal(null)}
          reviewData={{
            overall_score: reviewModal.overall_score,
            feedback: reviewModal.feedback,
            created_at: reviewModal.reviewed_at || reviewModal.created_at,
          }}
          documentTitle={reviewModal.title}
          gemName={reviewModal.gem_name || undefined}
          studentEmail={reviewModal.student_email}
        />
      )}

      {/* 일괄 첨삭 모달 */}
      {batchModal && (
        <BatchReviewModal
          documents={pendingDocs.map((d) => ({
            id: d.id,
            document_type: d.document_type,
            title: d.title,
            student_name: d.student_name,
            student_id: d.user_id,
            education_level: d.education_level,
            department: d.student_department || undefined,
          }))}
          onClose={() => setBatchModal(false)}
          onComplete={() => {
            setBatchModal(false);
            fetchData();
            onStatsUpdate();
          }}
        />
      )}
    </div>
  );
}

function StatusBadge({
  status,
  isProcessing,
}: {
  status: UploadDocumentStatus;
  isProcessing?: boolean;
}) {
  if (isProcessing || status === "reviewing") {
    return (
      <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full dark:bg-yellow-900/30 dark:text-yellow-300">
        <Loader2 className="w-3 h-3 animate-spin" />
        분석중
      </span>
    );
  }
  const map: Record<
    UploadDocumentStatus,
    { bg: string; text: string }
  > = {
    uploaded: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300" },
    reviewing: { bg: "bg-yellow-100", text: "text-yellow-700" },
    reviewed: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
    failed: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  };
  const labels: Record<UploadDocumentStatus, string> = {
    uploaded: "대기중",
    reviewing: "분석중",
    reviewed: "완료",
    failed: "실패",
  };
  const s = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${s.bg} ${s.text}`}>
      {labels[status]}
    </span>
  );
}
