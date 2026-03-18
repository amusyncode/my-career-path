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
  ExternalLink,
  Users,
} from "lucide-react";
import type { Profile } from "@/lib/types";

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [studentCount, setStudentCount] = useState(0);
  const supabase = createClient();

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
      setApiKey(p.gemini_api_key || "");
      if (p.gemini_api_key) setApiKeyValid(true);

      // 소속 학생 수
      if (p.role === "instructor") {
        const { count } = await supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("instructor_id", p.id)
          .eq("role", "student");
        setStudentCount(count || 0);
      }
    }
    setLoading(false);
  }, [supabase]);

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
      toast.error("검증 중 오류가 발생했습니다.");
    }
    setIsValidating(false);
  };

  const saveApiKey = async () => {
    if (!apiKeyValid) {
      toast.error("먼저 API 키를 검증해주세요.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ gemini_api_key: apiKey.trim() })
      .eq("id", profile?.id);

    if (error) {
      toast.error("저장 실패: " + error.message);
    } else {
      toast.success("API 키가 저장되었습니다.");
    }
    setSaving(false);
  };

  const copyInviteCode = () => {
    if (profile?.invite_code) {
      navigator.clipboard.writeText(profile.invite_code);
      setCopied(true);
      toast.success("초대코드가 복사되었습니다!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const regenerateInviteCode = async () => {
    if (studentCount > 0) {
      const confirmed = confirm(
        `현재 ${studentCount}명의 학생이 등록되어 있습니다.\n코드를 변경하면 새로운 학생만 새 코드로 가입할 수 있습니다.\n계속하시겠습니까?`
      );
      if (!confirmed) return;
    }

    setRegenerating(true);
    const newCode = Math.random()
      .toString(36)
      .substring(2, 10)
      .toUpperCase();

    const { error } = await supabase
      .from("profiles")
      .update({ invite_code: newCode })
      .eq("id", profile?.id);

    if (error) {
      toast.error("코드 변경 실패: " + error.message);
    } else {
      setProfile((prev) => (prev ? { ...prev, invite_code: newCode } : prev));
      toast.success("새 초대코드가 생성되었습니다.");
    }
    setRegenerating(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  if (!profile) return null;

  const isInstructor = profile.role === "instructor";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">계정 및 서비스 설정을 관리합니다</p>
      </div>

      {/* 프로필 정보 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
            <User className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">계정 정보</h2>
            <p className="text-sm text-gray-500">기본 프로필 정보</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500">이름</p>
            <p className="font-medium text-gray-900">{profile.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">이메일</p>
            <p className="font-medium text-gray-900">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">역할</p>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                profile.role === "super_admin"
                  ? "bg-red-100 text-red-700"
                  : "bg-purple-100 text-purple-700"
              }`}
            >
              <Shield className="w-3 h-3" />
              {profile.role === "super_admin" ? "플랫폼 관리자" : "강사"}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500">전화번호</p>
            <p className="font-medium text-gray-900">
              {profile.phone || "-"}
            </p>
          </div>
        </div>
      </div>

      {/* 초대코드 (강사 전용) */}
      {isInstructor && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">학생 초대코드</h2>
              <p className="text-sm text-gray-500">
                학생이 회원가입 시 이 코드를 입력하면 연결됩니다 ·{" "}
                <span className="text-purple-600 font-medium">
                  {studentCount}명 등록됨
                </span>
              </p>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-purple-800 tracking-widest">
              {profile.invite_code || "없음"}
            </span>
            <div className="flex items-center gap-2">
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
              <button
                onClick={regenerateInviteCode}
                disabled={regenerating}
                className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                title="새 코드 생성"
              >
                <RefreshCw
                  className={`w-5 h-5 text-purple-500 ${regenerating ? "animate-spin" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API 키 관리 (강사 전용) */}
      {isInstructor && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                Gemini API 키 관리
              </h2>
              <p className="text-sm text-gray-500">
                AI 첨삭 기능에 사용되는 API 키
              </p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 mb-4"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Google AI Studio에서 API 키 발급
          </a>

          <div className="space-y-3">
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setApiKeyValid(null);
                }}
                placeholder="AIza..."
                className="w-full pl-11 pr-20 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-colors text-gray-900 placeholder:text-gray-400"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                {showApiKey ? (
                  <EyeOff className="w-4 h-4 text-gray-400" />
                ) : (
                  <Eye className="w-4 h-4 text-gray-400" />
                )}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={validateApiKey}
                disabled={isValidating || !apiKey.trim()}
                className="flex-1 py-2.5 border border-purple-200 text-purple-700 rounded-xl font-medium hover:bg-purple-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : apiKeyValid ? (
                  <>
                    <Check className="w-4 h-4 text-green-500" />
                    유효함
                  </>
                ) : (
                  "키 검증"
                )}
              </button>
              <button
                onClick={saveApiKey}
                disabled={saving || !apiKeyValid}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "저장"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
