"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import type { Profile, Gem } from "@/lib/types";
import {
  ArrowLeft,
  Users,
  Sparkles,
  MessageSquareHeart,
  Mail,
  Ban,
  CheckCircle,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  Phone,
  Building,
  Calendar,
  Shield,
} from "lucide-react";
import toast from "react-hot-toast";

interface InstructorStats {
  studentCount: number;
  reviewCount: number;
  counselingCount: number;
  emailCount: number;
}

interface StudentRow {
  id: string;
  name: string;
  email: string | null;
  school: string | null;
  department: string | null;
  education_level: string;
  created_at: string;
  documentCount: number;
  lastActivity: string | null;
}

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%";
  const all = upper + lower + digits + special;
  let pw =
    upper[Math.floor(Math.random() * upper.length)] +
    lower[Math.floor(Math.random() * lower.length)] +
    digits[Math.floor(Math.random() * digits.length)] +
    special[Math.floor(Math.random() * special.length)];
  for (let i = 4; i < 12; i++)
    pw += all[Math.floor(Math.random() * all.length)];
  return pw
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

export default function InstructorDetailPage() {
  const params = useParams();
  const instructorId = params.instructorId as string;
  const supabase = createClient();

  const [instructor, setInstructor] = useState<Profile | null>(null);
  const [stats, setStats] = useState<InstructorStats>({
    studentCount: 0,
    reviewCount: 0,
    counselingCount: 0,
    emailCount: 0,
  });
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [gems, setGems] = useState<Gem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch instructor profile
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", instructorId)
        .single();

      if (error) throw error;
      setInstructor(profile as Profile);

      // Fetch related data in parallel
      const [studentsRes, reviewsRes, counselingRes, emailsRes, gemsRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, name, email, school, department, education_level, created_at")
            .eq("role", "student")
            .eq("instructor_id", instructorId)
            .order("created_at", { ascending: false }),
          supabase
            .from("ai_review_results")
            .select("id", { count: "exact", head: true })
            .eq("instructor_id", instructorId),
          supabase
            .from("counseling_records")
            .select("id", { count: "exact", head: true })
            .eq("instructor_id", instructorId),
          supabase
            .from("email_logs")
            .select("id", { count: "exact", head: true })
            .eq("instructor_id", instructorId),
          supabase
            .from("gems")
            .select("*")
            .eq("scope", "instructor")
            .eq("created_by", instructorId)
            .order("created_at", { ascending: false }),
        ]);

      setStats({
        studentCount: studentsRes.data?.length ?? 0,
        reviewCount: reviewsRes.count ?? 0,
        counselingCount: counselingRes.count ?? 0,
        emailCount: emailsRes.count ?? 0,
      });

      // Get student document counts and last activity
      const studentProfiles = studentsRes.data || [];
      if (studentProfiles.length > 0) {
        const studentIds = studentProfiles.map((s) => s.id);

        const [resumesRes, coverLettersRes, streaksRes] = await Promise.all([
          supabase
            .from("uploaded_resumes")
            .select("user_id")
            .in("user_id", studentIds),
          supabase
            .from("uploaded_cover_letters")
            .select("user_id")
            .in("user_id", studentIds),
          supabase
            .from("streaks")
            .select("user_id, last_active_date")
            .in("user_id", studentIds),
        ]);

        const docCountMap: Record<string, number> = {};
        resumesRes.data?.forEach((r) => {
          docCountMap[r.user_id] = (docCountMap[r.user_id] || 0) + 1;
        });
        coverLettersRes.data?.forEach((c) => {
          docCountMap[c.user_id] = (docCountMap[c.user_id] || 0) + 1;
        });

        const streakMap: Record<string, string | null> = {};
        streaksRes.data?.forEach((s) => {
          streakMap[s.user_id] = s.last_active_date;
        });

        const rows: StudentRow[] = studentProfiles.map((s) => ({
          id: s.id,
          name: s.name,
          email: s.email,
          school: s.school,
          department: s.department,
          education_level: s.education_level,
          created_at: s.created_at,
          documentCount: docCountMap[s.id] || 0,
          lastActivity: streakMap[s.id] || null,
        }));

        setStudents(rows);
      } else {
        setStudents([]);
      }

      setGems((gemsRes.data as Gem[]) || []);
    } catch (err) {
      console.error("강사 상세 조회 실패:", err);
      toast.error("강사 정보를 불러오는데 실패했습니다.");
    }
    setIsLoading(false);
  }, [supabase, instructorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async () => {
    if (!instructor) return;
    try {
      const res = await fetch("/api/admin/update-instructor", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: instructor.id,
          updates: { is_active: !instructor.is_active },
        }),
      });
      if (!res.ok) throw new Error("업데이트 실패");
      toast.success(
        !instructor.is_active
          ? "강사가 활성화되었습니다."
          : "강사가 비활성화되었습니다."
      );
      fetchData();
    } catch {
      toast.error("상태 변경에 실패했습니다.");
    }
  };

  const handleResetPassword = async () => {
    if (
      !confirm("비밀번호를 초기화하시겠습니까? 새 비밀번호가 자동 생성됩니다.")
    )
      return;

    setIsResetting(true);
    const newPassword = generatePassword();
    try {
      const res = await fetch("/api/admin/reset-instructor-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId,
          newPassword: newPassword,
        }),
      });
      if (!res.ok) throw new Error("비밀번호 초기화 실패");
      setResetPassword(newPassword);
      setShowResetPassword(true);
      toast.success("비밀번호가 초기화되었습니다.");
    } catch {
      toast.error("비밀번호 초기화에 실패했습니다.");
    }
    setIsResetting(false);
  };

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success("복사되었습니다.");
    setTimeout(() => setCopiedField(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex gap-6">
            <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-3">
              <div className="h-6 w-40 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-60 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-lg shadow-sm p-4">
              <div className="h-4 w-16 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="h-8 w-12 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!instructor) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">강사 정보를 찾을 수 없습니다.</p>
        <Link
          href="/admin/instructors"
          className="text-red-600 hover:underline mt-2 inline-block"
        >
          강사 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const initials = instructor.name
    ? instructor.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const educationLevelLabel = (level: string) => {
    switch (level) {
      case "high_school":
        return "고등학교";
      case "university":
        return "대학교";
      default:
        return level;
    }
  };

  const gemCategoryLabel = (cat: string) => {
    switch (cat) {
      case "resume":
        return "이력서";
      case "cover_letter":
        return "자소서";
      case "analysis":
        return "분석";
      case "counseling":
        return "상담";
      default:
        return cat;
    }
  };

  const statCards = [
    { icon: Users, label: "학생 수", value: stats.studentCount, color: "text-blue-500" },
    { icon: Sparkles, label: "총 AI 첨삭", value: stats.reviewCount, color: "text-purple-500" },
    { icon: MessageSquareHeart, label: "총 상담", value: stats.counselingCount, color: "text-green-500" },
    { icon: Mail, label: "총 이메일", value: stats.emailCount, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <Link
        href="/admin/instructors"
        className="text-sm text-gray-500 hover:text-red-600 flex items-center gap-1 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        강사관리
      </Link>

      {/* Profile card */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          {/* Avatar */}
          {instructor.avatar_url ? (
            <img
              src={instructor.avatar_url}
              alt={instructor.name}
              className="w-20 h-20 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
              {initials}
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {instructor.name}
              </h1>
              {instructor.is_active ? (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  활성
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  비활성
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {instructor.email}
              </span>
              {instructor.school && (
                <span className="flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  {instructor.school}
                </span>
              )}
              {instructor.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5" />
                  {instructor.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(instructor.created_at).toLocaleDateString("ko-KR")}{" "}
                가입
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1 text-gray-500">
                <Shield className="w-3.5 h-3.5" />
                API 키:{" "}
                {instructor.gemini_api_key ? (
                  <span className="text-green-600 font-medium">설정됨</span>
                ) : (
                  <span className="text-red-500 font-medium">미설정</span>
                )}
              </span>
              {instructor.invite_code && (
                <span className="flex items-center gap-1 text-gray-500">
                  <KeyRound className="w-3.5 h-3.5" />
                  초대코드:{" "}
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">
                    {instructor.invite_code}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(instructor.invite_code!, "invite")
                    }
                    className="p-0.5 hover:bg-gray-100 rounded"
                  >
                    {copiedField === "invite" ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-gray-400" />
                    )}
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <button
              onClick={handleToggleActive}
              className={`rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 transition-colors ${
                instructor.is_active
                  ? "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                  : "bg-green-500 text-white hover:bg-green-600"
              }`}
            >
              {instructor.is_active ? (
                <>
                  <Ban className="w-4 h-4" />
                  비활성화
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  활성화
                </>
              )}
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isResetting}
              className="bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm flex items-center gap-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              {isResetting ? "초기화 중..." : "비밀번호 초기화"}
            </button>
          </div>
        </div>

        {/* Reset password result */}
        {resetPassword && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  새 비밀번호가 생성되었습니다
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm font-mono text-yellow-900 bg-yellow-100 px-2 py-0.5 rounded">
                    {showResetPassword ? resetPassword : "************"}
                  </code>
                  <button
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="p-1 hover:bg-yellow-100 rounded"
                  >
                    {showResetPassword ? (
                      <EyeOff className="w-4 h-4 text-yellow-700" />
                    ) : (
                      <Eye className="w-4 h-4 text-yellow-700" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      copyToClipboard(resetPassword, "resetPw")
                    }
                    className="p-1 hover:bg-yellow-100 rounded"
                  >
                    {copiedField === "resetPw" ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-yellow-700" />
                    )}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-xs text-yellow-700 mt-2">
              &#9888; 이 비밀번호를 강사에게 전달하세요. 다시 확인할 수 없습니다.
            </p>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-sm text-gray-500">{card.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Students table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            소속 학생{" "}
            <span className="text-sm font-normal text-gray-400">
              ({students.length}명)
            </span>
          </h3>
        </div>
        {students.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>소속 학생이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    이름
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    소속
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    학과
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    학교급
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    문서 수
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    최근 활동
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr
                    key={student.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() =>
                      window.location.assign(
                        `/admin/students/${student.id}`
                      )
                    }
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">
                        {student.name}
                      </p>
                      <p className="text-xs text-gray-400">{student.email}</p>
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {student.school || "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {student.department || "-"}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {educationLevelLabel(student.education_level)}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-900 font-medium">
                      {student.documentCount}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {student.lastActivity
                        ? new Date(student.lastActivity).toLocaleDateString(
                            "ko-KR"
                          )
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Custom Gems */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            커스텀 Gem{" "}
            <span className="text-sm font-normal text-gray-400">
              ({gems.length}개)
            </span>
          </h3>
        </div>
        {gems.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <Sparkles className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p>커스텀 Gem이 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    Gem 이름
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    카테고리
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    학교급
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-500">
                    사용 횟수
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-500">
                    생성일
                  </th>
                </tr>
              </thead>
              <tbody>
                {gems.map((gem) => (
                  <tr
                    key={gem.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-900">{gem.name}</p>
                      {gem.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">
                          {gem.description}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">
                        {gemCategoryLabel(gem.category)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {gem.education_level === "all"
                        ? "전체"
                        : educationLevelLabel(gem.education_level)}
                    </td>
                    <td className="py-3 px-4 text-center text-gray-900 font-medium">
                      {gem.usage_count}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(gem.created_at).toLocaleDateString("ko-KR")}
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
