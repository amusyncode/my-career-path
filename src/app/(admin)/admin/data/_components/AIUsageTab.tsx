"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  FileCheck,
  Zap,
  DollarSign,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Calculator,
} from "lucide-react";
import { format } from "date-fns";

const RBarChart = dynamic(() => import("recharts").then((m) => m.BarChart), {
  ssr: false,
});
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
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface ReviewLog {
  id: string;
  user_id: string;
  document_type: string;
  overall_score: number | null;
  input_tokens: number;
  output_tokens: number;
  model_name: string;
  reviewed_at: string;
  studentName: string;
}

const PAGE_SIZE = 15;

export default function AIUsageTab() {
  const supabase = createClient();
  const [reviews, setReviews] = useState<ReviewLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filterType, setFilterType] = useState("all");
  const [filterScore, setFilterScore] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [sortBy, setSortBy] = useState("latest");
  const [monthlyChart, setMonthlyChart] = useState<
    { month: string; count: number; tokens: number }[]
  >([]);

  // 비용 계산기 상태
  const [calcResume, setCalcResume] = useState(0);
  const [calcCoverLetter, setCalcCoverLetter] = useState(0);
  const [calcAnalysis, setCalcAnalysis] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: allReviews } = await supabase
        .from("ai_review_results")
        .select("id, user_id, document_type, overall_score, input_tokens, output_tokens, model_name, reviewed_at")
        .order("reviewed_at", { ascending: false });

      // 프로필 맵
      const userIds = new Set((allReviews || []).map((r) => r.user_id));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", Array.from(userIds));
      const nameMap = new Map(
        (profiles || []).map((p) => [p.id, p.name || "이름없음"])
      );

      const mapped: ReviewLog[] = (allReviews || []).map((r) => ({
        ...r,
        studentName: nameMap.get(r.user_id) || "이름없음",
      }));

      setReviews(mapped);

      // 이번 달 첨삭 건수로 계산기 기본값 설정
      const thisMonth = format(new Date(), "yyyy-MM");
      const thisMonthResumes = mapped.filter(
        (r) => r.document_type === "resume" && r.reviewed_at?.startsWith(thisMonth)
      ).length;
      const thisMonthCL = mapped.filter(
        (r) => r.document_type === "cover_letter" && r.reviewed_at?.startsWith(thisMonth)
      ).length;
      setCalcResume(thisMonthResumes);
      setCalcCoverLetter(thisMonthCL);

      // 월별 차트 데이터
      const now = new Date();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        );
      }
      setMonthlyChart(
        months.map((m) => {
          const monthReviews = mapped.filter((r) =>
            r.reviewed_at?.startsWith(m)
          );
          return {
            month: m.slice(5) + "월",
            count: monthReviews.length,
            tokens: monthReviews.reduce(
              (sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
              0
            ),
          };
        })
      );
    } catch (err) {
      console.error("AI 사용량 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 통계 계산
  const totalReviews = reviews.length;
  const thisMonth = format(new Date(), "yyyy-MM");
  const thisMonthReviews = reviews.filter((r) =>
    r.reviewed_at?.startsWith(thisMonth)
  ).length;
  const totalTokens = reviews.reduce(
    (sum, r) => sum + (r.input_tokens || 0) + (r.output_tokens || 0),
    0
  );
  const totalInputTokens = reviews.reduce((sum, r) => sum + (r.input_tokens || 0), 0);
  const totalOutputTokens = reviews.reduce((sum, r) => sum + (r.output_tokens || 0), 0);
  const totalCost = (totalInputTokens * 0.3 + totalOutputTokens * 2.5) / 1_000_000;

  // 필터링
  const filtered = reviews.filter((r) => {
    if (filterType !== "all" && r.document_type !== filterType) return false;
    if (filterScore !== "all") {
      const s = r.overall_score;
      if (s === null) return filterScore === "none";
      if (filterScore === "0-40" && (s < 0 || s > 40)) return false;
      if (filterScore === "41-70" && (s < 41 || s > 70)) return false;
      if (filterScore === "71-100" && (s < 71 || s > 100)) return false;
    }
    if (filterPeriod !== "all") {
      const days =
        filterPeriod === "1w" ? 7 : filterPeriod === "1m" ? 30 : 90;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      if (new Date(r.reviewed_at) < cutoff) return false;
    }
    return true;
  });

  // 정렬
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "latest")
      return new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime();
    if (sortBy === "score-high")
      return (b.overall_score || 0) - (a.overall_score || 0);
    if (sortBy === "score-low")
      return (a.overall_score || 0) - (b.overall_score || 0);
    if (sortBy === "tokens")
      return (
        b.input_tokens + b.output_tokens - (a.input_tokens + a.output_tokens)
      );
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatTokens = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

  const getScoreColor = (s: number | null) => {
    if (s === null) return "text-gray-400";
    if (s <= 40) return "text-red-500";
    if (s <= 70) return "text-yellow-500";
    return "text-green-500";
  };

  // 비용 계산
  const calcResumeTokens = calcResume * 5000;
  const calcCLTokens = calcCoverLetter * 9000;
  const calcAnalysisTokens = calcAnalysis * 8000;
  const calcResumeCost = (calcResumeTokens * 0.4 * 0.3 + calcResumeTokens * 0.6 * 2.5) / 1_000_000;
  const calcCLCost = (calcCLTokens * 0.4 * 0.3 + calcCLTokens * 0.6 * 2.5) / 1_000_000;
  const calcAnalysisCost = (calcAnalysisTokens * 0.4 * 0.3 + calcAnalysisTokens * 0.6 * 2.5) / 1_000_000;
  const calcTotalCost = calcResumeCost + calcCLCost + calcAnalysisCost;
  const usdToKrw = 1350;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-72 bg-gray-200 rounded-xl" />
        <div className="h-80 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <FileCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalReviews}</p>
            <p className="text-sm text-gray-500">총 AI 첨삭</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {thisMonthReviews}
            </p>
            <p className="text-sm text-gray-500">이번 달 첨삭</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Zap className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatTokens(totalTokens)}
            </p>
            <p className="text-sm text-gray-500">총 사용 토큰</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              ${totalCost.toFixed(2)}
            </p>
            <p className="text-sm text-gray-500">예상 누적 비용</p>
            <p className="text-xs text-gray-400">
              (약 {Math.round(totalCost * usdToKrw).toLocaleString()}원)
            </p>
          </div>
        </div>
      </div>

      {/* 월별 차트 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">월별 AI 사용량</h3>
        {monthlyChart.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            데이터가 없습니다
          </p>
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <RBarChart data={monthlyChart}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => formatTokens(v)}
                />
                <Tooltip />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="count"
                  fill="#A78BFA"
                  radius={[4, 4, 0, 0]}
                  name="첨삭 건수"
                />
              </RBarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* AI 첨삭 로그 테이블 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {/* 필터 */}
        <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">전체 유형</option>
            <option value="resume">이력서</option>
            <option value="cover_letter">자기소개서</option>
          </select>

          <select
            value={filterScore}
            onChange={(e) => { setFilterScore(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">전체 점수</option>
            <option value="0-40">0-40점</option>
            <option value="41-70">41-70점</option>
            <option value="71-100">71-100점</option>
          </select>

          <select
            value={filterPeriod}
            onChange={(e) => { setFilterPeriod(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">전체 기간</option>
            <option value="1w">최근 1주</option>
            <option value="1m">최근 1개월</option>
            <option value="3m">최근 3개월</option>
          </select>

          <div className="flex-1" />

          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="latest">최신순</option>
            <option value="score-high">점수 높은순</option>
            <option value="score-low">점수 낮은순</option>
            <option value="tokens">토큰 많은순</option>
          </select>
        </div>

        {paginated.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">AI 첨삭 기록이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    학생
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    문서유형
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">
                    점수
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    토큰수
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    모델
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    처리일
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-50 hover:bg-purple-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.studentName}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.document_type === "resume"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {r.document_type === "resume" ? "이력서" : "자소서"}
                      </span>
                    </td>
                    <td
                      className={`px-4 py-3 text-center font-bold ${getScoreColor(
                        r.overall_score
                      )}`}
                    >
                      {r.overall_score != null ? `${r.overall_score}점` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {((r.input_tokens || 0) + (r.output_tokens || 0)).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {r.model_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {r.reviewed_at
                        ? format(new Date(r.reviewed_at), "yyyy.MM.dd")
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-sm text-gray-500">
              총 {sorted.length}건 중{" "}
              {(page - 1) * PAGE_SIZE + 1}-
              {Math.min(page * PAGE_SIZE, sorted.length)}
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
                const pn = i + 1;
                return (
                  <button
                    key={pn}
                    onClick={() => setPage(pn)}
                    className={`w-8 h-8 rounded-lg text-sm ${
                      page === pn
                        ? "bg-purple-600 text-white"
                        : "text-gray-500 hover:bg-gray-100"
                    }`}
                  >
                    {pn}
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
      </div>

      {/* 비용 계산기 */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="w-5 h-5 text-purple-700" />
          <h3 className="font-semibold text-purple-800">비용 계산기</h3>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          예상 월간 비용을 계산해보세요
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              월간 이력서 첨삭 (건)
            </label>
            <input
              type="number"
              min={0}
              value={calcResume}
              onChange={(e) => setCalcResume(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              월간 자소서 첨삭 (건)
            </label>
            <input
              type="number"
              min={0}
              value={calcCoverLetter}
              onChange={(e) => setCalcCoverLetter(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              월간 역량 분석 (건)
            </label>
            <input
              type="number"
              min={0}
              value={calcAnalysis}
              onChange={(e) => setCalcAnalysis(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            />
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              이력서 첨삭: {calcResume}건 × ~5,000 토큰
            </span>
            <span className="text-gray-700">
              ${calcResumeCost.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              자소서 첨삭: {calcCoverLetter}건 × ~9,000 토큰
            </span>
            <span className="text-gray-700">
              ${calcCLCost.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              역량 분석: {calcAnalysis}건 × ~8,000 토큰
            </span>
            <span className="text-gray-700">
              ${calcAnalysisCost.toFixed(4)}
            </span>
          </div>
          <div className="border-t border-gray-200 pt-2 mt-2">
            <div className="flex justify-between">
              <span className="font-semibold text-gray-800">
                예상 월간 비용
              </span>
              <div className="text-right">
                <p className="text-xl font-bold text-purple-700">
                  ${calcTotalCost.toFixed(2)}
                </p>
                <p className="text-xs text-gray-400">
                  (약 {Math.round(calcTotalCost * usdToKrw).toLocaleString()}원)
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          참고: Gemini 2.5 Flash 기준, 입력 $0.30/1M, 출력 $2.50/1M, 입출력
          비율 40:60 가정
        </p>
      </div>
    </div>
  );
}
