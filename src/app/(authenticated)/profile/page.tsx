"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";
import toast from "react-hot-toast";
import {
  Settings,
  User,
  School,
  BookOpen,
  GraduationCap,
  Target,
  Camera,
  Loader2,
  Lock,
  Calendar,
  Shield,
  Save,
} from "lucide-react";

export default function ProfilePage() {
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  /* ─── 프로필 폼 ─── */
  const [form, setForm] = useState({
    name: "",
    school: "",
    department: "",
    grade: "",
    target_field: "",
    bio: "",
  });

  /* ─── 비밀번호 폼 ─── */
  const [pwForm, setPwForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  /* ─── 데이터 로딩 ─── */
  const loadProfile = useCallback(async () => {
    try {
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
        setForm({
          name: p.name || "",
          school: p.school || "",
          department: p.department || "",
          grade: p.grade ? String(p.grade) : "",
          target_field: p.target_field || "",
          bio: p.bio || "",
        });
      }
    } catch (err) {
      console.error(err);
      toast.error("프로필 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /* ─── 아바타 업로드 ─── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(ext || "")) {
      toast.error("JPG, PNG, WEBP 파일만 업로드 가능합니다.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("파일 크기는 2MB 이하여야 합니다.");
      return;
    }

    setAvatarUploading(true);
    try {
      const filePath = `${profile.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const avatarUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", profile.id);

      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, avatar_url: avatarUrl } : prev));
      toast.success("프로필 사진이 변경되었습니다.");
    } catch (err) {
      console.error(err);
      toast.error("프로필 사진 업로드에 실패했습니다.");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  /* ─── 프로필 저장 ─── */
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!form.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: form.name.trim(),
          school: form.school || null,
          department: form.department || null,
          grade: form.grade ? parseInt(form.grade) : null,
          target_field: form.target_field || null,
          bio: form.bio || null,
        })
        .eq("id", profile.id);

      if (error) throw error;
      toast.success("프로필이 저장되었습니다.");
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              name: form.name.trim(),
              school: form.school || null,
              department: form.department || null,
              grade: form.grade ? parseInt(form.grade) : null,
              target_field: form.target_field || null,
              bio: form.bio || null,
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      toast.error("프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  /* ─── 비밀번호 변경 ─── */
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pwForm.newPassword.length < 6) {
      toast.error("비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      toast.error("비밀번호가 일치하지 않습니다.");
      return;
    }

    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: pwForm.newPassword,
      });

      if (error) throw error;
      toast.success("비밀번호가 변경되었습니다.");
      setPwForm({ newPassword: "", confirmPassword: "" });
    } catch (err) {
      console.error(err);
      toast.error("비밀번호 변경에 실패했습니다.");
    } finally {
      setPwSaving(false);
    }
  };

  /* ─── 날짜 포맷 ─── */
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-20 text-gray-500">
        프로필 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-xl">
          <Settings className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-sm text-gray-500">프로필과 계정 설정을 관리하세요.</p>
        </div>
      </div>

      {/* ─── 섹션 1: 프로필 정보 ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <User className="w-5 h-5 text-blue-500" />
          프로필 정보
        </h2>

        {/* 아바타 */}
        <div className="flex items-center gap-5 mb-6">
          <div className="relative">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center border-2 border-gray-200">
                <User className="w-10 h-10 text-blue-400" />
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 p-1.5 bg-blue-500 text-white rounded-full hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {avatarUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5" />
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <p className="font-medium text-gray-900">{profile.name}</p>
            <p className="text-sm text-gray-500">{profile.email || "이메일 미등록"}</p>
          </div>
        </div>

        {/* 프로필 폼 */}
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* 이름 & 이메일 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="홍길동"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                이메일
              </label>
              <input
                type="email"
                value={profile.email || ""}
                readOnly
                className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          {/* 학교 & 학과 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                학과
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.department}
                  onChange={(e) => updateField("department", e.target.value)}
                  placeholder="컴퓨터공학과"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* 학년 & 희망분야 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                학년
              </label>
              <div className="relative">
                <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <select
                  value={form.grade}
                  onChange={(e) => updateField("grade", e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 appearance-none bg-white"
                >
                  <option value="">선택</option>
                  <option value="1">1학년</option>
                  <option value="2">2학년</option>
                  <option value="3">3학년</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                희망 분야
              </label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={form.target_field}
                  onChange={(e) => updateField("target_field", e.target.value)}
                  placeholder="프론트엔드 개발"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* 한줄소개 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              한줄소개
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => {
                if (e.target.value.length <= 200) updateField("bio", e.target.value);
              }}
              placeholder="자신을 소개하는 한 줄을 작성해주세요."
              rows={2}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400 resize-none"
            />
            <p className="text-xs text-gray-400 text-right mt-1">
              {form.bio.length}/200
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            프로필 저장
          </button>
        </form>
      </div>

      {/* ─── 섹션 2: 비밀번호 변경 ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Lock className="w-5 h-5 text-blue-500" />
          비밀번호 변경
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                새 비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={pwForm.newPassword}
                  onChange={(e) =>
                    setPwForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
                  placeholder="6자 이상 입력하세요"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                  minLength={6}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                비밀번호 확인
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={pwForm.confirmPassword}
                  onChange={(e) =>
                    setPwForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="비밀번호를 다시 입력하세요"
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors text-gray-900 placeholder:text-gray-400"
                  required
                />
              </div>
              {pwForm.confirmPassword &&
                pwForm.newPassword !== pwForm.confirmPassword && (
                  <p className="text-xs text-red-500 mt-1">
                    비밀번호가 일치하지 않습니다.
                  </p>
                )}
            </div>
          </div>

          <button
            type="submit"
            disabled={pwSaving || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword}
            className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
          >
            {pwSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Lock className="w-5 h-5" />
            )}
            비밀번호 변경
          </button>
        </form>
      </div>

      {/* ─── 섹션 3: 계정 정보 ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          계정 정보
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">가입일</p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(profile.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
            <Shield className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">역할</p>
              <p className="text-sm font-medium text-gray-900">
                {profile.role === "admin" ? "관리자" : "학생"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
