"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { EducationLevel } from "@/lib/types";
import {
  Download,
  Search,
  Users,
  UserPlus,
} from "lucide-react";
import { differenceInDays } from "date-fns";
import { formatDistanceToNow } from "date-fns/formatDistanceToNow";
import { ko } from "date-fns/locale/ko";
import toast from "react-hot-toast";
import StudentRegistrationModal from "@/components/instructor/StudentRegistrationModal";
import { exportStudentsToCSV } from "./_utils/csv-export";

const PAGE_SIZE = 20;

interface InstructorStudentItem {
  id: string;
  name: string;
  email: string | null;
  student_email: string | null;
  school: string | null;
  department: string | null;
  grade: number | null;
  target_field: string | null;
  avatar_url: string | null;
  education_level: EducationLevel;
  created_at: string;
  resume_count: number;
  cover_letter_count: number;
  last_active_date: string | null;
  has_auth: boolean; // auth account exists
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getActivityStatus(
  lastActiveDate: string | null,
  hasAuth: boolean
): "active" | "inactive" | "unregistered" {
  if (!hasAuth) return "unregistered";
  if (!lastActiveDate) return "inactive";
  return differenceInDays(new Date(), new Date(lastActiveDate)) <= 7
    ? "active"
    : "inactive";
}

function formatRelativeTime(date: string | null): string {
  if (!date) return "활동 없음";
  const days = differenceInDays(new Date(), new Date(date));
  if (days === 0) return "오늘";
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ko });
}

