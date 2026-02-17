"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type {
  Profile,
  RoadmapGoal,
  DailyTask,
  Project,
  Streak,
} from "@/lib/types";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  ClipboardList,
  CheckCircle2,
  ScrollText,
  FolderOpen,
  CalendarClock,
  ArrowRight,
  Flame,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  planning: { label: "기획중", cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "진행중", cls: "bg-blue-100 text-blue-600" },
  completed: { label: "완료", cls: "bg-green-100 text-green-600" },
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export default function DashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [goals, setGoals] = useState<RoadmapGoal[]>([]);
  const [certCount, setCertCount] = useState(0);
  const [projectCount, setProjectCount] = useState(0);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [todayTasks, setTodayTasks] = useState<DailyTask[]>([]);
  const [weeklyHours, setWeeklyHours] = useState<
    { day: string; hours: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");

  const fetchDashboard = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const uid = user.id;
      const sevenDaysAgo = format(subDays(new Date(), 6), "yyyy-MM-dd");

      const [
        profileRes,
        streakRes,
        goalsRes,
        certRes,
        projectCountRes,
        recentProjectsRes,
        todayLogRes,
        weeklyLogsRes,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("streaks").select("*").eq("user_id", uid).single(),
        supabase.from("roadmap_goals").select("*").eq("user_id", uid),
        supabase
          .from("certificates")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
        supabase
          .from("projects")
          .select("id", { count: "exact", head: true })
          .eq("user_id", uid),
        supabase
          .from("projects")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("daily_logs")
          .select("id")
          .eq("user_id", uid)
          .eq("log_date", today)
          .single(),
        supabase
          .from("daily_logs")
          .select("log_date, study_hours")
          .eq("user_id", uid)
          .gte("log_date", sevenDaysAgo)
          .lte("log_date", today)
          .order("log_date", { ascending: true }),
      ]);

      if (profileRes.data) setProfile(profileRes.data as Profile);
      if (streakRes.data) setStreak(streakRes.data as Streak);
      if (goalsRes.data) setGoals(goalsRes.data as RoadmapGoal[]);
      setCertCount(certRes.count ?? 0);
      setProjectCount(projectCountRes.count ?? 0);
      if (recentProjectsRes.data)
        setRecentProjects(recentProjectsRes.data as Project[]);

      // 오늘 할 일
      if (todayLogRes.data) {
        const { data: tasks } = await supabase
          .from("daily_tasks")
          .select("*")
          .eq("daily_log_id", todayLogRes.data.id)
          .order("order_index", { ascending: true });
        if (tasks) setTodayTasks(tasks as DailyTask[]);
      }

      // 주간 학습시간 — 빈 날짜 채우기
      const logsMap = new Map<string, number>();
      if (weeklyLogsRes.data) {
        for (const log of weeklyLogsRes.data) {
          logsMap.set(log.log_date, Number(log.study_hours) || 0);
        }
      }
      const weekly: { day: string; hours: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const key = format(d, "yyyy-MM-dd");
        const dayLabel = DAY_LABELS[d.getDay()];
        weekly.push({ day: dayLabel, hours: logsMap.get(key) ?? 0 });
      }
      setWeeklyHours(weekly);
    } catch {
      toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase, today]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // --- 할 일 토글 ---
  const toggleTask = async (task: DailyTask) => {
    const newCompleted = !task.is_completed;

    // 낙관적 업데이트
    setTodayTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              is_completed: newCompleted,
              completed_at: newCompleted ? new Date().toISOString() : null,
            }
          : t
      )
    );

    const { error } = await supabase
      .from("daily_tasks")
      .update({
        is_completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq("id", task.id);

    if (error) {
      toast.error("할 일 업데이트에 실패했습니다.");
      setTodayTasks((prev) =>
        prev.map((t) => (t.id === task.id ? task : t))
      );
    }
  };

  // --- 파생 데이터 ---
  const inProgressCount = goals.filter(
    (g) => g.status === "in_progress"
  ).length;
  const completedCount = goals.filter((g) => g.status === "completed").length;
  const totalGoals = goals.length;
  const progressPercent =
    totalGoals > 0 ? Math.round((completedCount / totalGoals) * 100) : 0;

  const upcomingDeadlines = goals
    .filter((g) => g.target_date && g.status !== "completed")
    .sort(
      (a, b) =>
        new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime()
    )
    .slice(0, 3);

  const totalWeeklyHours = weeklyHours.reduce((s, d) => s + d.hours, 0);
  const incompleteTasks = todayTasks.filter((t) => !t.is_completed).length;

  const pieData = [
    { name: "완료", value: completedCount || 0 },
    { name: "남은", value: Math.max(totalGoals - completedCount, 0) || 0 },
  ];
  const PIE_COLORS = ["#10B981", "#E5E7EB"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ===== 1. 인사 섹션 ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-2xl font-bold text-gray-900">
            안녕하세요, {profile?.name || "사용자"}님!
          </h2>
          {streak && streak.current_streak > 0 && (
            <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-600 rounded-full px-3 py-1 text-sm font-medium">
              <Flame className="w-4 h-4" />
              연속 {streak.current_streak}일째 기록중
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500">
          {format(new Date(), "yyyy년 M월 d일 EEEE", { locale: ko })}
        </p>
      </div>

      {/* ===== 2. 통계 카드 ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: ClipboardList,
            label: "진행중 목표",
            value: inProgressCount,
            color: "text-blue-500",
            bg: "bg-blue-50",
          },
          {
            icon: CheckCircle2,
            label: "완료한 목표",
            value: completedCount,
            color: "text-green-500",
            bg: "bg-green-50",
          },
          {
            icon: ScrollText,
            label: "취득 자격증",
            value: certCount,
            color: "text-purple-500",
            bg: "bg-purple-50",
          },
          {
            icon: FolderOpen,
            label: "프로젝트",
            value: projectCount,
            color: "text-orange-500",
            bg: "bg-orange-50",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-xl shadow-sm p-5 flex items-center gap-4"
          >
            <div
              className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}
            >
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ===== 3~7. 메인 그리드 ===== */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* --- 3. 오늘의 할 일 --- */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                오늘의 할 일
              </h3>
              <span className="text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-0.5 font-medium">
                {incompleteTasks}/{todayTasks.length}
              </span>
            </div>
          </div>

          {todayTasks.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 mb-3">
                오늘의 할 일을 추가해보세요!
              </p>
              <Link
                href="/daily"
                className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
              >
                일일기록 페이지로 이동
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {todayTasks.map((task) => (
                <li key={task.id} className="flex items-center gap-3 group">
                  <button
                    onClick={() => toggleTask(task)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      task.is_completed
                        ? "bg-primary border-primary"
                        : "border-gray-300 group-hover:border-primary"
                    }`}
                  >
                    {task.is_completed && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                  <span
                    className={`text-sm ${
                      task.is_completed
                        ? "line-through text-gray-400"
                        : "text-gray-700"
                    }`}
                  >
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- 4. 로드맵 진행률 --- */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            로드맵 진행률
          </h3>

          {totalGoals === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">
                등록된 목표가 없습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="w-full h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">
                    {progressPercent}%
                  </span>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 mt-2">
                {totalGoals}개 중 {completedCount}개 완료
              </p>
            </>
          )}
        </div>

        {/* --- 5. 이번 주 학습시간 --- */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              이번 주 학습시간
            </h3>
            <span className="text-sm font-medium text-primary">
              총 {totalWeeklyHours}시간
            </span>
          </div>

          {totalWeeklyHours === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">
                이번 주 학습 기록이 없습니다.
              </p>
            </div>
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyHours}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "#9CA3AF" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => [`${value}시간`, "학습"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="hours"
                    fill="#3B82F6"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* --- 6. 최근 프로젝트 --- */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              최근 프로젝트
            </h3>
            <Link
              href="/portfolio"
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              전체보기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">
                등록된 프로젝트가 없습니다.
              </p>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
              {recentProjects.map((project) => {
                const badge =
                  STATUS_BADGE[project.status] || STATUS_BADGE.planning;
                return (
                  <div
                    key={project.id}
                    className="min-w-[220px] flex-shrink-0 border border-gray-100 rounded-xl overflow-hidden"
                  >
                    <div className="h-28 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                      {project.thumbnail_url ? (
                        <img
                          src={project.thumbnail_url}
                          alt={project.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FolderOpen className="w-8 h-8 text-blue-300" />
                      )}
                    </div>
                    <div className="p-3">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">
                        {project.title}
                      </h4>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {project.tech_stack.slice(0, 3).map((tech) => (
                          <span
                            key={tech}
                            className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                      <span
                        className={`inline-block text-[10px] font-medium rounded-full px-2 py-0.5 mt-2 ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- 7. 다가오는 마감 --- */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-gray-400" />
            다가오는 마감
          </h3>

          {upcomingDeadlines.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">
                다가오는 마감이 없습니다.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingDeadlines.map((goal) => {
                const dDay = differenceInDays(
                  parseISO(goal.target_date!),
                  new Date()
                );
                let badgeCls = "bg-gray-100 text-gray-600";
                if (dDay <= 7) badgeCls = "bg-red-100 text-red-600";
                else if (dDay <= 30)
                  badgeCls = "bg-orange-100 text-orange-600";

                return (
                  <li
                    key={goal.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {goal.title}
                    </span>
                    <span
                      className={`text-xs font-medium rounded-full px-2.5 py-0.5 flex-shrink-0 ${badgeCls}`}
                    >
                      {dDay === 0
                        ? "D-Day"
                        : dDay > 0
                          ? `D-${dDay}`
                          : `D+${Math.abs(dDay)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
