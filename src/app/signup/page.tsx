"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Mail,
  Lock,
  UserPlus,
  Loader2,
  User,
  School,
  BookOpen,
  GraduationCap,
  Phone,
  KeyRound,
  CheckCircle2,
  XCircle,
  Target,
} from "lucide-react";
import { generateInviteCodeSync } from "@/lib/invite";
import type { EducationLevel } from "@/lib/types";

type SignupRole = "student" | "instructor";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const inviteFromUrl = searchParams.get("invite") || "";

  const [role, setRole] = useState<SignupRole>(inviteFromUrl ? "student" : "instructor");
  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
    school: "",
    department: "",
    grade: "",
    inviteCode: inviteFromUrl,
    instructorCode: "",
    educationLevel: "" as EducationLevel | "",
    targetField: "",
  });
  const [loading, setLoading] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{
    valid: boolean;
    instructorName?: string;
    instructorId?: string;
  } | null>(null);
  const [inviteChecking, setInviteChecking] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // 초대코드 실시간 검증
  const verifyInviteCode = useCallback(
    async (code: string) => {
      if (!code || code.length < 4) {
        setInviteStatus(null);
        return;
      }

      setInviteChecking(true);
      try {
        const res = await fetch("/api/auth/verify-invite-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invite_code: code }),
        });
        const data = await res.json();
        setInviteStatus(data);
      } catch {
        setInviteStatus(null);
      }
      setInviteChecking(false);
    },
    []
  );

  // URL에서 초대코드가 있으면 즉시 검증
  useEffect(() => {
    if (inviteFromUrl) {
      verifyInviteCode(inviteFromUrl);
    }
  }, [inviteFromUrl, verifyInviteCode]);

  // 초대코드 입력시 디바운스 검증
  useEffect(() => {
    if (role !== "student" || !form.inviteCode) return;
    const timer = setTimeout(() => {
      verifyInviteCode(form.inviteCode);
    }, 500);
    return () => clearTimeout(timer);
  }, [form.inviteCode, role, verifyInviteCode]);

  // 학교급에 따른 학년 옵션
  const gradeOptions =
    form.educationLevel === "high_school"
      ? [
          { value: "1", label: "1학년" },
          { value: "2", label: "2학년" },
          { value: "3", label: "3학년" },
        ]
      : form.educationLevel === "university"
        ? [
            { value: "1", label: "1학년" },
            { value: "2", label: "2학년" },
            { value: "3", label: "3학년" },
            { value: "4", label: "4학년" },
          ]
        : [];

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.email || !form.password || !form.name) {
      toast.error("필수 항목을 입력해주세요.");
      return;
    }

    if (form.password.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (form.password !== form.passwordConfirm) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    // 강사: 가입 코드 검증
    if (role === "instructor") {
      const validCode = process.env.NEXT_PUBLIC_INSTRUCTOR_SIGNUP_CODE;
      if (!form.instructorCode || form.instructorCode !== validCode) {
        toast.error("강사 가입 코드가 올바르지 않습니다.");
        return;
      }
    }

    // 학생: 초대코드 검증
    if (role === "student") {
      if (!form.inviteCode) {
        toast.error("강사 초대코드를 입력해주세요.");
        return;
      }
      if (!inviteStatus?.valid) {
        toast.error("유효하지 않은 초대코드입니다.");
        return;
      }
      if (!form.school || !form.department || !form.educationLevel) {
        toast.error("학교, 학과, 학교급은 필수 항목입니다.");
        return;
      }
    }

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          name: form.name,
          role: role,
        },
      },
    });

    if (error) {
      if (
        error.message.includes("already registered") ||
        error.message.includes("already been registered")
      ) {
        toast.error("이미 등록된 이메일입니다.");
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    // 트리거가 profiles INSERT 완료할 시간 확보
    await new Promise((r) => setTimeout(r, 500));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      if (role === "student") {
        try {
          await supabase.rpc('merge_student_profile', {
            p_new_user_id: user.id,
            p_instructor_id: inviteStatus?.instructorId || null,
            p_name: form.name,
            p_email: form.email,
            p_school: form.school || null,
            p_department: form.department || null,
            p_grade: form.grade || null,
            p_education_level: form.educationLevel || null,
          });
        } catch (err) {
          console.error("프로필 병합 실패:", err);
        }
      } else {
        // Instructor branch - keep existing update logic
        try {
          const profileUpdate: Record<string, unknown> = {
            name: form.name,
            phone: form.phone || null,
            invite_code: generateInviteCodeSync(),
            is_onboarded: false,
            school: form.school || null,
          };

          const { error: updateError } = await supabase
            .from("profiles")
            .update(profileUpdate)
            .eq("id", user.id);

          if (updateError) {
            console.error("프로필 업데이트 실패:", updateError);
          }
        } catch (err) {
          console.error("프로필 업데이트 예외:", err);
        }
      }
    }

    if (role === "instructor") {
      toast.success("강사 계정이 생성되었습니다!");
      router.push("/onboarding");
    } else {
      toast.success("학생 계정이 생성되었습니다!");
      router.push("/dashboard");
    }
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12">
      <div className="w-full max-w-md px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          {/* 헤더 */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-2xl mb-4">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">회원가입</h1>
            <p className="text-gray-500 mt-2">
              MyCareerPath에 오신 것을 환영합니다
            </p>
          </div>

          {/* 역할 선택 세그먼트 */}
          <div className="flex rounded-xl border-2 border-gray-200 overflow-hidden mb-6">
            <button
              type="button"
              onClick={() => setRole("instructor")}
              className={`flex-1 py-3 px-4 text-center font-medium transition-all flex items-center justify-center gap-2 ${
                role === "instructor"
                  ? "bg-purple-500 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span className="text-sm">강사로 가입</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 py-3 px-4 text-center font-medium transition-all flex items-center justify-center gap-2 ${
                role === "student"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
            >
              <User className="w-4 h-4" />
              <span className="text-sm">학생으로 가입</span>
            </button>
          </div>

          {role === "student" && (
            <p className="text-xs text-gray-400 text-center mb-4">
              학생 가입은 강사의 초대 코드가 필요합니다
            </p>
          )}

          {/* 폼 */}
          <form onSubmit={handleSignup} className="space-y-4">
            {/* 학생: 초대코드 (최상단) */}
            {role === "student" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  초대 코드 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={form.inviteCode}
                    onChange={(e) =>
                      updateField("inviteCode", e.target.value.toUpperCase())
                    }
                    placeholder="선생님에게 받은 초대 코드를 입력하세요"
                    className="w-full pl-11 pr-10 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                    required
                  />
                  {inviteChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
                  )}
                  {!inviteChecking && inviteStatus?.valid && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500" />
                  )}
                  {!inviteChecking &&
                    inviteStatus !== null &&
                    !inviteStatus.valid && (
                      <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-red-500" />
                    )}
                </div>
                {inviteStatus?.valid && (
                  <p className="text-xs text-green-500 mt-1">
                    {inviteStatus.instructorName} 선생님의 클래스입니다
                  </p>
                )}
                {inviteStatus !== null && !inviteStatus.valid && form.inviteCode.length >= 4 && (
                  <p className="text-xs text-red-500 mt-1">
                    유효하지 않은 초대 코드입니다
                  </p>
                )}
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder="example@email.com"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  placeholder="6자 이상 입력하세요"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={form.passwordConfirm}
                  onChange={(e) =>
                    updateField("passwordConfirm", e.target.value)
                  }
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이름 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder={
                    role === "instructor" ? "강사 이름" : "학생 이름"
                  }
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
            </div>

            {/* 소속 학교/기관 (강사) */}
            {role === "instructor" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  소속 학교/기관
                </label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={form.school}
                    onChange={(e) => updateField("school", e.target.value)}
                    placeholder="소속 학교 또는 기관명"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>
            )}

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                연락처
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* 강사: 가입 코드 */}
            {role === "instructor" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  강사 가입 코드 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={form.instructorCode}
                    onChange={(e) =>
                      updateField("instructorCode", e.target.value)
                    }
                    placeholder="강사 가입 코드를 입력하세요"
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-gray-900 placeholder:text-gray-400"
                    required
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  강사 가입 코드는 플랫폼 운영자에게 문의하세요
                </p>
              </div>
            )}

            {/* 학생 전용 필드 */}
            {role === "student" && (
              <>
                {/* 학교명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    학교 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={form.school}
                      onChange={(e) => updateField("school", e.target.value)}
                      placeholder="OO고등학교 또는 OO대학교"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                </div>

                {/* 학과/전공 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    학과/전공 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={form.department}
                      onChange={(e) =>
                        updateField("department", e.target.value)
                      }
                      placeholder="컴퓨터공학과"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                </div>

                {/* 학교급 & 학년 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      학교급 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={form.educationLevel}
                        onChange={(e) => {
                          updateField("educationLevel", e.target.value);
                          updateField("grade", ""); // 학교급 변경시 학년 초기화
                        }}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 appearance-none bg-white"
                        required
                      >
                        <option value="">선택</option>
                        <option value="high_school">특성화고</option>
                        <option value="university">대학교</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      학년 <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={form.grade}
                        onChange={(e) => updateField("grade", e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 appearance-none bg-white"
                        required
                        disabled={!form.educationLevel}
                      >
                        <option value="">선택</option>
                        {gradeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* 희망 분야 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    희망 분야
                  </label>
                  <div className="relative">
                    <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={form.targetField}
                      onChange={(e) =>
                        updateField("targetField", e.target.value)
                      }
                      placeholder="예: 웹개발, 데이터분석"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 text-white rounded-xl font-semibold focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 ${
                role === "instructor"
                  ? "bg-purple-600 hover:bg-purple-700 focus:ring-purple-500/50"
                  : "bg-primary hover:bg-blue-600 focus:ring-primary/50"
              }`}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : role === "instructor" ? (
                "강사 등록"
              ) : (
                "학생 가입"
              )}
            </button>
          </form>

          {/* 하단 링크 */}
          <p className="text-center text-sm text-gray-500 mt-6">
            이미 계정이 있으신가요?{" "}
            <Link
              href="/login"
              className="text-primary font-semibold hover:underline"
            >
              로그인
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
