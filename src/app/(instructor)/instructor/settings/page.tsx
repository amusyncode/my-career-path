"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Wifi,
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  Trash2,
  Edit3,
  ExternalLink,
  Copy,
  Link,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Profile, Gem } from "@/lib/types";
import ToggleSwitch from "@/components/ui/ToggleSwitch";
import GemEditorModal from "@/components/instructor/GemEditorModal";
import QRCodeModal from "@/components/instructor/QRCodeModal";
import toast from "react-hot-toast";

// --- 알림 설정 타입 ---
interface NotificationSettings {
  newStudent: boolean;
  aiComplete: boolean;
  counselingReminder: boolean;
  studentInactive: boolean;
}

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  newStudent: true,
  aiComplete: true,
  counselingReminder: true,
  studentInactive: false,
};

// --- 시스템 통계 ---
interface SystemStats {
  studentCount: number;
  uploadedDocs: number;
  aiReviews: number;
  counselingCount: number;
  emailCount: number;
  myGemCount: number;
  defaultGemCount: number;
}

export default function InstructorSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  // Auth & Profile
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Section ① Profile
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editSchool, setEditSchool] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Section ② API Key
  const [showApiInput, setShowApiInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState({
    count: 0,
    tokens: 0,
    cost: 0,
  });

  // Section ③ Gems
  const [gemTab, setGemTab] = useState<"default" | "custom">("custom");
  const [defaultGems, setDefaultGems] = useState<Gem[]>([]);
  const [customGems, setCustomGems] = useState<Gem[]>([]);
  const [expandedGem, setExpandedGem] = useState<string | null>(null);
  const [showGemEditor, setShowGemEditor] = useState(false);
  const [editingGem, setEditingGem] = useState<Gem | undefined>(undefined);

  // Section ④ Invite
  const [showQR, setShowQR] = useState(false);
  const [isRegeneratingCode, setIsRegeneratingCode] = useState(false);

  // Section ⑤ Notifications
  const [notifications, setNotifications] = useState<NotificationSettings>(
    DEFAULT_NOTIFICATIONS
  );

  // Section ⑥ System
  const [systemStats, setSystemStats] = useState<SystemStats>({
    studentCount: 0,
    uploadedDocs: 0,
    aiReviews: 0,
    counselingCount: 0,
    emailCount: 0,
    myGemCount: 0,
    defaultGemCount: 0,
  });
  const [apiStatus, setApiStatus] = useState<"ok" | "error" | "none">("none");

  // --- Init ---
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!p || (p.role !== "instructor" && p.role !== "super_admin")) {
        router.push("/");
        return;
      }

      setProfile(p);
      setEditName(p.name || "");
      setEditSchool(p.school || "");
      setEditDept(p.department || "");
      setEditPhone(p.phone || "");
      setAvatarPreview(p.avatar_url);
      setApiStatus(p.gemini_api_key ? "ok" : "none");

      // 알림 설정 로드
      const saved = localStorage.getItem("instructor_notification_settings");
      if (saved) {
        try {
          setNotifications(JSON.parse(saved));
        } catch { /* ignore */ }
      }

      // 통계
      await Promise.all([
        fetchGems(user.id),
        fetchMonthlyUsage(user.id),
        fetchSystemStats(user.id),
      ]);

      setIsLoading(false);
    };
    init();
  }, []);

  // --- Gem fetch ---
  const fetchGems = async (uid: string) => {
    const { data: globals } = await supabase
      .from("gems")
      .select("*")
      .eq("scope", "global")
      .eq("is_active", true)
      .order("sort_order");
    if (globals) setDefaultGems(globals);

    const { data: customs } = await supabase
      .from("gems")
      .select("*")
      .eq("scope", "instructor")
      .eq("created_by", uid)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (customs) setCustomGems(customs);
  };

  // --- Monthly usage ---
  const fetchMonthlyUsage = async (uid: string) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { data } = await supabase
      .from("ai_review_results")
      .select("tokens_used, input_tokens, output_tokens")
      .eq("instructor_id", uid)
      .gte("created_at", monthStart);
    if (data) {
      const count = data.length;
      let totalTokens = 0;
      let totalCost = 0;
      data.forEach((r) => {
        const input = r.input_tokens || 0;
        const output = r.output_tokens || 0;
        const tokens = r.tokens_used || input + output;
        totalTokens += tokens;
        totalCost += (input * 0.15 + output * 0.6) / 1_000_000;
      });
      setMonthlyUsage({ count, tokens: totalTokens, cost: totalCost });
    }
  };

  // --- System stats ---
  const fetchSystemStats = async (uid: string) => {
    const [s1, s2, s3, s4, s5, s6, s7] = await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("instructor_id", uid),
      supabase
        .from("uploaded_resumes")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", uid),
      supabase
        .from("ai_review_results")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", uid),
      supabase
        .from("counseling_records")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", uid),
      supabase
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", uid),
      supabase
        .from("gems")
        .select("id", { count: "exact", head: true })
        .eq("created_by", uid)
        .eq("scope", "instructor"),
      supabase
        .from("gems")
        .select("id", { count: "exact", head: true })
        .eq("scope", "global")
        .eq("is_active", true),
    ]);

    // uploaded_cover_letters 추가
    const { count: clCount } = await supabase
      .from("uploaded_cover_letters")
      .select("id", { count: "exact", head: true })
      .eq("instructor_id", uid);

    setSystemStats({
      studentCount: s1.count || 0,
      uploadedDocs: (s2.count || 0) + (clCount || 0),
      aiReviews: s3.count || 0,
      counselingCount: s4.count || 0,
      emailCount: s5.count || 0,
      myGemCount: s6.count || 0,
      defaultGemCount: s7.count || 0,
    });
  };

  // --- Profile save ---
  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSavingProfile(true);

    let avatarUrl = profile.avatar_url;

    // 아바타 업로드
    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${profile.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);
        avatarUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        name: editName.trim(),
        school: editSchool.trim() || null,
        department: editDept.trim() || null,
        phone: editPhone.trim() || null,
        avatar_url: avatarUrl,
      })
      .eq("id", profile.id);

    if (error) {
      toast.error("프로필 수정에 실패했습니다.");
    } else {
      toast.success("프로필이 수정되었습니다 ✅");
      setProfile({
        ...profile,
        name: editName.trim(),
        school: editSchool.trim() || null,
        department: editDept.trim() || null,
        phone: editPhone.trim() || null,
        avatar_url: avatarUrl,
      });
      setIsEditingProfile(false);
      setAvatarFile(null);
    }
    setIsSavingProfile(false);
  };

  // --- Password change ---
  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }
    setIsChangingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("비밀번호 변경에 실패했습니다.");
    } else {
      toast.success("비밀번호가 변경되었습니다");
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsChangingPw(false);
  };

  // --- API Key ---
  const handleSaveApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsSavingApiKey(true);
    try {
      const res = await fetch("/api/instructor/save-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKeyInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("API 키가 저장되었습니다 ✅");
        setShowApiInput(false);
        setApiKeyInput("");
        setApiStatus("ok");
        if (profile) {
          setProfile({ ...profile, gemini_api_key: apiKeyInput.trim() });
        }
      } else {
        toast.error(data.error || "API 키 저장에 실패했습니다.");
      }
    } catch {
      toast.error("서버 연결에 실패했습니다.");
    }
    setIsSavingApiKey(false);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/gemini/test-connection");
      const data = await res.json();
      if (data.success) {
        setTestResult({
          success: true,
          message: `API 연결 정상 (${data.model})`,
        });
        setApiStatus("ok");
      } else {
        setTestResult({ success: false, message: `연결 실패: ${data.error}` });
        setApiStatus("error");
      }
    } catch {
      setTestResult({ success: false, message: "테스트 요청 실패" });
      setApiStatus("error");
    }
    setIsTesting(false);
  };

  // --- Gem delete ---
  const handleDeleteGem = async (gem: Gem) => {
    if (!confirm(`"${gem.name}" Gem을 삭제하시겠습니까?`)) return;
    const { error } = await supabase
      .from("gems")
      .update({ is_active: false })
      .eq("id", gem.id)
      .eq("created_by", profile?.id);
    if (error) {
      toast.error("삭제에 실패했습니다.");
    } else {
      toast.success("Gem이 삭제되었습니다.");
      setCustomGems((prev) => prev.filter((g) => g.id !== gem.id));
    }
  };

  // --- Invite code ---
  const generateInviteCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  };

  const handleRegenerateCode = async () => {
    if (
      !confirm(
        "초대 코드를 변경하시겠습니까? 기존 코드는 더 이상 사용할 수 없습니다."
      )
    )
      return;
    if (!profile) return;
    setIsRegeneratingCode(true);
    const newCode = generateInviteCode();
    const { error } = await supabase
      .from("profiles")
      .update({ invite_code: newCode })
      .eq("id", profile.id);
    if (error) {
      toast.error("초대 코드 변경에 실패했습니다.");
    } else {
      toast.success("초대 코드가 변경되었습니다");
      setProfile({ ...profile, invite_code: newCode });
    }
    setIsRegeneratingCode(false);
  };

  const copyText = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  // --- Notification toggle ---
  const toggleNotification = (key: keyof NotificationSettings) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem(
      "instructor_notification_settings",
      JSON.stringify(updated)
    );
    toast.success("알림 설정이 변경되었습니다");
  };

  // --- Helpers ---
  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "****";
    return key.slice(0, 4) + "****...****" + key.slice(-2);
  };

  const eduLabel = (level: string) =>
    level === "high_school"
      ? "특성화고"
      : level === "university"
      ? "대학생"
      : "공통";

  const categoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      resume: "이력서",
      cover_letter: "자소서",
      analysis: "분석",
      counseling: "상담",
    };
    return map[cat] || cat;
  };

  // Group default gems
  const groupGems = (gems: Gem[]) => {
    const groups: Record<string, Gem[]> = {};
    gems.forEach((g) => {
      const key = `${eduLabel(g.education_level)} ${categoryLabel(g.category)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });
    return groups;
  };

  const inviteUrl = profile?.invite_code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/signup?invite=${profile.invite_code}`
    : "";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const sectionNav = [
    { id: "profile", label: "👤 프로필 정보" },
    { id: "api-key", label: "🔑 API 키" },
    { id: "gems", label: "🤖 내 Gem" },
    { id: "invite", label: "🔗 초대 코드" },
    { id: "notifications", label: "🔔 알림" },
    { id: "system", label: "ℹ️ 시스템" },
  ];

  return (
    <div className="flex gap-6">
      {/* 좌측 네비 (md 이상) */}
      <nav className="hidden md:block w-48 flex-shrink-0 sticky top-24 self-start">
        <ul className="space-y-1">
          {sectionNav.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block px-3 py-2 text-sm rounded-lg hover:bg-purple-50 text-gray-600 hover:text-purple-700 transition"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* 우측 콘텐츠 */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-gray-500 text-sm mt-1">계정 및 시스템 설정</p>
        </div>

        {/* ===== ① 프로필 정보 ===== */}
        <section id="profile" className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">👤 프로필 정보</h2>
            {isEditingProfile ? (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={isSavingProfile}
                  className="bg-purple-500 text-white rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {isSavingProfile && (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  )}
                  저장
                </button>
                <button
                  onClick={() => {
                    setIsEditingProfile(false);
                    setEditName(profile.name || "");
                    setEditSchool(profile.school || "");
                    setEditDept(profile.department || "");
                    setEditPhone(profile.phone || "");
                    setAvatarFile(null);
                    setAvatarPreview(profile.avatar_url);
                  }}
                  className="text-sm text-gray-400 hover:text-gray-600"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingProfile(true)}
                className="bg-white border border-gray-200 text-gray-600 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                수정
              </button>
            )}
          </div>

          {/* Avatar */}
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-2xl font-bold overflow-hidden">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  profile.name?.charAt(0) || "?"
                )}
              </div>
              {isEditingProfile && (
                <label className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center cursor-pointer opacity-0 hover:opacity-100 transition">
                  <Camera className="w-6 h-6 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 2 * 1024 * 1024) {
                          toast.error("이미지는 2MB 이하만 가능합니다.");
                          return;
                        }
                        setAvatarFile(f);
                        setAvatarPreview(URL.createObjectURL(f));
                      }
                    }}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">이름</label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <p className="text-gray-900 font-medium">{profile.name}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">이메일</label>
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="bg-gray-50 text-gray-500 rounded-lg px-3 py-2 text-sm flex-1">
                  {profile.email}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                이메일은 변경할 수 없습니다
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                소속 학교/기관
              </label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editSchool}
                  onChange={(e) => setEditSchool(e.target.value)}
                  placeholder="학교 또는 기관명"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <p className="text-gray-900">{profile.school || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                담당 학과
              </label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  placeholder="담당 학과"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <p className="text-gray-900">{profile.department || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">연락처</label>
              {isEditingProfile ? (
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
              ) : (
                <p className="text-gray-900">{profile.phone || "-"}</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">역할</label>
              <span
                className={`inline-block text-xs px-2 py-1 rounded-full ${
                  profile.role === "super_admin"
                    ? "bg-red-100 text-red-700"
                    : "bg-purple-100 text-purple-700"
                }`}
              >
                {profile.role === "super_admin" ? "관리자" : "강사"}
              </span>
            </div>
          </div>

          {/* Password change */}
          <div className="border-t pt-4 mt-4">
            <p className="font-medium text-sm mb-3">비밀번호 변경</p>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (6자 이상)"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="비밀번호 확인"
                className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
            </div>
            {newPassword &&
              confirmPassword &&
              newPassword !== confirmPassword && (
                <p className="text-red-500 text-xs mt-1">
                  비밀번호가 일치하지 않습니다
                </p>
              )}
            <button
              onClick={handleChangePassword}
              disabled={isChangingPw || !newPassword}
              className="mt-3 bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 disabled:opacity-50"
            >
              {isChangingPw ? "변경 중..." : "비밀번호 변경"}
            </button>
          </div>
        </section>

        {/* ===== ② API 키 관리 ===== */}
        <section id="api-key" className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-4">🔑 Gemini API 키</h2>

          {/* Status */}
          <div
            className={`rounded-lg p-4 mb-4 ${
              profile.gemini_api_key
                ? "bg-green-50 border border-green-200"
                : "bg-red-50 border border-red-200"
            }`}
          >
            {profile.gemini_api_key ? (
              <>
                <p className="text-green-700 font-medium">
                  ✅ API 키가 설정되어 있습니다
                </p>
                <p className="text-sm text-gray-600 font-mono bg-gray-100 rounded px-2 py-1 mt-1 inline-block">
                  {maskApiKey(profile.gemini_api_key)}
                </p>
              </>
            ) : (
              <>
                <p className="text-red-700 font-medium">
                  ❌ API 키가 설정되지 않았습니다
                </p>
                <p className="text-sm text-red-600 mt-1">
                  AI 첨삭 기능을 사용하려면 API 키를 등록해주세요
                </p>
              </>
            )}
          </div>

          {/* Input */}
          {!showApiInput ? (
            <button
              onClick={() => setShowApiInput(true)}
              className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600"
            >
              {profile.gemini_api_key ? "키 변경" : "API 키 등록"}
            </button>
          ) : (
            <div className="flex gap-2 mb-3">
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="Gemini API 키를 입력하세요 (AIza...)"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={isSavingApiKey}
                className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
              >
                {isSavingApiKey && (
                  <Loader2 className="w-3 h-3 animate-spin" />
                )}
                저장
              </button>
              <button
                onClick={() => {
                  setShowApiInput(false);
                  setApiKeyInput("");
                }}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                취소
              </button>
            </div>
          )}

          {/* Test connection */}
          <div className="mt-3">
            <button
              onClick={handleTestConnection}
              disabled={isTesting || !profile.gemini_api_key}
              className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {isTesting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wifi className="w-4 h-4" />
              )}
              {isTesting ? "테스트 중..." : "연결 테스트"}
            </button>
            {testResult && (
              <p
                className={`mt-2 text-sm ${
                  testResult.success ? "text-green-600" : "text-red-500"
                }`}
              >
                {testResult.success ? "✅" : "❌"} {testResult.message}
              </p>
            )}
          </div>

          {/* Guide */}
          <div className="bg-gray-50 rounded-lg p-4 mt-4">
            <p className="font-medium text-sm mb-2">
              💡 Gemini API 키 발급 방법
            </p>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Google AI Studio 접속</li>
              <li>Google 계정으로 로그인</li>
              <li>&quot;Create API Key&quot; 클릭</li>
              <li>발급된 키를 위에 입력</li>
            </ol>
            <p className="text-xs text-gray-400 mt-2">
              무료 사용 한도: RPM 15회, RPD 1,500회
            </p>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-600 text-sm hover:underline inline-flex items-center gap-1 mt-1"
            >
              Google AI Studio 바로가기
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Monthly usage */}
          <div className="border-t pt-4 mt-4">
            <p className="font-medium text-sm mb-2">📊 이번 달 사용량</p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-400">첨삭 건수</p>
                <p className="font-bold text-lg">{monthlyUsage.count}건</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">사용 토큰</p>
                <p className="font-bold text-lg">
                  {monthlyUsage.tokens.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">예상 비용</p>
                <p className="font-bold text-lg">
                  ~${monthlyUsage.cost.toFixed(4)}
                </p>
                <p className="text-xs text-gray-400">
                  (약 {Math.round(monthlyUsage.cost * 1350)}원)
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===== ③ 내 Gem 관리 ===== */}
        <section id="gems" className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-lg">🤖 내 Gem 관리</h2>
            <button
              onClick={() => {
                setEditingGem(undefined);
                setShowGemEditor(true);
              }}
              className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />새 Gem 만들기
            </button>
          </div>

          <div className="bg-purple-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-purple-700">
              Gem은 AI 첨삭에 사용하는 전문가 프롬프트입니다. 전공과별 맞춤
              Gem을 만들어 더 정확한 첨삭 결과를 얻으세요.
            </p>
          </div>

          {/* Tabs */}
          <div className="flex border-b mb-4">
            <button
              onClick={() => setGemTab("custom")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                gemTab === "custom"
                  ? "border-purple-500 text-purple-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              내 커스텀 Gem ({customGems.length})
            </button>
            <button
              onClick={() => setGemTab("default")}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                gemTab === "default"
                  ? "border-purple-500 text-purple-700"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              기본 Gem ({defaultGems.length})
            </button>
          </div>

          {/* Default Gems */}
          {gemTab === "default" && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 mb-2">
                기본 Gem은 읽기 전용입니다. 수정이 필요하면 &quot;기본 템플릿 불러오기&quot;로 커스텀 Gem을 만드세요.
              </p>
              {Object.entries(groupGems(defaultGems)).map(([group, gems]) => (
                <div key={group}>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    {group}
                  </h4>
                  {gems.map((g) => (
                    <div
                      key={g.id}
                      className="bg-gray-50 rounded-lg p-4 mb-2"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-medium text-sm">
                            {g.is_default && "⭐ "}
                            {g.name}
                          </span>
                          {g.department && (
                            <span className="text-sm text-gray-500 ml-2">
                              {g.department}
                            </span>
                          )}
                          <div className="flex gap-1 mt-1">
                            <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">
                              {eduLabel(g.education_level)}
                            </span>
                            <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                              {categoryLabel(g.category)}
                            </span>
                            {g.usage_count > 0 && (
                              <span className="text-xs text-gray-400">
                                {g.usage_count}회 사용
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            setExpandedGem(
                              expandedGem === g.id ? null : g.id
                            )
                          }
                          className="text-sm text-purple-600 hover:underline flex items-center gap-0.5"
                        >
                          프롬프트 보기
                          {expandedGem === g.id ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      {expandedGem === g.id && (
                        <pre className="bg-white border rounded-lg p-3 mt-2 text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                          {g.system_prompt}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {defaultGems.length === 0 && (
                <p className="text-center text-gray-400 py-8">
                  기본 Gem이 없습니다
                </p>
              )}
            </div>
          )}

          {/* Custom Gems */}
          {gemTab === "custom" && (
            <div className="space-y-3">
              {customGems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-2">
                    아직 커스텀 Gem이 없습니다
                  </p>
                  <p className="text-sm text-gray-400 mb-4">
                    기본 Gem을 기반으로 나만의 전문 Gem을 만들어보세요
                  </p>
                  <button
                    onClick={() => {
                      setEditingGem(undefined);
                      setShowGemEditor(true);
                    }}
                    className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium"
                  >
                    + 새 Gem 만들기
                  </button>
                </div>
              ) : (
                customGems.map((g) => (
                  <div
                    key={g.id}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-medium">{g.name}</span>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          <span className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded-full">
                            {eduLabel(g.education_level)}
                          </span>
                          <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">
                            {categoryLabel(g.category)}
                          </span>
                          {g.department && (
                            <span className="text-xs text-gray-400">
                              {g.department}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(g.created_at).toLocaleDateString("ko-KR")}{" "}
                          생성 · {g.usage_count}회 사용
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingGem(g);
                            setShowGemEditor(true);
                          }}
                          className="text-purple-600 text-sm hover:underline flex items-center gap-0.5"
                        >
                          <Edit3 className="w-3 h-3" />
                          수정
                        </button>
                        <button
                          onClick={() => handleDeleteGem(g)}
                          className="text-red-400 text-sm hover:underline flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          삭제
                        </button>
                        <button
                          onClick={() =>
                            setExpandedGem(
                              expandedGem === g.id ? null : g.id
                            )
                          }
                          className="text-gray-500 text-sm hover:underline"
                        >
                          프롬프트
                          {expandedGem === g.id ? (
                            <ChevronUp className="w-3 h-3 inline ml-0.5" />
                          ) : (
                            <ChevronDown className="w-3 h-3 inline ml-0.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {expandedGem === g.id && (
                      <pre className="bg-gray-50 border rounded-lg p-3 mt-2 text-xs font-mono max-h-40 overflow-y-auto whitespace-pre-wrap">
                        {g.system_prompt}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </section>

        {/* ===== ④ 초대 코드 ===== */}
        <section id="invite" className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-4">🔗 학생 초대</h2>

          <div className="bg-purple-50 rounded-lg p-5 mb-4">
            <p className="text-sm text-purple-600 mb-1">내 초대 코드</p>
            <p className="text-3xl font-bold text-purple-700 tracking-widest font-mono">
              {profile.invite_code || "미생성"}
            </p>
            <p className="text-xs text-purple-600 mt-2">
              이 코드를 학생에게 공유하면 자동으로 내 클래스에 등록됩니다
            </p>
            <div className="flex gap-3 mt-3">
              <button
                onClick={() =>
                  copyText(
                    profile.invite_code || "",
                    "초대 코드가 복사되었습니다"
                  )
                }
                className="bg-purple-500 text-white rounded-lg px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-purple-600"
              >
                <Copy className="w-3.5 h-3.5" />
                코드 복사
              </button>
              <button
                onClick={() =>
                  copyText(inviteUrl, "초대 링크가 복사되었습니다")
                }
                className="bg-white border border-purple-300 text-purple-600 rounded-lg px-3 py-1.5 text-sm flex items-center gap-1 hover:bg-purple-50"
              >
                <Link className="w-3.5 h-3.5" />
                초대 링크 복사
              </button>
              <button
                onClick={() => setShowQR(true)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                QR 코드
              </button>
            </div>
          </div>

          {/* Signup link */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-gray-600 mb-2">학생 가입 링크</p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm font-mono text-gray-600 break-all">
              {inviteUrl}
            </div>
          </div>

          {/* Regenerate */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm text-gray-600 mb-2">초대 코드 변경</p>
            <button
              onClick={handleRegenerateCode}
              disabled={isRegeneratingCode}
              className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {isRegeneratingCode ? "생성 중..." : "새 코드 생성"}
            </button>
          </div>
        </section>

        {/* ===== ⑤ 알림 설정 ===== */}
        <section
          id="notifications"
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <h2 className="font-semibold text-lg mb-4">🔔 알림 설정</h2>
          <div className="divide-y">
            {[
              {
                key: "newStudent" as const,
                label: "신규 학생 가입 알림",
                desc: "초대 코드로 새 학생이 가입하면 대시보드에 알림을 표시합니다",
              },
              {
                key: "aiComplete" as const,
                label: "AI 첨삭 완료 알림",
                desc: "AI 첨삭이 완료되면 대시보드에 알림을 표시합니다",
              },
              {
                key: "counselingReminder" as const,
                label: "상담 예정일 알림",
                desc: "예정된 상담이 있는 날 대시보드에 알림을 표시합니다",
              },
              {
                key: "studentInactive" as const,
                label: "학생 비활동 알림",
                desc: "7일 이상 활동이 없는 학생이 있으면 알림을 표시합니다",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex justify-between items-center py-3"
              >
                <div>
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.desc}</p>
                </div>
                <ToggleSwitch
                  checked={notifications[item.key]}
                  onChange={() => toggleNotification(item.key)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* ===== ⑥ 시스템 정보 ===== */}
        <section id="system" className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-lg mb-4">ℹ️ 시스템 정보</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { label: "사이트 버전", value: "v2.0.0" },
              {
                label: "내 학생 수",
                value: `${systemStats.studentCount}명`,
              },
              {
                label: "총 업로드 문서",
                value: `${systemStats.uploadedDocs}건`,
              },
              {
                label: "총 AI 첨삭",
                value: `${systemStats.aiReviews}건`,
              },
              {
                label: "총 상담 기록",
                value: `${systemStats.counselingCount}건`,
              },
              {
                label: "총 이메일 발송",
                value: `${systemStats.emailCount}건`,
              },
              { label: "AI 모델", value: "Gemini 2.5 Flash" },
              {
                label: "내 Gem 수",
                value: `커스텀 ${systemStats.myGemCount}개 + 기본 ${systemStats.defaultGemCount}개`,
              },
              {
                label: "API 상태",
                value:
                  apiStatus === "ok"
                    ? "🟢 정상"
                    : apiStatus === "error"
                    ? "🔴 오류"
                    : "⚪ 미설정",
              },
              { label: "Supabase", value: "🟢 연결됨" },
              {
                label: "가입일",
                value: new Date(profile.created_at).toLocaleDateString(
                  "ko-KR"
                ),
              },
            ].map((item) => (
              <div key={item.label} className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                <p className="font-medium text-sm">{item.value}</p>
              </div>
            ))}
          </div>

          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            className="mt-4 bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Wifi className="w-4 h-4" />
            )}
            연결 테스트 실행
          </button>
        </section>
      </div>

      {/* Modals */}
      {showGemEditor && (
        <GemEditorModal
          gem={editingGem}
          instructorId={profile.id}
          onClose={() => setShowGemEditor(false)}
          onSave={() => fetchGems(profile.id)}
        />
      )}

      {showQR && <QRCodeModal url={inviteUrl} onClose={() => setShowQR(false)} />}
    </div>
  );
}
