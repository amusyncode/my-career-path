"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type {
  Profile,
  Certificate,
  Project,
  Skill,
  CoverLetter,
} from "@/lib/types";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import {
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Trash2,
  Save,
  Download,
  Eye,
  Edit3,
  GripVertical,
  Upload,
  User,
  Briefcase,
  BookOpen,
  Award,
  FolderOpen,
  Zap,
  Star,
  MessageSquare,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "react-beautiful-dnd";

/* ─── 타입 ─── */
interface Experience {
  id: string;
  title: string;
  organization: string;
  period: string;
  description: string;
}

interface ResumeData {
  name: string;
  email: string;
  phone: string;
  address: string;
  targetField: string;
  intro: string;
  avatarUrl: string | null;
  schoolName: string;
  department: string;
  grade: string;
  enrollmentPeriod: string;
  gpa: string;
  courses: string[];
  selectedCertIds: string[];
  certOrder: string[];
  selectedProjectIds: string[];
  projectOrder: string[];
  selectedSkillIds: string[];
  experiences: Experience[];
  selfPR: string;
}

const DEFAULT_RESUME: ResumeData = {
  name: "",
  email: "",
  phone: "",
  address: "",
  targetField: "",
  intro: "",
  avatarUrl: null,
  schoolName: "",
  department: "",
  grade: "",
  enrollmentPeriod: "",
  gpa: "",
  courses: [],
  selectedCertIds: [],
  certOrder: [],
  selectedProjectIds: [],
  projectOrder: [],
  selectedSkillIds: [],
  experiences: [],
  selfPR: "",
};

/* ─── 섹션 정의 ─── */
const SECTIONS = [
  { key: "basic", label: "기본 정보", icon: User },
  { key: "education", label: "학력", icon: BookOpen },
  { key: "certificates", label: "자격증", icon: Award },
  { key: "projects", label: "프로젝트", icon: FolderOpen },
  { key: "skills", label: "스킬", icon: Zap },
  { key: "experience", label: "경험/활동", icon: Briefcase },
  { key: "selfpr", label: "자기PR", icon: Star },
] as const;

/* ─── 자기소개서 가이드 ─── */
const CL_FIELDS = [
  {
    key: "growth" as const,
    label: "성장과정",
    guide:
      "가정환경, 학창시절 경험, 가치관 형성 과정 등을 서술하세요.",
  },
  {
    key: "personality" as const,
    label: "성격의 장단점",
    guide:
      "자신의 강점과 이를 뒷받침할 구체적인 사례를 작성하세요.",
  },
  {
    key: "motivation" as const,
    label: "지원동기",
    guide:
      "해당 기업/직무에 지원하게 된 계기와 준비 과정을 작성하세요.",
  },
  {
    key: "aspiration" as const,
    label: "입사 후 포부",
    guide:
      "입사 후 이루고 싶은 목표와 기여 방안을 구체적으로 서술하세요.",
  },
];

export default function ResumePage() {
  const supabase = createClient();

  /* ─── 공통 상태 ─── */
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"resume" | "coverLetter">(
    "resume"
  );

  /* ─── 이력서 데이터 ─── */
  const [resume, setResume] = useState<ResumeData>(DEFAULT_RESUME);
  const [openSections, setOpenSections] = useState<Set<string>>(
    new Set(["basic"])
  );
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [pdfLoading, setPdfLoading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  /* 새 스킬 추가 */
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillCategory, setNewSkillCategory] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState(3);

  /* 새 코스(과목) 추가 */
  const [newCourse, setNewCourse] = useState("");

  /* ─── 자기소개서 상태 ─── */
  const [coverLetters, setCoverLetters] = useState<CoverLetter[]>([]);
  const [selectedCL, setSelectedCL] = useState<CoverLetter | null>(null);
  const [clForm, setCLForm] = useState({
    title: "",
    target_company: "",
    growth: "",
    personality: "",
    motivation: "",
    aspiration: "",
  });
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CoverLetter | null>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  /* ─── 프로필 사진 업로드 ─── */
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  /* ─── 데이터 로딩 ─── */
  const loadData = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const [profileRes, certRes, projRes, skillRes, clRes] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single(),
          supabase
            .from("certificates")
            .select("*")
            .eq("user_id", user.id)
            .order("acquired_date", { ascending: false }),
          supabase
            .from("projects")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("skills")
            .select("*")
            .eq("user_id", user.id)
            .order("category"),
          supabase
            .from("cover_letters")
            .select("*")
            .eq("user_id", user.id)
            .order("updated_at", { ascending: false }),
        ]);

      setCertificates(certRes.data || []);
      setProjects(projRes.data || []);
      setSkills(skillRes.data || []);
      setCoverLetters(clRes.data || []);

      // localStorage에서 이력서 복원
      const saved = localStorage.getItem(`resume_data_${user.id}`);
      if (saved) {
        try {
          setResume(JSON.parse(saved));
        } catch {
          // fallback to profile data
        }
      }

      // 프로필 기본 정보 채우기 (localStorage에 없는 경우)
      if (!saved && profileRes.data) {
        const p = profileRes.data as Profile;
        setResume((prev) => ({
          ...prev,
          name: p.name || "",
          targetField: p.target_field || "",
          intro: p.bio || "",
          avatarUrl: p.avatar_url,
          schoolName: p.school || "",
          department: p.department || "",
          grade: p.grade ? String(p.grade) : "",
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error("데이터 로딩 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /* ─── 이력서 localStorage 자동저장 ─── */
  useEffect(() => {
    if (!userId) return;
    localStorage.setItem(`resume_data_${userId}`, JSON.stringify(resume));
  }, [resume, userId]);

  /* ─── 이력서 헬퍼 ─── */
  const updateResume = (partial: Partial<ResumeData>) =>
    setResume((prev) => ({ ...prev, ...partial }));

  const toggleSection = (key: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleCertSelect = (id: string) => {
    setResume((prev) => {
      const ids = prev.selectedCertIds.includes(id)
        ? prev.selectedCertIds.filter((c) => c !== id)
        : [...prev.selectedCertIds, id];
      return {
        ...prev,
        selectedCertIds: ids,
        certOrder: ids,
      };
    });
  };

  const toggleProjectSelect = (id: string) => {
    setResume((prev) => {
      const ids = prev.selectedProjectIds.includes(id)
        ? prev.selectedProjectIds.filter((p) => p !== id)
        : [...prev.selectedProjectIds, id];
      return {
        ...prev,
        selectedProjectIds: ids,
        projectOrder: ids,
      };
    });
  };

  const toggleSkillSelect = (id: string) => {
    setResume((prev) => {
      const ids = prev.selectedSkillIds.includes(id)
        ? prev.selectedSkillIds.filter((s) => s !== id)
        : [...prev.selectedSkillIds, id];
      return { ...prev, selectedSkillIds: ids };
    });
  };

  /* ─── 드래그&드롭 ─── */
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination, type } = result;
    if (source.index === destination.index) return;

    if (type === "cert") {
      setResume((prev) => {
        const arr = [...prev.certOrder];
        const [moved] = arr.splice(source.index, 1);
        arr.splice(destination.index, 0, moved);
        return { ...prev, certOrder: arr, selectedCertIds: arr };
      });
    } else if (type === "project") {
      setResume((prev) => {
        const arr = [...prev.projectOrder];
        const [moved] = arr.splice(source.index, 1);
        arr.splice(destination.index, 0, moved);
        return { ...prev, projectOrder: arr, selectedProjectIds: arr };
      });
    }
  };

  /* ─── 경험 CRUD ─── */
  const addExperience = () => {
    const newExp: Experience = {
      id: crypto.randomUUID(),
      title: "",
      organization: "",
      period: "",
      description: "",
    };
    updateResume({ experiences: [...resume.experiences, newExp] });
  };

  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    updateResume({
      experiences: resume.experiences.map((e) =>
        e.id === id ? { ...e, [field]: value } : e
      ),
    });
  };

  const removeExperience = (id: string) => {
    updateResume({
      experiences: resume.experiences.filter((e) => e.id !== id),
    });
  };

  /* ─── 코스 태그 ─── */
  const addCourse = () => {
    if (!newCourse.trim()) return;
    updateResume({ courses: [...resume.courses, newCourse.trim()] });
    setNewCourse("");
  };

  const removeCourse = (idx: number) => {
    updateResume({ courses: resume.courses.filter((_, i) => i !== idx) });
  };

  /* ─── 새 스킬 추가 (DB 저장) ─── */
  const addNewSkill = async () => {
    if (!newSkillName.trim() || !userId) return;
    const { data, error } = await supabase
      .from("skills")
      .insert({
        user_id: userId,
        name: newSkillName.trim(),
        category: newSkillCategory.trim() || null,
        level: newSkillLevel,
      })
      .select()
      .single();
    if (error) {
      toast.error("스킬 추가 실패");
      return;
    }
    setSkills((prev) => [...prev, data as Skill]);
    setNewSkillName("");
    setNewSkillCategory("");
    setNewSkillLevel(3);
    toast.success("스킬 추가 완료");
  };

  /* ─── 프로필 사진 업로드 ─── */
  const handleAvatarUpload = async (file: File) => {
    if (!userId) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("5MB 이하 파일만 업로드 가능합니다");
      return;
    }
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);
      updateResume({ avatarUrl: publicUrl });
      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      toast.success("사진 업로드 완료");
    } catch {
      toast.error("사진 업로드 실패");
    } finally {
      setAvatarUploading(false);
    }
  };

  /* ─── PDF 다운로드 ─── */
  const downloadPDF = async () => {
    if (!previewRef.current) return;
    setPdfLoading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`${resume.name || "이력서"}_이력서.pdf`);
      toast.success("PDF 다운로드 완료");
    } catch {
      toast.error("PDF 생성 실패");
    } finally {
      setPdfLoading(false);
    }
  };

  /* ─── 자기소개서: 생성 ─── */
  const createCoverLetter = async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("cover_letters")
      .insert({
        user_id: userId,
        title: "새 자기소개서",
        target_company: "",
        growth: "",
        personality: "",
        motivation: "",
        aspiration: "",
      })
      .select()
      .single();
    if (error) {
      toast.error("생성 실패");
      return;
    }
    const cl = data as CoverLetter;
    setCoverLetters((prev) => [cl, ...prev]);
    selectCoverLetter(cl);
    toast.success("새 자기소개서 생성");
  };

  const selectCoverLetter = (cl: CoverLetter) => {
    setSelectedCL(cl);
    setCLForm({
      title: cl.title,
      target_company: cl.target_company || "",
      growth: cl.growth || "",
      personality: cl.personality || "",
      motivation: cl.motivation || "",
      aspiration: cl.aspiration || "",
    });
  };

  /* ─── 자기소개서: 자동저장 (디바운스 2초) ─── */
  const updateCLField = (
    field: keyof typeof clForm,
    value: string
  ) => {
    setCLForm((prev) => ({ ...prev, [field]: value }));

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveCoverLetter({ [field]: value });
    }, 2000);
  };

  const saveCoverLetter = async (
    partial?: Partial<typeof clForm>
  ) => {
    if (!selectedCL) return;
    setIsSaving(true);
    const payload = partial
      ? { ...partial, updated_at: new Date().toISOString() }
      : { ...clForm, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from("cover_letters")
      .update(payload)
      .eq("id", selectedCL.id);
    if (error) {
      toast.error("저장 실패");
    } else {
      setCoverLetters((prev) =>
        prev.map((c) =>
          c.id === selectedCL.id ? { ...c, ...payload } : c
        )
      );
      toast.success("저장 완료", { duration: 1500 });
    }
    setIsSaving(false);
  };

  /* ─── 자기소개서: 삭제 ─── */
  const confirmDeleteCL = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from("cover_letters")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error("삭제 실패");
      return;
    }
    setCoverLetters((prev) =>
      prev.filter((c) => c.id !== deleteTarget.id)
    );
    if (selectedCL?.id === deleteTarget.id) {
      setSelectedCL(null);
      setCLForm({
        title: "",
        target_company: "",
        growth: "",
        personality: "",
        motivation: "",
        aspiration: "",
      });
    }
    setDeleteTarget(null);
    toast.success("삭제 완료");
  };

  /* ─── 로딩 스켈레톤 ─── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-200 rounded-lg w-64 animate-pulse" />
        <div className="grid lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 rounded-xl animate-pulse"
              />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="aspect-[1/1.414] bg-gray-200 rounded-xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  /* ─── 선택된 자격증/프로젝트 목록 ─── */
  const selectedCerts = resume.certOrder
    .map((id) => certificates.find((c) => c.id === id))
    .filter(Boolean) as Certificate[];
  const selectedProjects = resume.projectOrder
    .map((id) => projects.find((p) => p.id === id))
    .filter(Boolean) as Project[];
  const selectedSkills = skills.filter((s) =>
    resume.selectedSkillIds.includes(s.id)
  );

  /* ─── 스킬 카테고리 그룹핑 ─── */
  const skillsByCategory = skills.reduce(
    (acc, s) => {
      const cat = s.category || "기타";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(s);
      return acc;
    },
    {} as Record<string, Skill[]>
  );

  /* ─── 렌더 ─── */
  return (
    <div className="space-y-6">
      {/* 헤더 + 탭 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          이력서 & 자기소개서
        </h1>
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("resume")}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === "resume"
                ? "text-blue-600 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            이력서
          </button>
          <button
            onClick={() => setActiveTab("coverLetter")}
            className={`px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === "coverLetter"
                ? "text-blue-600 border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            자기소개서
          </button>
        </div>
      </div>

      {/* ====== 이력서 탭 ====== */}
      {activeTab === "resume" && (
        <>
          {/* 모바일 편집/미리보기 전환 */}
          <div className="flex gap-2 lg:hidden">
            <button
              onClick={() => setMobileView("edit")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mobileView === "edit"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <Edit3 className="w-4 h-4 inline mr-1" /> 편집
            </button>
            <button
              onClick={() => setMobileView("preview")}
              className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                mobileView === "preview"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              <Eye className="w-4 h-4 inline mr-1" /> 미리보기
            </button>
          </div>

          <div className="grid lg:grid-cols-5 gap-6">
            {/* ─── 편집 패널 ─── */}
            <div
              className={`lg:col-span-3 space-y-3 ${
                mobileView === "preview" ? "hidden lg:block" : ""
              }`}
            >
              <DragDropContext onDragEnd={onDragEnd}>
                {SECTIONS.map(({ key, label, icon: Icon }) => (
                  <div
                    key={key}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
                  >
                    {/* 아코디언 헤더 */}
                    <button
                      onClick={() => toggleSection(key)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-blue-500" />
                        <span className="font-semibold text-gray-900">
                          {label}
                        </span>
                      </div>
                      {openSections.has(key) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {/* 아코디언 본문 */}
                    {openSections.has(key) && (
                      <div className="px-5 pb-5 space-y-4 border-t border-gray-50">
                        {/* ① 기본 정보 */}
                        {key === "basic" && (
                          <div className="space-y-4 pt-4">
                            {/* 프로필 사진 */}
                            <div className="flex items-center gap-4">
                              <div
                                onClick={() =>
                                  avatarInputRef.current?.click()
                                }
                                className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 transition-colors overflow-hidden"
                              >
                                {resume.avatarUrl ? (
                                  <img
                                    src={resume.avatarUrl}
                                    alt="avatar"
                                    className="w-full h-full object-cover"
                                  />
                                ) : avatarUploading ? (
                                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="w-6 h-6 text-gray-400" />
                                )}
                              </div>
                              <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleAvatarUpload(f);
                                }}
                              />
                              <div className="text-sm text-gray-500">
                                클릭하여 사진 업로드 (5MB 이하)
                              </div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-3">
                              <input
                                placeholder="이름"
                                value={resume.name}
                                onChange={(e) =>
                                  updateResume({ name: e.target.value })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="이메일"
                                value={resume.email}
                                onChange={(e) =>
                                  updateResume({ email: e.target.value })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="전화번호"
                                value={resume.phone}
                                onChange={(e) =>
                                  updateResume({ phone: e.target.value })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="주소"
                                value={resume.address}
                                onChange={(e) =>
                                  updateResume({
                                    address: e.target.value,
                                  })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                            </div>
                            <input
                              placeholder="희망 분야"
                              value={resume.targetField}
                              onChange={(e) =>
                                updateResume({
                                  targetField: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                            />
                            <textarea
                              placeholder="한 줄 소개"
                              value={resume.intro}
                              onChange={(e) =>
                                updateResume({ intro: e.target.value })
                              }
                              rows={2}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                            />
                          </div>
                        )}

                        {/* ② 학력 */}
                        {key === "education" && (
                          <div className="space-y-3 pt-4">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <input
                                placeholder="학교명"
                                value={resume.schoolName}
                                onChange={(e) =>
                                  updateResume({
                                    schoolName: e.target.value,
                                  })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="학과/전공"
                                value={resume.department}
                                onChange={(e) =>
                                  updateResume({
                                    department: e.target.value,
                                  })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="학년 (예: 3)"
                                value={resume.grade}
                                onChange={(e) =>
                                  updateResume({
                                    grade: e.target.value,
                                  })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                              <input
                                placeholder="재학기간 (예: 2022.03 ~ 현재)"
                                value={resume.enrollmentPeriod}
                                onChange={(e) =>
                                  updateResume({
                                    enrollmentPeriod: e.target.value,
                                  })
                                }
                                className="px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                              />
                            </div>
                            <input
                              placeholder="학점 (예: 4.2/4.5)"
                              value={resume.gpa}
                              onChange={(e) =>
                                updateResume({ gpa: e.target.value })
                              }
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                            />

                            {/* 이수 과목 태그 */}
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-2">
                                주요 이수과목
                              </label>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {resume.courses.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs"
                                  >
                                    {c}
                                    <button
                                      onClick={() => removeCourse(i)}
                                      className="hover:text-red-500"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  placeholder="과목명 입력"
                                  value={newCourse}
                                  onChange={(e) =>
                                    setNewCourse(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addCourse();
                                    }
                                  }}
                                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                                <button
                                  onClick={addCourse}
                                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ③ 자격증 */}
                        {key === "certificates" && (
                          <div className="space-y-3 pt-4">
                            {certificates.length === 0 ? (
                              <div className="text-center py-6">
                                <Award className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 mb-2">
                                  등록된 자격증이 없습니다
                                </p>
                                <Link
                                  href="/certificates"
                                  className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
                                >
                                  자격증 등록하기
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-gray-500">
                                  이력서에 포함할 자격증을 선택하세요.
                                  드래그로 순서를 변경할 수 있습니다.
                                </p>
                                {/* 선택 체크리스트 */}
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {certificates.map((c) => (
                                    <label
                                      key={c.id}
                                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={resume.selectedCertIds.includes(
                                          c.id
                                        )}
                                        onChange={() =>
                                          toggleCertSelect(c.id)
                                        }
                                        className="w-4 h-4 text-blue-500 rounded"
                                      />
                                      <span className="text-sm text-gray-700 flex-1">
                                        {c.name}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {c.issuer}
                                      </span>
                                    </label>
                                  ))}
                                </div>

                                {/* 선택된 항목 DnD */}
                                {selectedCerts.length > 0 && (
                                  <Droppable
                                    droppableId="cert-order"
                                    type="cert"
                                  >
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="space-y-1 mt-2"
                                      >
                                        <p className="text-xs font-medium text-gray-500 mb-1">
                                          선택 순서 (드래그로 변경)
                                        </p>
                                        {selectedCerts.map((c, idx) => (
                                          <Draggable
                                            key={c.id}
                                            draggableId={c.id}
                                            index={idx}
                                          >
                                            {(prov, snap) => (
                                              <div
                                                ref={prov.innerRef}
                                                {...prov.draggableProps}
                                                {...prov.dragHandleProps}
                                                className={`flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg text-sm ${
                                                  snap.isDragging
                                                    ? "shadow-lg"
                                                    : ""
                                                }`}
                                              >
                                                <GripVertical className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-700">
                                                  {idx + 1}.{" "}
                                                  {c.name}
                                                </span>
                                              </div>
                                            )}
                                          </Draggable>
                                        ))}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* ④ 프로젝트 */}
                        {key === "projects" && (
                          <div className="space-y-3 pt-4">
                            {projects.length === 0 ? (
                              <div className="text-center py-6">
                                <FolderOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500 mb-2">
                                  등록된 프로젝트가 없습니다
                                </p>
                                <Link
                                  href="/portfolio"
                                  className="text-sm text-blue-500 hover:underline inline-flex items-center gap-1"
                                >
                                  프로젝트 등록하기
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-gray-500">
                                  이력서에 포함할 프로젝트를 선택하세요.
                                </p>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {projects.map((p) => (
                                    <label
                                      key={p.id}
                                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={resume.selectedProjectIds.includes(
                                          p.id
                                        )}
                                        onChange={() =>
                                          toggleProjectSelect(p.id)
                                        }
                                        className="w-4 h-4 text-blue-500 rounded"
                                      />
                                      <span className="text-sm text-gray-700 flex-1">
                                        {p.title}
                                      </span>
                                      <span className="text-xs text-gray-400">
                                        {p.status === "completed"
                                          ? "완료"
                                          : p.status === "in_progress"
                                          ? "진행중"
                                          : "기획중"}
                                      </span>
                                    </label>
                                  ))}
                                </div>

                                {selectedProjects.length > 0 && (
                                  <Droppable
                                    droppableId="project-order"
                                    type="project"
                                  >
                                    {(provided) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="space-y-1 mt-2"
                                      >
                                        <p className="text-xs font-medium text-gray-500 mb-1">
                                          선택 순서 (드래그로 변경)
                                        </p>
                                        {selectedProjects.map(
                                          (p, idx) => (
                                            <Draggable
                                              key={p.id}
                                              draggableId={`proj-${p.id}`}
                                              index={idx}
                                            >
                                              {(prov, snap) => (
                                                <div
                                                  ref={prov.innerRef}
                                                  {...prov.draggableProps}
                                                  {...prov.dragHandleProps}
                                                  className={`flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg text-sm ${
                                                    snap.isDragging
                                                      ? "shadow-lg"
                                                      : ""
                                                  }`}
                                                >
                                                  <GripVertical className="w-4 h-4 text-gray-400" />
                                                  <span className="text-gray-700">
                                                    {idx + 1}.{" "}
                                                    {p.title}
                                                  </span>
                                                </div>
                                              )}
                                            </Draggable>
                                          )
                                        )}
                                        {provided.placeholder}
                                      </div>
                                    )}
                                  </Droppable>
                                )}
                              </>
                            )}
                          </div>
                        )}

                        {/* ⑤ 스킬 */}
                        {key === "skills" && (
                          <div className="space-y-4 pt-4">
                            {skills.length === 0 ? (
                              <p className="text-sm text-gray-500 text-center py-4">
                                등록된 스킬이 없습니다
                              </p>
                            ) : (
                              Object.entries(skillsByCategory).map(
                                ([cat, catSkills]) => (
                                  <div key={cat}>
                                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                                      {cat}
                                    </p>
                                    <div className="space-y-1">
                                      {catSkills.map((s) => (
                                        <label
                                          key={s.id}
                                          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={resume.selectedSkillIds.includes(
                                              s.id
                                            )}
                                            onChange={() =>
                                              toggleSkillSelect(
                                                s.id
                                              )
                                            }
                                            className="w-4 h-4 text-blue-500 rounded"
                                          />
                                          <span className="text-sm text-gray-700 flex-1">
                                            {s.name}
                                          </span>
                                          <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map(
                                              (lv) => (
                                                <div
                                                  key={lv}
                                                  className={`w-2 h-2 rounded-full ${
                                                    lv <= s.level
                                                      ? "bg-blue-500"
                                                      : "bg-gray-200"
                                                  }`}
                                                />
                                              )
                                            )}
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                )
                              )
                            )}

                            {/* 새 스킬 추가 */}
                            <div className="pt-3 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-2">
                                새 스킬 추가
                              </p>
                              <div className="flex gap-2 flex-wrap">
                                <input
                                  placeholder="스킬명"
                                  value={newSkillName}
                                  onChange={(e) =>
                                    setNewSkillName(e.target.value)
                                  }
                                  className="flex-1 min-w-[120px] px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                                <input
                                  placeholder="카테고리"
                                  value={newSkillCategory}
                                  onChange={(e) =>
                                    setNewSkillCategory(
                                      e.target.value
                                    )
                                  }
                                  className="w-28 px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                                <select
                                  value={newSkillLevel}
                                  onChange={(e) =>
                                    setNewSkillLevel(
                                      Number(e.target.value)
                                    )
                                  }
                                  className="w-20 px-2 py-2 rounded-lg border border-gray-200 text-sm"
                                >
                                  {[1, 2, 3, 4, 5].map((v) => (
                                    <option key={v} value={v}>
                                      Lv.{v}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={addNewSkill}
                                  disabled={!newSkillName.trim()}
                                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ⑥ 경험/활동 */}
                        {key === "experience" && (
                          <div className="space-y-3 pt-4">
                            {resume.experiences.map((exp) => (
                              <div
                                key={exp.id}
                                className="p-4 bg-gray-50 rounded-lg space-y-2 relative group"
                              >
                                <button
                                  onClick={() =>
                                    removeExperience(exp.id)
                                  }
                                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <div className="grid sm:grid-cols-2 gap-2">
                                  <input
                                    placeholder="활동명"
                                    value={exp.title}
                                    onChange={(e) =>
                                      updateExperience(
                                        exp.id,
                                        "title",
                                        e.target.value
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                  />
                                  <input
                                    placeholder="기관/단체"
                                    value={exp.organization}
                                    onChange={(e) =>
                                      updateExperience(
                                        exp.id,
                                        "organization",
                                        e.target.value
                                      )
                                    }
                                    className="px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                  />
                                </div>
                                <input
                                  placeholder="기간 (예: 2023.06 ~ 2023.12)"
                                  value={exp.period}
                                  onChange={(e) =>
                                    updateExperience(
                                      exp.id,
                                      "period",
                                      e.target.value
                                    )
                                  }
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                                <textarea
                                  placeholder="활동 설명"
                                  value={exp.description}
                                  onChange={(e) =>
                                    updateExperience(
                                      exp.id,
                                      "description",
                                      e.target.value
                                    )
                                  }
                                  rows={2}
                                  className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                                />
                              </div>
                            ))}
                            <button
                              onClick={addExperience}
                              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> 경험 추가
                            </button>
                          </div>
                        )}

                        {/* ⑦ 자기PR */}
                        {key === "selfpr" && (
                          <div className="space-y-2 pt-4">
                            <textarea
                              placeholder="자신의 강점, 목표, 가치관 등을 자유롭게 작성하세요."
                              value={resume.selfPR}
                              onChange={(e) =>
                                updateResume({
                                  selfPR: e.target.value,
                                })
                              }
                              rows={6}
                              className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                            />
                            <p className="text-xs text-gray-400 text-right">
                              {resume.selfPR.length}자
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </DragDropContext>
            </div>

            {/* ─── 미리보기 패널 ─── */}
            <div
              className={`lg:col-span-2 ${
                mobileView === "edit" ? "hidden lg:block" : ""
              }`}
            >
              <div className="sticky top-6">
                {/* PDF 다운로드 버튼 */}
                <button
                  onClick={downloadPDF}
                  disabled={pdfLoading}
                  className="w-full mb-3 py-2.5 bg-blue-500 text-white rounded-xl text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {pdfLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  PDF 다운로드
                </button>

                {/* A4 미리보기 */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div
                    ref={previewRef}
                    className="aspect-[1/1.414] p-6 text-[10px] leading-relaxed overflow-hidden"
                    style={{ fontSize: "10px" }}
                  >
                    {/* 헤더 */}
                    <div className="flex items-start gap-4 mb-4">
                      {resume.avatarUrl && (
                        <img
                          src={resume.avatarUrl}
                          alt=""
                          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900">
                          {resume.name || "이름"}
                        </h2>
                        {resume.targetField && (
                          <p className="text-[11px] text-blue-600 font-medium">
                            {resume.targetField}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-gray-500">
                          {resume.email && (
                            <span>{resume.email}</span>
                          )}
                          {resume.phone && (
                            <span>{resume.phone}</span>
                          )}
                          {resume.address && (
                            <span>{resume.address}</span>
                          )}
                        </div>
                        {resume.intro && (
                          <p className="mt-1 text-gray-600">
                            {resume.intro}
                          </p>
                        )}
                      </div>
                    </div>

                    <hr className="border-gray-200 mb-3" />

                    {/* 학력 */}
                    {(resume.schoolName || resume.department) && (
                      <div className="mb-3">
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          학력
                        </h3>
                        <div className="flex justify-between">
                          <span className="font-medium">
                            {resume.schoolName}{" "}
                            {resume.department &&
                              `${resume.department}`}
                          </span>
                          <span className="text-gray-500">
                            {resume.enrollmentPeriod}
                          </span>
                        </div>
                        {resume.gpa && (
                          <p className="text-gray-500">
                            학점: {resume.gpa}
                          </p>
                        )}
                        {resume.courses.length > 0 && (
                          <p className="text-gray-500 mt-0.5">
                            주요과목:{" "}
                            {resume.courses.join(", ")}
                          </p>
                        )}
                      </div>
                    )}

                    {/* 자격증 */}
                    {selectedCerts.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          자격증 / 수상
                        </h3>
                        <table className="w-full">
                          <tbody>
                            {selectedCerts.map((c) => (
                              <tr key={c.id}>
                                <td className="py-0.5 font-medium pr-4">
                                  {c.name}
                                </td>
                                <td className="py-0.5 text-gray-500 pr-4">
                                  {c.issuer}
                                </td>
                                <td className="py-0.5 text-gray-500 text-right whitespace-nowrap">
                                  {c.acquired_date &&
                                    format(
                                      parseISO(c.acquired_date),
                                      "yyyy.MM"
                                    )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* 프로젝트 */}
                    {selectedProjects.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          프로젝트
                        </h3>
                        {selectedProjects.map((p) => (
                          <div key={p.id} className="mb-1.5">
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {p.title}
                              </span>
                              <span className="text-gray-500">
                                {p.start_date &&
                                  format(
                                    parseISO(p.start_date),
                                    "yyyy.MM"
                                  )}
                                {p.end_date &&
                                  ` ~ ${format(
                                    parseISO(p.end_date),
                                    "yyyy.MM"
                                  )}`}
                              </span>
                            </div>
                            {p.description && (
                              <p className="text-gray-600 line-clamp-2">
                                {p.description}
                              </p>
                            )}
                            {p.tech_stack.length > 0 && (
                              <p className="text-gray-400 text-[9px]">
                                {p.tech_stack.join(" / ")}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 스킬 */}
                    {selectedSkills.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          스킬
                        </h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {selectedSkills.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center gap-1.5"
                            >
                              <span className="font-medium">
                                {s.name}
                              </span>
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((lv) => (
                                  <div
                                    key={lv}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      lv <= s.level
                                        ? "bg-blue-500"
                                        : "bg-gray-200"
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 경험 */}
                    {resume.experiences.length > 0 && (
                      <div className="mb-3">
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          경험 / 활동
                        </h3>
                        {resume.experiences.map((exp) => (
                          <div key={exp.id} className="mb-1.5">
                            <div className="flex justify-between">
                              <span className="font-medium">
                                {exp.title}
                                {exp.organization &&
                                  ` | ${exp.organization}`}
                              </span>
                              <span className="text-gray-500">
                                {exp.period}
                              </span>
                            </div>
                            {exp.description && (
                              <p className="text-gray-600">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 자기PR */}
                    {resume.selfPR && (
                      <div>
                        <h3 className="text-[11px] font-bold text-gray-800 mb-1 uppercase tracking-wide">
                          자기 PR
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {resume.selfPR}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ====== 자기소개서 탭 ====== */}
      {activeTab === "coverLetter" && (
        <div className="flex gap-6 min-h-[600px]">
          {/* 좌측 사이드바 */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <button
                onClick={createCoverLetter}
                className="w-full py-2.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> 새 자기소개서
              </button>

              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {coverLetters.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    자기소개서를 작성해보세요
                  </p>
                ) : (
                  coverLetters.map((cl) => (
                    <div
                      key={cl.id}
                      onClick={() => selectCoverLetter(cl)}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                        selectedCL?.id === cl.id
                          ? "bg-blue-50 border border-blue-200"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {cl.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {format(
                            parseISO(cl.updated_at),
                            "MM.dd HH:mm",
                            { locale: ko }
                          )}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(cl);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 우측 편집 영역 */}
          <div className="flex-1">
            {!selectedCL ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  자기소개서를 선택하세요
                </h3>
                <p className="text-sm text-gray-500">
                  좌측에서 자기소개서를 선택하거나 새로 만들어보세요.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 제목/대상기업 */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        제목
                      </label>
                      <input
                        value={clForm.title}
                        onChange={(e) =>
                          updateCLField("title", e.target.value)
                        }
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">
                        대상 기업
                      </label>
                      <input
                        value={clForm.target_company}
                        onChange={(e) =>
                          updateCLField(
                            "target_company",
                            e.target.value
                          )
                        }
                        placeholder="지원할 기업명"
                        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                      />
                    </div>
                  </div>

                  {/* 수동 저장 */}
                  <div className="flex items-center justify-end gap-2">
                    {isSaving && (
                      <span className="text-xs text-gray-400">
                        저장 중...
                      </span>
                    )}
                    <button
                      onClick={() => saveCoverLetter()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 flex items-center gap-1.5"
                    >
                      <Save className="w-4 h-4" /> 저장
                    </button>
                  </div>
                </div>

                {/* 4개 섹션 */}
                {CL_FIELDS.map(({ key, label, guide }) => (
                  <div
                    key={key}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-5"
                  >
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      {label}
                    </label>
                    <p className="text-xs text-gray-400 mb-3">
                      {guide}
                    </p>
                    <textarea
                      value={clForm[key]}
                      onChange={(e) =>
                        updateCLField(key, e.target.value)
                      }
                      rows={8}
                      className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm resize-none"
                    />
                    <p
                      className={`text-xs text-right mt-1 ${
                        clForm[key].length > 500
                          ? "text-orange-500"
                          : "text-gray-400"
                      }`}
                    >
                      {clForm[key].length} / 500자
                    </p>
                  </div>
                ))}

                {/* 참고 패널 */}
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setShowRefPanel(!showRefPanel)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-700">
                      내 프로젝트/자격증 참고하기
                    </span>
                    {showRefPanel ? (
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  {showRefPanel && (
                    <div className="px-5 pb-5 border-t border-gray-50">
                      <div className="grid sm:grid-cols-2 gap-4 pt-4">
                        {/* 프로젝트 */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">
                            프로젝트
                          </h4>
                          {projects.length === 0 ? (
                            <p className="text-xs text-gray-400">
                              없음
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {projects.map((p) => (
                                <div
                                  key={p.id}
                                  className="text-xs text-gray-600 p-2 bg-gray-50 rounded"
                                >
                                  <p className="font-medium">
                                    {p.title}
                                  </p>
                                  {p.description && (
                                    <p className="text-gray-400 line-clamp-2">
                                      {p.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 자격증 */}
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 mb-2">
                            자격증
                          </h4>
                          {certificates.length === 0 ? (
                            <p className="text-xs text-gray-400">
                              없음
                            </p>
                          ) : (
                            <div className="space-y-1 max-h-40 overflow-y-auto">
                              {certificates.map((c) => (
                                <div
                                  key={c.id}
                                  className="text-xs text-gray-600 p-2 bg-gray-50 rounded"
                                >
                                  <span className="font-medium">
                                    {c.name}
                                  </span>
                                  {c.issuer && (
                                    <span className="text-gray-400">
                                      {" "}
                                      ({c.issuer})
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 삭제 확인 다이얼로그 ─── */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              자기소개서 삭제
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              &ldquo;{deleteTarget.title}&rdquo;을(를) 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={confirmDeleteCL}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
