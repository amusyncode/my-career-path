"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import {
  Search,
  Users,
  Plus,
  KeyRound,
  MoreVertical,
  Eye,
  Ban,
  CheckCircle,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";
import CreateInstructorModal from "@/components/admin/CreateInstructorModal";
import InviteCodeModal from "@/components/admin/InviteCodeModal";

const PAGE_SIZE = 15;

interface InstructorRow extends Profile {
  studentCount: number;
  reviewCount: number;
  gemCount: number;
}

export default function AdminInstructorsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [instructors, setInstructors] = useState<InstructorRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [apiKeyFilter, setApiKeyFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteCodeModal, setShowInviteCodeModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
  }, [statusFilter, apiKeyFilter, sortBy]);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchInstructors = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch instructors
      let query = supabase
        .from("profiles")
        .select("*", { count: "exact" })
        .eq("role", "instructor");

      if (debouncedSearch) {
        query = query.or(
          `name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,school.ilike.%${debouncedSearch}%`
        );
      }

      if (statusFilter === "active") query = query.eq("is_active", true);
      if (statusFilter === "inactive") query = query.eq("is_active", false);

      switch (sortBy) {
        case "name":
          query = query.order("name", { ascending: true });
          break;
        case "recent":
        default:
          query = query.order("created_at", { ascending: false });
          break;
      }

      const { data: profiles, count, error } = await query;
      if (error) throw error;
      if (!profiles || profiles.length === 0) {
        setInstructors([]);
        setTotalCount(count ?? 0);
        setIsLoading(false);
        return;
      }

      // 2. Parallel queries for counts
      const [studentsRes, reviewsRes, gemsRes] = await Promise.all([
        supabase.from("profiles").select("instructor_id").eq("role", "student"),
        supabase.from("ai_review_results").select("instructor_id"),
        supabase
          .from("gems")
          .select("created_by")
          .eq("scope", "instructor"),
      ]);

      const studentCountMap: Record<string, number> = {};
      studentsRes.data?.forEach((s) => {
        if (s.instructor_id)
          studentCountMap[s.instructor_id] =
            (studentCountMap[s.instructor_id] || 0) + 1;
      });

      const reviewCountMap: Record<string, number> = {};
      reviewsRes.data?.forEach((r) => {
        if (r.instructor_id)
          reviewCountMap[r.instructor_id] =
            (reviewCountMap[r.instructor_id] || 0) + 1;
      });

      const gemCountMap: Record<string, number> = {};
      gemsRes.data?.forEach((g) => {
        if (g.created_by)
          gemCountMap[g.created_by] = (gemCountMap[g.created_by] || 0) + 1;
      });

      // 3. Build rows
      let rows: InstructorRow[] = (profiles as Profile[]).map((p) => ({
        ...p,
        studentCount: studentCountMap[p.id] || 0,
        reviewCount: reviewCountMap[p.id] || 0,
        gemCount: gemCountMap[p.id] || 0,
      }));

      // API key filter (client-side)
      if (apiKeyFilter === "set") {
        rows = rows.filter((r) => r.gemini_api_key);
      } else if (apiKeyFilter === "unset") {
        rows = rows.filter((r) => !r.gemini_api_key);
      }

      // Sort by students (client-side)
      if (sortBy === "students") {
        rows.sort((a, b) => b.studentCount - a.studentCount);
      }

      setTotalCount(count ?? 0);
      setInstructors(rows);
    } catch (err) {
      console.error("강사 목록 조회 실패:", err);
      toast.error("강사 목록을 불러오는데 실패했습니다.");
    }
    setIsLoading(false);
  }, [supabase, debouncedSearch, statusFilter, apiKeyFilter, sortBy]);

  useEffect(() => {
    fetchInstructors();
  }, [fetchInstructors]);

  const handleToggleActive = async (
    instructorId: string,
    currentActive: boolean
  ) => {
    try {
      const res = await fetch("/api/admin/update-instructor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          updates: { is_active: !currentActive },
        }),
      });
      if (!res.ok) throw new Error("업데이트 실패");
      toast.success(
        !currentActive ? "강사가 활성화되었습니다." : "강사가 비활성화되었습니다."
      );
      setOpenMenuId(null);
      fetchInstructors();
    } catch {
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleDelete = async (instructorId: string, name: string) => {
    if (!confirm(`정말 "${name}" 강사를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`))
      return;
    try {
      const res = await fetch("/api/admin/update-instructor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          updates: { role: "deleted" },
        }),
      });
      if (!res.ok) throw new Error("삭제 실패");
      toast.success("강사가 삭제되었습니다.");
      setOpenMenuId(null);
      fetchInstructors();
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  };

  // Pagination
  const paginatedInstructors = instructors.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );
  const totalPages = Math.ceil(instructors.length / PAGE_SIZE);
  const showFrom = instructors.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, instructors.length);

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-gray-900">강사관리</h2>
          <span className="bg-red-100 text-red-700 text-sm px-2 py-0.5 rounded-full font-medium">
            {totalCount}명
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInviteCodeModal(true)}
            className="bg-white border border-gray-200 text-gray-600 rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-sm"
          >
            <KeyRound className="w-4 h-4" />
            가입 코드 관리
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-red-500 text-white rounded-lg px-4 py-2 flex items-center gap-2 hover:bg-red-600 transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            강사 계정 생성
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름, 이메일, 소속으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
            </select>
            <select
              value={apiKeyFilter}
              onChange={(e) => setApiKeyFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">API 키 전체</option>
              <option value="set">설정됨</option>
              <option value="unset">미설정</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="recent">최근 가입순</option>
              <option value="name">이름순</option>
              <option value="students">학생 많은순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading && instructors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto" />
          <p className="text-gray-400 mt-4">로딩 중...</p>
        </div>
      ) : paginatedInstructors.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          {debouncedSearch || statusFilter !== "all" || apiKeyFilter !== "all" ? (
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
                등록된 강사가 없습니다
              </h3>
              <p className="text-gray-500">
                강사 계정을 생성하거나 가입 코드를 공유하세요
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
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      강사
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      소속
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      학생 수
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      API 키
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      Gem 수
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      첨삭 건수
                    </th>
                    <th className="text-left py-3 px-4 font-medium text-gray-500">
                      가입일
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      상태
                    </th>
                    <th className="text-center py-3 px-4 font-medium text-gray-500">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedInstructors.map((inst) => (
                    <tr
                      key={inst.id}
                      className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      {/* 강사 */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {inst.avatar_url ? (
                            <img
                              src={inst.avatar_url}
                              alt={inst.name}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                              {getInitials(inst.name)}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {inst.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              {inst.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* 소속 */}
                      <td className="py-3 px-4 text-gray-600">
                        {inst.school || "-"}
                      </td>
                      {/* 학생 수 */}
                      <td className="py-3 px-4 text-center text-gray-900 font-medium">
                        {inst.studentCount}
                      </td>
                      {/* API 키 */}
                      <td className="py-3 px-4 text-center">
                        {inst.gemini_api_key ? (
                          <span className="text-green-500" title="설정됨">
                            &#10003;
                          </span>
                        ) : (
                          <span className="text-red-400" title="미설정">
                            &#10007;
                          </span>
                        )}
                      </td>
                      {/* Gem 수 */}
                      <td className="py-3 px-4 text-center text-gray-600">
                        {inst.gemCount}
                      </td>
                      {/* 첨삭 건수 */}
                      <td className="py-3 px-4 text-center text-gray-600">
                        {inst.reviewCount}
                      </td>
                      {/* 가입일 */}
                      <td className="py-3 px-4 text-gray-500">
                        {new Date(inst.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      {/* 상태 */}
                      <td className="py-3 px-4 text-center">
                        {inst.is_active ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            활성
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                            비활성
                          </span>
                        )}
                      </td>
                      {/* 액션 */}
                      <td className="py-3 px-4 text-center relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === inst.id ? null : inst.id
                            )
                          }
                          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                        {openMenuId === inst.id && (
                          <div
                            ref={menuRef}
                            className="absolute right-4 top-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 w-40"
                          >
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                router.push(
                                  `/admin/instructors/${inst.id}`
                                );
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Eye className="w-4 h-4" />
                              상세보기
                            </button>
                            <button
                              onClick={() =>
                                handleToggleActive(inst.id, inst.is_active)
                              }
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {inst.is_active ? (
                                <>
                                  <Ban className="w-4 h-4" />
                                  비활성화
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  활성화
                                </>
                              )}
                            </button>
                            <button
                              onClick={() =>
                                handleDelete(inst.id, inst.name)
                              }
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              삭제
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4 p-4 bg-white rounded-xl shadow-sm">
              <p className="text-sm text-gray-500">
                총 {instructors.length}명 중 {showFrom}-{showTo}명 표시
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

      {/* Modals */}
      {showCreateModal && (
        <CreateInstructorModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchInstructors();
          }}
        />
      )}
      {showInviteCodeModal && (
        <InviteCodeModal
          isOpen={showInviteCodeModal}
          onClose={() => setShowInviteCodeModal(false)}
        />
      )}
    </div>
  );
}
