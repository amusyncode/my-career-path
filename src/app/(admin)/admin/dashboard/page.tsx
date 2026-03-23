"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { format, subMonths, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import dynamic from "next/dynamic";
import {
  UserCog,
  Users,
  Sparkles,
  Mail,
  UserPlus,
  ArrowRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";

// Recharts dynamic imports
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

// --- Interfaces ---

interface StatsData {
  totalInstructors: number;
  activeInstructors: number;
  inactiveInstructors: number;
  totalStudents: number;
  highSchoolStudents: number;
  universityStudents: number;
  monthlyAiReviews: number;
  avgAiScore: number;
  monthlyEmails: number;
  failedEmails: number;
  newInstructorsThisMonth: number;
  newStudentsThisMonth: number;
}

interface MonthlyTrend {
  month: string;
  instructors: number;
  students: number;
}

interface InstructorStudentCount {
  id: string;
  name: string;
  school: string | null;
  studentCount: number;
}

interface RecentInstructor {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  studentCount: number;
  hasApiKey: boolean;
  created_at: string;
}

interface RecentStudent {
  id: string;
  name: string;
  school: string | null;
  education_level: string;
  instructor_name: string | null;
  created_at: string;
}

interface ScoreDistribution {
  range: string;
  count: number;
  color: string;
}

const SCORE_COLORS = ["#EF4444", "#F97316", "#EAB308", "#84CC16", "#22C55E"];

export default function SuperAdminDashboardPage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsData>({
    totalInstructors: 0,
    activeInstructors: 0,
    inactiveInstructors: 0,
    totalStudents: 0,
    highSchoolStudents: 0,
    universityStudents: 0,
    monthlyAiReviews: 0,
    avgAiScore: 0,
    monthlyEmails: 0,
    failedEmails: 0,
    newInstructorsThisMonth: 0,
    newStudentsThisMonth: 0,
  });
  const [monthlyTrend, setMonthlyTrend] = useState<MonthlyTrend[]>([]);
  const [topInstructors, setTopInstructors] = useState<InstructorStudentCount[]>([]);
  const [recentInstructors, setRecentInstructors] = useState<RecentInstructor[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution[]>([]);

  useEffect(() => {
    fetchDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchDashboard() {
    try {
      setLoading(true);
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();

      // --- Parallel queries for stats ---
      const [
        instructorsRes,
        studentsRes,
        monthlyReviewsRes,
        monthlyReviewScoresRes,
        monthlyEmailsSentRes,
        monthlyEmailsFailedRes,
        newInstructorsRes,
        newStudentsRes,
        allProfilesRes,
        allReviewScoresRes,
      ] = await Promise.all([
        // All instructors
        supabase
          .from("profiles")
          .select("id, is_active", { count: "exact" })
          .eq("role", "instructor"),
        // All students
        supabase
          .from("profiles")
          .select("id, education_level", { count: "exact" })
          .eq("role", "student"),
        // Monthly AI reviews count
        supabase
          .from("ai_review_results")
          .select("id", { count: "exact", head: true })
          .gte("reviewed_at", monthStart),
        // Monthly AI review scores (for average)
        supabase
          .from("ai_review_results")
          .select("overall_score")
          .gte("reviewed_at", monthStart)
          .not("overall_score", "is", null),
        // Monthly emails sent
        supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .eq("status", "sent"),
        // Monthly emails failed
        supabase
          .from("email_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .eq("status", "failed"),
        // New instructors this month
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "instructor")
          .gte("created_at", monthStart),
        // New students this month
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student")
          .gte("created_at", monthStart),
        // All profiles for trend chart (last 6 months)
        supabase
          .from("profiles")
          .select("role, created_at")
          .in("role", ["instructor", "student"])
          .gte("created_at", subMonths(now, 6).toISOString()),
        // All AI review scores for distribution
        supabase
          .from("ai_review_results")
          .select("overall_score")
          .not("overall_score", "is", null),
      ]);

      // --- Process stats ---
      const activeInstructors = instructorsRes.data?.filter((i) => i.is_active).length ?? 0;
      const totalInstructors = instructorsRes.count ?? 0;

      const highSchoolStudents = studentsRes.data?.filter((s) => s.education_level === "high_school").length ?? 0;
      const universityStudents = studentsRes.data?.filter((s) => s.education_level === "university").length ?? 0;

      const scores = monthlyReviewScoresRes.data?.map((r) => r.overall_score as number) ?? [];
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      setStats({
        totalInstructors,
        activeInstructors,
        inactiveInstructors: totalInstructors - activeInstructors,
        totalStudents: studentsRes.count ?? 0,
        highSchoolStudents,
        universityStudents,
        monthlyAiReviews: monthlyReviewsRes.count ?? 0,
        avgAiScore: avgScore,
        monthlyEmails: monthlyEmailsSentRes.count ?? 0,
        failedEmails: monthlyEmailsFailedRes.count ?? 0,
        newInstructorsThisMonth: newInstructorsRes.count ?? 0,
        newStudentsThisMonth: newStudentsRes.count ?? 0,
      });

      // --- Monthly signup trend (last 6 months) ---
      if (allProfilesRes.data) {
        const trendMap = new Map<string, { instructors: number; students: number }>();
        for (let i = 5; i >= 0; i--) {
          const d = subMonths(now, i);
          const key = format(d, "yyyy-MM");
          trendMap.set(key, { instructors: 0, students: 0 });
        }
        allProfilesRes.data.forEach((p) => {
          const key = p.created_at.slice(0, 7); // "yyyy-MM"
          const entry = trendMap.get(key);
          if (entry) {
            if (p.role === "instructor") entry.instructors++;
            else if (p.role === "student") entry.students++;
          }
        });
        const trend: MonthlyTrend[] = [];
        trendMap.forEach((val, key) => {
          trend.push({
            month: format(new Date(key + "-01"), "M월", { locale: ko }),
            instructors: val.instructors,
            students: val.students,
          });
        });
        setMonthlyTrend(trend);
      }

      // --- Top 10 instructors by student count ---
      if (instructorsRes.data && studentsRes.data) {
        // Fetch instructor names/schools
        const instructorIds = instructorsRes.data.map((i) => i.id);
        const { data: instructorProfiles } = await supabase
          .from("profiles")
          .select("id, name, school")
          .in("id", instructorIds);

        // Fetch all students with instructor_id
        const { data: allStudents } = await supabase
          .from("profiles")
          .select("instructor_id")
          .eq("role", "student")
          .not("instructor_id", "is", null);

        const countMap = new Map<string, number>();
        allStudents?.forEach((s) => {
          if (s.instructor_id) {
            countMap.set(s.instructor_id, (countMap.get(s.instructor_id) || 0) + 1);
          }
        });

        const ranked: InstructorStudentCount[] = (instructorProfiles || [])
          .map((ip) => ({
            id: ip.id,
            name: ip.name,
            school: ip.school,
            studentCount: countMap.get(ip.id) || 0,
          }))
          .sort((a, b) => b.studentCount - a.studentCount)
          .slice(0, 10);

        setTopInstructors(ranked);

        // --- Recent 5 instructors ---
        const { data: recentInst } = await supabase
          .from("profiles")
          .select("id, name, email, school, gemini_api_key, created_at")
          .eq("role", "instructor")
          .order("created_at", { ascending: false })
          .limit(5);

        if (recentInst) {
          setRecentInstructors(
            recentInst.map((ri) => ({
              id: ri.id,
              name: ri.name,
              email: ri.email,
              school: ri.school,
              studentCount: countMap.get(ri.id) || 0,
              hasApiKey: !!ri.gemini_api_key,
              created_at: ri.created_at,
            }))
          );
        }
      }

      // --- Recent 5 students with instructor name ---
      const { data: recentStud } = await supabase
        .from("profiles")
        .select("id, name, school, education_level, instructor_id, created_at")
        .eq("role", "student")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentStud) {
        const instructorIds = Array.from(
          new Set(recentStud.map((s) => s.instructor_id).filter(Boolean))
        );
        let nameMap = new Map<string, string>();
        if (instructorIds.length > 0) {
          const { data: instNames } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", instructorIds);
          if (instNames) {
            nameMap = new Map(instNames.map((n) => [n.id, n.name]));
          }
        }
        setRecentStudents(
          recentStud.map((s) => ({
            id: s.id,
            name: s.name,
            school: s.school,
            education_level: s.education_level,
            instructor_name: s.instructor_id ? nameMap.get(s.instructor_id) || null : null,
            created_at: s.created_at,
          }))
        );
      }

      // --- AI Score Distribution ---
      if (allReviewScoresRes.data) {
        const ranges = [
          { range: "0-20", min: 0, max: 20, color: SCORE_COLORS[0] },
          { range: "21-40", min: 21, max: 40, color: SCORE_COLORS[1] },
          { range: "41-60", min: 41, max: 60, color: SCORE_COLORS[2] },
          { range: "61-80", min: 61, max: 80, color: SCORE_COLORS[3] },
          { range: "81-100", min: 81, max: 100, color: SCORE_COLORS[4] },
        ];
        const dist: ScoreDistribution[] = ranges.map((r) => ({
          range: r.range,
          count: allReviewScoresRes.data!.filter(
            (d) => (d.overall_score as number) >= r.min && (d.overall_score as number) <= r.max
          ).length,
          color: r.color,
        }));
        setScoreDistribution(dist);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- Stat card helper ---
  const statCards = [
    {
      label: "전체 강사 수",
      value: stats.totalInstructors,
      sub: `활성 ${stats.activeInstructors}명 · 비활성 ${stats.inactiveInstructors}명`,
      icon: UserCog,
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
    },
    {
      label: "전체 학생 수",
      value: stats.totalStudents,
      sub: `특성화고 ${stats.highSchoolStudents}명 · 대학생 ${stats.universityStudents}명`,
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "이번 달 AI 첨삭",
      value: stats.monthlyAiReviews,
      sub: `평균 ${stats.avgAiScore}점`,
      icon: Sparkles,
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      label: "이번 달 이메일",
      value: stats.monthlyEmails,
      sub: `실패 ${stats.failedEmails}건`,
      icon: Mail,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      label: "이번 달 신규 강사",
      value: stats.newInstructorsThisMonth,
      sub: "",
      icon: UserPlus,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
    {
      label: "이번 달 신규 학생",
      value: stats.newStudentsThisMonth,
      sub: "",
      icon: UserPlus,
      iconBg: "bg-cyan-100",
      iconColor: "text-cyan-600",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">플랫폼 전체 현황을 확인하세요</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-lg ${card.iconBg}`}>
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <span className="text-sm text-gray-500 font-medium">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {card.value.toLocaleString()}
                <span className="text-base font-normal text-gray-400 ml-1">
                  {card.label.includes("이메일") ? "건" : "명"}
                </span>
              </p>
              {card.sub && (
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Monthly Signup Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">월별 가입 추이</h2>
          {monthlyTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" fontSize={12} tick={{ fill: "#6b7280" }} />
                <YAxis fontSize={12} tick={{ fill: "#6b7280" }} allowDecimals={false} />
                <Tooltip
                  formatter={(value, name) => [
                    `${value}명`,
                    name === "instructors" ? "강사" : "학생",
                  ]}
                />
                <Legend
                  formatter={(value) =>
                    value === "instructors" ? "강사" : "학생"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="instructors"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="students"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              데이터가 없습니다
            </div>
          )}
        </div>

        {/* Top 10 Instructors by Student Count */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            강사별 학생 수 TOP 10
          </h2>
          {topInstructors.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={topInstructors}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" fontSize={12} tick={{ fill: "#6b7280" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  fontSize={12}
                  tick={{ fill: "#6b7280" }}
                  width={80}
                />
                <Tooltip
                  formatter={(value) => [`${value}명`, "학생 수"]}
                />
                <Bar dataKey="studentCount" fill="#F87171" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">
              데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* Recent Instructors Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">최근 가입 강사</h2>
          <Link
            href="/admin/instructors"
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
          >
            전체보기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentInstructors.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">이름</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">이메일</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">소속</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">학생 수</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">API 키</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {recentInstructors.map((inst) => (
                  <tr key={inst.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-medium text-gray-900">{inst.name}</td>
                    <td className="py-3 px-3 text-gray-500">{inst.email || "-"}</td>
                    <td className="py-3 px-3 text-gray-500">{inst.school || "-"}</td>
                    <td className="py-3 px-3 text-center text-gray-700">{inst.studentCount}명</td>
                    <td className="py-3 px-3 text-center">
                      {inst.hasApiKey ? (
                        <span className="text-green-600">&#10003;</span>
                      ) : (
                        <span className="text-red-400">&#10007;</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-gray-500">
                      {format(new Date(inst.created_at), "yyyy.MM.dd", { locale: ko })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">등록된 강사가 없습니다</p>
        )}
      </div>

      {/* Recent Students Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">최근 등록 학생</h2>
          <Link
            href="/admin/students"
            className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1"
          >
            전체보기 <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">이름</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">학교</th>
                  <th className="text-center py-3 px-3 text-gray-500 font-medium">학교급</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">담당 강사</th>
                  <th className="text-left py-3 px-3 text-gray-500 font-medium">등록일</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((stu) => (
                  <tr key={stu.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-3 px-3 font-medium text-gray-900">{stu.name}</td>
                    <td className="py-3 px-3 text-gray-500">{stu.school || "-"}</td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          stu.education_level === "high_school"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {stu.education_level === "high_school" ? "특성화고" : "대학생"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-500">{stu.instructor_name || "-"}</td>
                    <td className="py-3 px-3 text-gray-500">
                      {format(new Date(stu.created_at), "yyyy.MM.dd", { locale: ko })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">등록된 학생이 없습니다</p>
        )}
      </div>

      {/* AI Score Distribution Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">AI 첨삭 점수 분포</h2>
        {scoreDistribution.some((d) => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" fontSize={12} tick={{ fill: "#6b7280" }} />
              <YAxis fontSize={12} tick={{ fill: "#6b7280" }} allowDecimals={false} />
              <Tooltip
                formatter={(value) => [`${value}건`, "건수"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {scoreDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
            첨삭 데이터가 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
