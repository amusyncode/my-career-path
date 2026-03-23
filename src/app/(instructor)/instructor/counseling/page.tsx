"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { CounselingType } from "@/lib/types";
import { format } from "date-fns";
import {
  MessageSquareHeart,
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  Calendar,
  Loader2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE = 15;

const TYPE_OPTIONS: { value: CounselingType | ""; label: string }[] = [
  { value: "", label: "전체 유형" },
  { value: "career", label: "진로상담" },
  { value: "resume", label: "이력서상담" },
  { value: "interview", label: "면접준비" },
  { value: "mental", label: "고충상담" },
  { value: "other", label: "기타" },
];

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

interface CounselingRow {
  id: string;
  user_id: string;
  title: string;
  content: string | null;
  counseling_type: CounselingType;
  counseling_date: string;
  is_completed: boolean;
  action_items: string | null;
  next_counseling_date: string | null;
  created_at: string;
  profiles: {
    name: string;
    school: string | null;
    department: string | null;
    grade: number | null;
    avatar_url: string | null;
  };
}

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
}

export default function InstructorCounselingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [records, setRecords] = useState<CounselingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<CounselingType | "">("");

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    thisMonth: 0,
    upcoming: 0,
    completed: 0,
  });

  // Modal
  const [showNewModal, setShowNewModal] = useState(false);

  // Auth check
  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role !== "instructor" && profile?.role !== "super_admin") {
        router.push("/dashboard");
        return;
      }
      setInstructorId(user.id);
    };
    check();
  }, [supabase, router]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!instructorId) return;
    setIsLoading(true);

    try {
      // Get student IDs
      const { data: students } = await supabase
        .from("profiles")
        .select("id")
        .eq("instructor_id", instructorId)
        .eq("role", "student");

      const studentIds = (students || []).map((s) => s.id);
      if (studentIds.length === 0) {
        setRecords([]);
        setTotalCount(0);
        setStats({ total: 0, thisMonth: 0, upcoming: 0, completed: 0 });
        setIsLoading(false);
        return;
      }

      // Build query
      let query = supabase
        .from("counseling_records")
        .select("id, user_id, title, content, counseling_type, counseling_date, is_completed, action_items, next_counseling_date, created_at, profiles!counseling_records_user_id_fkey(name, school, department, grade, avatar_url)", { count: "exact" })
        .in("user_id", studentIds)
        .order("counseling_date", { ascending: false });

      if (typeFilter) {
        query = query.eq("counseling_type", typeFilter);
      }

      // Pagination
      const from = page * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      let filtered = (data || []) as unknown as CounselingRow[];
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.profiles?.name?.toLowerCase().includes(q) ||
            r.title.toLowerCase().includes(q)
        );
      }

      setRecords(filtered);
      setTotalCount(count || 0);

      // Stats (all records, no pagination)
      const { data: allRecords } = await supabase
        .from("counseling_records")
        .select("counseling_date, is_completed, next_counseling_date")
        .in("user_id", studentIds);

      const now = new Date();
      const thisMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      const todayStr = format(now, "yyyy-MM-dd");

      const all = allRecords || [];
      setStats({
        total: all.length,
        thisMonth: all.filter((r) => r.counseling_date >= thisMonthStart).length,
        upcoming: all.filter((r) => r.next_counseling_date && r.next_counseling_date >= todayStr).length,
        completed: all.filter((r) => r.is_completed).length,
      });
    } catch (err) {
      console.error("Counseling fetch error:", err);
      toast.error("상담 기록 조회에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId, page, typeFilter, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleCardClick = (record: CounselingRow) => {
    router.push(`/instructor/counseling/${record.user_id}?highlight=${record.id}`);
  };

  if (!instructorId) {
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
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            개별상담도우미
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            학생별 상담 기록 관리 및 AI 상담 제안
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-purple-500 text-white rounded-lg px-4 py-2.5 hover:bg-purple-600 transition-colors font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "전체 상담", value: stats.total, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: "이번 달", value: stats.thisMonth, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "예정 상담", value: stats.upcoming, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
          { label: "완료", value: stats.completed, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color} mt-1`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="학생 이름 또는 제목 검색..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value as CounselingType | ""); setPage(0); }}
            className="px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquareHeart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            {searchQuery || typeFilter ? "검색 결과가 없습니다" : "아직 상담 기록이 없습니다"}
          </p>
          {!searchQuery && !typeFilter && (
            <button
              onClick={() => setShowNewModal(true)}
              className="text-sm text-purple-500 hover:text-purple-600 font-medium"
            >
              첫 상담 기록 작성하기
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <button
              key={record.id}
              onClick={() => handleCardClick(record)}
              className="w-full bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md hover:border-purple-200 dark:hover:border-purple-700 transition-all text-left"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {record.profiles?.avatar_url ? (
                    <img
                      src={record.profiles.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center text-sm font-bold">
                      {record.profiles?.name?.[0] || "?"}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {record.profiles?.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {record.profiles?.school} · {record.profiles?.department}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[record.counseling_type]}`}>
                      {TYPE_LABELS[record.counseling_type]}
                    </span>
                    {record.is_completed && (
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">
                    {record.title}
                  </p>
                  {record.content && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {record.content}
                    </p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {record.counseling_date}
                  </p>
                  {record.next_counseling_date && (
                    <p className="text-xs text-purple-500 flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      다음: {record.next_counseling_date}
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-500">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Counseling Modal */}
      {showNewModal && (
        <NewCounselingModal
          instructorId={instructorId}
          onClose={() => setShowNewModal(false)}
          onSave={() => {
            setShowNewModal(false);
            fetchData();
            toast.success("상담 기록이 저장되었습니다");
          }}
        />
      )}
    </div>
  );
}

// Inline New Counseling Modal
function NewCounselingModal({
  instructorId,
  onClose,
  onSave,
}: {
  instructorId: string;
  onClose: () => void;
  onSave: () => void;
}) {
  const supabase = createClient();

  const [students, setStudents] = useState<StudentOption[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentOption | null>(null);
  const [showStudentList, setShowStudentList] = useState(false);

  const [counselingType, setCounselingType] = useState<CounselingType>("career");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [counselingDate, setCounselingDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [actionItems, setActionItems] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStudents = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, school, department")
        .eq("instructor_id", instructorId)
        .eq("role", "student")
        .order("name");
      setStudents((data || []) as StudentOption[]);
    };
    fetchStudents();
  }, [supabase, instructorId]);

  const filteredStudents = students.filter(
    (s) =>
      s.name.includes(studentSearch) ||
      s.school?.includes(studentSearch) ||
      s.department?.includes(studentSearch)
  );

  const handleSave = async () => {
    if (!selectedStudent) { setError("학생을 선택해주세요."); return; }
    if (!title.trim()) { setError("제목을 입력해주세요."); return; }

    setIsSaving(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from("counseling_records")
        .insert({
          user_id: selectedStudent.id,
          counselor_id: instructorId,
          instructor_id: instructorId,
          title: title.trim(),
          content: content.trim() || null,
          counseling_type: counselingType,
          counseling_date: counselingDate,
          action_items: actionItems.trim() || null,
          next_counseling_date: nextDate || null,
        });

      if (insertError) throw insertError;
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
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
              새 상담 기록
            </h3>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Student select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">학생 선택 *</label>
              {selectedStudent ? (
                <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2">
                  <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                    {selectedStudent.name}
                    <span className="text-purple-400 ml-2 text-xs">
                      {[selectedStudent.school, selectedStudent.department].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <button onClick={() => setSelectedStudent(null)} className="text-xs text-purple-500 hover:text-purple-700">변경</button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={studentSearch}
                    onChange={(e) => { setStudentSearch(e.target.value); setShowStudentList(true); }}
                    onFocus={() => setShowStudentList(true)}
                    placeholder="학생 이름 검색..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {showStudentList && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {filteredStudents.length === 0 ? (
                        <p className="text-sm text-gray-400 p-3">검색 결과 없음</p>
                      ) : (
                        filteredStudents.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              setSelectedStudent(s);
                              setShowStudentList(false);
                              setStudentSearch("");
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm"
                          >
                            <span className="font-medium text-gray-900 dark:text-white">{s.name}</span>
                            <span className="text-gray-400 ml-2 text-xs">
                              {[s.school, s.department].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담 유형</label>
              <select
                value={counselingType}
                onChange={(e) => setCounselingType(e.target.value as CounselingType)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {TYPE_OPTIONS.filter((o) => o.value).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">제목 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="상담 제목"
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담 내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="상담 내용을 기록하세요..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">상담일</label>
              <input
                type="date"
                value={counselingDate}
                onChange={(e) => setCounselingDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Action items */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">후속 조치</label>
              <textarea
                value={actionItems}
                onChange={(e) => setActionItems(e.target.value)}
                placeholder="후속 조치 사항..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>

            {/* Next date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">다음 상담 예정일</label>
              <input
                type="date"
                value={nextDate}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 disabled:opacity-50 transition-colors"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              기록 저장
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
