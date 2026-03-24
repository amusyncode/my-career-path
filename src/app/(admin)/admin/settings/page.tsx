"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import toast from "react-hot-toast";
import {
  Key,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  User,
  Shield,
  Eye,
  EyeOff,
  Database,
  BarChart3,
  Info,
  Users,
  FileText,
  Sparkles,
  MessageSquareHeart,
  Mail,
  FileEdit,
  Save,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Profile } from "@/lib/types";

interface EmailLog {
  id: string;
  instructor_id: string;
  student_id: string | null;
  recipient_email: string;
  subject: string;
  content_type: string;
  status: string;
  sent_at: string;
  error_message: string | null;
  instructor_name?: string;
  student_name?: string;
}

interface PlatformStats {
  totalInstructors: number;
  totalStudents: number;
  totalAIReviews: number;
  totalEmails: number;
  totalResumes: number;
  totalCoverLetters: number;
  totalCounseling: number;
  totalGems: number;
}

export default function SettingsPage() {
  const supabase = createClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Instructor signup code
  const [copied, setCopied] = useState(false);
  const instructorCode = process.env.NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE || "미설정";

  // Supabase connection
  const [connectionStatus, setConnectionStatus] = useState<
    "idle" | "testing" | "connected" | "error"
  >("idle");

  // Platform stats
  const [stats, setStats] = useState<PlatformStats>({
    totalInstructors: 0,
    totalStudents: 0,
    totalAIReviews: 0,
    totalEmails: 0,
    totalResumes: 0,
    totalCoverLetters: 0,
    totalCounseling: 0,
    totalGems: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // Email history
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [emailPage, setEmailPage] = useState(1);
  const [emailTotal, setEmailTotal] = useState(0);
  const [emailLoading, setEmailLoading] = useState(false);

  // Profile edit
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [saving, setSaving] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      const p = data as Profile;
      setProfile(p);
      setEditName(p.name || "");
      setEditEmail(p.email || "");
    }
    setLoading(false);
  }, [supabase]);

  const fetchStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const [
        instructorsRes,
        studentsRes,
        reviewsRes,
        emailsRes,
        resumesRes,
        coverLettersRes,
        counselingRes,
        gemsRes,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "instructor"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "student"),
        supabase
          .from("ai_review_results")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("email_logs")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("uploaded_resumes")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("uploaded_cover_letters")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("counseling_records")
          .select("*", { count: "exact", head: true }),
        supabase.from("gems").select("*", { count: "exact", head: true }),
      ]);

      setStats({
        totalInstructors: instructorsRes.count ?? 0,
        totalStudents: studentsRes.count ?? 0,
        totalAIReviews: reviewsRes.count ?? 0,
        totalEmails: emailsRes.count ?? 0,
        totalResumes: resumesRes.count ?? 0,
        totalCoverLetters: coverLettersRes.count ?? 0,
        totalCounseling: counselingRes.count ?? 0,
        totalGems: gemsRes.count ?? 0,
      });
    } catch (err) {
      console.error("통계 조회 실패:", err);
    }
    setLoadingStats(false);
  }, [supabase]);

  const fetchEmailLogs = useCallback(async () => {
    setEmailLoading(true);
    try {
      const from = (emailPage - 1) * 10;
      const { data, count } = await supabase
        .from("email_logs")
        .select("*", { count: "exact" })
        .order("sent_at", { ascending: false })
        .range(from, from + 9);

      if (data) {
        // Get instructor + student names
        const instrIds = [...new Set(data.map(l => l.instructor_id))];
        const studIds = [...new Set(data.filter(l => l.student_id).map(l => l.student_id!))];
        const allIds = [...new Set([...instrIds, ...studIds])];
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", allIds);
        const nameMap: Record<string, string> = {};
        profiles?.forEach(p => { nameMap[p.id] = p.name; });

        setEmailLogs(data.map(l => ({
          ...l,
          instructor_name: nameMap[l.instructor_id] || "-",
          student_name: l.student_id ? nameMap[l.student_id] || "-" : "-",
        })));
      }
      setEmailTotal(count || 0);
    } catch (err) {
      console.error("이메일 로그 조회 실패:", err);
    }
    setEmailLoading(false);
  }, [supabase, emailPage]);

  useEffect(() => {
    fetchProfile();
    fetchStats();
    fetchEmailLogs();
  }, [fetchProfile, fetchStats, fetchEmailLogs]);

  const testConnection = async () => {
    setConnectionStatus("testing");
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) {
        setConnectionStatus("error");
        toast.error("Supabase 연결 실패");
      } else {
        setConnectionStatus("connected");
        toast.success("Supabase 연결 성공");
      }
    } catch {
      setConnectionStatus("error");
      toast.error("연결 테스트 중 오류 발생");
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(instructorCode);
    setCopied(true);
    toast.success("코드가 복사되었습니다!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: editName.trim() })
      .eq("id", profile?.id);

    if (error) {
      toast.error("저장 실패: " + error.message);
    } else {
      toast.success("프로필이 저장되었습니다.");
      fetchProfile();
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      toast.error("비밀번호 변경 실패: " + error.message);
    } else {
      toast.success("비밀번호가 변경되었습니다.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setChangingPassword(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-red-500" />
      </div>
    );
  }

  if (!profile) return null;

  const statCards = [
    { label: "총 강사", value: stats.totalInstructors, icon: Users, color: "text-red-600" },
    { label: "총 학생", value: stats.totalStudents, icon: Users, color: "text-blue-600" },
    { label: "총 AI 첨삭", value: stats.totalAIReviews, icon: Sparkles, color: "text-purple-600" },
    { label: "총 이메일", value: stats.totalEmails, icon: Mail, color: "text-green-600" },
    { label: "총 이력서", value: stats.totalResumes, icon: FileText, color: "text-amber-600" },
    { label: "총 자소서", value: stats.totalCoverLetters, icon: FileEdit, color: "text-teal-600" },
    { label: "총 상담", value: stats.totalCounseling, icon: MessageSquareHeart, color: "text-pink-600" },
    { label: "총 Gem", value: stats.totalGems, icon: Sparkles, color: "text-indigo-600" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">플랫폼 설정 및 시스템 정보</p>
      </div>

      {/* 1. 강사 가입 코드 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <Key className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">강사 가입 코드</h2>
            <p className="text-sm text-gray-500">
              강사가 회원가입 시 사용하는 인증 코드
            </p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <span className="text-2xl font-mono font-bold text-red-800 tracking-widest">
            {instructorCode}
          </span>
          <button
            onClick={copyCode}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
            title="복사"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-500" />
            ) : (
              <Copy className="w-5 h-5 text-red-500" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          이 코드는 환경변수(NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE)에서 관리됩니다.
          변경하려면 Vercel 환경변수를 수정하세요.
        </p>
      </div>

      {/* 2. 시스템 연결 상태 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Database className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">시스템 연결 상태</h2>
            <p className="text-sm text-gray-500">외부 서비스 연결 상태</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Supabase</span>
            <span className="text-lg">
              {connectionStatus === "connected"
                ? "🟢"
                : connectionStatus === "error"
                ? "🔴"
                : "⚪"}
            </span>
            <span className="text-sm text-gray-500">
              {connectionStatus === "connected"
                ? "연결됨"
                : connectionStatus === "error"
                ? "연결 실패"
                : connectionStatus === "testing"
                ? "테스트 중..."
                : "미확인"}
            </span>
          </div>
          <button
            onClick={testConnection}
            disabled={connectionStatus === "testing"}
            className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {connectionStatus === "testing" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            연결 테스트
          </button>
        </div>
      </div>

      {/* 3. 플랫폼 통계 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">플랫폼 통계</h2>
            <p className="text-sm text-gray-500">전체 플랫폼 사용 현황</p>
          </div>
        </div>

        {loadingStats ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-gray-50 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${card.color}`} />
                    <span className="text-xs text-gray-500">{card.label}</span>
                  </div>
                  <p className={`text-xl font-bold ${card.color}`}>
                    {card.value.toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. 이메일 발송 내역 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">이메일 발송 내역</h2>
            <p className="text-sm text-gray-500">플랫폼 전체 이메일 발송 기록 (최근순)</p>
          </div>
        </div>

        {emailLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : emailLogs.length === 0 ? (
          <p className="text-center text-gray-400 py-8">발송 내역이 없습니다</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-3 py-2 font-medium text-gray-500">상태</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">유형</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">발신자</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">수신자</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">제목</th>
                    <th className="text-left px-3 py-2 font-medium text-gray-500">발송일</th>
                  </tr>
                </thead>
                <tbody>
                  {emailLogs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <span className={`text-xs ${log.status === "sent" ? "text-green-600" : "text-red-600"}`}>
                          {log.status === "sent" ? "✅" : "❌"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          log.content_type === "ai_review" ? "bg-blue-100 text-blue-700" :
                          log.content_type === "counseling" ? "bg-green-100 text-green-700" :
                          log.content_type === "invite" ? "bg-purple-100 text-purple-700" :
                          log.content_type === "instructor_welcome" ? "bg-red-100 text-red-700" :
                          "bg-gray-100 text-gray-700"
                        }`}>
                          {log.content_type === "ai_review" ? "AI 분석" :
                           log.content_type === "counseling" ? "상담" :
                           log.content_type === "invite" ? "초대" :
                           log.content_type === "instructor_welcome" ? "강사 환영" :
                           "커스텀"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{log.instructor_name}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[150px] truncate">{log.recipient_email}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-[200px] truncate">{log.subject}</td>
                      <td className="px-3 py-2 text-gray-400 whitespace-nowrap text-xs">
                        {new Date(log.sent_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(emailTotal / 10) > 1 && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <button
                  disabled={emailPage <= 1}
                  onClick={() => setEmailPage(p => p - 1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" /> 이전
                </button>
                <span className="text-xs text-gray-500">{emailPage} / {Math.ceil(emailTotal / 10)}</span>
                <button
                  disabled={emailPage >= Math.ceil(emailTotal / 10)}
                  onClick={() => setEmailPage(p => p + 1)}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
                >
                  다음 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 5. 관리자 프로필 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">관리자 프로필</h2>
            <p className="text-sm text-gray-500">계정 정보 및 비밀번호 관리</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Name & Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                value={editEmail}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">
                이메일은 Supabase Auth에서 관리됩니다
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <Shield className="w-3 h-3" />
              플랫폼 관리자
            </span>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 bg-red-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-600 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            프로필 저장
          </button>

          {/* Password change */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              비밀번호 변경
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호"
                  className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 확인"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
            <button
              onClick={handleChangePassword}
              disabled={changingPassword || !newPassword || !confirmPassword}
              className="mt-3 flex items-center gap-2 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
            >
              {changingPassword && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              비밀번호 변경
            </button>
          </div>
        </div>
      </div>

      {/* 6. 시스템 정보 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
            <Info className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">시스템 정보</h2>
            <p className="text-sm text-gray-500">애플리케이션 환경 정보</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">버전</p>
            <p className="font-medium text-gray-900">v2.0</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">환경</p>
            <p className="font-medium text-gray-900">
              {process.env.NODE_ENV === "production"
                ? "Production"
                : "Development"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Next.js</p>
            <p className="font-medium text-gray-900">14.2.35</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Supabase 프로젝트</p>
            <p className="font-medium text-gray-900 text-xs">jjtvpexmbxvcsplnyczp</p>
          </div>
        </div>
      </div>
    </div>
  );
}