export default function InstructorStudentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<InstructorStudentItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [eduFilter, setEduFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [page, setPage] = useState(1);
  const [showRegistrationModal, setShowRegistrationModal] = useState(false);
  const [instructorId, setInstructorId] = useState<string | null>(null);

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
  }, [eduFilter, gradeFilter, activityFilter, sortBy]);

  // Get current instructor ID
  useEffect(() => {
    const getInstructor = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setInstructorId(user.id);
    };
    getInstructor();
  }, [supabase]);

  const fetchStudents = useCallback(async () => {
    if (!instructorId) return;

    setIsLoading(true);
    try {
      // 1. Query profiles with instructor_id filter
      let query = supabase
        .from("profiles")
        .select(
          "id, name, email, student_email, school, department, grade, target_field, avatar_url, education_level, created_at",
          { count: "exact" }
        )
        .eq("instructor_id", instructorId)
        .eq("role", "student");

      // Search filter
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,school.ilike.%${debouncedSearch}%,department.ilike.%${debouncedSearch}%`
        );
      }

      // Education level filter
      if (eduFilter !== "all") {
        query = query.eq("education_level", eduFilter);
      }

      // Grade filter
      if (gradeFilter !== "all") {
        query = query.eq("grade", parseInt(gradeFilter));
      }

      // Sort
      switch (sortBy) {
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "recent":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      // Pagination
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

      // 2. Get student IDs
      const studentIds = profiles.map((p) => p.id);

      // 3. Parallel queries for related data
      const [resumesRes, coverLettersRes, streaksRes] = await Promise.all([
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

      // 4. Count maps
      const resumeCountMap = new Map<string, number>();
      resumesRes.data?.forEach((r) => {
        resumeCountMap.set(
          r.user_id,
          (resumeCountMap.get(r.user_id) ?? 0) + 1
        );
      });

      const clCountMap = new Map<string, number>();
      coverLettersRes.data?.forEach((c) => {
        clCountMap.set(c.user_id, (clCountMap.get(c.user_id) ?? 0) + 1);
      });

      const streakMap = new Map<string, string | null>();
      streaksRes.data?.forEach((s) => {
        streakMap.set(s.user_id, s.last_active_date);
      });

      // 5. Build items
      let items: InstructorStudentItem[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        student_email: p.student_email,
        school: p.school,
        department: p.department,
        grade: p.grade,
        target_field: p.target_field,
        avatar_url: p.avatar_url,
        education_level: p.education_level as EducationLevel,
        created_at: p.created_at,
        resume_count: resumeCountMap.get(p.id) ?? 0,
        cover_letter_count: clCountMap.get(p.id) ?? 0,
        last_active_date: streakMap.get(p.id) ?? null,
        has_auth: !!p.email, // If email exists, they have an auth account
      }));

      // 6. Activity filter (client-side)
      if (activityFilter === "active") {
        items = items.filter(
          (s) => getActivityStatus(s.last_active_date, s.has_auth) === "active"
        );
      } else if (activityFilter === "inactive") {
        items = items.filter(
          (s) =>
            getActivityStatus(s.last_active_date, s.has_auth) === "inactive"
        );
      } else if (activityFilter === "unregistered") {
        items = items.filter(
          (s) =>
            getActivityStatus(s.last_active_date, s.has_auth) === "unregistered"
        );
      }

      // Sort by activity
      if (sortBy === "activity") {
        items.sort((a, b) => {
          if (!a.last_active_date && !b.last_active_date) return 0;
          if (!a.last_active_date) return 1;
          if (!b.last_active_date) return -1;
          return (
            new Date(b.last_active_date).getTime() -
            new Date(a.last_active_date).getTime()
          );
        });
      }

      setStudents(items);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("학생 목록 조회 실패:", err);
      toast.error("학생 목록을 불러오는데 실패했습니다.");
    }
    setIsLoading(false);
  }, [
    supabase,
    instructorId,
    debouncedSearch,
    eduFilter,
    gradeFilter,
    activityFilter,
    sortBy,
    page,
  ]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleStudentClick = (studentId: string) => {
    router.push(`/instructor/students/${studentId}`);
  };

  const handleCSVExport = async () => {
    if (!instructorId) return;
    try {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select(
          "name, email, student_email, school, department, education_level, grade, target_field, created_at"
        )
        .eq("instructor_id", instructorId)
        .eq("role", "student")
        .order("name");

      if (!allProfiles) return;
      exportStudentsToCSV(allProfiles as Parameters<typeof exportStudentsToCSV>[0]);
      toast.success("CSV 파일이 다운로드되었습니다.");
    } catch {
      toast.error("CSV 내보내기에 실패했습니다.");
    }
  };

  // Pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  // Grade options based on education level filter
  const showGrade4 = eduFilter !== "high_school";

  if (isLoading && students.length === 0) {
    return <StudentListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            학생관리
          </h2>
          <span className="bg-purple-100 text-purple-700 text-sm px-2 py-0.5 rounded-full font-medium dark:bg-purple-900/30 dark:text-purple-300">
            {totalCount}명
          </span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowRegistrationModal(true)}
            className="bg-purple-500 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-purple-600 transition-colors text-sm"
          >
            <UserPlus className="w-4 h-4" />
            학생 등록
          </button>
          <button
            onClick={handleCSVExport}
            className="bg-white border border-gray-200 text-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300"
          >
            <Download className="w-4 h-4" />
            CSV 내보내기
          </button>
        </div>
      </div>

      {/* Filter/Search bar */}
      <div className="bg-white rounded-xl shadow-sm p-4 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 학교, 학과로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select
              value={eduFilter}
              onChange={(e) => setEduFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="all">전체 학교급</option>
              <option value="high_school">특성화고</option>
              <option value="university">대학교</option>
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="all">전체 학년</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
              {showGrade4 && <option value="4">4학년</option>}
            </select>

            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="unregistered">미가입</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
            >
              <option value="recent">최근 등록순</option>
              <option value="name">이름순</option>
              <option value="activity">최근 활동순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
          {debouncedSearch ||
          eduFilter !== "all" ||
          gradeFilter !== "all" ||
          activityFilter !== "all" ? (
            <>
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
                검색 결과가 없습니다
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                다른 검색어를 시도해보세요
              </p>
            </>
          ) : (
            <>
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-500 mb-2 dark:text-gray-300">
                등록된 학생이 없습니다
              </h3>
              <p className="text-gray-400 text-sm mb-4 dark:text-gray-500">
                학생을 등록하여 시작해보세요
              </p>
              <button
                onClick={() => setShowRegistrationModal(true)}
                className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600 transition-colors inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                학생 등록
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden dark:bg-gray-800">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-sm text-gray-500 font-medium dark:bg-gray-700 dark:text-gray-400">
                  <th className="text-left px-4 py-3">학생</th>
                  <th className="text-left px-4 py-3">학교/학과</th>
                  <th className="text-left px-4 py-3">학교급</th>
                  <th className="text-left px-4 py-3">학년</th>
                  <th className="text-left px-4 py-3">희망분야</th>
                  <th className="text-left px-4 py-3">문서</th>
                  <th className="text-left px-4 py-3">최근활동</th>
                  <th className="text-left px-4 py-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const status = getActivityStatus(
                    student.last_active_date,
                    student.has_auth
                  );

                  return (
                    <tr
                      key={student.id}
                      onClick={() => handleStudentClick(student.id)}
                      className="hover:bg-purple-50 cursor-pointer transition-colors border-t border-gray-100 dark:hover:bg-gray-700/50 dark:border-gray-700"
                    >
                      {/* Student */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {student.avatar_url ? (
                            <img
                              src={student.avatar_url}
                              alt={student.name}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-medium dark:bg-purple-900/30 dark:text-purple-300">
                              {getInitials(student.name)}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-sm dark:text-white">
                              {student.name}
                            </div>
                            {student.student_email || student.email ? (
                              <div className="text-xs text-gray-400">
                                {student.student_email || student.email}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-300 italic dark:text-gray-500">
                                이메일 미등록
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* School/Dept */}
                      <td className="px-4 py-3">
                        <div className="text-sm dark:text-gray-300">
                          {student.school ?? "-"}
                        </div>
                        {student.department && (
                          <div className="text-xs text-gray-400">
                            {student.department}
                          </div>
                        )}
                      </td>

                      {/* Education Level */}
                      <td className="px-4 py-3">
                        {student.education_level === "high_school" ? (
                          <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                            특성화고
                          </span>
                        ) : (
                          <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                            대학교
                          </span>
                        )}
                      </td>

                      {/* Grade */}
                      <td className="px-4 py-3 text-sm dark:text-gray-300">
                        {student.grade ? `${student.grade}학년` : "-"}
                      </td>

                      {/* Target field */}
                      <td className="px-4 py-3">
                        {student.target_field ? (
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full dark:bg-gray-700 dark:text-gray-300">
                            {student.target_field}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm dark:text-gray-500">
                            -
                          </span>
                        )}
                      </td>

                      {/* Documents */}
                      <td className="px-4 py-3">
                        {student.resume_count > 0 ||
                        student.cover_letter_count > 0 ? (
                          <span className="text-xs dark:text-gray-300">
                            이력서 {student.resume_count} · 자소서{" "}
                            {student.cover_letter_count}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-sm dark:text-gray-500">
                            0
                          </span>
                        )}
                      </td>

                      {/* Last activity */}
                      <td className="px-4 py-3 text-sm">
                        {!student.has_auth ? (
                          <span className="text-gray-300 italic dark:text-gray-500">
                            미가입
                          </span>
                        ) : (
                          <span className="dark:text-gray-300">
                            {formatRelativeTime(student.last_active_date)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-sm">
                        {status === "active" && (
                          <span className="flex items-center">
                            <span className="w-2 h-2 rounded-full inline-block mr-1 bg-green-500" />
                            활성
                          </span>
                        )}
                        {status === "inactive" && (
                          <span className="flex items-center text-gray-400">
                            <span className="w-2 h-2 rounded-full inline-block mr-1 bg-yellow-400" />
                            비활성
                          </span>
                        )}
                        {status === "unregistered" && (
                          <span className="flex items-center text-gray-400">
                            <span className="w-2 h-2 rounded-full inline-block mr-1 bg-gray-300" />
                            미가입
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Card list */}
          <div className="md:hidden">
            {students.map((student) => {
              const status = getActivityStatus(
                student.last_active_date,
                student.has_auth
              );

              return (
                <div
                  key={student.id}
                  className="bg-white rounded-lg shadow-sm p-4 mb-3 cursor-pointer active:bg-gray-50 dark:bg-gray-800"
                  onClick={() => handleStudentClick(student.id)}
                >
                  {/* Top */}
                  <div className="flex items-center gap-3">
                    {student.avatar_url ? (
                      <img
                        src={student.avatar_url}
                        alt={student.name}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-sm font-medium dark:bg-purple-900/30 dark:text-purple-300">
                        {getInitials(student.name)}
                      </div>
                    )}
                    <span className="font-medium flex-1 truncate dark:text-white">
                      {student.name}
                    </span>
                    {student.education_level === "high_school" ? (
                      <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
                        특성화고
                      </span>
                    ) : (
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full dark:bg-blue-900/30 dark:text-blue-300">
                        대학교
                      </span>
                    )}
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                        status === "active"
                          ? "bg-green-500"
                          : status === "inactive"
                          ? "bg-yellow-400"
                          : "bg-gray-300"
                      }`}
                    />
                  </div>

                  {/* Middle */}
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-500 flex-wrap dark:text-gray-400">
                    {student.school && <span>{student.school}</span>}
                    {student.school && student.department && (
                      <span className="text-gray-300">|</span>
                    )}
                    {student.department && <span>{student.department}</span>}
                    {student.grade && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{student.grade}학년</span>
                      </>
                    )}
                  </div>

                  {/* Bottom */}
                  <div className="flex justify-between text-sm text-gray-500 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 dark:text-gray-400">
                    <span>
                      이력서 {student.resume_count} · 자소서{" "}
                      {student.cover_letter_count}
                    </span>
                    <span>
                      {!student.has_auth
                        ? "미가입"
                        : formatRelativeTime(student.last_active_date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-white rounded-xl shadow-sm dark:bg-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                총 {totalCount}명 중 {showFrom}-{showTo}명 표시
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  이전
                </button>
                {Array.from(
                  { length: Math.min(5, totalPages) },
                  (_, i) => {
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
                            ? "bg-purple-500 text-white"
                            : "border border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                )}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors dark:border-gray-600 dark:hover:bg-gray-700"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Registration Modal */}
      {showRegistrationModal && (
        <StudentRegistrationModal
          onClose={() => setShowRegistrationModal(false)}
          onSuccess={() => {
            setShowRegistrationModal(false);
            fetchStudents();
          }}
        />
      )}
    </div>
  );
}

// ============================================
// Inline Skeleton Component
// ============================================
function StudentListSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="h-8 w-28 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-6 w-12 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="flex gap-3">
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm p-4 dark:bg-gray-800">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 h-10 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
          <div className="flex gap-3">
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-24 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
            <div className="h-10 w-28 bg-gray-100 rounded-lg animate-pulse dark:bg-gray-700" />
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden dark:bg-gray-800">
        <div className="bg-gray-50 px-4 py-3 flex gap-4 dark:bg-gray-700">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-4 bg-gray-200 rounded animate-pulse dark:bg-gray-600"
              style={{ width: `${60 + Math.random() * 60}px` }}
            />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="px-4 py-4 border-t border-gray-100 flex items-center gap-4 dark:border-gray-700"
          >
            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse dark:bg-gray-600" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
              <div className="h-3 w-36 bg-gray-100 rounded animate-pulse dark:bg-gray-700" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-5 w-14 bg-gray-200 rounded-full animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-10 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-14 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
            <div className="h-4 w-12 bg-gray-200 rounded animate-pulse dark:bg-gray-600" />
          </div>
        ))}
      </div>
    </div>
  );
}
