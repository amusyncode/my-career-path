"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import {
  FileSearch,
  Sparkles,
  Target,
  FileText,
  TrendingUp,
  Clock,
  Zap,
} from "lucide-react";
import AICenterSkeleton from "./_components/AICenterSkeleton";
import ReviewManagementTab from "./_components/ReviewManagementTab";
import CompetencyAnalysisTab from "./_components/CompetencyAnalysisTab";
import JobMatchingTab from "./_components/JobMatchingTab";

const TABS = [
  { id: "review", label: "AI 첨삭 관리", icon: FileSearch },
  { id: "competency", label: "학생 역량 분석", icon: Sparkles },
  { id: "matching", label: "취업 매칭 추천", icon: Target },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Stats {
  totalReviews: number;
  averageScore: number;
  pendingDocs: number;
  monthlyTokens: { input: number; output: number };
}

export default function AICenterPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>("review");
  const [stats, setStats] = useState<Stats>({
    totalReviews: 0,
    averageScore: 0,
    pendingDocs: 0,
    monthlyTokens: { input: 0, output: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [reviewsRes, resumesRes, coverLettersRes, monthlyReviewTokensRes, monthlyAnalysisTokensRes] =
        await Promise.all([
          // 총 AI 첨삭 + 점수
          supabase.from("ai_review_results").select("overall_score"),
          // 대기 이력서
          supabase
            .from("uploaded_resumes")
            .select("id", { count: "exact", head: true })
            .eq("status", "uploaded"),
          // 대기 자소서
          supabase
            .from("uploaded_cover_letters")
            .select("id", { count: "exact", head: true })
            .eq("status", "uploaded"),
          // 이번 달 리뷰 토큰
          supabase
            .from("ai_review_results")
            .select("input_tokens, output_tokens")
            .gte("reviewed_at", firstOfMonth),
          // 이번 달 분석 토큰
          supabase
            .from("ai_student_analyses")
            .select("input_tokens, output_tokens")
            .gte("created_at", firstOfMonth),
        ]);

      const reviews = reviewsRes.data || [];
      const totalReviews = reviews.length;
      const scores = reviews
        .map((r) => r.overall_score)
        .filter((s): s is number => s != null);
      const averageScore =
        scores.length > 0
          ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
          : 0;

      const pendingDocs = (resumesRes.count || 0) + (coverLettersRes.count || 0);

      const reviewTokens = monthlyReviewTokensRes.data || [];
      const analysisTokens = monthlyAnalysisTokensRes.data || [];
      const allTokens = [...reviewTokens, ...analysisTokens];
      const monthlyInput = allTokens.reduce(
        (sum, t) => sum + (t.input_tokens || 0),
        0
      );
      const monthlyOutput = allTokens.reduce(
        (sum, t) => sum + (t.output_tokens || 0),
        0
      );

      setStats({
        totalReviews,
        averageScore,
        pendingDocs,
        monthlyTokens: { input: monthlyInput, output: monthlyOutput },
      });
    } catch (error) {
      console.error("통계 조회 오류:", error);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return <AICenterSkeleton />;
  }

  const tokenCost =
    (stats.monthlyTokens.input * 0.15 + stats.monthlyTokens.output * 0.6) /
    1_000_000;

  const statCards = [
    {
      icon: FileText,
      label: "총 AI 첨삭",
      value: stats.totalReviews.toLocaleString(),
      sub: "전체 첨삭 완료 건수",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: TrendingUp,
      label: "평균 점수",
      value: `${stats.averageScore}점`,
      sub: "첨삭 평균 종합 점수",
      color: "bg-green-50 text-green-600",
    },
    {
      icon: Clock,
      label: "첨삭 대기",
      value: stats.pendingDocs.toLocaleString(),
      sub: "미처리 문서 수",
      color: "bg-orange-50 text-orange-600",
    },
    {
      icon: Zap,
      label: "이번 달 토큰",
      value: (
        (stats.monthlyTokens.input + stats.monthlyTokens.output) /
        1000
      ).toFixed(1) + "K",
      sub: `예상 비용: $${tokenCost.toFixed(4)}`,
      color: "bg-purple-50 text-purple-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">AI 분석센터</h2>
        <p className="text-sm text-gray-500 mt-1">
          Gemini 2.5 Flash 기반 AI 분석 도구를 통합 관리합니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-gray-500">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "review" && (
        <ReviewManagementTab onStatsUpdate={fetchStats} />
      )}
      {activeTab === "competency" && <CompetencyAnalysisTab />}
      {activeTab === "matching" && <JobMatchingTab />}
    </div>
  );
}
