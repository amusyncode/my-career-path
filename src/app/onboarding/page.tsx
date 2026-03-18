"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  Key,
  Copy,
  Check,
  ArrowRight,
  Loader2,
  Sparkles,
  Users,
  Shield,
  ExternalLink,
} from "lucide-react";
import type { Profile } from "@/lib/types";

export default function OnboardingPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const router = useRouter();
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (data) {
      const p = data as Profile;
      if (p.role !== "instructor") {
        router.push("/dashboard");
        return;
      }
      if (p.is_onboarded) {
        router.push("/admin/dashboard");
        return;
      }
      setProfile(p);
      if (p.gemini_api_key) {
        setApiKey(p.gemini_api_key);
        setApiKeyValid(true);
      }
    }
  }, [supabase, router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const validateApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error("API 키를 입력해주세요.");
      return;
    }

    setIsValidating(true);
    try {
      // Simple validation: try to call Gemini API
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey.trim()}`
      );
      if (res.ok) {
        setApiKeyValid(true);
        toast.success("API 키가 유효합니다!");
      } else {
        setApiKeyValid(false);
        toast.error("유효하지 않은 API 키입니다.");
      }
    } catch {
      setApiKeyValid(false);
      toast.error("API 키 검증 중 오류가 발생했습니다.");
    }
    setIsValidating(false);
  };

  const copyInviteCode = () => {
    if (profile?.invite_code) {
      navigator.clipboard.writeText(profile.invite_code);
      setCopied(true);
      toast.success("초대코드가 복사되었습니다!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleComplete = async () => {
    if (!apiKeyValid) {
      toast.error("먼저 API 키를 검증해주세요.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        gemini_api_key: apiKey.trim(),
        is_onboarded: true,
      })
      .eq("id", profile?.id);

    if (error) {
      toast.error("저장 실패: " + error.message);
      setSaving(false);
      return;
    }

    toast.success("온보딩 완료! 대시보드로 이동합니다.");
    router.push("/admin/dashboard");
    router.refresh();
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            환영합니다, {profile.name} 선생님!
          </h1>
          <p className="text-gray-500 mt-2">
            서비스 이용을 위해 초기 설정을 완료해주세요
          </p>
        </div>

        {/* 단계 표시 */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step === s
                    ? "bg-purple-600 text-white"
                    : step > s
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {step > s ? <Check className="w-4 h-4" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={`w-12 h-0.5 ${step > s ? "bg-green-500" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: 서비스 소개 */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              MyCareerPath 강사 기능 안내
            </h2>

            <div className="space-y-4 mb-8">
              <div className="flex gap-4 p-4 bg-purple-50 rounded-xl">
                <Users className="w-8 h-8 text-purple-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">학생 관리</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    초대코드로 학생을 등록하고, 이력서/자소서를 관리하세요.
                    학생별 진행 현황을 한눈에 파악할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-blue-50 rounded-xl">
                <Sparkles className="w-8 h-8 text-blue-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">AI 첨삭</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Google Gemini AI를 활용한 이력서/자소서 자동 첨삭 기능을
                    제공합니다. 본인의 API 키를 사용하므로 비용을 직접 관리할
                    수 있습니다.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 p-4 bg-green-50 rounded-xl">
                <Shield className="w-8 h-8 text-green-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900">데이터 격리</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    선생님의 학생 데이터는 다른 강사와 완전히 격리됩니다.
                    오직 본인의 학생만 관리할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
            >
              다음 단계
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 2: API 키 설정 */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Gemini API 키 설정
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              AI 첨삭 기능을 사용하려면 Google AI Studio에서 발급받은 API 키가
              필요합니다.
            </p>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              Google AI Studio에서 API 키 발급받기
            </a>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  API 키
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setApiKeyValid(null);
                    }}
                    placeholder="AIza..."
                    className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-gray-900 placeholder:text-gray-400"
                  />
                </div>
              </div>

              <button
                onClick={validateApiKey}
                disabled={isValidating || !apiKey.trim()}
                className="w-full py-2.5 border-2 border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : apiKeyValid ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    검증 완료
                  </>
                ) : (
                  "API 키 검증"
                )}
              </button>

              {apiKeyValid === false && (
                <p className="text-sm text-red-500">
                  API 키가 유효하지 않습니다. 다시 확인해주세요.
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              <button
                onClick={() => {
                  if (!apiKeyValid) {
                    toast.error("먼저 API 키를 검증해주세요.");
                    return;
                  }
                  setStep(3);
                }}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2"
              >
                다음 단계
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 초대코드 확인 */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              학생 초대코드
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              아래 초대코드를 학생에게 전달하면, 학생이 회원가입 시 코드를
              입력하여 선생님에게 연결됩니다.
            </p>

            <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 text-center mb-6">
              <p className="text-sm text-purple-600 mb-2">나의 초대코드</p>
              <div className="flex items-center justify-center gap-3">
                <span className="text-3xl font-mono font-bold text-purple-800 tracking-widest">
                  {profile.invite_code || "생성 중..."}
                </span>
                <button
                  onClick={copyInviteCode}
                  className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                  title="복사"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5 text-purple-500" />
                  )}
                </button>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-medium text-gray-800 mb-2">설정 요약</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  이름: {profile.name}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  이메일: {profile.email}
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  API 키: 설정 완료
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  초대코드: {profile.invite_code}
                </li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    설정 완료
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
