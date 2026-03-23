"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { CalendarDays } from "lucide-react";
import { format, subDays, startOfWeek, addDays } from "date-fns";
import { ko } from "date-fns/locale/ko";
import dynamic from "next/dynamic";

const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });

interface DailyLog {
  id: string;
  log_date: string;
  daily_goal: string | null;
  study_hours: number;
  mood: number | null;
}

interface DailyTabProps {
  studentId: string;
  hasAuth?: boolean;
}

const MOOD_EMOJI: Record<number, string> = {
  1: "\ud83d\ude1e",
  2: "\ud83d\ude15",
  3: "\ud83d\ude10",
  4: "\ud83d\ude0a",
  5: "\ud83d\ude04",
};

export default function DailyTab({ studentId, hasAuth }: DailyTabProps) {
  const supabase = createClient();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("daily_logs")
        .select("id, log_date, daily_goal, study_hours, mood")
        .eq("user_id", studentId)
        .gte("log_date", thirtyDaysAgo)
        .order("log_date", { ascending: false });

      if (error) throw error;
      setLogs((data as DailyLog[]) ?? []);
    } catch (err) {
      console.error("일일기록 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-6 animate-pulse dark:bg-gray-800">
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (hasAuth === false) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          이 학생은 아직 가입하지 않아 일일 기록 데이터가 없습니다
        </p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          일일 기록이 없습니다
        </h3>
      </div>
    );
  }

  // Build heatmap data (90 days)
  const logDateSet = new Set(logs.map((l) => l.log_date));
  const today = new Date();
  const heatmapWeeks: { date: string; has: boolean }[][] = [];
  const startDate = subDays(today, 89);
  const weekStart = startOfWeek(startDate, { weekStartsOn: 1 });
  let currentWeek: { date: string; has: boolean }[] = [];

  for (let d = weekStart; d <= today; d = addDays(d, 1)) {
    const ds = format(d, "yyyy-MM-dd");
    currentWeek.push({ date: ds, has: logDateSet.has(ds) });
    if (currentWeek.length === 7) {
      heatmapWeeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) heatmapWeeks.push(currentWeek);

  // Weekly study hours for chart
  const weeklyData: { week: string; hours: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const weekEnd = subDays(today, i * 7);
    const weekBegin = subDays(weekEnd, 6);
    const weekLogs = logs.filter((l) => {
      const d = new Date(l.log_date);
      return d >= weekBegin && d <= weekEnd;
    });
    const totalHours = weekLogs.reduce((s, l) => s + l.study_hours, 0);
    weeklyData.push({
      week: `${format(weekBegin, "M/d")}~${format(weekEnd, "M/d")}`,
      hours: Math.round(totalHours * 10) / 10,
    });
  }

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 dark:text-white">
          학습 히트맵 (3개월)
        </h3>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {heatmapWeeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.date}
                  className={`w-3 h-3 rounded-sm ${
                    day.has
                      ? "bg-purple-500"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                  title={day.date}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly chart */}
      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 dark:text-white">
          주간 학습시간
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="hours" fill="#a855f7" radius={[4, 4, 0, 0]} name="학습시간(h)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent logs */}
      <div className="bg-white rounded-xl shadow-sm dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 p-4 pb-2 dark:text-white">
          최근 기록
        </h3>
        <div className="divide-y dark:divide-gray-700">
          {logs.slice(0, 10).map((log) => (
            <div key={log.id} className="p-4 flex items-center gap-4">
              <div className="text-center flex-shrink-0">
                <p className="text-sm font-medium dark:text-white">
                  {format(new Date(log.log_date), "M/d")}
                </p>
                <p className="text-xs text-gray-400">
                  {format(new Date(log.log_date), "EEE", { locale: ko })}
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate dark:text-gray-300">
                  {log.daily_goal || "목표 미입력"}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-sm text-purple-600 font-medium">
                  {log.study_hours}시간
                </span>
                {log.mood && (
                  <span className="text-lg">
                    {MOOD_EMOJI[log.mood] || ""}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
