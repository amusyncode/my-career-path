"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import type {
  DailyLog,
  Streak,
  RoadmapGoal,
  Skill,
  GoalCategory,
} from "@/lib/types";
import {
  format,
  subDays,
  subMonths,
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  isBefore,
  isAfter,
  addDays,
  getDay,
} from "date-fns";
import { ko } from "date-fns/locale";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { BarChart3, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

// ── 상수 ──
type Period = "1w" | "1m" | "3m" | "6m" | "all";

const PERIOD_OPTIONS: { key: Period; label: string }[] = [
  { key: "1w", label: "1주" },
  { key: "1m", label: "1개월" },
  { key: "3m", label: "3개월" },
  { key: "6m", label: "6개월" },
  { key: "all", label: "전체" },
];

const CATEGORY_LABEL: Record<string, string> = {
  certificate: "자격증",
  skill: "스킬",
  project: "프로젝트",
  experience: "경험",
  education: "학업",
  other: "기타",
};

const CATEGORY_COLOR: Record<string, string> = {
  certificate: "#3B82F6",
  skill: "#10B981",
  project: "#8B5CF6",
  experience: "#F59E0B",
  education: "#EC4899",
  other: "#6B7280",
};

const MOOD_EMOJI = ["", "\uD83D\uDE2B", "\uD83D\uDE14", "\uD83D\uDE10", "\uD83D\uDE0A", "\uD83E\uDD29"];
const MOOD_TEXT = ["", "힘들었어요", "별로였어요", "보통이에요", "좋았어요", "최고였어요"];

const HEATMAP_COLORS = ["#EBEDF0", "#9BE9A8", "#40C463", "#30A14E", "#216E39"];

function getHeatmapColor(hours: number): string {
  if (hours <= 0) return HEATMAP_COLORS[0];
  if (hours < 2) return HEATMAP_COLORS[1];
  if (hours < 4) return HEATMAP_COLORS[2];
  if (hours < 6) return HEATMAP_COLORS[3];
  return HEATMAP_COLORS[4];
}

function getStartDate(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "1w":
      return format(subDays(now, 7), "yyyy-MM-dd");
    case "1m":
      return format(subMonths(now, 1), "yyyy-MM-dd");
    case "3m":
      return format(subMonths(now, 3), "yyyy-MM-dd");
    case "6m":
      return format(subMonths(now, 6), "yyyy-MM-dd");
    case "all":
      return null;
  }
}

// ── 커스텀 Recharts 컴포넌트 ──

function MoodCustomDot(props: Record<string, unknown>) {
  const { cx, cy, payload } = props as { cx: number; cy: number; payload: { mood: number } };
  const mood = payload?.mood ?? 0;
  if (!cx || !cy || mood < 1 || mood > 5) return null;
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={16}>
      {MOOD_EMOJI[mood]}
    </text>
  );
}

function MoodYAxisTick(props: Record<string, unknown>) {
  const { x, y, payload } = props as { x: number; y: number; payload: { value: number } };
  const val = payload?.value;
  if (val < 1 || val > 5) return null;
  return (
    <text x={x - 4} y={y} textAnchor="end" dominantBaseline="central" fontSize={14}>
      {MOOD_EMOJI[val]}
    </text>
  );
}

// ── 메인 컴포넌트 ──

