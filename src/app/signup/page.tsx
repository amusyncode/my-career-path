"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
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
  GraduationCap as InstructorIcon,
} from "lucide-react";

type SignupRole = "student" | "instructor";

export default function SignupPage() {
  const [role, setRole] = useState<SignupRole>("instructor");
  const [form, setForm] = useState({
    email: "",
    password: "",
    passwordConfirm: "",
    name: "",
    phone: "",
    // student fields
    school: "",
    department: "",
    grade: "",
    inviteCode: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

    // 학생인 경우 초대코드 필수
    if (role === "student" && !form.inviteCode) {
      toast.error("강사 초대코드를 입력해주세요.");
      return;
    }

    setLoading(true);

    // 학생: 초대코드로 강사 찾기
    let instructorId: string | null = null;
    if (role === "student" && form.inviteCode) {
      const { data: instructor } = await supabase
        .from("profiles")
        .select("id")
        .eq("invite_code", form.inviteCode)
        .eq("role", "instructor")
        .single();

      if (!instructor) {
        toast.error("유효하지 않은 초대코드입니다.");
        setLoading(false);
        return;
      }
      instructorId = instructor.id;
    }

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
      try {
        const profileUpdate: Record<string, unknown> = {
          phone: form.phone || null,
        };

        if (role === "student") {
          profileUpdate.school = form.school || null;
          profileUpdate.department = form.department || null;
          profileUpdate.grade = form.grade ? parseInt(form.grade) : null;
          profileUpdate.instructor_id = instructorId;
        }

        if (role === "instructor") {
          // 초대코드 자동 생성 (8자리 랜덤)
          const inviteCode = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();
          profileUpdate.invite_code = inviteCode;
          profileUpdate.is_onboarded = false;
        }

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

    toast.success("회원가입이 완료되었습니다!");

    if (role === "instructor") {
      router.push("/onboarding");
    } else {
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

          {/* 역할 선택 */}
          <div className="flex gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole("instructor")}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-center font-medium transition-all ${
                role === "instructor"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <InstructorIcon
                className={`w-5 h-5 mx-auto mb-1 ${role === "instructor" ? "text-purple-500" : "text-gray-400"}`}
              />
              <div className="text-sm">강사</div>
            </button>
            <button
              type="button"
              onClick={() => setRole("student")}
              className={`flex-1 py-3 px-4 rounded-xl border-2 text-center font-medium transition-all ${
                role === "student"
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <User
                className={`w-5 h-5 mx-auto mb-1 ${role === "student" ? "text-blue-500" : "text-gray-400"}`}
              />
              <div className="text-sm">학생</div>
            </button>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSignup} className="space-y-4">
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

            {/* 전화번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                전화번호
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* 학생 전용 필드 */}
            {role === "student" && (
              <>
                {/* 초대코드 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    강사 초대코드 <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={form.inviteCode}
                      onChange={(e) =>
                        updateField(
                          "inviteCode",
                          e.target.value.toUpperCase()
                        )
                      }
                      placeholder="강사에게 받은 초대코드"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                      required
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    담당 강사에게 초대코드를 요청하세요
                  </p>
                </div>

                {/* 학교명 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    학교명
                  </label>
                  <div className="relative">
                    <School className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={form.school}
                      onChange={(e) => updateField("school", e.target.value)}
                      placeholder="OO대학교"
                      className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>

                {/* 학과 & 학년 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      학과
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
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      학년
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={form.grade}
                        onChange={(e) => updateField("grade", e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors text-gray-900 appearance-none bg-white"
                      >
                        <option value="">선택</option>
                        <option value="1">1학년</option>
                        <option value="2">2학년</option>
                        <option value="3">3학년</option>
                      </select>
                    </div>
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
