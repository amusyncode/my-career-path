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
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import AIReviewTab from "@/components/instructor/tabs/AIReviewTab";
import StudentAnalysisTab from "@/components/instructor/tabs/StudentAnalysisTab";
import JobMatchingTab from "@/components/instructor/tabs/JobMatchingTab";

const TABS = [
  { id: "review", label: "AI 첨삭 관리", icon: FileSearch },
  { id: "competency", label: "학생 역량 분석", icon: Sparkles },
  { id: "matching", label: "취업 매칭 추천", icon: Target },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Stats {
  totalReviews: number;
  averageScore: number;
  recentAvgScore: number;
  pendingDocs: number;
  monthlyTokens: { input: number; output: number };
}

export default function InstructorAICenterPage() {
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<TabId>("review");
  const [stats, setStats] = useState<Stats>({
    totalReviews: 0,
    averageScore: 0,
    recentAvgScore: 0,
    pendingDocs: 0,
    monthlyTokens: { input: 0, output: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [instructorId, setInstructorId] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, gemini_api_key")
        .eq("id", user.id)
        .single();

      if (!profile) return;
      setInstructorId(profile.id);
      setHasApiKey(!!profile.gemini_api_key);

      const now = new Date();
      const firstOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toISOString();

      // 내 소속 학생들의 데이터만 조회
      const myStudentIds = await supabase
        .from("profiles")
        .select("id")
        .eq("instructor_id", profile.id)
        .eq("role", "student");

      const studentIds = (myStudentIds.data || []).map((s) => s.id);

      if (studentIds.length === 0) {
        setStats({
          totalReviews: 0,
          averageScore: 0,
          recentAvgScore: 0,
          pendingDocs: 0,
          monthlyTokens: { input: 0, output: 0 },
        });
        setIsLoading(false);
        return;
      }

      const [
        reviewsRes,
        recentReviewsRes,
        resumesRes,
        coverLettersRes,
        monthlyReviewTokensRes,
        monthlyAnalysisTokensRes,
      ] = await Promise.all([
        supabase
          .from("ai_review_results")
          .select("overall_score")
          .in("user_id", studentIds),
        supabase
          .from("ai_review_results")
          .select("overall_score")
          .in("user_id", studentIds)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("uploaded_resumes")
          .select("id", { count: "exact", head: true })
          .in("user_id", studentIds)
          .eq("status", "uploaded"),
        supabase
          .from("uploaded_cover_letters")
          .select("id", { count: "exact", head: true })
          .in("user_id", studentIds)
          .eq("status", "uploaded"),
        supabase
          .from("ai_review_results")
          .select("input_tokens, output_tokens")
          .in("user_id", studentIds)
          .gte("reviewed_at", firstOfMonth),
        supabase
          .from("ai_student_analyses")
          .select("input_tokens, output_tokens")
          .in("user_id", studentIds)
          .gte("created_at", firstOfMonth),
      ]);

      const reviews = reviewsRes.data || [];
      const totalReviews = reviews.length;
      const scores = reviews
        .map((r) => r.overall_score)
        .filter((s): s is number => s != null);
      const averageScore =
        scores.length > 0
          ? Math.round(
              (scores.reduce((a, b) => a + b, 0) / scores.length) * 10
            ) / 10
          : 0;

      const recentScores = (recentReviewsRes.data || [])
        .map((r) => r.overall_score)
        .filter((s): s is number => s != null);
      const recentAvgScore =
        recentScores.length > 0
          ? Math.round(
              (recentScores.reduce((a, b) => a + b, 0) / recentScores.length) *
                10
            ) / 10
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
        recentAvgScore,
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

  const scoreDiff = Math.round((stats.recentAvgScore - stats.averageScore) * 10) / 10;

  const statCards = [
    {
      icon: FileText,
      label: "총 AI 첨삭",
      value: stats.totalReviews.toLocaleString(),
      sub: "전체 첨삭 완료 건수",
      color: "bg-purple-100 text-purple-600",
    },
    {
      icon: TrendingUp,
      label: "평균 점수",
      value: `${stats.averageScore}점`,
      sub:
        scoreDiff !== 0
          ? `최근 10건 대비 ${scoreDiff > 0 ? "↑" : "↓"}${Math.abs(scoreDiff)}점`
          : "최근 10건과 동일",
      color: "bg-green-100 text-green-600",
    },
    {
      icon: Clock,
      label: "첨삭 대기",
      value: stats.pendingDocs.toLocaleString(),
      sub: "미처리 문서 수",
      color: "bg-yellow-100 text-yellow-600",
    },
    {
      icon: Zap,
      label: "이번 달 토큰",
      value:
        (
          (stats.monthlyTokens.input + stats.monthlyTokens.output) /
          1000
        ).toFixed(1) + "K",
      sub: `예상 비용 ~$${tokenCost.toFixed(4)}`,
      color: "bg-blue-100 text-blue-600",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          AI 분석센터
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Gemini 기반 AI 분석 도구
        </p>
      </div>

      {/* API 키 미등록 경고 */}
      {!hasApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3 dark:bg-yellow-900/20 dark:border-yellow-800">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              API 키가 등록되지 않았습니다. AI 기능을 사용하려면 설정에서 Gemini
              API 키를 등록해주세요.
            </p>
            <Link
              href="/instructor/settings"
              className="text-sm text-yellow-700 dark:text-yellow-300 font-medium hover:underline inline-flex items-center gap-1 mt-1"
            >
              설정으로 이동 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}
              >
                <card.icon className="w-5 h-5" />
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {card.label}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {card.sub}
            </p>
          </div>
        ))}
      </div>

      {/* 탭 바 */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex-1 justify-center ${
              activeTab === tab.id
                ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "review" && (
        <AIReviewTab
          instructorId={instructorId!}
          hasApiKey={hasApiKey}
          onStatsUpdate={fetchStats}
        />
      )}
      {activeTab === "competency" && (
        <StudentAnalysisTab
          instructorId={instructorId!}
          hasApiKey={hasApiKey}
        />
      )}
      {activeTab === "matching" && (
        <JobMatchingTab instructorId={instructorId!} hasApiKey={hasApiKey} />
      )}
    </div>
  );
}

/* 로딩 스켈레톤 (인라인) */
function AICenterSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-36 bg-gray-200 rounded-lg" />
        <div className="h-4 w-48 bg-gray-200 rounded mt-2" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-gray-100"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gray-200" />
              <div className="h-4 w-16 bg-gray-200 rounded" />
            </div>
            <div className="h-8 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded mt-2" />
          </div>
        ))}
      </div>
      <div className="h-12 bg-gray-200 rounded-xl" />
      <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
