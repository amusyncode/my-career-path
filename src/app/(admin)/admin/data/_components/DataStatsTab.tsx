"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import dynamic from "next/dynamic";
import {
  Users,
  Target,
  FolderOpen,
  Award,
  CalendarDays,
  Wrench,
  FileText,
  MessageSquareHeart,
} from "lucide-react";

const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), {
  ssr: false,
});
const RBarChart = dynamic(() => import("recharts").then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), {
  ssr: false,
});
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
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

interface StatCard {
  label: string;
  count: number;
  icon: typeof Users;
  color: string;
}

const GRADE_COLORS = ["#8B5CF6", "#A78BFA", "#C4B5FD"];

export default function DataStatsTab() {
  const supabase = createClient();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [gradeData, setGradeData] = useState<{ name: string; value: number }[]>(
    []
  );
  const [deptData, setDeptData] = useState<{ name: string; count: number }[]>(
    []
  );
  const [monthlyData, setMonthlyData] = useState<
    { month: string; students: number; projects: number; certs: number; logs: number }[]
  >([]);
  const [rankingData, setRankingData] = useState<
    {
      rank: number;
      name: string;
      school: string;
      studyHours: number;
      logDays: number;
      projects: number;
      score: number;
    }[]
  >([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        // 기본 카운트들 병렬 조회
        const [
          profilesRes,
          goalsRes,
          projectsRes,
          certsRes,
          logsRes,
          skillsRes,
          resumesRes,
          clRes,
          counselingRes,
        ] = await Promise.all([
          supabase.from("profiles").select("id", { count: "exact" }).eq("role", "student"),
          supabase.from("roadmap_goals").select("id", { count: "exact" }),
          supabase.from("projects").select("id", { count: "exact" }),
          supabase.from("certificates").select("id", { count: "exact" }),
          supabase.from("daily_logs").select("id", { count: "exact" }),
          supabase.from("skills").select("id", { count: "exact" }),
          supabase.from("uploaded_resumes").select("id", { count: "exact" }),
          supabase.from("uploaded_cover_letters").select("id", { count: "exact" }),
          supabase.from("counseling_records").select("id", { count: "exact" }),
        ]);

        const studentCount = profilesRes.count || 0;
        setTotalStudents(studentCount);

        setStats([
          { label: "총 학생 수", count: studentCount, icon: Users, color: "bg-purple-100 text-purple-600" },
          { label: "총 로드맵 목표", count: goalsRes.count || 0, icon: Target, color: "bg-blue-100 text-blue-600" },
          { label: "총 프로젝트", count: projectsRes.count || 0, icon: FolderOpen, color: "bg-green-100 text-green-600" },
          { label: "총 자격증", count: certsRes.count || 0, icon: Award, color: "bg-yellow-100 text-yellow-600" },
          { label: "총 일일 기록", count: logsRes.count || 0, icon: CalendarDays, color: "bg-orange-100 text-orange-600" },
          { label: "총 스킬", count: skillsRes.count || 0, icon: Wrench, color: "bg-cyan-100 text-cyan-600" },
          { label: "총 이력서/자소서", count: (resumesRes.count || 0) + (clRes.count || 0), icon: FileText, color: "bg-indigo-100 text-indigo-600" },
          { label: "총 상담 기록", count: counselingRes.count || 0, icon: MessageSquareHeart, color: "bg-pink-100 text-pink-600" },
        ]);

        // 학년별 분포
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("grade, department")
          .eq("role", "student");

        if (allProfiles) {
          const gradeMap = new Map<number, number>();
          const deptMap = new Map<string, number>();
          allProfiles.forEach((p) => {
            if (p.grade) gradeMap.set(p.grade, (gradeMap.get(p.grade) || 0) + 1);
            if (p.department) deptMap.set(p.department, (deptMap.get(p.department) || 0) + 1);
          });
          setGradeData(
            [1, 2, 3].map((g) => ({
              name: `${g}학년`,
              value: gradeMap.get(g) || 0,
            }))
          );
          setDeptData(
            Array.from(deptMap.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([name, count]) => ({ name, count }))
          );
        }

        // 월별 데이터 (최근 6개월)
        const now = new Date();
        const months: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
        }

        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
          .toISOString()
          .slice(0, 10);

        const [mProfiles, mProjects, mCerts, mLogs] = await Promise.all([
          supabase.from("profiles").select("created_at").eq("role", "student").gte("created_at", sixMonthsAgo),
          supabase.from("projects").select("created_at").gte("created_at", sixMonthsAgo),
          supabase.from("certificates").select("created_at").gte("created_at", sixMonthsAgo),
          supabase.from("daily_logs").select("created_at").gte("created_at", sixMonthsAgo),
        ]);

        const countByMonth = (data: { created_at: string }[] | null, m: string) =>
          (data || []).filter((r) => r.created_at?.startsWith(m)).length;

        setMonthlyData(
          months.map((m) => ({
            month: m.slice(5) + "월",
            students: countByMonth(mProfiles.data, m),
            projects: countByMonth(mProjects.data, m),
            certs: countByMonth(mCerts.data, m),
            logs: countByMonth(mLogs.data, m),
          }))
        );

        // 학생 활동 랭킹 (이번 달)
        const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const { data: thisMonthLogs } = await supabase
          .from("daily_logs")
          .select("user_id, study_hours, log_date")
          .gte("log_date", `${thisMonth}-01`);

        const { data: allStudents } = await supabase
          .from("profiles")
          .select("id, name, school")
          .eq("role", "student");

        const { data: allPrjs } = await supabase
          .from("projects")
          .select("user_id")
          .gte("created_at", `${thisMonth}-01`);

        const { data: allCrts } = await supabase
          .from("certificates")
          .select("user_id")
          .gte("created_at", `${thisMonth}-01`);

        if (allStudents) {
          const ranking = allStudents.map((s) => {
            const sLogs = (thisMonthLogs || []).filter((l) => l.user_id === s.id);
            const studyHours = sLogs.reduce((sum, l) => sum + (l.study_hours || 0), 0);
            const logDays = new Set(sLogs.map((l) => l.log_date)).size;
            const projects = (allPrjs || []).filter((p) => p.user_id === s.id).length;
            const certs = (allCrts || []).filter((c) => c.user_id === s.id).length;
            const score = studyHours * 2 + logDays * 3 + projects * 10 + certs * 15;
            return {
              rank: 0,
              name: s.name || "이름없음",
              school: s.school || "",
              studyHours: Math.round(studyHours * 10) / 10,
              logDays,
              projects,
              score,
            };
          });
          ranking.sort((a, b) => b.score - a.score);
          ranking.forEach((r, i) => (r.rank = i + 1));
          setRankingData(ranking.slice(0, 10));
        }
      } catch (err) {
        console.error("통계 조회 오류:", err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [supabase]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="h-72 bg-gray-200 rounded-xl" />
          <div className="h-72 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3"
            >
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {s.count.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 차트 영역 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 학년별 분포 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">학년별 학생 분포</h3>
          {totalStudents === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              학생 데이터가 없습니다
            </p>
          ) : (
            <div className="h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gradeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {gradeData.map((_, i) => (
                      <Cell key={i} fill={GRADE_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">
                    {totalStudents}
                  </p>
                  <p className="text-xs text-gray-500">총 학생</p>
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2">
            {gradeData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-1.5 text-sm">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: GRADE_COLORS[i] }}
                />
                {d.name} ({d.value}명)
              </div>
            ))}
          </div>
        </div>

        {/* 학과별 분포 */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-4">학과별 학생 분포</h3>
          {deptData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">
              학과 데이터가 없습니다
            </p>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RBarChart data={deptData} layout="vertical">
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="학생 수" />
                </RBarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 월별 데이터 추이 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          월별 데이터 증가 추이
        </h3>
        {monthlyData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-12">
            데이터가 부족합니다
          </p>
        ) : (
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="students"
                  stroke="#8B5CF6"
                  name="신규 학생"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="projects"
                  stroke="#3B82F6"
                  name="프로젝트"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="certs"
                  stroke="#10B981"
                  name="자격증"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="logs"
                  stroke="#F59E0B"
                  name="일일 기록"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* 학생 활동 랭킹 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          학생 활동 랭킹 (이번 달)
        </h3>
        {rankingData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            이번 달 활동 데이터가 없습니다
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    순위
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">
                    학생
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    학습시간
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    기록일수
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    프로젝트
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">
                    점수
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankingData.map((r) => (
                  <tr
                    key={r.rank}
                    className={`border-b border-gray-50 ${
                      r.rank === 1
                        ? "bg-yellow-50"
                        : r.rank === 2
                        ? "bg-gray-50"
                        : r.rank === 3
                        ? "bg-orange-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-gray-700">
                      {r.rank === 1
                        ? "🥇"
                        : r.rank === 2
                        ? "🥈"
                        : r.rank === 3
                        ? "🥉"
                        : r.rank}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{r.name}</p>
                      {r.school && (
                        <p className="text-xs text-gray-400">{r.school}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.studyHours}시간
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.logDays}일
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {r.projects}개
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-purple-600">
                      {r.score}점
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
