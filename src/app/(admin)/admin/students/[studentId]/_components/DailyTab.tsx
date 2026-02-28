"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { CalendarDays } from "lucide-react";
import { format, subDays, startOfDay, getDay } from "date-fns";
import { ko } from "date-fns/locale/ko";
import dynamic from "next/dynamic";

const RechartsBarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);
const Bar = dynamic(
  () => import("recharts").then((m) => m.Bar),
  { ssr: false }
);
const XAxis = dynamic(
  () => import("recharts").then((m) => m.XAxis),
  { ssr: false }
);
const YAxis = dynamic(
  () => import("recharts").then((m) => m.YAxis),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface DailyTask {
  id: string;
  title: string;
  is_completed: boolean;
}

interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  study_hours: number;
  mood: number | null;
  daily_goal: string | null;
  tasks: DailyTask[];
  created_at: string;
}

interface DailyTabProps {
  studentId: string;
}

const MOOD_EMOJI: Record<number, string> = {
  1: "\uD83D\uDE22",
  2: "\uD83D\uDE1F",
  3: "\uD83D\uDE10",
  4: "\uD83D\uDE42",
  5: "\uD83D\uDE04",
};

const DAY_NAMES = ["\uC77C", "\uC6D4", "\uD654", "\uC218", "\uBAA9", "\uAE08", "\uD1A0"];

function getHeatmapColor(hours: number): string {
  if (hours === 0) return "bg-gray-100";
  if (hours <= 2) return "bg-green-200";
  if (hours <= 4) return "bg-green-400";
  return "bg-green-600";
}

export default function DailyTab({ studentId }: DailyTabProps) {
  const supabase = createClient();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("daily_logs")
        .select("*, tasks:daily_tasks(*)")
        .eq("user_id", studentId)
        .order("log_date", { ascending: false })
        .limit(30);

      if (error) throw error;
      setLogs((data as DailyLog[]) ?? []);
    } catch (err) {
      console.error("일일 기록 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Build heatmap data: last 30 days
  const heatmapData = useCallback(() => {
    const today = startOfDay(new Date());
    const hoursMap = new Map<string, number>();
    logs.forEach((log) => {
      hoursMap.set(log.log_date, log.study_hours);
    });

    const days: { date: Date; dateStr: string; hours: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      days.push({
        date,
        dateStr,
        hours: hoursMap.get(dateStr) ?? 0,
      });
    }
    return days;
  }, [logs]);

  // Build weekly chart data: last 7 days
  const weeklyChartData = useCallback(() => {
    const today = startOfDay(new Date());
    const hoursMap = new Map<string, number>();
    logs.forEach((log) => {
      hoursMap.set(log.log_date, log.study_hours);
    });

    const data: { name: string; hours: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, "yyyy-MM-dd");
      const dayIndex = getDay(date); // 0=Sun
      data.push({
        name: DAY_NAMES[dayIndex],
        hours: hoursMap.get(dateStr) ?? 0,
      });
    }
    return data;
  }, [logs]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="h-32 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          아직 일일 기록이 없습니다
        </h3>
        <p className="text-gray-500 text-sm">
          학생이 일일 기록을 작성하면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  const heatmap = heatmapData();
  const weeklyData = weeklyChartData();

  // Arrange heatmap into 5 rows x 7 cols (reading order: left-to-right, top-to-bottom)
  // We pad to 35 cells: first few may be empty
  const paddedHeatmap = [
    ...Array(35 - heatmap.length).fill(null),
    ...heatmap,
  ];

  const heatmapGrid: (typeof heatmap[number] | null)[][] = [];
  for (let row = 0; row < 5; row++) {
    heatmapGrid.push(paddedHeatmap.slice(row * 7, row * 7 + 7));
  }

  return (
    <div className="space-y-6">
      {/* Mini Heatmap */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          30일 학습 히트맵
        </h3>
        <div className="flex flex-col items-center gap-1">
          {heatmapGrid.map((row, rowIdx) => (
            <div key={rowIdx} className="flex gap-1">
              {row.map((cell, colIdx) => (
                <div
                  key={`${rowIdx}-${colIdx}`}
                  className={`w-4 h-4 rounded-sm ${
                    cell ? getHeatmapColor(cell.hours) : "bg-gray-50"
                  }`}
                  title={
                    cell
                      ? `${cell.dateStr}: ${cell.hours}시간`
                      : ""
                  }
                />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center justify-center gap-1 mt-3 text-xs text-gray-400">
          <span>적음</span>
          <span>&larr;</span>
          <div className="w-3 h-3 rounded-sm bg-gray-100" />
          <div className="w-3 h-3 rounded-sm bg-green-200" />
          <div className="w-3 h-3 rounded-sm bg-green-400" />
          <div className="w-3 h-3 rounded-sm bg-green-600" />
          <span>&rarr;</span>
          <span>많음</span>
        </div>
      </div>

      {/* Weekly Study Hours Bar Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          주간 학습 시간
        </h3>
        <div className="w-full h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={weeklyData}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#6B7280" }}
                axisLine={false}
                tickLine={false}
                width={30}
              />
              <Tooltip
                formatter={(value) => [`${value}시간`, "학습"]}
                contentStyle={{
                  borderRadius: "8px",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                }}
              />
              <Bar
                dataKey="hours"
                fill="#7C3AED"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </RechartsBarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Logs List */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          최근 기록
        </h3>
        <div>
          {logs.map((log) => {
            const completedTasks = log.tasks?.filter(
              (t) => t.is_completed
            ).length ?? 0;
            const totalTasks = log.tasks?.length ?? 0;

            return (
              <div
                key={log.id}
                className="bg-gray-50 rounded-lg p-4 mb-3 last:mb-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900">
                      {format(new Date(log.log_date), "M월 d일 (EEE)", {
                        locale: ko,
                      })}
                    </span>
                    <span className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                      {log.study_hours}시간
                    </span>
                  </div>
                  {log.mood && (
                    <span className="text-lg" title={`기분: ${log.mood}/5`}>
                      {MOOD_EMOJI[log.mood] ?? ""}
                    </span>
                  )}
                </div>

                {log.daily_goal && (
                  <p className="text-sm text-gray-600 mb-2">
                    {log.daily_goal}
                  </p>
                )}

                {totalTasks > 0 && (
                  <p className="text-xs text-gray-400">
                    할 일: {completedTasks}/{totalTasks} 완료
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
