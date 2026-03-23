"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase";
import {
  Users,
  FileText,
  Sparkles,
  MessageSquareHeart,
  FolderOpen,
  Award,
  Mail,
  TrendingUp,
  Loader2,
  Trophy,
} from "lucide-react";

const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), { ssr: false });
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), { ssr: false });
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), { ssr: false });
const Line = dynamic(() => import("recharts").then((m) => m.Line), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const CartesianGrid = dynamic(() => import("recharts").then((m) => m.CartesianGrid), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });

interface Props {
  instructorId: string;
}

interface StatCard {
  label: string;
  value: number | string;
  icon: typeof Users;
  color: string;
  bg: string;
}

export default function DataStatsTab({ instructorId }: Props) {
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(true);
  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalDocuments: 0,
    totalReviews: 0,
    totalCounseling: 0,
    totalProjects: 0,
    totalCerts: 0,
    totalEmails: 0,
    avgScore: 0,
  });

  // Charts
  const [eduPieData, setEduPieData] = useState<{ name: string; value: number }[]>([]);
  const [deptBarData, setDeptBarData] = useState<{ name: string; count: number }[]>([]);
  const [monthlyData, setMonthlyData] = useState<{ month: string; students: number; reviews: number; counseling: number; emails: number }[]>([]);
  const [rankingData, setRankingData] = useState<{ rank: number; name: string; education_level: string; studyHours: number; logDays: number; projects: number; score: number }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get students
      const { data: students } = await supabase
        .from("profiles")
        .select("id, name, education_level, department, created_at")
        .eq("instructor_id", instructorId)
        .eq("role", "student");

      const studs = students || [];
      const ids = studs.map((s) => s.id);

      if (ids.length === 0) {
        setIsLoading(false);
        return;
      }

      // Parallel queries
      const [resumeRes, coverRes, reviewRes, counselRes, projRes, certRes, emailRes] = await Promise.all([
        supabase.from("uploaded_resumes").select("id", { count: "exact", head: true }).in("user_id", ids),
        supabase.from("uploaded_cover_letters").select("id", { count: "exact", head: true }).in("user_id", ids),
        supabase.from("ai_review_results").select("score, created_at").eq("instructor_id", instructorId),
        supabase.from("counseling_records").select("created_at").eq("instructor_id", instructorId),
        supabase.from("projects").select("id, user_id, created_at").in("user_id", ids),
        supabase.from("certificates").select("id").in("user_id", ids),
        supabase.from("email_logs").select("created_at").eq("instructor_id", instructorId),
      ]);

      const reviews = reviewRes.data || [];
      const scores = reviews.filter((r) => r.score != null).map((r) => r.score as number);
      const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;

      setStats({
        totalStudents: studs.length,
        totalDocuments: (resumeRes.count || 0) + (coverRes.count || 0),
        totalReviews: reviews.length,
        totalCounseling: (counselRes.data || []).length,
        totalProjects: (projRes.data || []).length,
        totalCerts: (certRes.data || []).length,
        totalEmails: (emailRes.data || []).length,
        avgScore,
      });

      // Education pie
      const hsCount = studs.filter((s) => s.education_level === "high_school").length;
      const uniCount = studs.filter((s) => s.education_level === "university").length;
      setEduPieData([
        { name: "특성화고", value: hsCount },
        { name: "대학교", value: uniCount },
      ]);

      // Department bar
      const deptMap: Record<string, number> = {};
      studs.forEach((s) => {
        const dept = s.department || "미정";
        deptMap[dept] = (deptMap[dept] || 0) + 1;
      });
      const sorted = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
      const top8 = sorted.slice(0, 8).map(([name, count]) => ({ name, count }));
      if (sorted.length > 8) {
        const otherCount = sorted.slice(8).reduce((sum, [, c]) => sum + c, 0);
        top8.push({ name: "기타", count: otherCount });
      }
      setDeptBarData(top8);

      // Monthly trend (last 6 months)
      const now = new Date();
      const months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      }

      const monthlyArr = months.map((m) => {
        const label = m.slice(2).replace("-", ".");
        return {
          month: label,
          students: studs.filter((s) => s.created_at?.startsWith(m)).length,
          reviews: reviews.filter((r) => r.created_at?.startsWith(m)).length,
          counseling: (counselRes.data || []).filter((c) => c.created_at?.startsWith(m)).length,
          emails: (emailRes.data || []).filter((e) => e.created_at?.startsWith(m)).length,
        };
      });
      setMonthlyData(monthlyArr);

      // Student ranking (this month)
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const { data: dailyLogs } = await supabase
        .from("daily_logs")
        .select("user_id, study_hours, log_date")
        .in("user_id", ids)
        .gte("log_date", thisMonth + "-01");

      const rankMap: Record<string, { studyHours: number; logDays: number; projects: number }> = {};
      ids.forEach((id) => { rankMap[id] = { studyHours: 0, logDays: 0, projects: 0 }; });

      (dailyLogs || []).forEach((log) => {
        if (rankMap[log.user_id]) {
          rankMap[log.user_id].studyHours += log.study_hours || 0;
          rankMap[log.user_id].logDays += 1;
        }
      });

      (projRes.data || []).forEach((p) => {
        if (p.created_at?.startsWith(thisMonth) && rankMap[p.user_id]) {
          rankMap[p.user_id].projects += 1;
        }
      });

      const ranking = ids.map((id) => {
        const s = studs.find((st) => st.id === id)!;
        const r = rankMap[id];
        const score = r.studyHours * 2 + r.logDays * 3 + r.projects * 10;
        return {
          rank: 0,
          name: s.name,
          education_level: s.education_level,
          studyHours: Math.round(r.studyHours * 10) / 10,
          logDays: r.logDays,
          projects: r.projects,
          score,
        };
      })
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((r, i) => ({ ...r, rank: i + 1 }));

      setRankingData(ranking);
    } catch (err) {
      console.error("Stats fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase, instructorId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  const PIE_COLORS = ["#8B5CF6", "#3B82F6"];

  const statCards: StatCard[] = [
    { label: "총 학생 수", value: stats.totalStudents, icon: Users, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20" },
    { label: "총 이력서/자소서", value: stats.totalDocuments, icon: FileText, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20" },
    { label: "총 AI 첨삭", value: stats.totalReviews, icon: Sparkles, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20" },
    { label: "총 상담 기록", value: stats.totalCounseling, icon: MessageSquareHeart, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/20" },
    { label: "총 프로젝트", value: stats.totalProjects, icon: FolderOpen, color: "text-cyan-600", bg: "bg-cyan-50 dark:bg-cyan-900/20" },
    { label: "총 자격증", value: stats.totalCerts, icon: Award, color: "text-pink-600", bg: "bg-pink-50 dark:bg-pink-900/20" },
    { label: "총 이메일 발송", value: stats.totalEmails, icon: Mail, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/20" },
    { label: "평균 AI 점수", value: stats.avgScore, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20" },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-5 h-5 ${card.color}`} />
              <span className="text-sm text-gray-500 dark:text-gray-400">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Education Pie */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">학교급별 학생 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={eduPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, value }) => `${name} ${value}명`}
                >
                  {eduPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            {eduPieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                <span className="text-gray-600 dark:text-gray-400">{d.name}: {d.value}명</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-4">학과/전공별 학생 분포</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptBarData} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4">월별 데이터 증가 추이</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="students" name="신규 학생" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="reviews" name="AI 첨삭" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="counseling" name="상담" stroke="#F97316" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="emails" name="이메일" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Student Ranking */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          학생 활동 랭킹 (이번 달)
        </h3>
        {rankingData.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">이번 달 활동 기록이 없습니다</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학생</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">학교급</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">학습시간</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">기록일수</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">프로젝트</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">점수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rankingData.map((r) => (
                  <tr key={r.rank} className={
                    r.rank === 1 ? "bg-yellow-50 dark:bg-yellow-900/10" :
                    r.rank === 2 ? "bg-gray-50 dark:bg-gray-900/50" :
                    r.rank === 3 ? "bg-orange-50 dark:bg-orange-900/10" : ""
                  }>
                    <td className="px-4 py-3 font-bold">
                      {r.rank <= 3 ? ["", "\u{1F947}", "\u{1F948}", "\u{1F949}"][r.rank] : r.rank}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{r.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${r.education_level === "high_school" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {r.education_level === "high_school" ? "특성화고" : "대학교"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.studyHours}h</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.logDays}일</td>
                    <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">{r.projects}개</td>
                    <td className="px-4 py-3 text-right font-bold text-purple-600">{r.score}</td>
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
