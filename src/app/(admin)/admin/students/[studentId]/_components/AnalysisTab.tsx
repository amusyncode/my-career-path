"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase";
import { BarChart3 } from "lucide-react";
import { format } from "date-fns";
import dynamic from "next/dynamic";

// Dynamic imports for all recharts components with ssr: false
const RechartsAreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);
const RechartsPieChart = dynamic(
  () => import("recharts").then((m) => m.PieChart),
  { ssr: false }
);
const Pie = dynamic(
  () => import("recharts").then((m) => m.Pie),
  { ssr: false }
);
const Cell = dynamic(
  () => import("recharts").then((m) => m.Cell),
  { ssr: false }
);
const RechartsRadarChart = dynamic(
  () => import("recharts").then((m) => m.RadarChart),
  { ssr: false }
);
const Radar = dynamic(
  () => import("recharts").then((m) => m.Radar),
  { ssr: false }
);
const PolarGrid = dynamic(
  () => import("recharts").then((m) => m.PolarGrid),
  { ssr: false }
);
const PolarAngleAxis = dynamic(
  () => import("recharts").then((m) => m.PolarAngleAxis),
  { ssr: false }
);
const PolarRadiusAxis = dynamic(
  () => import("recharts").then((m) => m.PolarRadiusAxis),
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
const Legend = dynamic(
  () => import("recharts").then((m) => m.Legend),
  { ssr: false }
);
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);

interface DailyLogEntry {
  log_date: string;
  study_hours: number;
}

interface GoalEntry {
  status: string;
}

interface SkillEntry {
  name: string;
  level: number;
  category: string | null;
}

interface AnalysisTabProps {
  studentId: string;
}

const GOAL_STATUS_COLORS: Record<string, string> = {
  planned: "#9CA3AF",
  in_progress: "#3B82F6",
  completed: "#10B981",
  paused: "#F59E0B",
};

const GOAL_STATUS_LABELS: Record<string, string> = {
  planned: "\uACC4\uD68D",
  in_progress: "\uC9C4\uD589\uC911",
  completed: "\uC644\uB8CC",
  paused: "\uC77C\uC2DC\uC911\uC9C0",
};

export default function AnalysisTab({ studentId }: AnalysisTabProps) {
  const supabase = createClient();
  const [logs, setLogs] = useState<DailyLogEntry[]>([]);
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalysisData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [logsRes, goalsRes, skillsRes] = await Promise.all([
        supabase
          .from("daily_logs")
          .select("log_date, study_hours")
          .eq("user_id", studentId)
          .order("log_date", { ascending: true })
          .limit(30),
        supabase
          .from("roadmap_goals")
          .select("status")
          .eq("user_id", studentId),
        supabase
          .from("skills")
          .select("name, level, category")
          .eq("user_id", studentId),
      ]);

      if (logsRes.error) throw logsRes.error;
      if (goalsRes.error) throw goalsRes.error;
      if (skillsRes.error) throw skillsRes.error;

      setLogs((logsRes.data as DailyLogEntry[]) ?? []);
      setGoals((goalsRes.data as GoalEntry[]) ?? []);
      setSkills((skillsRes.data as SkillEntry[]) ?? []);
    } catch (err) {
      console.error("분석 데이터 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  // Area chart data: format dates
  const areaChartData = useMemo(() => {
    return logs.map((log) => ({
      date: format(new Date(log.log_date), "MM/dd"),
      hours: log.study_hours,
    }));
  }, [logs]);

  // Pie chart data: count by status
  const pieChartData = useMemo(() => {
    const countMap: Record<string, number> = {};
    goals.forEach((goal) => {
      countMap[goal.status] = (countMap[goal.status] ?? 0) + 1;
    });

    return Object.entries(countMap).map(([status, count]) => ({
      name: GOAL_STATUS_LABELS[status] ?? status,
      value: count,
      status,
    }));
  }, [goals]);

  // Radar chart data: skills
  const radarChartData = useMemo(() => {
    return skills.map((skill) => ({
      name: skill.name,
      level: skill.level,
      fullMark: 5,
    }));
  }, [skills]);

  const hasEnoughData = logs.length >= 7;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!hasEnoughData && goals.length === 0 && skills.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          분석에 필요한 데이터가 부족합니다
        </h3>
        <p className="text-gray-500 text-sm">
          최소 7일 이상의 기록이 필요합니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Study Hours Trend - Area Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          학습 시간 추이 (30일)
        </h3>
        {areaChartData.length > 0 ? (
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsAreaChart data={areaChartData}>
                <defs>
                  <linearGradient
                    id="studyHoursGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="#7C3AED"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="#7C3AED"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  formatter={(value) => [
                    `${value}시간`,
                    "학습",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#7C3AED"
                  strokeWidth={2}
                  fill="url(#studyHoursGradient)"
                />
              </RechartsAreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
            학습 기록이 없습니다
          </div>
        )}
      </div>

      {/* Goal Completion - Pie Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          목표 달성 현황
        </h3>
        {pieChartData.length > 0 ? (
          <div className="w-full h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({
                    name,
                    percent,
                  }: {
                    name?: string;
                    percent?: number;
                  }) =>
                    `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        GOAL_STATUS_COLORS[entry.status] ??
                        "#9CA3AF"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [
                    `${value}개`,
                    `${name}`,
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  formatter={(value: string) => (
                    <span className="text-xs text-gray-600">
                      {value}
                    </span>
                  )}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[250px] flex items-center justify-center text-sm text-gray-400">
            설정된 목표가 없습니다
          </div>
        )}
      </div>

      {/* Skills Radar Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          스킬 분포
        </h3>
        {radarChartData.length > 0 ? (
          <div className="w-full h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsRadarChart
                cx="50%"
                cy="50%"
                outerRadius="70%"
                data={radarChartData}
              >
                <PolarGrid stroke="#E5E7EB" />
                <PolarAngleAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#6B7280" }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 5]}
                  tick={{ fontSize: 10, fill: "#9CA3AF" }}
                  tickCount={6}
                />
                <Radar
                  name="스킬 레벨"
                  dataKey="level"
                  stroke="#7C3AED"
                  fill="#7C3AED"
                  fillOpacity={0.5}
                />
                <Tooltip
                  formatter={(value) => [
                    `레벨 ${value}`,
                    "스킬",
                  ]}
                  contentStyle={{
                    borderRadius: "8px",
                    border: "1px solid #E5E7EB",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                />
              </RechartsRadarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-sm text-gray-400">
            등록된 스킬이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
