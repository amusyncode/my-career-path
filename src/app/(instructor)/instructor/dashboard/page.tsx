"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import Link from "next/link";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import {
  Users,
  UserCheck,
  FileText,
  MessageSquareHeart,
  AlertTriangle,
  Copy,
  LinkIcon,
} from "lucide-react";

const AreaChart = dynamic(() => import("recharts").then((m) => m.AreaChart), { ssr: false });
const Area = dynamic(() => import("recharts").then((m) => m.Area), { ssr: false });
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), { ssr: false });
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), { ssr: false });
const Tooltip = dynamic(() => import("recharts").then((m) => m.Tooltip), { ssr: false });
const ResponsiveContainer = dynamic(() => import("recharts").then((m) => m.ResponsiveContainer), { ssr: false });
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), { ssr: false });
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), { ssr: false });
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), { ssr: false });

const COUNSELING_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  career: { label: "진로", color: "bg-purple-100 text-purple-700" },
  resume: { label: "이력서", color: "bg-blue-100 text-blue-700" },
  interview: { label: "면접", color: "bg-green-100 text-green-700" },
  mental: { label: "고충", color: "bg-orange-100 text-orange-700" },
  other: { label: "기타", color: "bg-gray-100 text-gray-700" },
};

const EDU_BADGE: Record<string, string> = {
  high_school: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  university: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const PIE_COLORS = ["#8B5CF6", "#3B82F6"];

function scoreColor(score: number) {
  if (score <= 40) return "text-red-600";
  if (score <= 70) return "text-yellow-600";
  return "text-green-600";
}

interface DashboardData {
  profile: Profile | null;
  studentCount: number;
  highSchoolCount: number;
  universityCount: number;
  activeStudentCount: number;
  docCount: number;
  reviewedCount: number;
  counselingCount: number;
  pendingCounselingCount: number;
  recentStudents: Profile[];
  weeklyActivity: { week: string; count: number }[];
  uploadedCount: number;
  reviewingCount: number;
  reviewedDocCount: number;
  recentReviews: { student_name: string; doc_type: string; gem_name: string | null; score: number; date: string }[];
  upcomingCounseling: { student_name: string; type: string; date: string; title: string }[];
}

export default function InstructorDashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) return;
    const myId = user.id;

    try {
      // 1. 내 학생 목록
      const { data: students } = await supabase
        .from("profiles")
        .select("id, name, school, department, education_level, created_at")
        .eq("role", "student")
        .eq("instructor_id", myId)
        .order("created_at", { ascending: false });

      const myStudents = students || [];
      const studentIds = myStudents.map((s) => s.id);
      const highSchoolCount = myStudents.filter((s) => s.education_level === "high_school").length;
      const universityCount = myStudents.filter((s) => s.education_level === "university").length;

      // 2. 최근 7일 활성 학생
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      let activeStudentCount = 0;
      if (studentIds.length > 0) {
        const { data: activeLogs } = await supabase
          .from("daily_logs")
          .select("user_id")
          .in("user_id", studentIds)
          .gte("log_date", sevenDaysAgo.toISOString().split("T")[0]);
        const uniqueActive = new Set((activeLogs || []).map((l) => l.user_id));
        activeStudentCount = uniqueActive.size;
      }

      // 3. 문서 통계
      let docCount = 0;
      let uploadedCount = 0;
      let reviewingCount = 0;
      let reviewedDocCount = 0;
      if (studentIds.length > 0) {
        const { data: resumes } = await supabase
          .from("uploaded_resumes")
          .select("id, status")
          .in("user_id", studentIds);
        const { data: coverLetters } = await supabase
          .from("uploaded_cover_letters")
          .select("id, status")
          .in("user_id", studentIds);
        const allDocs = [...(resumes || []), ...(coverLetters || [])];
        docCount = allDocs.length;
        uploadedCount = allDocs.filter((d) => d.status === "uploaded").length;
        reviewingCount = allDocs.filter((d) => d.status === "reviewing").length;
        reviewedDocCount = allDocs.filter((d) => d.status === "reviewed").length;
      }

      // 4. 이번 달 상담
      const monthStart = new Date();
      monthStart.setDate(1);
      let counselingCount = 0;
      let pendingCounselingCount = 0;
      if (studentIds.length > 0) {
        const { data: counseling } = await supabase
          .from("counseling_records")
          .select("id, is_completed")
          .in("student_id", studentIds)
          .gte("created_at", monthStart.toISOString());
        counselingCount = (counseling || []).length;
        pendingCounselingCount = (counseling || []).filter((c) => !c.is_completed).length;
      }

      // 5. 주간 활동 추이 (4주)
      const weeklyActivity: { week: string; count: number }[] = [];
      if (studentIds.length > 0) {
        for (let i = 3; i >= 0; i--) {
          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
          const weekEnd = new Date();
          weekEnd.setDate(weekEnd.getDate() - i * 7);
          const { data: logs } = await supabase
            .from("daily_logs")
            .select("user_id")
            .in("user_id", studentIds)
            .gte("log_date", weekStart.toISOString().split("T")[0])
            .lt("log_date", weekEnd.toISOString().split("T")[0]);
          const unique = new Set((logs || []).map((l) => l.user_id));
          weeklyActivity.push({
            week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
            count: unique.size,
          });
        }
      }

      // 6. 최근 첨삭 완료 3건
      let recentReviews: DashboardData["recentReviews"] = [];
      if (studentIds.length > 0) {
        const { data: reviews } = await supabase
          .from("ai_review_results")
          .select("overall_score, document_type, created_at, user_id")
          .in("user_id", studentIds)
          .order("created_at", { ascending: false })
          .limit(3);

        if (reviews && reviews.length > 0) {
          const reviewUserIds = Array.from(new Set(reviews.map((r) => r.user_id)));
          const { data: reviewProfiles } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", reviewUserIds);
          const nameMap = new Map((reviewProfiles || []).map((p) => [p.id, p.name]));

          recentReviews = reviews.map((r) => ({
            student_name: nameMap.get(r.user_id) || "알 수 없음",
            doc_type: r.document_type === "resume" ? "이력서" : "자소서",
            gem_name: null,
            score: r.overall_score || 0,
            date: new Date(r.created_at).toLocaleDateString("ko-KR"),
          }));
        }
      }

      // 7. 다가오는 상담
      let upcomingCounseling: DashboardData["upcomingCounseling"] = [];
      if (studentIds.length > 0) {
        const today = new Date().toISOString().split("T")[0];
        const { data: upcoming } = await supabase
          .from("counseling_records")
          .select("student_id, counseling_type, next_counseling_date, title")
          .in("student_id", studentIds)
          .gte("next_counseling_date", today)
          .eq("is_completed", false)
          .order("next_counseling_date", { ascending: true })
          .limit(5);

        if (upcoming && upcoming.length > 0) {
          const upcomingStudentIds = Array.from(new Set(upcoming.map((u) => u.student_id)));
          const { data: upProfiles } = await supabase
            .from("profiles")
            .select("id, name")
            .in("id", upcomingStudentIds);
          const nameMap2 = new Map((upProfiles || []).map((p) => [p.id, p.name]));

          upcomingCounseling = upcoming.map((u) => ({
            student_name: nameMap2.get(u.student_id) || "알 수 없음",
            type: u.counseling_type || "other",
            date: u.next_counseling_date || "",
            title: u.title || "상담",
          }));
        }
      }

      setData({
        profile: profile as Profile,
        studentCount: myStudents.length,
        highSchoolCount,
        universityCount,
        activeStudentCount,
        docCount,
        reviewedCount: reviewedDocCount,
        counselingCount,
        pendingCounselingCount,
        recentStudents: myStudents.slice(0, 5) as Profile[],
        weeklyActivity,
        uploadedCount,
        reviewingCount,
        reviewedDocCount,
        recentReviews,
        upcomingCounseling,
      });
    } catch (err) {
      console.error("대시보드 데이터 로딩 실패:", err);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCopyCode = () => {
    if (data?.profile?.invite_code) {
      navigator.clipboard.writeText(data.profile.invite_code);
      toast.success("초대 코드가 복사되었습니다");
    }
  };

  const handleCopyLink = () => {
    if (data?.profile?.invite_code) {
      const link = `${window.location.origin}/signup?invite=${data.profile.invite_code}`;
      navigator.clipboard.writeText(link);
      toast.success("초대 링크가 복사되었습니다");
    }
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { profile: p } = data;
  const activePercent = data.studentCount > 0
    ? Math.round((data.activeStudentCount / data.studentCount) * 100)
    : 0;

  const pieData = [
    { name: "특성화고", value: data.highSchoolCount },
    { name: "대학생", value: data.universityCount },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* 인사 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          안녕하세요, {p?.name} 선생님
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">오늘의 학생 현황을 확인하세요</p>

        {/* API 키 미등록 알림 */}
        {!p?.gemini_api_key && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-4 mt-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                Gemini API 키가 등록되지 않았습니다. AI 첨삭 기능을 사용하려면 API 키를 등록해주세요.
              </p>
              <Link href="/instructor/settings" className="text-sm text-yellow-700 dark:text-yellow-400 font-medium underline mt-1 inline-block">
                설정 페이지로 이동 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
          value={data.studentCount}
          label="내 학생"
          sub={`특성화고 ${data.highSchoolCount}명 · 대학생 ${data.universityCount}명`}
        />
        <StatCard
          icon={UserCheck}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
          value={data.activeStudentCount}
          label="이번 주 활성"
          sub={`${activePercent}%`}
        />
        <StatCard
          icon={FileText}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
          value={data.docCount}
          label="업로드 문서"
          sub={`${data.reviewedCount}건 첨삭완료`}
        />
        <StatCard
          icon={MessageSquareHeart}
          iconBg="bg-orange-100 dark:bg-orange-900/30"
          iconColor="text-orange-600 dark:text-orange-400"
          value={data.counselingCount}
          label="이번 달 상담"
          sub={`${data.pendingCounselingCount}건 진행중`}
        />
      </div>

      {/* 차트 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* 주간 학생 활동 추이 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">주간 학생 활동 추이</h2>
          {data.weeklyActivity.length > 0 && data.weeklyActivity.some((w) => w.count > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={data.weeklyActivity}>
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value}명`, "활성 학생"]} />
                <Area type="monotone" dataKey="count" stroke="#8B5CF6" fill="#EDE9FE" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-center py-10">아직 학생 활동 데이터가 없습니다</p>
          )}
        </div>

        {/* 학생 분포 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">학생 분포</h2>
          {pieData.length > 0 ? (
            <div className="flex flex-col items-center">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value}명`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex gap-6 mt-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="text-gray-600 dark:text-gray-400">{d.name}: {d.value}명</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-400 dark:text-gray-500 text-center py-10">등록된 학생이 없습니다</p>
          )}
        </div>
      </div>

      {/* 최근 등록 학생 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">최근 등록 학생</h2>
          <Link href="/instructor/students" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">전체보기 →</Link>
        </div>
        {data.recentStudents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2 font-medium">이름</th>
                  <th className="pb-2 font-medium">학교</th>
                  <th className="pb-2 font-medium">학과</th>
                  <th className="pb-2 font-medium">학교급</th>
                  <th className="pb-2 font-medium">등록일</th>
                </tr>
              </thead>
              <tbody>
                {data.recentStudents.map((s) => (
                  <tr key={s.id} className="border-b dark:border-gray-700 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer">
                    <td className="py-2.5 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{s.school || "-"}</td>
                    <td className="py-2.5 text-gray-600 dark:text-gray-400">{s.department || "-"}</td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${EDU_BADGE[s.education_level] || "bg-gray-100 text-gray-600"}`}>
                        {s.education_level === "high_school" ? "특성화고" : "대학생"}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-400 text-xs">{new Date(s.created_at).toLocaleDateString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p>아직 등록된 학생이 없습니다</p>
            <Link href="/instructor/students" className="text-purple-600 dark:text-purple-400 text-sm mt-2 inline-block hover:underline">학생 등록하기 →</Link>
          </div>
        )}
      </div>

      {/* AI 첨삭 현황 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">AI 첨삭 현황</h2>
          <Link href="/instructor/ai-center" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">AI 분석센터 →</Link>
        </div>

        {!p?.gemini_api_key ? (
          <div className="text-center py-8 text-gray-400 dark:text-gray-500">
            <p>AI 첨삭을 사용하려면 Gemini API 키를 등록해주세요</p>
            <Link href="/instructor/settings" className="text-purple-600 dark:text-purple-400 text-sm mt-2 inline-block hover:underline">설정으로 이동 →</Link>
          </div>
        ) : (
          <>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-yellow-700 dark:text-yellow-400">{data.uploadedCount}</p>
                <p className="text-xs text-yellow-600 dark:text-yellow-500">대기중</p>
              </div>
              <div className="flex-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{data.reviewingCount}</p>
                <p className="text-xs text-blue-600 dark:text-blue-500">진행중</p>
              </div>
              <div className="flex-1 bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-green-700 dark:text-green-400">{data.reviewedDocCount}</p>
                <p className="text-xs text-green-600 dark:text-green-500">완료</p>
              </div>
            </div>

            {data.recentReviews.length > 0 ? (
              <div className="space-y-2">
                {data.recentReviews.map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0 text-sm">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{r.student_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{r.doc_type}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${scoreColor(r.score)}`}>{r.score}점</span>
                      <span className="text-xs text-gray-400">{r.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 dark:text-gray-500 py-4 text-sm">아직 AI 첨삭 기록이 없습니다</p>
            )}
          </>
        )}
      </div>

      {/* 다가오는 상담 일정 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">다가오는 상담 일정</h2>
          <Link href="/instructor/counseling" className="text-sm text-purple-600 dark:text-purple-400 hover:underline">상담도우미 →</Link>
        </div>
        {data.upcomingCounseling.length > 0 ? (
          <div className="space-y-2">
            {data.upcomingCounseling.map((c, i) => {
              const typeInfo = COUNSELING_TYPE_LABELS[c.type] || COUNSELING_TYPE_LABELS.other;
              return (
                <div key={i} className="flex items-center justify-between py-2 border-b dark:border-gray-700 last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{c.student_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>{typeInfo.label}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-gray-600 dark:text-gray-400">{c.title}</span>
                    <span className="text-xs text-gray-400">{c.date}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-400 dark:text-gray-500 py-8">예정된 상담이 없습니다</p>
        )}
      </div>

      {/* 초대 코드 카드 */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-5">
        <p className="font-semibold text-purple-800 dark:text-purple-300 mb-3">내 초대 코드</p>
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-2xl font-bold text-purple-700 dark:text-purple-400 tracking-widest">
            {p?.invite_code || "N/A"}
          </span>
          <div className="flex gap-2">
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 bg-purple-500 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-purple-600 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              코드 복사
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 text-purple-600 dark:text-purple-400 rounded-lg px-3 py-1.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              초대 링크 복사
            </button>
          </div>
        </div>
        <p className="text-xs text-purple-600 dark:text-purple-400 mt-3">
          이 코드를 학생에게 공유하면 자동으로 내 클래스에 등록됩니다
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  value,
  label,
  sub,
}: {
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
  value: number;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm dark:shadow-gray-900/20 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
