"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { CounselingRecordWithStudent } from "@/lib/types";
import {
  MessageSquareHeart,
  Users,
  CalendarClock,
  Search,
  Plus,
} from "lucide-react";
import CounselingListSkeleton from "./_components/CounselingListSkeleton";
import CounselingRecordCard from "./_components/CounselingRecordCard";
import UpcomingCounselingList from "./_components/UpcomingCounselingList";
import CounselingRecordModal from "./_components/CounselingRecordModal";
import toast from "react-hot-toast";

const PAGE_SIZE = 10;

function getThisMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const end = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export default function CounselingListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [records, setRecords] = useState<CounselingRecordWithStudent[]>([]);
  const [upcomingRecords, setUpcomingRecords] = useState<CounselingRecordWithStudent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // 통계
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [studentCount, setStudentCount] = useState(0);
  const [upcomingCount, setUpcomingCount] = useState(0);

  // 필터
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // 모달
  const [showModal, setShowModal] = useState(false);

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
  }, [typeFilter, statusFilter, periodFilter]);

  // 통계 조회
  const fetchStats = useCallback(async () => {
    try {
      const { start, end } = getThisMonthRange();
      const todayStr = new Date().toISOString().split("T")[0];

      const [monthlyRes, allRes, upcomingRes] = await Promise.all([
        supabase
          .from("counseling_records")
          .select("id", { count: "exact", head: true })
          .gte("counseling_date", start)
          .lt("counseling_date", end),
        supabase
          .from("counseling_records")
          .select("user_id")
          .gte("counseling_date", start)
          .lt("counseling_date", end),
        supabase
          .from("counseling_records")
          .select("id", { count: "exact", head: true })
          .gte("next_counseling_date", todayStr)
          .eq("is_completed", false),
      ]);

      setMonthlyCount(monthlyRes.count ?? 0);
      const uniqueStudents = new Set(allRes.data?.map((r) => r.user_id));
      setStudentCount(uniqueStudents.size);
      setUpcomingCount(upcomingRes.count ?? 0);
    } catch (err) {
      console.error("통계 조회 실패:", err);
    }
  }, [supabase]);

  // 다가오는 상담 조회
  const fetchUpcoming = useCallback(async () => {
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("counseling_records")
        .select("*, profiles!counseling_records_user_id_fkey(name, school, department, grade, avatar_url, target_field)")
        .gte("next_counseling_date", todayStr)
        .eq("is_completed", false)
        .order("next_counseling_date", { ascending: true })
        .limit(5);

      setUpcomingRecords(
        (data || []).map((r) => ({
          ...r,
          profiles: r.profiles || { name: "이름없음", school: null, department: null, grade: null, avatar_url: null, target_field: null },
        })) as CounselingRecordWithStudent[]
      );
    } catch (err) {
      console.error("다가오는 상담 조회 실패:", err);
    }
  }, [supabase]);

  // 메인 레코드 조회
  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // 학생명 검색: 2단계 쿼리
      let userIdFilter: string[] | null = null;
      if (debouncedSearch) {
        const { data: matchedProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("role", "user")
          .ilike("name", `%${debouncedSearch}%`);
        userIdFilter = matchedProfiles?.map((p) => p.id) || [];
        if (userIdFilter.length === 0) {
          setRecords([]);
          setTotalCount(0);
          setIsLoading(false);
          return;
        }
      }

      let query = supabase
        .from("counseling_records")
        .select("*, profiles!counseling_records_user_id_fkey(name, school, department, grade, avatar_url, target_field)", {
          count: "exact",
        });

      if (userIdFilter) {
        query = query.in("user_id", userIdFilter);
      }

      // 유형 필터
      if (typeFilter !== "all") {
        query = query.eq("counseling_type", typeFilter);
      }

      // 상태 필터
      if (statusFilter === "completed") {
        query = query.eq("is_completed", true);
      } else if (statusFilter === "incomplete") {
        query = query.eq("is_completed", false);
      }

      // 기간 필터
      if (periodFilter !== "all") {
        const now = new Date();
        let fromDate: string;
        if (periodFilter === "week") {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          fromDate = d.toISOString().split("T")[0];
        } else if (periodFilter === "month") {
          fromDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        } else {
          // 3months
          const d = new Date(now);
          d.setMonth(d.getMonth() - 3);
          fromDate = d.toISOString().split("T")[0];
        }
        query = query.gte("counseling_date", fromDate);
      }

      // 정렬 + 페이지네이션
      query = query.order("counseling_date", { ascending: false });
      const from = (page - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) throw error;

      setRecords(
        (data || []).map((r) => ({
          ...r,
          profiles: r.profiles || { name: "이름없음", school: null, department: null, grade: null, avatar_url: null, target_field: null },
        })) as CounselingRecordWithStudent[]
      );
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error("상담 기록 조회 실패:", err);
      toast.error("상담 기록을 불러오는데 실패했습니다.");
    }
    setIsLoading(false);
  }, [supabase, debouncedSearch, typeFilter, statusFilter, periodFilter, page]);

  useEffect(() => {
    fetchStats();
    fetchUpcoming();
  }, [fetchStats, fetchUpcoming]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleCardClick = (record: CounselingRecordWithStudent) => {
    router.push(`/admin/counseling/${record.user_id}`);
  };

  const handleSave = () => {
    setShowModal(false);
    toast.success("상담 기록이 저장되었습니다.");
    fetchRecords();
    fetchStats();
    fetchUpcoming();
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const showFrom = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  if (isLoading && records.length === 0) {
    return <CounselingListSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">개별상담도우미</h2>
          <p className="text-sm text-gray-500 mt-1">
            학생별 상담 기록을 관리하고 AI 기반 상담 제안을 받아보세요
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          새 상담 기록
        </button>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <MessageSquareHeart className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">이번달 상담</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{monthlyCount}건</p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date().getMonth() + 1}월 전체
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">상담 학생수</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{studentCount}명</p>
          <p className="text-xs text-gray-400 mt-1">이번달 상담한 학생</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">예정된 상담</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{upcomingCount}건</p>
          <p className="text-xs text-gray-400 mt-1">미완료 + 다음 상담일 설정</p>
        </div>
      </div>

      {/* 다가오는 상담 */}
      <UpcomingCounselingList items={upcomingRecords} />

      {/* 필터/검색 바 */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="학생 이름으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-3">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 유형</option>
              <option value="career">진로상담</option>
              <option value="resume">이력서상담</option>
              <option value="interview">면접준비</option>
              <option value="mental">고충상담</option>
              <option value="other">기타</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 상태</option>
              <option value="completed">완료</option>
              <option value="incomplete">진행중</option>
            </select>

            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">전체 기간</option>
              <option value="week">최근 1주</option>
              <option value="month">이번달</option>
              <option value="3months">최근 3개월</option>
            </select>
          </div>
        </div>
      </div>

      {/* 상담 기록 리스트 */}
      {records.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          {debouncedSearch || typeFilter !== "all" || statusFilter !== "all" || periodFilter !== "all" ? (
            <>
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                검색 결과가 없습니다
              </h3>
              <p className="text-gray-500 text-sm">
                다른 검색어나 필터를 시도해보세요
              </p>
            </>
          ) : (
            <>
              <MessageSquareHeart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                아직 상담 기록이 없습니다
              </h3>
              <p className="text-gray-500 text-sm mb-4">
                첫 상담 기록을 작성해보세요
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                새 상담 기록
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-sm">
            {records.map((record) => (
              <CounselingRecordCard
                key={record.id}
                record={record}
                onClick={handleCardClick}
              />
            ))}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 bg-white rounded-xl shadow-sm">
              <p className="text-sm text-gray-500">
                총 {totalCount}건 중 {showFrom}-{showTo}건 표시
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
                  let pageNum: number;
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

      {/* 새 상담 기록 모달 */}
      {showModal && (
        <CounselingRecordModal
          mode="create"
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
