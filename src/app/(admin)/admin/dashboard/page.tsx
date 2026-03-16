"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import { format, subDays, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { ko } from "date-fns/locale";
import dynamic from "next/dynamic";
import {
  Users,
  UserCheck,
  FileText,
  MessageSquareHeart,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const AreaChart = dynamic(
  () => import("recharts").then((m) => m.AreaChart),
  { ssr: false }
);
const Area = dynamic(
  () => import("recharts").then((m) => m.Area),
  { ssr: false }
);
const PieChart = dynamic(
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

const PIE_COLORS = ["#8B5CF6", "#A78BFA", "#C4B5FD"];

const COUNSELING_TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  career: { label: "진로", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  resume: { label: "이력서", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  interview: { label: "면접", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  mental: { label: "고충", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  other: { label: "기타", cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
};

interface RecentStudent {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
  grade: number | null;
  created_at: string;
}

interface RecentReview {
  id: string;
  user_id: string;
  document_type: "resume" | "cover_letter";
  overall_score: number | null;
  reviewed_at: string;
  student_name: string;
}

interface UpcomingCounseling {
  id: string;
  title: string;
  counseling_type: string;
  next_counseling_date: string;
  student_name: string;
}

interface WeeklyActivity {
  week: string;
  count: number;
}

interface GradeDistribution {
  name: string;
  value: number;
  grade: number;
}

export default function AdminDashboardPage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // 통계
  const [totalStudents, setTotalStudents] = useState(0);
  const [newStudentsThisWeek, setNewStudentsThisWeek] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [reviewedDocs, setReviewedDocs] = useState(0);
  const [monthlyCounseling, setMonthlyCounseling] = useState(0);
  const [inProgressCounseling, setInProgressCounseling] = useState(0);

  // 차트
  const [weeklyActivity, setWeeklyActivity] = useState<WeeklyActivity[]>([]);
  const [gradeDistribution, setGradeDistribution] = useState<GradeDistribution[]>([]);

  // 리스트
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [reviewStatusCounts, setReviewStatusCounts] = useState({ uploaded: 0, reviewing: 0, reviewed: 0 });
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [upcomingCounseling, setUpcomingCounseling] = useState<UpcomingCounseling[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 프로필
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profileData) setProfile(profileData as Profile);

      const today = new Date();
      const todayStr = format(today, "yyyy-MM-dd");
      const sevenDaysAgo = format(subDays(today, 7), "yyyy-MM-dd");
      const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), "yyyy-MM-dd");

      // === 병렬 쿼리 ===
      const [
        totalStudentsRes,
        newStudentsRes,
        activeStudentsRes,
        resumeCountRes,
        coverLetterCountRes,
        reviewedDocsRes,
        monthlyCounselingRes,
        inProgressCounselingRes,
        recentStudentsRes,
        uploadedStatusRes,
        reviewingStatusRes,
        reviewedStatusRes,
        gradeRes,
      ] = await Promise.all([
        // 전체 학생 수
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "user"),
        // 이번 주 신규 가입
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .gte("created_at", sevenDaysAgo),
        // 활성 학생 (최근 7일 daily_logs)
        supabase
          .from("daily_logs")
          .select("user_id")
          .gte("log_date", sevenDaysAgo),
        // 업로드 이력서 수
        supabase
          .from("uploaded_resumes")
          .select("id", { count: "exact", head: true }),
        // 업로드 자소서 수
        supabase
          .from("uploaded_cover_letters")
          .select("id", { count: "exact", head: true }),
        // AI 첨삭 완료 수
        supabase
          .from("ai_review_results")
          .select("id", { count: "exact", head: true }),
        // 이번 달 상담
        supabase
          .from("counseling_records")
          .select("id", { count: "exact", head: true })
          .gte("counseling_date", monthStart),
        // 미완료 상담
        supabase
          .from("counseling_records")
          .select("id", { count: "exact", head: true })
          .eq("is_completed", false),
        // 최근 가입 학생 5명
        supabase
          .from("profiles")
          .select("id, name, school, department, grade, created_at")
          .eq("role", "user")
          .order("created_at", { ascending: false })
          .limit(5),
        // AI 첨삭 상태별 카운트 - uploaded
        supabase
          .from("uploaded_resumes")
          .select("id", { count: "exact", head: true })
          .eq("status", "uploaded"),
        // reviewing
        supabase
          .from("uploaded_resumes")
          .select("id", { count: "exact", head: true })
          .eq("status", "reviewing"),
        // reviewed
        supabase
          .from("uploaded_resumes")
          .select("id", { count: "exact", head: true })
          .eq("status", "reviewed"),
        // 학년별 분포
        supabase
          .from("profiles")
          .select("grade")
          .eq("role", "user")
          .not("grade", "is", null),
      ]);

      // 통계 세팅
      setTotalStudents(totalStudentsRes.count ?? 0);
      setNewStudentsThisWeek(newStudentsRes.count ?? 0);

      // 활성 학생 (unique user_id)
      if (activeStudentsRes.data) {
        const uniqueUsers = new Set(activeStudentsRes.data.map((d: { user_id: string }) => d.user_id));
        setActiveStudents(uniqueUsers.size);
      }

      setTotalDocs((resumeCountRes.count ?? 0) + (coverLetterCountRes.count ?? 0));
      setReviewedDocs(reviewedDocsRes.count ?? 0);
      setMonthlyCounseling(monthlyCounselingRes.count ?? 0);
      setInProgressCounseling(inProgressCounselingRes.count ?? 0);

      // 최근 가입 학생
      if (recentStudentsRes.data) {
        setRecentStudents(recentStudentsRes.data as RecentStudent[]);
      }

      // AI 첨삭 상태별 (이력서 + 자소서 합산)
      const [uploadedCLRes, reviewingCLRes, reviewedCLRes] = await Promise.all([
        supabase.from("uploaded_cover_letters").select("id", { count: "exact", head: true }).eq("status", "uploaded"),
        supabase.from("uploaded_cover_letters").select("id", { count: "exact", head: true }).eq("status", "reviewing"),
        supabase.from("uploaded_cover_letters").select("id", { count: "exact", head: true }).eq("status", "reviewed"),
      ]);

      setReviewStatusCounts({
        uploaded: (uploadedStatusRes.count ?? 0) + (uploadedCLRes.count ?? 0),
        reviewing: (reviewingStatusRes.count ?? 0) + (reviewingCLRes.count ?? 0),
        reviewed: (reviewedStatusRes.count ?? 0) + (reviewedCLRes.count ?? 0),
      });

      // 최근 첨삭 완료 3건
      const { data: recentReviewsData } = await supabase
        .from("ai_review_results")
        .select("id, user_id, document_type, overall_score, reviewed_at")
        .order("reviewed_at", { ascending: false })
        .limit(3);

      if (recentReviewsData && recentReviewsData.length > 0) {
        const userIds = Array.from(new Set(recentReviewsData.map((r: { user_id: string }) => r.user_id)));
        const { data: names } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        const nameMap = new Map((names || []).map((n: { id: string; name: string }) => [n.id, n.name]));

        setRecentReviews(
          recentReviewsData.map((r: { id: string; user_id: string; document_type: "resume" | "cover_letter"; overall_score: number | null; reviewed_at: string }) => ({
            ...r,
            student_name: nameMap.get(r.user_id) || "알 수 없음",
          }))
        );
      }

      // 학년별 분포
      if (gradeRes.data) {
        const gradeCounts: Record<number, number> = {};
        gradeRes.data.forEach((d: { grade: number | null }) => {
          if (d.grade) {
            gradeCounts[d.grade] = (gradeCounts[d.grade] || 0) + 1;
          }
        });
        const dist: GradeDistribution[] = [1, 2, 3].map((g) => ({
          name: `${g}학년`,
          value: gradeCounts[g] || 0,
          grade: g,
        }));
        setGradeDistribution(dist);
      }

      // 주간 활동 추이 (최근 4주)
      const fourWeeksAgo = format(subWeeks(today, 4), "yyyy-MM-dd");
      const { data: weeklyLogs } = await supabase
        .from("daily_logs")
        .select("user_id, log_date")
        .gte("log_date", fourWeeksAgo);

      if (weeklyLogs) {
        const weekMap = new Map<string, Set<string>>();
        for (let i = 3; i >= 0; i--) {
          const ws = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
          const we = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
          const weekLabel = `${format(ws, "M/d")}~${format(we, "M/d")}`;
          weekMap.set(weekLabel, new Set());
        }

        weeklyLogs.forEach((log: { user_id: string; log_date: string }) => {
          const logDate = new Date(log.log_date);
          for (let i = 3; i >= 0; i--) {
            const ws = startOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
            const we = endOfWeek(subWeeks(today, i), { weekStartsOn: 1 });
            if (logDate >= ws && logDate <= we) {
              const weekLabel = `${format(ws, "M/d")}~${format(we, "M/d")}`;
              weekMap.get(weekLabel)?.add(log.user_id);
              break;
            }
          }
        });

        const activity: WeeklyActivity[] = [];
        weekMap.forEach((users, week) => {
          activity.push({ week, count: users.size });
        });
        setWeeklyActivity(activity);
      }

      // 다가오는 상담 일정
      const { data: upcomingData } = await supabase
        .from("counseling_records")
        .select("id, title, counseling_type, next_counseling_date, user_id")
        .gt("next_counseling_date", todayStr)
        .order("next_counseling_date", { ascending: true })
        .limit(5);

      if (upcomingData && upcomingData.length > 0) {
        const userIds = Array.from(new Set(upcomingData.map((c: { user_id: string }) => c.user_id)));
        const { data: names } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", userIds);
        const nameMap = new Map((names || []).map((n: { id: string; name: string }) => [n.id, n.name]));

        setUpcomingCounseling(
          upcomingData.map((c: { id: string; title: string; counseling_type: string; next_counseling_date: string; user_id: string }) => ({
            id: c.id,
            title: c.title,
            counseling_type: c.counseling_type,
            next_counseling_date: c.next_counseling_date,
            student_name: nameMap.get(c.user_id) || "알 수 없음",
          }))
        );
      }
    } catch {
      toast.error("대시보드 데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const totalGradeStudents = gradeDistribution.reduce((s, d) => s + d.value, 0);
  const activePercent = totalStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0;

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* 4-1. 인사 섹션 */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          안녕하세요, {profile?.name || "관리자"} 선생님 👋
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          오늘의 학생 현황을 확인하세요
        </p>
      </div>

      {/* 4-2. 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          iconBg="bg-purple-100 dark:bg-purple-900/40"
          iconColor="text-purple-600 dark:text-purple-400"
          value={totalStudents}
          label="전체 학생"
          sub={newStudentsThisWeek > 0 ? `+${newStudentsThisWeek}명` : undefined}
          subColor="text-green-500"
        />
        <StatCard
          icon={UserCheck}
          iconBg="bg-green-100 dark:bg-green-900/40"
          iconColor="text-green-600 dark:text-green-400"
          value={activeStudents}
          label="이번 주 활성"
          sub={`${activePercent}%`}
          subColor="text-gray-500"
        />
        <StatCard
          icon={FileText}
          iconBg="bg-blue-100 dark:bg-blue-900/40"
          iconColor="text-blue-600 dark:text-blue-400"
          value={totalDocs}
          label="업로드 문서"
          sub={`${reviewedDocs}건 첨삭완료`}
          subColor="text-gray-500"
        />
        <StatCard
          icon={MessageSquareHeart}
          iconBg="bg-orange-100 dark:bg-orange-900/40"
          iconColor="text-orange-600 dark:text-orange-400"
          value={monthlyCounseling}
          label="이번 달 상담"
          sub={`${inProgressCounseling}건 진행중`}
          subColor="text-gray-500"
        />
      </div>

      {/* 4-3. 차트 영역 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 주간 학생 활동 추이 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            주간 학생 활동 추이
          </h3>
          {weeklyActivity.length > 0 ? (
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivity}>
                  <XAxis
                    dataKey="week"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#9CA3AF" }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => [`${value}명`, "활성 학생"]}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid #E5E7EB",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#8B5CF6"
                    fill="#EDE9FE"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              활동 데이터가 없습니다
            </div>
          )}
        </div>

        {/* 학년별 학생 분포 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            학년별 학생 분포
          </h3>
          {totalGradeStudents > 0 ? (
            <>
              <div className="w-full h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={gradeDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      dataKey="value"
                      startAngle={90}
                      endAngle={-270}
                      strokeWidth={0}
                    >
                      {gradeDistribution.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [`${value}명`]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid #E5E7EB",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {totalGradeStudents}
                    </p>
                    <p className="text-xs text-gray-500">총 학생</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {gradeDistribution.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: PIE_COLORS[i] }}
                    />
                    {d.name} ({d.value}명)
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-56 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              학년 데이터가 없습니다
            </div>
          )}
        </div>
      </div>

      {/* 4-4. 최근 가입 학생 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            최근 가입 학생
          </h3>
          <Link
            href="/admin/students"
            className="text-sm text-purple-600 dark:text-purple-400 font-medium hover:underline flex items-center gap-1"
          >
            전체보기
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        {recentStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">이름</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">학교</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">학과</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">학년</th>
                  <th className="text-left py-2 text-gray-500 dark:text-gray-400 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {recentStudents.map((student) => (
                  <tr
                    key={student.id}
                    onClick={() => window.location.href = `/admin/students/${student.id}`}
                    className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-purple-50/50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors"
                  >
                    <td className="py-3 text-gray-900 dark:text-gray-100 font-medium">
                      {student.name}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400">
                      {student.school || "-"}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {student.department || "-"}
                    </td>
                    <td className="py-3 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {student.grade ? `${student.grade}학년` : "-"}
                    </td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">
                      {format(new Date(student.created_at), "yy.MM.dd")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            아직 가입한 학생이 없습니다
          </div>
        )}
      </div>

      {/* 4-5. AI 첨삭 현황 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            AI 첨삭 현황
          </h3>
          <Link
            href="/admin/ai-center"
            className="text-sm text-purple-600 dark:text-purple-400 font-medium hover:underline flex items-center gap-1"
          >
            AI 분석센터
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* 상태 카운트 */}
        <div className="flex gap-4 mb-4">
          <div className="flex-1 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-center">
            <p className="text-xl font-bold text-yellow-700 dark:text-yellow-400">
              {reviewStatusCounts.uploaded}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">대기중</p>
          </div>
          <div className="flex-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-3 text-center">
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">
              {reviewStatusCounts.reviewing}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-500">진행중</p>
          </div>
          <div className="flex-1 rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-3 text-center">
            <p className="text-xl font-bold text-green-700 dark:text-green-400">
              {reviewStatusCounts.reviewed}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">완료</p>
          </div>
        </div>

        {/* 최근 첨삭 완료 리스트 */}
        {recentReviews.length > 0 ? (
          <div className="space-y-2">
            {recentReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {review.student_name}
                  </span>
                  <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full px-2 py-0.5">
                    {review.document_type === "resume" ? "이력서" : "자소서"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {review.overall_score !== null && (
                    <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                      {review.overall_score}점
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {format(new Date(review.reviewed_at), "MM.dd")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
            아직 AI 첨삭 기록이 없습니다
          </div>
        )}
      </div>

      {/* 4-6. 다가오는 상담 일정 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            다가오는 상담 일정
          </h3>
          <Link
            href="/admin/counseling"
            className="text-sm text-purple-600 dark:text-purple-400 font-medium hover:underline flex items-center gap-1"
          >
            상담도우미
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {upcomingCounseling.length > 0 ? (
          <div className="space-y-3">
            {upcomingCounseling.map((c) => {
              const badge = COUNSELING_TYPE_BADGE[c.counseling_type] || COUNSELING_TYPE_BADGE.other;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 flex-shrink-0">
                      {c.student_name}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {c.title}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                    {format(new Date(c.next_counseling_date), "M/d(EEE)", { locale: ko })}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 dark:text-gray-500 text-sm">
            예정된 상담이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}

// === 통계 카드 컴포넌트 ===
function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
  subColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
          {sub && (
            <p className={`text-xs mt-0.5 ${subColor || "text-gray-500"}`}>{sub}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// === 스켈레톤 ===
function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* 인사 */}
      <div>
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
      </div>
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-700" />
              <div>
                <div className="h-7 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1" />
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* 차트 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
            <div className="h-56 bg-gray-100 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded mb-2" />
        ))}
      </div>
    </div>
  );
}
