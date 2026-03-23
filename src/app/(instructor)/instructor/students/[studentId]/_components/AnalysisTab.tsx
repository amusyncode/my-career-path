"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { BarChart3 } from "lucide-react";
import { subDays, format } from "date-fns";
import dynamic from "next/dynamic";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });

interface AnalysisTabProps {
  studentId: string;
  hasAuth?: boolean;
}

const COLORS = ["#a855f7", "#3b82f6", "#22c55e", "#eab308", "#ef4444"];

export default function AnalysisTab({ studentId, hasAuth }: AnalysisTabProps) {
  const supabase = createClient();
  const [studyData, setStudyData] = useState<{ date: string; hours: number }[]>([]);
  const [goalData, setGoalData] = useState<{ name: string; value: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEnoughData, setHasEnoughData] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");

      const [logsRes, goalsRes] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("log_date, study_hours")
          .eq("user_id", studentId)
          .gte("log_date", thirtyDaysAgo)
          .order("log_date"),
        supabase
          .from("roadmap_goals")
          .select("status")
          .eq("user_id", studentId),
      ]);

      const logs = logsRes.data ?? [];
      setHasEnoughData(logs.length >= 7);

      // Study trend data
      const studyMap = new Map<string, number>();
      logs.forEach((l) => {
        studyMap.set(l.log_date, (studyMap.get(l.log_date) ?? 0) + l.study_hours);
      });
      const trend: { date: string; hours: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "yyyy-MM-dd");
        trend.push({ date: format(new Date(d), "M/d"), hours: studyMap.get(d) ?? 0 });
      }
      setStudyData(trend);

      // Goal status pie
      const goals = goalsRes.data ?? [];
      const statusCount: Record<string, number> = {};
      goals.forEach((g) => {
        statusCount[g.status] = (statusCount[g.status] ?? 0) + 1;
      });
      const STATUS_NAMES: Record<string, string> = {
        planned: "계획됨",
        in_progress: "진행중",
        completed: "완료",
        paused: "일시중지",
      };
      const pieData = Object.entries(statusCount).map(([k, v]) => ({
        name: STATUS_NAMES[k] ?? k,
        value: v,
      }));
      setGoalData(pieData);
    } catch (err) {
      console.error("분석 데이터 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-xl p-6 animate-pulse dark:bg-gray-800">
          <div className="h-48 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  if (hasAuth === false) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 dark:text-gray-400">
          이 학생은 아직 가입하지 않아 분석 데이터가 없습니다
        </p>
      </div>
    );
  }

  if (!hasEnoughData) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          분석에 필요한 데이터가 부족합니다
        </h3>
        <p className="text-gray-500 text-sm dark:text-gray-400">
          최소 7일 이상 기록이 필요합니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Study hours trend */}
      <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 dark:text-white">
          학습시간 추이 (30일)
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={studyData}>
              <defs>
                <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#a855f7"
                fillOpacity={1}
                fill="url(#colorHours)"
                name="학습시간(h)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Goal completion pie */}
      {goalData.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6 dark:bg-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 dark:text-white">
            목표 완료율
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={goalData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}`}
                >
                  {goalData.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