export default function AnalyticsPage() {
  const supabase = createClient();

  const [period, setPeriod] = useState<Period>("1m");
  const [loading, setLoading] = useState(true);

  // 원본 데이터
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [yearLogs, setYearLogs] = useState<{ log_date: string; study_hours: number }[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [goals, setGoals] = useState<RoadmapGoal[]>([]);
  const [projectCount, setProjectCount] = useState(0);
  const [certCount, setCertCount] = useState(0);
  const [skills, setSkills] = useState<Skill[]>([]);

  const startDate = useMemo(() => getStartDate(period), [period]);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const uid = user.id;

      const oneYearAgo = format(subDays(new Date(), 365), "yyyy-MM-dd");

      // 기간별 로그 쿼리
      let logsQuery = supabase
        .from("daily_logs")
        .select("*")
        .eq("user_id", uid)
        .order("log_date", { ascending: true });
      if (startDate) logsQuery = logsQuery.gte("log_date", startDate);

      const [logsRes, streakRes, goalsRes, projectsRes, certsRes, skillsRes, yearLogsRes] =
        await Promise.all([
          logsQuery,
          supabase.from("streaks").select("*").eq("user_id", uid).single(),
          supabase.from("roadmap_goals").select("*").eq("user_id", uid),
          supabase
            .from("projects")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid),
          supabase
            .from("certificates")
            .select("id", { count: "exact", head: true })
            .eq("user_id", uid),
          supabase.from("skills").select("*").eq("user_id", uid),
          supabase
            .from("daily_logs")
            .select("log_date, study_hours")
            .eq("user_id", uid)
            .gte("log_date", oneYearAgo)
            .order("log_date", { ascending: true }),
        ]);

      if (logsRes.data) setLogs(logsRes.data as DailyLog[]);
      if (streakRes.data) setStreak(streakRes.data as Streak);
      if (goalsRes.data) setGoals(goalsRes.data as RoadmapGoal[]);
      setProjectCount(projectsRes.count ?? 0);
      setCertCount(certsRes.count ?? 0);
      if (skillsRes.data) setSkills(skillsRes.data as Skill[]);
      if (yearLogsRes.data)
        setYearLogs(
          yearLogsRes.data.map((d) => ({
            log_date: d.log_date,
            study_hours: Number(d.study_hours) || 0,
          }))
        );
    } catch {
      toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase, startDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // ── 파생 데이터 ──

  const totalStudyHours = useMemo(
    () => logs.reduce((s, l) => s + (Number(l.study_hours) || 0), 0),
    [logs]
  );

  const completedGoals = useMemo(
    () => goals.filter((g) => g.status === "completed"),
    [goals]
  );

  // 이전 기간 대비 증감
  const periodDelta = useMemo(() => {
    if (!startDate || logs.length === 0)
      return { hours: 0, goals: 0 };

    const start = parseISO(startDate);
    const now = new Date();
    const midpoint = new Date((start.getTime() + now.getTime()) / 2);
    const midStr = format(midpoint, "yyyy-MM-dd");

    const firstHalf = logs.filter(
      (l) => l.log_date < midStr
    );
    const secondHalf = logs.filter(
      (l) => l.log_date >= midStr
    );

    const firstHours = firstHalf.reduce((s, l) => s + (Number(l.study_hours) || 0), 0);
    const secondHours = secondHalf.reduce((s, l) => s + (Number(l.study_hours) || 0), 0);

    const firstGoals = completedGoals.filter(
      (g) => g.completed_at && g.completed_at < midStr
    ).length;
    const secondGoals = completedGoals.filter(
      (g) => g.completed_at && g.completed_at >= midStr
    ).length;

    return {
      hours: Math.round((secondHours - firstHours) * 10) / 10,
      goals: secondGoals - firstGoals,
    };
  }, [logs, startDate, completedGoals]);

  // 데이터 충분 여부
  const hasEnoughData = logs.length >= 7;

  // ── 차트 데이터 ──

  // 1) 학습 시간 추이
  const studyChartData = useMemo(() => {
    if (logs.length === 0) return [];

    if (period === "1w" || period === "1m") {
      // 일별
      return logs.map((l) => ({
        date: format(parseISO(l.log_date), "M/d"),
        hours: Number(l.study_hours) || 0,
      }));
    } else if (period === "3m" || period === "6m") {
      // 주별 합산
      const weekMap = new Map<string, number>();
      for (const l of logs) {
        const weekStart = format(startOfWeek(parseISO(l.log_date), { weekStartsOn: 1 }), "M/d");
        weekMap.set(weekStart, (weekMap.get(weekStart) ?? 0) + (Number(l.study_hours) || 0));
      }
      return Array.from(weekMap.entries()).map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 10) / 10,
      }));
    } else {
      // 월별 합산
      const monthMap = new Map<string, number>();
      for (const l of logs) {
        const monthKey = format(parseISO(l.log_date), "yyyy.M");
        monthMap.set(monthKey, (monthMap.get(monthKey) ?? 0) + (Number(l.study_hours) || 0));
      }
      return Array.from(monthMap.entries()).map(([date, hours]) => ({
        date,
        hours: Math.round(hours * 10) / 10,
      }));
    }
  }, [logs, period]);

  const avgStudyHours = useMemo(() => {
    if (studyChartData.length === 0) return 0;
    const total = studyChartData.reduce((s, d) => s + d.hours, 0);
    return Math.round((total / studyChartData.length) * 10) / 10;
  }, [studyChartData]);

  // 2) 목표 달성률 변화
  const goalRateData = useMemo(() => {
    if (goals.length === 0) return [];

    const allDates = goals.map((g) => parseISO(g.created_at));
    const earliest = allDates.reduce((a, b) => (isBefore(a, b) ? a : b), new Date());
    const months = eachMonthOfInterval({ start: startOfMonth(earliest), end: new Date() });

    return months.map((m) => {
      const monthEnd = endOfMonth(m);
      const totalByThen = goals.filter((g) => !isAfter(parseISO(g.created_at), monthEnd)).length;
      const completedByThen = goals.filter(
        (g) => g.completed_at && !isAfter(parseISO(g.completed_at), monthEnd)
      ).length;
      const rate = totalByThen > 0 ? Math.round((completedByThen / totalByThen) * 100) : 0;
      return {
        month: format(m, "M월"),
        rate,
        completed: completedByThen,
        total: totalByThen,
      };
    });
  }, [goals]);

  // 3) 스킬 레이더
  const radarData = useMemo(() => {
    if (skills.length === 0) return [];

    const categoryMap = new Map<string, { sum: number; count: number }>();
    for (const s of skills) {
      const cat = s.category || "기타";
      const prev = categoryMap.get(cat) ?? { sum: 0, count: 0 };
      categoryMap.set(cat, { sum: prev.sum + s.level, count: prev.count + 1 });
    }

    const entries = Array.from(categoryMap.entries())
      .map(([name, { sum, count }]) => ({
        subject: name,
        value: Math.round((sum / count) * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    return entries;
  }, [skills]);

  // 4) 분야별 도넛
  const categoryPieData = useMemo(() => {
    if (goals.length === 0) return [];

    const countMap = new Map<string, number>();
    for (const g of goals) {
      const cat = g.category || "other";
      countMap.set(cat, (countMap.get(cat) ?? 0) + 1);
    }

    return Array.from(countMap.entries()).map(([cat, count]) => ({
      name: CATEGORY_LABEL[cat] || cat,
      value: count,
      category: cat,
    }));
  }, [goals]);

  const categoryTotal = useMemo(
    () => categoryPieData.reduce((s, d) => s + d.value, 0),
    [categoryPieData]
  );

  // 5) 기분 변화
  const moodChartData = useMemo(() => {
    return logs
      .filter((l) => l.mood !== null && l.mood !== undefined && l.mood >= 1)
      .map((l) => ({
        date: format(parseISO(l.log_date), "M/d"),
        mood: l.mood!,
      }));
  }, [logs]);

  const avgMood = useMemo(() => {
    if (moodChartData.length === 0) return 0;
    const total = moodChartData.reduce((s, d) => s + d.mood, 0);
    return Math.round((total / moodChartData.length) * 10) / 10;
  }, [moodChartData]);

  // 6) 잔디밭 (1년)
  const heatmapData = useMemo(() => {
    const logsMap = new Map<string, number>();
    for (const l of yearLogs) {
      logsMap.set(l.log_date, l.study_hours);
    }

    const today = new Date();
    const todayDay = getDay(today); // 0=일 ~ 6=토
    // 끝 = 이번 주 토요일
    const endDate = addDays(today, 6 - todayDay);
    // 시작 = 52주 전 일요일
    const startDate = addDays(endDate, -52 * 7 + 1);

    const weeks: { date: Date; dateStr: string; hours: number }[][] = [];
    let currentDate = startDate;
    let currentWeek: { date: Date; dateStr: string; hours: number }[] = [];

    while (!isAfter(currentDate, endDate)) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      currentWeek.push({
        date: new Date(currentDate),
        dateStr,
        hours: logsMap.get(dateStr) ?? 0,
      });
      if (getDay(currentDate) === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentDate = addDays(currentDate, 1);
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    return weeks;
  }, [yearLogs]);

  // 잔디밭 월 라벨 계산
  const heatmapMonthLabels = useMemo(() => {
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    for (let w = 0; w < heatmapData.length; w++) {
      const firstDay = heatmapData[w][0];
      if (firstDay) {
        const m = firstDay.date.getMonth();
        if (m !== lastMonth) {
          labels.push({ label: `${m + 1}월`, col: w });
          lastMonth = m;
        }
      }
    }
    return labels;
  }, [heatmapData]);

  // 7) 월간 리포트
  const monthlyReport = useMemo(() => {
    const now = new Date();
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

    const monthLogs = logs.filter(
      (l) => l.log_date >= monthStart && l.log_date <= monthEnd
    );
    const monthHours = monthLogs.reduce((s, l) => s + (Number(l.study_hours) || 0), 0);

    const monthCompletedGoals = goals.filter(
      (g) =>
        g.status === "completed" &&
        g.completed_at &&
        g.completed_at >= monthStart &&
        g.completed_at <= monthEnd
    ).length;

    // 가장 많은 카테고리
    const catCount = new Map<string, number>();
    for (const g of goals) {
      const cat = g.category || "other";
      catCount.set(cat, (catCount.get(cat) ?? 0) + 1);
    }
    let topCat: GoalCategory | string = "other";
    let topCount = 0;
    for (const [cat, count] of Array.from(catCount.entries())) {
      if (count > topCount) {
        topCat = cat;
        topCount = count;
      }
    }

    const totalGoals = goals.length;
    const completedTotal = completedGoals.length;
    const achieveRate = totalGoals > 0 ? Math.round((completedTotal / totalGoals) * 100) : 0;

    let encouragement = "";
    if (achieveRate >= 80)
      encouragement = "🎉 대단해요! 목표에 거의 다 왔어요!";
    else if (achieveRate >= 50)
      encouragement = "💪 잘 하고 있어요! 꾸준히 해봐요!";
    else if (achieveRate >= 30)
      encouragement = "🌱 조금씩 성장하고 있어요. 포기하지 마세요!";
    else encouragement = "🚀 새로운 시작이에요. 오늘부터 달려볼까요?";

    return {
      hours: Math.round(monthHours * 10) / 10,
      completedGoals: monthCompletedGoals,
      topCategory: CATEGORY_LABEL[topCat] || "기타",
      longestStreak: streak?.longest_streak ?? 0,
      encouragement,
      achieveRate,
    };
  }, [logs, goals, completedGoals, streak]);

  // ── 스켈레톤 UI ──
  if (loading) {
    return (
      <div className="space-y-6">
        {/* 상단 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="h-8 w-40 bg-gray-200 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 w-14 bg-gray-200 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4 h-24 animate-pulse">
              <div className="h-4 w-16 bg-gray-200 rounded mb-3" />
              <div className="h-7 w-20 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        {/* 차트 */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 h-80 animate-pulse">
            <div className="h-5 w-32 bg-gray-200 rounded mb-4" />
            <div className="h-56 bg-gray-100 rounded-lg" />
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-6 h-72 animate-pulse">
              <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
              <div className="h-48 bg-gray-100 rounded-lg" />
            </div>
          ))}
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 h-48 animate-pulse">
            <div className="h-5 w-28 bg-gray-200 rounded mb-4" />
            <div className="h-28 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // ── 빈 상태 ──
  if (!hasEnoughData) {
    return (
      <div className="space-y-6">
        {/* 상단 */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">분석 &amp; 통계</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <BarChart3 className="w-20 h-20 text-gray-200 mx-auto mb-6" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            아직 데이터가 부족해요
          </h2>
          <p className="text-gray-500 mb-6">
            7일 이상 기록하면 의미있는 분석이 시작됩니다!
          </p>
          <Link
            href="/daily"
            className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-lg px-6 py-3 font-medium hover:bg-blue-600 transition-colors"
          >
            일일 기록 시작하기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ── 렌더 ──
  return (
    <div className="space-y-6">
      {/* ===== 상단 ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">분석 &amp; 통계</h1>
        <div className="flex gap-2 flex-wrap">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === opt.key
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ===== 요약 통계 카드 ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            emoji: "📚",
            label: "총 학습 시간",
            value: `${Math.round(totalStudyHours * 10) / 10}`,
            unit: "시간",
            delta: periodDelta.hours,
            deltaUnit: "h",
          },
          {
            emoji: "🔥",
            label: "최장 연속",
            value: `${streak?.longest_streak ?? 0}`,
            unit: "일",
            delta: null,
            deltaUnit: "",
          },
          {
            emoji: "\u2705",
            label: "달성한 목표",
            value: `${completedGoals.length}`,
            unit: "개",
            delta: periodDelta.goals,
            deltaUnit: "개",
          },
          {
            emoji: "📁",
            label: "프로젝트",
            value: `${projectCount}`,
            unit: "개",
            delta: null,
            deltaUnit: "",
          },
          {
            emoji: "🏆",
            label: "자격증",
            value: `${certCount}`,
            unit: "개",
            delta: null,
            deltaUnit: "",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm p-4"
          >
            <p className="text-sm text-gray-500 mb-1">
              {stat.emoji} {stat.label}
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold text-gray-900">
                {stat.value}
              </span>
              <span className="text-sm text-gray-400 mb-0.5">{stat.unit}</span>
            </div>
            {stat.delta !== null && stat.delta !== 0 && (
              <div
                className={`flex items-center gap-0.5 mt-1 text-xs font-medium ${
                  stat.delta > 0 ? "text-green-500" : "text-red-500"
                }`}
              >
                {stat.delta > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {stat.delta > 0 ? "+" : ""}
                {stat.delta}
                {stat.deltaUnit}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== 차트 그리드 ===== */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* ① 학습 시간 추이 */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">학습 시간 추이</h3>
            <span className="text-xs bg-blue-100 text-blue-600 rounded-full px-3 py-1 font-medium">
              총 {Math.round(totalStudyHours * 10) / 10}시간
            </span>
          </div>
          {studyChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
              해당 기간에 학습 기록이 없습니다.
            </div>
          ) : (
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={studyChartData}>
                  <defs>
                    <linearGradient id="studyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(v) => `${v}h`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${value}시간`, "학습"]}
                  />
                  <ReferenceLine
                    y={avgStudyHours}
                    stroke="#9CA3AF"
                    strokeDasharray="5 5"
                    label={{
                      value: `평균 ${avgStudyHours}h`,
                      position: "insideTopRight",
                      fill: "#9CA3AF",
                      fontSize: 11,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hours"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    fill="url(#studyGrad)"
                    isAnimationActive={true}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ② 목표 달성률 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">목표 달성률</h3>
          {goalRateData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
              등록된 목표가 없습니다.
            </div>
          ) : (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={goalRateData}>
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                    formatter={(value, _name, props) => {
                      const p = (props as { payload?: { completed?: number; total?: number } }).payload;
                      return [`${value}% (${p?.completed ?? 0}/${p?.total ?? 0}개)`, "달성률"];
                    }}
                    labelFormatter={(label) => `${new Date().getFullYear()}년 ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={{ fill: "#10B981", r: 4 }}
                    isAnimationActive={true}
                    label={{
                      position: "top",
                      formatter: (v: unknown) => `${v}%`,
                      fill: "#10B981",
                      fontSize: 10,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ③ 역량 분석 (레이더) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">역량 분석</h3>
          {radarData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
              <p>스킬을 등록하면 역량 차트가 생성됩니다</p>
              <Link
                href="/profile"
                className="text-blue-500 hover:underline text-sm font-medium"
              >
                스킬 등록하기 →
              </Link>
            </div>
          ) : (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#E5E7EB" />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 5]}
                    tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  />
                  <Radar
                    name="역량"
                    dataKey="value"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                    isAnimationActive={true}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ④ 분야별 노력 분배 (도넛) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">분야별 노력 분배</h3>
          {categoryPieData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
              등록된 목표가 없습니다.
            </div>
          ) : (
            <div className="flex items-center gap-4 h-56">
              <div className="w-1/2 h-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      strokeWidth={0}
                      isAnimationActive={true}
                    >
                      {categoryPieData.map((entry) => (
                        <Cell
                          key={entry.category}
                          fill={CATEGORY_COLOR[entry.category] || "#6B7280"}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                        fontSize: "12px",
                      }}
                      formatter={(value) => [
                        `${value}개 (${Math.round((Number(value) / categoryTotal) * 100)}%)`,
                        "",
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-gray-900">
                    {categoryTotal}
                  </span>
                </div>
              </div>
              <div className="w-1/2 space-y-2">
                {categoryPieData.map((entry) => (
                  <div key={entry.category} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: CATEGORY_COLOR[entry.category] || "#6B7280",
                      }}
                    />
                    <span className="text-gray-600 flex-1 truncate">{entry.name}</span>
                    <span className="text-gray-900 font-medium">
                      {Math.round((entry.value / categoryTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ⑤ 기분 변화 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">기분 변화</h3>
          {moodChartData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">
              해당 기간에 기분 기록이 없습니다.
            </div>
          ) : (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={moodChartData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <YAxis
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    axisLine={false}
                    tickLine={false}
                    tick={(props) => <MoodYAxisTick {...props} />}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [
                      `${MOOD_EMOJI[Number(value)]} ${MOOD_TEXT[Number(value)]}`,
                      "기분",
                    ]}
                  />
                  <ReferenceLine
                    y={avgMood}
                    stroke="#F59E0B"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="mood"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={(props) => <MoodCustomDot {...props} />}
                    isAnimationActive={true}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ⑥ 활동 스트릭 캘린더 (잔디밭) */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h3 className="text-lg font-semibold text-gray-900">활동 기록</h3>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                🔥 현재 연속 {streak?.current_streak ?? 0}일
              </span>
              <span>|</span>
              <span>최장 {streak?.longest_streak ?? 0}일</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* 월 라벨 */}
              <div className="flex ml-8 mb-1">
                {heatmapMonthLabels.map((ml, i) => (
                  <span
                    key={i}
                    className="text-[10px] text-gray-400"
                    style={{
                      position: "relative",
                      left: `${ml.col * 14}px`,
                      marginRight: i < heatmapMonthLabels.length - 1
                        ? `${((heatmapMonthLabels[i + 1]?.col ?? 0) - ml.col) * 14 - 24}px`
                        : "0px",
                    }}
                  >
                    {ml.label}
                  </span>
                ))}
              </div>

              <div className="flex gap-0">
                {/* 요일 라벨 */}
                <div className="flex flex-col gap-[2px] mr-1 pt-0">
                  {["일", "월", "화", "수", "목", "금", "토"].map((d, i) => (
                    <div
                      key={d}
                      className="h-[12px] flex items-center justify-end"
                    >
                      {i === 1 || i === 3 || i === 5 ? (
                        <span className="text-[9px] text-gray-400 leading-none pr-1">
                          {d}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* 그리드 */}
                <div className="flex gap-[2px]">
                  {heatmapData.map((week, wi) => (
                    <div key={wi} className="flex flex-col gap-[2px]">
                      {/* 주 시작이 일요일 아닌 경우 빈 셀 */}
                      {week.length < 7 &&
                        wi === 0 &&
                        Array.from({ length: 7 - week.length }).map((_, ei) => (
                          <div key={`e-${ei}`} className="w-[12px] h-[12px]" />
                        ))}
                      {week.map((day) => (
                        <div
                          key={day.dateStr}
                          className="w-[12px] h-[12px] rounded-sm cursor-pointer group relative"
                          style={{ backgroundColor: getHeatmapColor(day.hours) }}
                        >
                          {/* 툴팁 */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                            <div className="bg-gray-800 text-white text-[10px] rounded-md px-2 py-1.5 whitespace-nowrap shadow-lg">
                              {format(day.date, "yyyy년 M월 d일", { locale: ko })}
                              <br />
                              {day.hours > 0
                                ? `${day.hours}시간 학습`
                                : "기록 없음"}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* 범례 */}
              <div className="flex items-center gap-1.5 mt-3 ml-8">
                <span className="text-[10px] text-gray-400">적음</span>
                {HEATMAP_COLORS.map((color, i) => (
                  <div
                    key={i}
                    className="w-[12px] h-[12px] rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <span className="text-[10px] text-gray-400">많음</span>
              </div>
            </div>
          </div>
        </div>

        {/* ⑦ 월간 리포트 */}
        <div className="lg:col-span-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-sm p-6 text-white">
          <h3 className="text-lg font-semibold mb-4">이번 달 리포트</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-blue-100 text-sm">
                이번 달 총{" "}
                <span className="text-white font-bold text-lg">
                  {monthlyReport.hours}시간
                </span>{" "}
                학습했고,{" "}
                <span className="text-white font-bold text-lg">
                  {monthlyReport.completedGoals}개
                </span>{" "}
                목표를 달성했어요!
              </p>
              <p className="text-blue-100 text-sm">
                가장 많이 노력한 분야:{" "}
                <span className="text-white font-semibold">
                  {monthlyReport.topCategory}
                </span>
              </p>
              <p className="text-blue-100 text-sm">
                최장 연속 기록:{" "}
                <span className="text-white font-semibold">
                  {monthlyReport.longestStreak}일
                </span>
              </p>
            </div>
            <div className="flex items-center justify-center sm:justify-end">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-4 text-center">
                <p className="text-2xl mb-1">{monthlyReport.encouragement}</p>
                <p className="text-blue-100 text-xs">
                  전체 달성률 {monthlyReport.achieveRate}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
