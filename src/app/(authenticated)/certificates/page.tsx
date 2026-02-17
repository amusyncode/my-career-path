"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { Certificate, RoadmapGoal } from "@/lib/types";
import { format, parseISO, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import {
  Plus,
  X,
  Upload,
  Pencil,
  Trash2,
  LayoutGrid,
  List,
  Building2,
  Calendar,
  Award,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

/* ─── 상수 ─── */
type CertType = "certificate" | "award" | "completion";

const TYPE_OPTIONS: { value: CertType; label: string; emoji: string; color: string; bgColor: string }[] = [
  { value: "certificate", label: "자격증", emoji: "🏆", color: "text-blue-600", bgColor: "bg-blue-50" },
  { value: "award", label: "수상", emoji: "🎖️", color: "text-yellow-600", bgColor: "bg-yellow-50" },
  { value: "completion", label: "수료", emoji: "📜", color: "text-green-600", bgColor: "bg-green-50" },
];

const TYPE_BAR_COLOR: Record<CertType, string> = {
  certificate: "bg-blue-500",
  award: "bg-yellow-500",
  completion: "bg-green-500",
};

const TYPE_NODE_COLOR: Record<CertType, string> = {
  certificate: "bg-blue-500",
  award: "bg-yellow-500",
  completion: "bg-green-500",
};

function getTypeInfo(type: CertType) {
  return TYPE_OPTIONS.find((t) => t.value === type) || TYPE_OPTIONS[0];
}

export default function CertificatesPage() {
  const supabase = createClient();

  /* ─── 상태 ─── */
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [upcomingGoals, setUpcomingGoals] = useState<RoadmapGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"card" | "timeline">("card");
  const [filterType, setFilterType] = useState<CertType | "all">("all");

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Certificate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 폼
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<CertType>("certificate");
  const [formIssuer, setFormIssuer] = useState("");
  const [formAcquiredDate, setFormAcquiredDate] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formNoExpiry, setFormNoExpiry] = useState(true);
  const [formScore, setFormScore] = useState("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 이미지 라이트박스
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  /* ─── 데이터 패칭 ─── */
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [certsRes, goalsRes] = await Promise.all([
        supabase
          .from("certificates")
          .select("*")
          .eq("user_id", user.id)
          .order("acquired_date", { ascending: false }),
        supabase
          .from("roadmap_goals")
          .select("*")
          .eq("user_id", user.id)
          .eq("category", "certificate")
          .neq("status", "completed")
          .order("target_date", { ascending: true }),
      ]);

      setCertificates((certsRes.data as Certificate[]) || []);
      setUpcomingGoals((goalsRes.data as RoadmapGoal[]) || []);
    } catch {
      toast.error("데이터를 불러오지 못했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── 통계 ─── */
  const stats = {
    certificate: certificates.filter((c) => c.type === "certificate").length,
    award: certificates.filter((c) => c.type === "award").length,
    completion: certificates.filter((c) => c.type === "completion").length,
    thisYear: certificates.filter((c) => {
      if (!c.acquired_date) return false;
      return parseISO(c.acquired_date).getFullYear() === new Date().getFullYear();
    }).length,
  };

  /* ─── 필터 ─── */
  const filtered =
    filterType === "all"
      ? certificates
      : certificates.filter((c) => c.type === filterType);

  /* ─── 모달 열기/닫기 ─── */
  const openCreateModal = () => {
    setEditingCert(null);
    setFormName("");
    setFormType("certificate");
    setFormIssuer("");
    setFormAcquiredDate(format(new Date(), "yyyy-MM-dd"));
    setFormExpiryDate("");
    setFormNoExpiry(true);
    setFormScore("");
    setFormImageFile(null);
    setFormImagePreview(null);
    setShowModal(true);
  };

  const openEditModal = (cert: Certificate) => {
    setEditingCert(cert);
    setFormName(cert.name);
    setFormType(cert.type as CertType);
    setFormIssuer(cert.issuer || "");
    setFormAcquiredDate(cert.acquired_date || "");
    setFormExpiryDate(cert.expiry_date || "");
    setFormNoExpiry(!cert.expiry_date);
    setFormScore(cert.score || "");
    setFormImageFile(null);
    setFormImagePreview(cert.certificate_url || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCert(null);
  };

  /* ─── 이미지 업로드 ─── */
  const handleImageSelect = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("파일 크기는 5MB 이하만 가능합니다");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다");
      return;
    }
    setFormImageFile(file);
    setFormImagePreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  };

  /* ─── 저장 ─── */
  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("이름을 입력해주세요");
      return;
    }
    if (!formAcquiredDate) {
      toast.error("취득일을 입력해주세요");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("인증 필요");

      let imageUrl = editingCert?.certificate_url || null;

      // 새 이미지 업로드
      if (formImageFile) {
        const ext = formImageFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("certificates")
          .upload(path, formImageFile);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("certificates")
          .getPublicUrl(path);
        imageUrl = urlData.publicUrl;

        // 기존 이미지 삭제
        if (editingCert?.certificate_url) {
          const oldPath = editingCert.certificate_url.split("/certificates/")[1];
          if (oldPath) {
            await supabase.storage.from("certificates").remove([oldPath]);
          }
        }
      }

      const payload = {
        user_id: user.id,
        name: formName.trim(),
        type: formType,
        issuer: formIssuer.trim() || null,
        acquired_date: formAcquiredDate || null,
        expiry_date: formNoExpiry ? null : formExpiryDate || null,
        score: formScore.trim() || null,
        certificate_url: imageUrl,
      };

      if (editingCert) {
        const { error } = await supabase
          .from("certificates")
          .update(payload)
          .eq("id", editingCert.id);
        if (error) throw error;
        toast.success("수정되었습니다");
      } else {
        const { error } = await supabase.from("certificates").insert(payload);
        if (error) throw error;
        toast.success("추가되었습니다");
      }

      closeModal();
      fetchData();
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  /* ─── 삭제 ─── */
  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    setDeleting(true);
    try {
      // 이미지 삭제
      if (showDeleteConfirm.certificate_url) {
        const path = showDeleteConfirm.certificate_url.split("/certificates/")[1];
        if (path) {
          await supabase.storage.from("certificates").remove([path]);
        }
      }

      const { error } = await supabase
        .from("certificates")
        .delete()
        .eq("id", showDeleteConfirm.id);
      if (error) throw error;

      toast.success("삭제되었습니다");
      setShowDeleteConfirm(null);
      fetchData();
    } catch {
      toast.error("삭제에 실패했습니다");
    } finally {
      setDeleting(false);
    }
  };

  /* ─── 만료 D-day ─── */
  const getExpiryBadge = (expiryDate: string | null) => {
    if (!expiryDate) return null;
    const days = differenceInDays(parseISO(expiryDate), new Date());
    if (days < 0) return { label: "만료됨", cls: "bg-red-100 text-red-600" };
    if (days <= 30) return { label: `D-${days} 만료 예정`, cls: "bg-red-100 text-red-600" };
    if (days <= 90) return { label: `D-${days} 만료 예정`, cls: "bg-yellow-100 text-yellow-600" };
    return null;
  };

  /* ─── 타임라인 그룹 (연도별) ─── */
  const getTimelineGroups = () => {
    const groups: { year: number; items: Certificate[] }[] = [];
    let currentYear = -1;

    filtered.forEach((cert) => {
      const year = cert.acquired_date
        ? parseISO(cert.acquired_date).getFullYear()
        : 0;
      if (year !== currentYear) {
        currentYear = year;
        groups.push({ year, items: [cert] });
      } else {
        groups[groups.length - 1].items.push(cert);
      }
    });

    return groups;
  };

  /* ─── 스켈레톤 ─── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-20 bg-gray-200 rounded-full animate-pulse" />
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ──── 상단 ──── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">자격증 & 수상</h1>
        <div className="flex items-center gap-2">
          {/* 뷰 전환 */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode("card")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "card" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "timeline" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새로 추가
          </button>
        </div>
      </div>

      {/* ──── 통계 카드 ──── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-lg">🏆</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.certificate}</p>
            <p className="text-xs text-gray-500">자격증</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center text-lg">🎖️</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.award}</p>
            <p className="text-xs text-gray-500">수상</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-lg">📜</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.completion}</p>
            <p className="text-xs text-gray-500">수료</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-lg">📅</div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{stats.thisYear}</p>
            <p className="text-xs text-gray-500">올해 취득</p>
          </div>
        </div>
      </div>

      {/* ──── 필터 탭 ──── */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilterType("all")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            filterType === "all"
              ? "bg-blue-500 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          전체 <span className="ml-1 opacity-70">{certificates.length}</span>
        </button>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterType(opt.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filterType === opt.value
                ? "bg-blue-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.emoji} {opt.label}{" "}
            <span className="ml-1 opacity-70">
              {certificates.filter((c) => c.type === opt.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* ──── 카드 뷰 ──── */}
      {filtered.length === 0 && upcomingGoals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl shadow-sm">
          <Award className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            아직 등록된 항목이 없어요
          </h3>
          <p className="text-gray-500 mb-6">
            자격증, 수상, 수료 이력을 등록해보세요!
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-lg px-6 py-2.5 font-medium hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            추가하기
          </button>
        </div>
      ) : viewMode === "card" ? (
        /* ── 카드 그리드 ── */
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((cert) => {
            const info = getTypeInfo(cert.type as CertType);
            const expiryBadge = getExpiryBadge(cert.expiry_date);
            return (
              <div
                key={cert.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* 색상 바 */}
                <div className={`h-2 ${TYPE_BAR_COLOR[cert.type as CertType]}`} />
                <div className="p-5">
                  {/* 타입 뱃지 */}
                  <div className="flex items-start justify-between mb-3">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${info.bgColor} ${info.color}`}
                    >
                      {info.emoji} {info.label}
                    </span>
                    {/* 수정/삭제 */}
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEditModal(cert)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(cert)}
                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>

                  {/* 이름 */}
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    {cert.name}
                  </h3>

                  {/* 발급기관 */}
                  {cert.issuer && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {cert.issuer}
                    </div>
                  )}

                  {/* 취득일 */}
                  {cert.acquired_date && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-2">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(parseISO(cert.acquired_date), "yyyy년 M월", { locale: ko })}
                    </div>
                  )}

                  {/* 등급/점수 */}
                  {cert.score && (
                    <span className="inline-block bg-purple-50 text-purple-600 text-xs font-medium px-2.5 py-1 rounded-full mb-2">
                      {cert.score}
                    </span>
                  )}

                  {/* 만료일 */}
                  {expiryBadge && (
                    <div className="mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${expiryBadge.cls}`}>
                        {expiryBadge.label}
                      </span>
                    </div>
                  )}

                  {/* 인증서 이미지 */}
                  {cert.certificate_url && (
                    <button
                      onClick={() => setLightboxImage(cert.certificate_url)}
                      className="mt-3 w-full"
                    >
                      <img
                        src={cert.certificate_url}
                        alt={cert.name}
                        className="h-20 w-full rounded-lg object-cover hover:opacity-90 transition-opacity"
                      />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ── 타임라인 뷰 ── */
        <div className="relative pl-8">
          {/* 세로선 */}
          <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-blue-200" />

          {getTimelineGroups().map((group) => (
            <div key={group.year}>
              {/* 연도 구분 */}
              <div className="flex items-center gap-3 mb-4 -ml-8">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 ring-4 ring-white">
                  <Calendar className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-bold text-blue-600">
                  {group.year > 0 ? `${group.year}년` : "날짜 미지정"}
                </span>
                <div className="flex-1 border-t border-dashed border-blue-200" />
              </div>

              {group.items.map((cert) => {
                const info = getTypeInfo(cert.type as CertType);
                const expiryBadge = getExpiryBadge(cert.expiry_date);
                return (
                  <div key={cert.id} className="relative mb-6 last:mb-0">
                    {/* 노드 */}
                    <div
                      className={`absolute -left-8 top-3 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${
                        TYPE_NODE_COLOR[cert.type as CertType]
                      }`}
                    >
                      <span className="text-xs text-white">
                        {cert.type === "certificate" ? "🏆" : cert.type === "award" ? "🎖️" : "📜"}
                      </span>
                    </div>

                    {/* 카드 */}
                    <div className="bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {/* 날짜 */}
                          {cert.acquired_date && (
                            <p className="text-xs text-gray-400 mb-1">
                              {format(parseISO(cert.acquired_date), "yyyy.MM.dd")}
                            </p>
                          )}
                          {/* 이름 + 타입 */}
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-gray-900">
                              {cert.name}
                            </h3>
                            <span
                              className={`text-xs font-medium px-2 py-0.5 rounded-full ${info.bgColor} ${info.color}`}
                            >
                              {info.label}
                            </span>
                          </div>
                          {/* 발급기관 + 점수 */}
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            {cert.issuer && (
                              <span className="flex items-center gap-1">
                                <Building2 className="w-3 h-3" /> {cert.issuer}
                              </span>
                            )}
                            {cert.score && (
                              <span className="bg-purple-50 text-purple-600 text-xs px-2 py-0.5 rounded-full">
                                {cert.score}
                              </span>
                            )}
                            {expiryBadge && (
                              <span className={`text-xs px-2 py-0.5 rounded-full ${expiryBadge.cls}`}>
                                {expiryBadge.label}
                              </span>
                            )}
                          </div>
                        </div>
                        {/* 인증서 이미지 썸네일 */}
                        {cert.certificate_url && (
                          <button
                            onClick={() => setLightboxImage(cert.certificate_url)}
                            className="flex-shrink-0 ml-3"
                          >
                            <img
                              src={cert.certificate_url}
                              alt={cert.name}
                              className="w-16 h-16 rounded-lg object-cover hover:opacity-90 transition-opacity"
                            />
                          </button>
                        )}
                        {/* 수정/삭제 */}
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(cert)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(cert)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ──── 취득 예정 자격증 ──── */}
      {upcomingGoals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-500" />
            취득 예정 자격증
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingGoals.map((goal) => (
              <Link
                key={goal.id}
                href="/roadmap"
                className="block border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              >
                <h3 className="font-medium text-gray-700 mb-1">{goal.title}</h3>
                {goal.target_date && (
                  <p className="text-sm text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(parseISO(goal.target_date), "yyyy.MM.dd")} 목표
                  </p>
                )}
                <span className="inline-block mt-2 text-xs bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">
                  {goal.status === "in_progress" ? "진행중" : "계획됨"}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ──── 추가/편집 모달 ──── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                {editingCert ? "수정" : "자격증/수상 추가"}
              </h2>
              <button onClick={closeModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="자격증 또는 수상명"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* 타입 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  타입 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as CertType)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.emoji} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 발급기관 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  발급기관
                </label>
                <input
                  type="text"
                  value={formIssuer}
                  onChange={(e) => setFormIssuer(e.target.value)}
                  placeholder="한국산업인력공단"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* 취득일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  취득일 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formAcquiredDate}
                  onChange={(e) => setFormAcquiredDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* 만료일 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    만료일
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formNoExpiry}
                      onChange={(e) => setFormNoExpiry(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    만료일 없음
                  </label>
                </div>
                {!formNoExpiry && (
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                )}
              </div>

              {/* 등급/점수 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등급/점수
                </label>
                <input
                  type="text"
                  value={formScore}
                  onChange={(e) => setFormScore(e.target.value)}
                  placeholder="예: 1급, 850점"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* 인증서 이미지 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  인증서 이미지
                </label>
                {formImagePreview ? (
                  <div className="relative">
                    <img
                      src={formImagePreview}
                      alt="미리보기"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setFormImageFile(null);
                        setFormImagePreview(null);
                      }}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full text-white hover:bg-black/70"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 px-3 py-1 bg-white/90 rounded-lg text-sm text-gray-700 hover:bg-white"
                    >
                      변경
                    </button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 hover:bg-blue-50/30 transition-colors cursor-pointer"
                  >
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      인증서 이미지를 업로드하세요
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      5MB 이하 이미지 파일
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageSelect(file);
                  }}
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── 삭제 확인 ──── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">삭제 확인</h3>
            <p className="text-sm text-gray-500 mb-6">
              &quot;{showDeleteConfirm.name}&quot;을(를) 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──── 이미지 라이트박스 ──── */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
            onClick={() => setLightboxImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={lightboxImage}
            alt="인증서"
            className="max-w-2xl max-h-[80vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
