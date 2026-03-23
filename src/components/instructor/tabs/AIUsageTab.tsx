"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calculator,
} from "lucide-react";
import AIReviewModal from "@/components/instructor/AIReviewModal";

const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const ComposedChart = dynamic(() => import("recharts").then((m) => m.ComposedChart), { ssr: false });

interface Props {
  instructorId: string;
}

interface ReviewRow {
  id: string;
  user_id: string;
  document_type: string;
  model_used: string;
  score: number | null;
  tokens_used: number | null;
  processing_time: number | null;
  created_at: string;
  feedback: string | null;
}

const PAGE_SIZE = 15;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function estimateCost(tokens: number): { usd: string; krw: string } {
  // Estimate: 40% input, 60% output
  const inputTokens = tokens * 0.4;
  const outputTokens = tokens * 0.6;
  const cost = (inputTokens * 0.15 + outputTokens * 0.6) / 1_000_000;
  const krw = Math.round(cost * 1350);
  return { usd: `$${cost.toFixed(4)}`, krw: `${krw.toLocaleString()}원` };
}

export default function AIUsageTab({ instructorId }: Props) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  const [studentMap, setStudentMap] = useState<Record<string, { name: string; education_level: string }>>({});

  // Summary stats
  const [totalReviews, setTotalReviews] = useState(0);
  const [monthReviews, setMonthReviews] = useState(0);
  const [totalTokens, setTotalTokens] = useState(0);

  // Charts
  const [monthlyChart, setMonthlyChart] = useState<{ month: string; count: number; tokens: number }[]>([]);
  const [gemStats, setGemStats] = useState<{ name: string; education_level: string; count: number; avgScore: number; lastUsed: string }[]>([]);

  // Log
  const [allReviews, setAllReviews] = useState<ReviewRow[]>([]);
  const [filteredReviews, setFilteredReviews] = useState<ReviewRow[]>([]);
  const [logPage, setLogPage] = useState(0);
  const [docTypeFilter, setDocTypeFilter] = useState("");
  const [eduFilter, setEduFilter] = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");

  // Modal
  const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);

  // Cost calculator
  const [calcResume, setCalcResume] = useState(0);
  const [calcCover, setCalcCover] = useState(0);
  const [calcAnalysis, setCalcAnalysis] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Students
      const { data: students } = await supabase
        .from("profiles")
        .select("id, name, education_level")
        .eq("instructor_id", instructorId)
        .eq("role", "student");
      const map: Record<string, { name: string; education_level: string }> = {};
      (students || []).forEach((s) => { map[s.id] = { name: s.name, education_level: s.education_level }; });
      setStudentMap(map);

      // All reviews
      const { data: reviews } = await supabase
        .from("ai_review_results")
        .select("id, user_id, document_type, model_used, score, tokens_used, processing_time, created_at, feedback")
        .eq("instructor_id", instructorId)
        .order("created_at", { ascending: false });

      const all = (reviews || []) as ReviewRow[];
      setAllReviews(all);
      setTotalReviews(all.length);

      const now = new Date();
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      setMonthReviews(all.filter((r) => r.created_at?.startsWith(thisMonth)).length);

      const tokens = all.reduce((sum, r) => sum + (r.tokens_used || 0), 0);
      setTotalTokens(tokens);

      // Set calculator defaults
      const thisMonthResumes = all.filter((r) => r.created_at?.startsWith(thisMonth) && r.document_type === "resume").length;
      const thisMonthCovers = all.filter((r) => r.created_at?.startsWith(thisMonth) && r.document_type === "cover_letter").length;
      setCalcResume(thisMonthResumes);
      setCalcCover(thisMonthCovers);

      // Monthly chart (6 months)
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }
      setMonthlyChart(months.map((m) => {
        const monthRevs = all.filter((r) => r.created_at?.startsWith(m));
        return {
          month: m.slice(2).replace("-", "."),
          count: monthRevs.length,
          tokens: monthRevs.reduce((sum, r) => sum + (r.tokens_used || 0), 0),
        };
      }));

      // Gem stats
      const gemMap: Record<string, { count: number; scores: number[]; lastUsed: string; education_level: string }> = {};
      all.forEach((r) => {
        const name = r.model_used || "기본";
        if (!gemMap[name]) {
          gemMap[name] = { count: 0, scores: [], lastUsed: r.created_at, education_level: map[r.user_id]?.education_level || "" };
        }
        gemMap[name].count++;
        if (r.score != null) gemMap[name].scores.push(r.score);
        if (r.created_at > gemMap[name].lastUsed) gemMap[name].lastUsed = r.created_at;
      });
      setGemStats(
        Object.entries(gemMap)
          .map(([name, g]) => ({
            name,
            education_level: g.education_level,
            count: g.count,
            avgScore: g.scores.length > 0 ? Math.round(g.scores.reduce((a, b) => a + b, 0) / g.scores.length) : 0,
            lastUsed: g.lastUsed?.slice(0, 10).replace(/-/g, ".") || "-",
          }))
          .sort((a, b) => b.count - a.count)
      );
    } catch (err) {
      console.error("AI usage fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter log
  useEffect(() => {
    let filtered = [...allReviews];

    if (docTypeFilter) filtered = filtered.filter((r) => r.document_type === docTypeFilter);

    if (eduFilter) {
      filtered = filtered.filter((r) => studentMap[r.user_id]?.education_level === eduFilter);
    }

    if (scoreFilter) {
      if (scoreFilter === "0-40") filtered = filtered.filter((r) => r.score != null && r.score <= 40);
      else if (scoreFilter === "41-70") filtered = filtered.filter((r) => r.score != null && r.score >= 41 && r.score <= 70);
      else if (scoreFilter === "71-100") filtered = filtered.filter((r) => r.score != null && r.score >= 71);
    }

    if (periodFilter) {
      const now = new Date();
      const cutoff = new Date();
      if (periodFilter === "1w") cutoff.setDate(now.getDate() - 7);
      else if (periodFilter === "1m") cutoff.setMonth(now.getMonth() - 1);
      else if (periodFilter === "3m") cutoff.setMonth(now.getMonth() - 3);
      filtered = filtered.filter((r) => new Date(r.created_at) >= cutoff);
    }

    // Sort
    if (sortOrder === "latest") filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else if (sortOrder === "score_high") filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortOrder === "score_low") filtered.sort((a, b) => (a.score || 0) - (b.score || 0));
    else if (sortOrder === "tokens") filtered.sort((a, b) => (b.tokens_used || 0) - (a.tokens_used || 0));

    setFilteredReviews(filtered);
    setLogPage(0);
  }, [allReviews, docTypeFilter, eduFilter, scoreFilter, periodFilter, sortOrder, studentMap]);

  const logTotalPages = Math.ceil(filteredReviews.length / PAGE_SIZE);
  const logPageData = filteredReviews.slice(logPage * PAGE_SIZE, (logPage + 1) * PAGE_SIZE);

  // Cost calculator
  const calcTokens = calcResume * 5000 + calcCover * 9000 + calcAnalysis * 8000;
  const calcCostData = estimateCost(calcTokens);
  const resumeTokens = calcResume * 5000;
  const coverTokens = calcCover * 9000;
  const analysisTokens = calcAnalysis * 8000;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const totalCost = estimateCost(totalTokens);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "총 첨삭", value: totalReviews, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
          { label: "이번 달 첨삭", value: monthReviews, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "총 토큰", value: formatTokens(totalTokens), color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
          { label: "예상 비용", value: `${totalCost.usd}`, sub: `(약 ${totalCost.krw})`, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
        ].map((c) => (
          <div key={c.label} className={`${c.bg} rounded-xl p-4`}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className={`text-2xl font-bold ${c.color} mt-1`}>{c.value}</p>
            {"sub" in c && c.sub && <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>}
          </div>
        ))}
      </div>

      {/* Monthly Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">월별 AI 사용량</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="count" name="첨삭 건수" fill="#A78BFA" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="tokens" name="토큰 수" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gem Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Gem별 사용 통계</h3>
        {gemStats.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">아직 사용 기록이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gem 이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학교급</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">사용 횟수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">평균 점수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">최근 사용</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {gemStats.map((g) => (
                  <tr key={g.name} className="hover:bg-purple-50 dark:hover:bg-purple-900/10">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{g.name}</td>
                    <td className="px-4 py-3">
                      {g.education_level ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${g.education_level === "high_school" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {g.education_level === "high_school" ? "특성화고" : "대학교"}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right">{g.count}회</td>
                    <td className="px-4 py-3 text-right">
                      {g.avgScore > 0 ? (
                        <span className={`font-bold ${g.avgScore >= 71 ? "text-green-600" : g.avgScore >= 41 ? "text-yellow-600" : "text-red-600"}`}>
                          {g.avgScore}점
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{g.lastUsed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Full Log */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Filters */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex flex-wrap gap-3">
          <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 문서</option>
            <option value="resume">이력서</option>
            <option value="cover_letter">자소서</option>
          </select>
          <select value={eduFilter} onChange={(e) => setEduFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 학교급</option>
            <option value="high_school">특성화고</option>
            <option value="university">대학교</option>
          </select>
          <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 점수</option>
            <option value="0-40">0~40</option>
            <option value="41-70">41~70</option>
            <option value="71-100">71~100</option>
          </select>
          <select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="">전체 기간</option>
            <option value="1w">1주</option>
            <option value="1m">1개월</option>
            <option value="3m">3개월</option>
          </select>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none">
            <option value="latest">최신순</option>
            <option value="score_high">점수높은순</option>
            <option value="score_low">점수낮은순</option>
            <option value="tokens">토큰많은순</option>
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학교급</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">문서유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gem</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">점수</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">토큰</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">처리시간</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">처리일</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {logPageData.map((r) => {
                const student = studentMap[r.user_id];
                const scoreColor = r.score != null ? (r.score >= 71 ? "text-green-600" : r.score >= 41 ? "text-yellow-600" : "text-red-600") : "";
                return (
                  <tr key={r.id} className="hover:bg-purple-50 dark:hover:bg-purple-900/10">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{student?.name || "-"}</td>
                    <td className="px-4 py-3">
                      {student ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${student.education_level === "high_school" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                          {student.education_level === "high_school" ? "특성화고" : "대학교"}
                        </span>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3">{r.document_type === "resume" ? "이력서" : "자소서"}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{r.model_used || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {r.score != null ? <span className={`font-bold ${scoreColor}`}>{r.score}</span> : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {r.tokens_used ? r.tokens_used.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                      {r.processing_time ? `${(r.processing_time / 1000).toFixed(1)}초` : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{r.created_at?.slice(0, 10).replace(/-/g, ".")}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setSelectedReview(r)}
                        className="text-purple-500 hover:text-purple-700 p-1"
                        title="결과 보기"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700">
          <span className="text-sm text-gray-500">총 {filteredReviews.length}건</span>
          {logTotalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setLogPage((p) => Math.max(0, p - 1))} disabled={logPage === 0}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-500">{logPage + 1} / {logTotalPages}</span>
              <button onClick={() => setLogPage((p) => Math.min(logTotalPages - 1, p + 1))} disabled={logPage >= logTotalPages - 1}
                className="p-1.5 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cost Calculator */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-6">
        <h3 className="font-semibold text-purple-800 dark:text-purple-300 flex items-center gap-2 mb-2">
          <Calculator className="w-5 h-5" />
          비용 계산기
        </h3>
        <p className="text-sm text-purple-600 dark:text-purple-400 mb-4">예상 월간 비용을 계산해보세요</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">월간 이력서 첨삭</label>
            <input type="number" value={calcResume} onChange={(e) => setCalcResume(parseInt(e.target.value) || 0)} min={0}
              className="w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">월간 자소서 첨삭</label>
            <input type="number" value={calcCover} onChange={(e) => setCalcCover(parseInt(e.target.value) || 0)} min={0}
              className="w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">월간 역량 분석</label>
            <input type="number" value={calcAnalysis} onChange={(e) => setCalcAnalysis(parseInt(e.target.value) || 0)} min={0}
              className="w-full px-3 py-2 border border-purple-200 dark:border-purple-600 rounded-lg text-sm bg-white dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex justify-between">
              <span>이력서: {calcResume}건 x ~5,000토큰</span>
              <span>= ~{formatTokens(resumeTokens)}토큰 → {estimateCost(resumeTokens).usd}</span>
            </div>
            <div className="flex justify-between">
              <span>자소서: {calcCover}건 x ~9,000토큰</span>
              <span>= ~{formatTokens(coverTokens)}토큰 → {estimateCost(coverTokens).usd}</span>
            </div>
            <div className="flex justify-between">
              <span>역량분석: {calcAnalysis}건 x ~8,000토큰</span>
              <span>= ~{formatTokens(analysisTokens)}토큰 → {estimateCost(analysisTokens).usd}</span>
            </div>
            <hr className="border-gray-200 dark:border-gray-700" />
            <div className="flex justify-between text-xl font-bold text-purple-700 dark:text-purple-400">
              <span>예상 월간</span>
              <span>{calcCostData.usd} (약 {calcCostData.krw})</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Gemini 2.5 Flash 기준</p>
        </div>
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <AIReviewModal
          isOpen={true}
          onClose={() => setSelectedReview(null)}
          reviewData={{
            overall_score: selectedReview.score,
            feedback: selectedReview.feedback,
            created_at: selectedReview.created_at,
          }}
          documentTitle={selectedReview.document_type === "resume" ? "이력서" : "자소서"}
          gemName={selectedReview.model_used}
        />
      )}
    </div>
  );
}
