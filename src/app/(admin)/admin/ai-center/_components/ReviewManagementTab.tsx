"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  Eye,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileSearch,
} from "lucide-react";
import BatchReviewModal from "./BatchReviewModal";

const RechartsBarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface ReviewRow {
  id: string;
  studentName: string;
  documentType: "resume" | "cover_letter";
  title: string;
  score: number | null;
  status: "uploaded" | "reviewing" | "reviewed" | "failed";
  requester: string;
  date: string;
  documentId: string;
  userId: string;
}

const PAGE_SIZE = 15;

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  uploaded: {
    label: "대기",
    className: "bg-gray-100 text-gray-600",
  },
  reviewing: {
    label: "처리중",
    className: "bg-blue-100 text-blue-600",
  },
  reviewed: {
    label: "완료",
    className: "bg-green-100 text-green-600",
  },
  failed: {
    label: "실패",
    className: "bg-red-100 text-red-600",
  },
};

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  resume: {
    label: "이력서",
    className: "bg-blue-50 text-blue-600",
  },
  cover_letter: {
    label: "자기소개서",
    className: "bg-purple-50 text-purple-600",
  },
};

export default function ReviewManagementTab({
  onStatsUpdate,
}: {
  onStatsUpdate: () => void;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1) 첨삭 완료된 리뷰 조회
      const reviewsQuery = supabase
        .from("ai_review_results")
        .select("id, user_id, document_type, document_id, overall_score, reviewed_at");

      const { data: reviews } = await reviewsQuery;

      // 2) 모든 이력서/자소서 조회
      const [resumesRes, coverLettersRes] = await Promise.all([
        supabase
          .from("uploaded_resumes")
          .select("id, user_id, title, status, created_at"),
        supabase
          .from("uploaded_cover_letters")
          .select("id, user_id, title, status, created_at"),
      ]);

      // 3) 모든 관련 유저 프로필 조회
      const allUserIds = new Set<string>();
      reviews?.forEach((r) => allUserIds.add(r.user_id));
      resumesRes.data?.forEach((r) => allUserIds.add(r.user_id));
      coverLettersRes.data?.forEach((r) => allUserIds.add(r.user_id));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", Array.from(allUserIds));

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p.name || "이름없음"])
      );

      // 리뷰 완료된 문서 ID 맵
      const reviewMap = new Map(
        (reviews || []).map((r) => [
          `${r.document_type}-${r.document_id}`,
          r,
        ])
      );

      // 4) 통합 행 생성
      const allRows: ReviewRow[] = [];

      // 이력서
      (resumesRes.data || []).forEach((doc) => {
        const review = reviewMap.get(`resume-${doc.id}`);
        allRows.push({
          id: review?.id || doc.id,
          studentName: profileMap.get(doc.user_id) || "이름없음",
          documentType: "resume",
          title: doc.title || "제목없음",
          score: review?.overall_score ?? null,
          status: doc.status as ReviewRow["status"],
          requester: profileMap.get(doc.user_id) || "이름없음",
          date: review?.reviewed_at || doc.created_at,
          documentId: doc.id,
          userId: doc.user_id,
        });
      });

      // 자소서
      (coverLettersRes.data || []).forEach((doc) => {
        const review = reviewMap.get(`cover_letter-${doc.id}`);
        allRows.push({
          id: review?.id || doc.id,
          studentName: profileMap.get(doc.user_id) || "이름없음",
          documentType: "cover_letter",
          title: doc.title || "제목없음",
          score: review?.overall_score ?? null,
          status: doc.status as ReviewRow["status"],
          requester: profileMap.get(doc.user_id) || "이름없음",
          date: review?.reviewed_at || doc.created_at,
          documentId: doc.id,
          userId: doc.user_id,
        });
      });

      // 정렬: 최신 순
      allRows.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );

      setRows(allRows);
    } catch (error) {
      console.error("첨삭 데이터 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 필터링
  const filtered = rows.filter((r) => {
    if (filterType !== "all" && r.documentType !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 대기 문서
  const pendingDocs = rows.filter((r) => r.status === "uploaded");

  // 점수 분포 데이터
  const scoreDistribution = [
    { range: "0-20", count: 0 },
    { range: "21-40", count: 0 },
    { range: "41-60", count: 0 },
    { range: "61-80", count: 0 },
    { range: "81-100", count: 0 },
  ];
  rows.forEach((r) => {
    if (r.score == null) return;
    if (r.score <= 20) scoreDistribution[0].count++;
    else if (r.score <= 40) scoreDistribution[1].count++;
    else if (r.score <= 60) scoreDistribution[2].count++;
    else if (r.score <= 80) scoreDistribution[3].count++;
    else scoreDistribution[4].count++;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const getScoreColor = (score: number | null) => {
    if (score == null) return "text-gray-400";
    if (score >= 80) return "text-green-600 font-bold";
    if (score >= 60) return "text-yellow-600 font-semibold";
    return "text-red-500 font-semibold";
  };

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">전체 유형</option>
          <option value="resume">이력서</option>
          <option value="cover_letter">자기소개서</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="all">전체 상태</option>
          <option value="uploaded">대기</option>
          <option value="reviewing">처리중</option>
          <option value="reviewed">완료</option>
          <option value="failed">실패</option>
        </select>

        <div className="flex-1" />

        <button
          onClick={() => setShowChart(!showChart)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          점수 분포
        </button>

        {pendingDocs.length > 0 && (
          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            <PlayCircle className="w-4 h-4" />
            대기 문서 일괄 첨삭 ({pendingDocs.length}건)
          </button>
        )}
      </div>

      {/* 점수 분포 차트 */}
      {showChart && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            점수 분포
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart data={scoreDistribution}>
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="문서 수" />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">로딩 중...</div>
        ) : paginated.length === 0 ? (
          <div className="p-12 text-center">
            <FileSearch className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">첨삭 결과가 없습니다.</p>
            <p className="text-sm text-gray-400 mt-1">
              학생이 이력서 또는 자기소개서를 업로드하면 여기에 표시됩니다.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      학생
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      유형
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      제목
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">
                      점수
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">
                      상태
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500">
                      처리일
                    </th>
                    <th className="text-center px-4 py-3 font-medium text-gray-500">
                      액션
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((row) => (
                    <tr
                      key={`${row.documentType}-${row.documentId}`}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {row.studentName}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[row.documentType]?.className}`}
                        >
                          {TYPE_BADGE[row.documentType]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                        {row.title}
                      </td>
                      <td
                        className={`px-4 py-3 text-center ${getScoreColor(row.score)}`}
                      >
                        {row.score != null ? `${row.score}점` : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status]?.className}`}
                        >
                          {STATUS_BADGE[row.status]?.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="상세 보기"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <span className="text-sm text-gray-500">
                  총 {filtered.length}건 중 {(page - 1) * PAGE_SIZE + 1}-
                  {Math.min(page * PAGE_SIZE, filtered.length)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-sm ${
                          page === pageNum
                            ? "bg-purple-600 text-white"
                            : "text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 rounded-lg"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 일괄 첨삭 모달 */}
      <BatchReviewModal
        isOpen={showBatchModal}
        onClose={() => {
          setShowBatchModal(false);
          fetchData();
          onStatsUpdate();
        }}
        pendingDocuments={pendingDocs.map((d) => ({
          id: d.documentId,
          type: d.documentType,
          userId: d.userId,
          title: d.title,
          studentName: d.studentName,
        }))}
      />
    </div>
  );
}
