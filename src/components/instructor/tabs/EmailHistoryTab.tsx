"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Mail, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

interface EmailLog {
  id: string;
  instructor_id: string;
  student_id: string | null;
  recipient_email: string;
  subject: string;
  content_type: string;
  status: string;
  sent_at: string;
  error_message: string | null;
  student_name?: string;
}

const CONTENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ai_review: { label: "AI 분석", color: "bg-blue-100 text-blue-700" },
  counseling: { label: "상담 기록", color: "bg-green-100 text-green-700" },
  invite: { label: "초대", color: "bg-purple-100 text-purple-700" },
  instructor_welcome: { label: "강사 환영", color: "bg-red-100 text-red-700" },
  custom: { label: "커스텀", color: "bg-gray-100 text-gray-700" },
};

const PAGE_SIZE = 15;

export default function EmailHistoryTab({ instructorId }: { instructorId: string }) {
  const supabase = createClient();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("email_logs")
        .select("*", { count: "exact" })
        .eq("instructor_id", instructorId)
        .order("sent_at", { ascending: false });

      if (typeFilter !== "all") {
        query = query.eq("content_type", typeFilter);
      }

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error("이메일 로그 조회 실패:", error);
        return;
      }

      // Fetch student names for logs that have student_id
      const studentIds = [...new Set((data || []).filter(l => l.student_id).map(l => l.student_id!))];
      let studentMap: Record<string, string> = {};
      if (studentIds.length > 0) {
        const { data: students } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", studentIds);
        if (students) {
          studentMap = Object.fromEntries(students.map(s => [s.id, s.name]));
        }
      }

      const enriched = (data || []).map(log => ({
        ...log,
        student_name: log.student_id ? studentMap[log.student_id] || "-" : "-",
      }));

      setLogs(enriched);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("이메일 로그 조회 실패:", err);
    }
    setLoading(false);
  }, [supabase, instructorId, page, typeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === "sent") return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
        >
          <option value="all">전체 유형</option>
          <option value="ai_review">AI 분석</option>
          <option value="counseling">상담 기록</option>
          <option value="invite">초대</option>
          <option value="custom">커스텀</option>
        </select>
        <span className="text-sm text-gray-500">총 {totalCount}건</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>발송 내역이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden dark:bg-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">유형</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">학생</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">수신자</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">제목</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">발송일</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const typeInfo = CONTENT_TYPE_LABELS[log.content_type] || { label: log.content_type, color: "bg-gray-100 text-gray-700" };
                  return (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon status={log.status} />
                          <span className={`text-xs ${log.status === "sent" ? "text-green-600" : log.status === "failed" ? "text-red-600" : "text-yellow-600"}`}>
                            {log.status === "sent" ? "성공" : log.status === "failed" ? "실패" : "대기"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${typeInfo.color}`}>
                          {typeInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{log.student_name}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">{log.recipient_email}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300 max-w-[250px] truncate">{log.subject}</td>
                      <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                        {new Date(log.sent_at).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" })}
                        {" "}
                        {new Date(log.sent_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>
              <span className="text-sm text-gray-500">{page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
