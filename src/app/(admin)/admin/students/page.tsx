"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile, EducationLevel } from "@/lib/types";
import {
  Download,
  Search,
  Users,
  MoreHorizontal,
  Eye,
  UserCog,
  Trash2,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import ChangeInstructorModal from "@/components/admin/ChangeInstructorModal";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

const EDUCATION_LABELS: Record<EducationLevel, string> = {
  high_school: "특성화고",
  university: "대학생",
};

interface StudentRow extends Profile {
  instructorName?: string;
  resumeCount: number;
  coverLetterCount: number;
  lastActivity: string | null;
}

export default function AdminStudentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [educationFilter, setEducationFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [page, setPage] = useState(1);

  // Instructors for filter dropdown
  const [instructorOptions, setInstructorOptions] = useState<
    { id: string; name: string }[]
  >([]);

  // Action dropdown
  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Change instructor modal
  const [changeModal, setChangeModal] = useState<{
    studentId: string;
    studentName: string;
    currentInstructorId: string | null;
  } | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [instructorFilter, educationFilter, gradeFilter, sortBy]);

  // Fetch instructors for filter
  useEffect(() => {
    const fetchInstructors = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "instructor")
        .order("name");
      if (data) setInstructorOptions(data);
    };
    fetchInstructors();
  }, [supabase]);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch students
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("role", "student");

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,school.ilike.%${debouncedSearch}%,department.ilike.%${debouncedSearch}%`
        );
      }

      if (instructorFilter !== "all") {
        query = query.eq("instructor_id", instructorFilter);
      }

      if (educationFilter !== "all") {
        query = query.eq("education_level", educationFilter);
      }

      if (gradeFilter !== "all") {
        query = query.eq("grade", parseInt(gradeFilter));
      }

      switch (sortBy) {
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "activity":
          query = query.order("updated_at", { ascending: false });
          break;
        case "recent":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data: profiles, count, error } = await query;
      if (error) throw error;

      if (!profiles || profiles.length === 0) {
        setStudents([]);
        setTotalCount(count ?? 0);
        setIsLoading(false);
        return;
      }

      // 2. Get instructor map
      const { data: instructors } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "instructor");
      const instructorMap = new Map(
        instructors?.map((i) => [i.id, i.name]) || []
      );

      // 3. Get document counts and last activity
      const studentIds = profiles.map((p) => p.id);

      const [resumeRes, coverRes, streakRes] = await Promise.all([
        supabase
          .from("uploaded_resumes")
          .select("user_id")
          .in("user_id", studentIds),
        supabase
          .from("uploaded_cover_letters")
          .select("user_id")
          .in("user_id", studentIds),
        supabase
          .from("streaks")
          .select("user_id, last_active_date")
          .in("user_id", studentIds),
      ]);

      const resumeMap = new Map<string, number>();
      resumeRes.data?.forEach((r) => {
        resumeMap.set(r.user_id, (resumeMap.get(r.user_id) ?? 0) + 1);
      });

      const coverMap = new Map<string, number>();
      coverRes.data?.forEach((c) => {
        coverMap.set(c.user_id, (coverMap.get(c.user_id) ?? 0) + 1);
      });

      const activityMap = new Map<string, string | null>();
      streakRes.data?.forEach((s) => {
        activityMap.set(s.user_id, s.last_active_date);
      });

      // 4. Build rows
      const rows: StudentRow[] = profiles.map((p) => ({
        ...(p as Profile),
        instructorName: p.instructor_id
          ? instructorMap.get(p.instructor_id) || "-"
          : "-",
        resumeCount: resumeMap.get(p.id) ?? 0,
        coverLetterCount: coverMap.get(p.id) ?? 0,
        lastActivity: activityMap.get(p.id) ?? null,
      }));

      // Sort by activity if needed
      if (sortBy === "activity") {
        rows.sort((a, b) => {
          if (!a.lastActivity && !b.lastActivity) return 0;
          if (!a.lastActivity) return 1;
          if (!b.lastActivity) return -1;
          return (
            new Date(b.lastActivity).getTime() -
            new Date(a.lastActivity).getTime()
          );
        });
      }

      setStudents(rows);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("학생 목록 조회 실패:", err);
      toast.error("학생 목록을 불러오는데 실패했습니다.");
    }
    setIsLoading(false);
  }, [
    supabase,
    debouncedSearch,
    instructorFilter,
    educationFilter,
    gradeFilter,
    sortBy,
    page,
  ]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Close action dropdown on outside click
  useEffect(() => {
    const handleClick = () => setOpenActionId(null);
    if (openActionId) {
      document.addEventListener("click", handleClick);
      return () => document.removeEventListener("click", handleClick);
    }
  }, [openActionId]);

  // CSV Export
  const handleCSVExport = async () => {
    try {
      toast.loading("CSV 생성 중...", { id: "csv" });

      let query = supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .order("name");

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,school.ilike.%${debouncedSearch}%,department.ilike.%${debouncedSearch}%`
        );
      }
      if (instructorFilter !== "all") {
        query = query.eq("instructor_id", instructorFilter);
      }
      if (educationFilter !== "all") {
        query = query.eq("education_level", educationFilter);
      }
      if (gradeFilter !== "all") {
        query = query.eq("grade", parseInt(gradeFilter));
      }

      const { data: allProfiles } = await query;
      if (!allProfiles || allProfiles.length === 0) {
        toast.error("내보낼 데이터가 없습니다.", { id: "csv" });
        return;
      }

      const { data: instructors } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("role", "instructor");
      const iMap = new Map(instructors?.map((i) => [i.id, i.name]) || []);

      const header = "이름,이메일,학교,학과,학교급,학년,담당 강사,희망 분야,가입일\n";
      const rows = allProfiles
        .map((p) => {
          const eduLabel =
            p.education_level === "high_school"
              ? "특성화고"
              : p.education_level === "university"
              ? "대학생"
              : "-";
          return [
            p.name || "",
            p.email || "",
            p.school || "",
            p.department || "",
            eduLabel,
            p.grade || "",
            p.instructor_id ? iMap.get(p.instructor_id) || "" : "",
            p.target_field || "",
            p.created_at ? format(new Date(p.created_at), "yyyy-MM-dd") : "",
          ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",");
        })
        .join("\n");

      const bom = "\uFEFF";
      const blob = new Blob([bom + header + rows], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `students_${format(new Date(), "yyyyMMdd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("CSV 파일이 다운로드되었습니다.", { id: "csv" });
    } catch {
      toast.error("CSV 내보내기에 실패했습니다.", { id: "csv" });
    }
  };

  // Delete student
  const handleDelete = async (student: StudentRow) => {
    if (
      !confirm(
        `"${student.name}" 학생을 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", student.id);
      if (error) throw error;
      toast.success("학생이 삭제되었습니다.");
      fetchStudents();
    } catch {
      toast.error("학생 삭제에 실패했습니다.");
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">전체 학생 관리</h2>
          <span className="bg-red-100 text-red-700 text-sm px-2.5 py-0.5 rounded-full font-medium">
            {totalCount}명
          </span>
        </div>
        <button
          onClick={handleCSVExport}
          className="bg-white border border-gray-200 text-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm"
        >
          <Download className="w-4 h-4" />
          CSV 내보내기
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 학교, 학과로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Instructor filter */}
            <select
              value={instructorFilter}
              onChange={(e) => setInstructorFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">전체 강사</option>
              {instructorOptions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>

            {/* Education level filter */}
            <select
              value={educationFilter}
              onChange={(e) => setEducationFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">전체 학교급</option>
              <option value="high_school">특성화고</option>
              <option value="university">대학생</option>
            </select>

            {/* Grade filter */}
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">전체 학년</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              <option value="4">4학년</option>
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="recent">최근 가입순</option>
              <option value="name">이름순</option>
              <option value="activity">최근 활동순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading && students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-red-500" />
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          {debouncedSearch ||
          instructorFilter !== "all" ||
          educationFilter !== "all" ||
          gradeFilter !== "all" ? (
            <>
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-gray-500">다른 조건을 시도해보세요</p>
            </>
          ) : (
            <>
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                등록된 학생이 없습니다
              </h3>
              <p className="text-gray-500">
                학생이 회원가입하면 여기에 표시됩니다
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      학생
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      학교/학과
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      학교급
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">
                      학년
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      담당 강사
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">
                      문서수
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-600">
                      최근활동
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {students.map((student) => {
                    const initials = student.name
                      ? student.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)
                      : "?";

                    return (
                      <tr
                        key={student.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {/* Student */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            {student.avatar_url ? (
                              <img
                                src={student.avatar_url}
                                alt={student.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                                {initials}
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">
                                {student.name}
                              </p>
                              <p className="text-xs text-gray-400">
                                {student.email}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* School/Department */}
                        <td className="py-3 px-4">
                          <p className="text-gray-900">
                            {student.school || "-"}
                          </p>
                          <p className="text-xs text-gray-400">
                            {student.department || ""}
                          </p>
                        </td>

                        {/* Education level */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              student.education_level === "high_school"
                                ? "bg-green-100 text-green-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {EDUCATION_LABELS[student.education_level] || "-"}
                          </span>
                        </td>

                        {/* Grade */}
                        <td className="py-3 px-4 text-center text-gray-700">
                          {student.grade ? `${student.grade}학년` : "-"}
                        </td>

                        {/* Instructor */}
                        <td className="py-3 px-4">
                          {student.instructor_id ? (
                            <Link
                              href={`/admin/instructors/${student.instructor_id}`}
                              className="text-red-600 hover:underline text-sm"
                            >
                              {student.instructorName}
                            </Link>
                          ) : (
                            <span className="text-gray-400 text-sm">
                              미배정
                            </span>
                          )}
                        </td>

                        {/* Document count */}
                        <td className="py-3 px-4 text-center">
                          <span className="text-gray-700">
                            {student.resumeCount + student.coverLetterCount}
                          </span>
                        </td>

                        {/* Last activity */}
                        <td className="py-3 px-4 text-gray-500 text-xs">
                          {student.lastActivity
                            ? formatDistanceToNow(
                                new Date(student.lastActivity),
                                { addSuffix: true, locale: ko }
                              )
                            : "-"}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionId(
                                  openActionId === student.id
                                    ? null
                                    : student.id
                                );
                              }}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4 text-gray-500" />
                            </button>

                            {openActionId === student.id && (
                              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-10 min-w-[160px]">
                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    router.push(
                                      `/admin/students/${student.id}`
                                    );
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  상세보기
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    setChangeModal({
                                      studentId: student.id,
                                      studentName: student.name,
                                      currentInstructorId:
                                        student.instructor_id,
                                    });
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                >
                                  <UserCog className="w-4 h-4" />
                                  담당 강사 변경
                                </button>
                                <button
                                  onClick={() => {
                                    setOpenActionId(null);
                                    handleDelete(student);
                                  }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-white rounded-xl shadow-sm">
              <p className="text-sm text-gray-500">
                총 {totalCount}명 중 {showFrom}-{showTo}명 표시
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  이전
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        page === pageNum
                          ? "bg-red-500 text-white"
                          : "border border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Change Instructor Modal */}
      {changeModal && (
        <ChangeInstructorModal
          isOpen={true}
          onClose={() => setChangeModal(null)}
          studentId={changeModal.studentId}
          studentName={changeModal.studentName}
          currentInstructorId={changeModal.currentInstructorId}
          onSuccess={fetchStudents}
        />
      )}
    </div>
  );
}
