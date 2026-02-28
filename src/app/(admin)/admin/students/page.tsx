"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { StudentListItem } from "@/lib/types";
import { Download, Search, Users } from "lucide-react";
import { differenceInDays } from "date-fns";
import StudentTable from "./_components/StudentTable";
import StudentCardList from "./_components/StudentCardList";
import StudentListSkeleton from "./_components/StudentListSkeleton";
import { exportStudentsToCSV } from "./_utils/csv-export";
import toast from "react-hot-toast";

const PAGE_SIZE = 20;

export default function AdminStudentsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [page, setPage] = useState(1);

  // 디바운스 검색
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 필터 변경시 페이지 리셋
  useEffect(() => {
    setPage(1);
  }, [gradeFilter, activityFilter, sortBy]);

  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. profiles에서 학생(role='user') 조회
      let query = supabase
        .from("profiles")
        .select("id, name, email, school, department, grade, target_field, avatar_url, created_at", {
          count: "exact",
        })
        .eq("role", "user");

      // 검색 필터
      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,school.ilike.%${debouncedSearch}%,department.ilike.%${debouncedSearch}%`
        );
      }

      // 학년 필터
      if (gradeFilter !== "all") {
        query = query.eq("grade", parseInt(gradeFilter));
      }

      // 정렬
      switch (sortBy) {
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "recent":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      // 페이지네이션
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

      // 2. 학생 IDs 추출
      const studentIds = profiles.map((p) => p.id);

      // 3. 관련 데이터 병렬 조회
      const [projectsRes, certsRes, streaksRes] = await Promise.all([
        supabase.from("projects").select("user_id").in("user_id", studentIds),
        supabase
          .from("certificates")
          .select("user_id")
          .in("user_id", studentIds),
        supabase
          .from("streaks")
          .select("user_id, last_active_date, current_streak")
          .in("user_id", studentIds),
      ]);

      // 4. JS에서 카운트 집계
      const projectCountMap = new Map<string, number>();
      projectsRes.data?.forEach((p) => {
        projectCountMap.set(
          p.user_id,
          (projectCountMap.get(p.user_id) ?? 0) + 1
        );
      });

      const certCountMap = new Map<string, number>();
      certsRes.data?.forEach((c) => {
        certCountMap.set(c.user_id, (certCountMap.get(c.user_id) ?? 0) + 1);
      });

      const streakMap = new Map<
        string,
        { last_active_date: string | null; current_streak: number }
      >();
      streaksRes.data?.forEach((s) => {
        streakMap.set(s.user_id, {
          last_active_date: s.last_active_date,
          current_streak: s.current_streak,
        });
      });

      // 5. StudentListItem 배열 생성
      let items: StudentListItem[] = profiles.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        school: p.school,
        department: p.department,
        grade: p.grade,
        target_field: p.target_field,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        project_count: projectCountMap.get(p.id) ?? 0,
        certificate_count: certCountMap.get(p.id) ?? 0,
        last_active_date: streakMap.get(p.id)?.last_active_date ?? null,
        current_streak: streakMap.get(p.id)?.current_streak ?? 0,
      }));

      // 활동 상태 필터 (클라이언트 사이드)
      if (activityFilter === "active") {
        items = items.filter(
          (s) =>
            s.last_active_date &&
            differenceInDays(new Date(), new Date(s.last_active_date)) <= 7
        );
      } else if (activityFilter === "inactive") {
        items = items.filter(
          (s) =>
            !s.last_active_date ||
            differenceInDays(new Date(), new Date(s.last_active_date)) > 7
        );
      }

      // 프로젝트 많은순 정렬 (클라이언트 사이드)
      if (sortBy === "projects") {
        items.sort((a, b) => b.project_count - a.project_count);
      } else if (sortBy === "activity") {
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
  }, [supabase, debouncedSearch, gradeFilter, activityFilter, sortBy, page]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleStudentClick = (studentId: string) => {
    router.push(`/admin/students/${studentId}`);
  };

  const handleCSVExport = async () => {
    try {
      // 전체 데이터 조회 (페이지네이션 없이)
      const query = supabase
        .from("profiles")
        .select("id, name, email, school, department, grade, target_field, avatar_url, created_at")
        .eq("role", "user")
        .order("name");

      const { data: allProfiles } = await query;
      if (!allProfiles) return;

      const allIds = allProfiles.map((p) => p.id);
      const [pRes, cRes, sRes] = await Promise.all([
        supabase.from("projects").select("user_id").in("user_id", allIds),
        supabase.from("certificates").select("user_id").in("user_id", allIds),
        supabase
          .from("streaks")
          .select("user_id, last_active_date, current_streak")
          .in("user_id", allIds),
      ]);

      const pMap = new Map<string, number>();
      pRes.data?.forEach((p) => pMap.set(p.user_id, (pMap.get(p.user_id) ?? 0) + 1));
      const cMap = new Map<string, number>();
      cRes.data?.forEach((c) => cMap.set(c.user_id, (cMap.get(c.user_id) ?? 0) + 1));
      const sMap = new Map<string, { last_active_date: string | null; current_streak: number }>();
      sRes.data?.forEach((s) => sMap.set(s.user_id, { last_active_date: s.last_active_date, current_streak: s.current_streak }));

      const all: StudentListItem[] = allProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        school: p.school,
        department: p.department,
        grade: p.grade,
        target_field: p.target_field,
        avatar_url: p.avatar_url,
        created_at: p.created_at,
        project_count: pMap.get(p.id) ?? 0,
        certificate_count: cMap.get(p.id) ?? 0,
        last_active_date: sMap.get(p.id)?.last_active_date ?? null,
        current_streak: sMap.get(p.id)?.current_streak ?? 0,
      }));

      exportStudentsToCSV(all);
      toast.success("CSV 파일이 다운로드되었습니다.");
    } catch {
      toast.error("CSV 내보내기에 실패했습니다.");
    }
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showFrom = (page - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  if (isLoading && students.length === 0) {
    return <StudentListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">학생관리</h2>
          <span className="bg-purple-100 text-purple-700 text-sm px-2 py-0.5 rounded-full font-medium">
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

      {/* 필터/검색 바 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* 검색 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 학교, 학과로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* 필터 */}
          <div className="flex gap-3">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 학년</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>

            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="recent">최근 가입순</option>
              <option value="name">이름순</option>
              <option value="activity">최근 활동순</option>
              <option value="projects">프로젝트 많은순</option>
            </select>
          </div>
        </div>
      </div>

      {/* 학생 목록 */}
      {students.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          {debouncedSearch || gradeFilter !== "all" || activityFilter !== "all" ? (
            <>
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-gray-500">다른 검색어를 시도해보세요</p>
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
          {/* 데스크톱: 테이블 */}
          <div className="hidden md:block">
            <StudentTable
              students={students}
              onStudentClick={handleStudentClick}
            />
          </div>

          {/* 모바일: 카드 리스트 */}
          <div className="md:hidden">
            <StudentCardList
              students={students}
              onStudentClick={handleStudentClick}
            />
          </div>

          {/* 페이지네이션 */}
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
                          ? "bg-purple-500 text-white"
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
    </div>
  );
}
