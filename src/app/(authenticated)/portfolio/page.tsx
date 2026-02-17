"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectFile } from "@/lib/types";
import { format, parseISO } from "date-fns";
import {
  FolderOpen,
  Plus,
  Star,
  X,
  Upload,
  Github,
  ExternalLink,
  Image as ImageIcon,
  FileText,
  Code,
  File,
  Trash2,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

/* ─── 상수 ─── */
const STATUS_OPTIONS: {
  value: Project["status"];
  label: string;
  cls: string;
}[] = [
  { value: "planning", label: "기획중", cls: "bg-gray-100 text-gray-600" },
  {
    value: "in_progress",
    label: "진행중",
    cls: "bg-blue-100 text-blue-600",
  },
  {
    value: "completed",
    label: "완료",
    cls: "bg-green-100 text-green-600",
  },
];

const CATEGORY_OPTIONS = [
  "웹개발",
  "앱개발",
  "임베디드",
  "디자인",
  "데이터",
  "기타",
];

const SUGGESTED_TAGS = [
  "HTML",
  "CSS",
  "JavaScript",
  "TypeScript",
  "React",
  "Next.js",
  "Python",
  "Java",
  "C",
  "C++",
  "Arduino",
  "Node.js",
  "Flutter",
  "Swift",
  "Kotlin",
];

type SortOption = "newest" | "oldest" | "featured";

function getStatusBadge(status: string) {
  return (
    STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0]
  );
}

function getFileIcon(fileType: string | null) {
  if (!fileType) return File;
  if (fileType.startsWith("image/")) return ImageIcon;
  if (fileType.includes("pdf") || fileType.includes("doc")) return FileText;
  if (
    fileType.includes("javascript") ||
    fileType.includes("python") ||
    fileType.includes("text/")
  )
    return Code;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

/* ─── 빈 프로젝트 폼 ─── */
const EMPTY_FORM = {
  title: "",
  description: "",
  tech_stack: [] as string[],
  category: "",
  start_date: "",
  end_date: "",
  status: "planning" as Project["status"],
  github_url: "",
  demo_url: "",
  is_featured: false,
  thumbnail_url: null as string | null,
};

export default function PortfolioPage() {
  const supabase = createClient();

  /* ─── 상태 ─── */
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  // 파일 업로드
  const [thumbnailFile, setThumbnailFile] = useState<globalThis.File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    null
  );
  const [projectFiles, setProjectFiles] = useState<globalThis.File[]>([]);
  const [existingFiles, setExistingFiles] = useState<ProjectFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ─── 데이터 로드 ─── */
  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch {
      toast.error("프로젝트를 불러오지 못했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ─── 필터 & 정렬 ─── */
  const filtered = projects
    .filter((p) => statusFilter === "all" || p.status === statusFilter)
    .sort((a, b) => {
      if (sortBy === "featured") {
        if (a.is_featured !== b.is_featured)
          return a.is_featured ? -1 : 1;
      }
      if (sortBy === "oldest") {
        return (
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
        );
      }
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      );
    });

  const stats = {
    total: projects.length,
    inProgress: projects.filter((p) => p.status === "in_progress").length,
    completed: projects.filter((p) => p.status === "completed").length,
    featured: projects.filter((p) => p.is_featured).length,
  };

  /* ─── 모달 열기/닫기 ─── */
  const openCreateModal = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setTagInput("");
    setThumbnailFile(null);
    setThumbnailPreview(null);
    setProjectFiles([]);
    setExistingFiles([]);
    setShowModal(true);
  };

  const openEditModal = async (project: Project) => {
    setEditingId(project.id);
    setForm({
      title: project.title,
      description: project.description || "",
      tech_stack: project.tech_stack || [],
      category: project.category || "",
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      status: project.status,
      github_url: project.github_url || "",
      demo_url: project.demo_url || "",
      is_featured: project.is_featured,
      thumbnail_url: project.thumbnail_url,
    });
    setTagInput("");
    setThumbnailFile(null);
    setThumbnailPreview(project.thumbnail_url);
    setProjectFiles([]);
    setShowModal(true);

    // 기존 파일 로드
    const { data: files } = await supabase
      .from("project_files")
      .select("*")
      .eq("project_id", project.id);
    setExistingFiles((files as ProjectFile[]) || []);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  /* ─── 태그 관리 ─── */
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !form.tech_stack.includes(t)) {
      setForm((f) => ({ ...f, tech_stack: [...f.tech_stack, t] }));
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setForm((f) => ({
      ...f,
      tech_stack: f.tech_stack.filter((t) => t !== tag),
    }));
  };

  /* ─── 썸네일 처리 ─── */
  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지 파일은 5MB 이하만 업로드 가능합니다");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("이미지 파일만 업로드 가능합니다");
      return;
    }
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  /* ─── 프로젝트 파일 처리 ─── */
  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProjectFiles((prev) => [...prev, ...files]);
  };

  const removeNewFile = (idx: number) => {
    setProjectFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const deleteExistingFile = async (fileId: string, fileUrl: string) => {
    try {
      // Storage에서 삭제
      const path = fileUrl.split("/project-files/")[1];
      if (path) {
        await supabase.storage.from("project-files").remove([path]);
      }
      // DB에서 삭제
      await supabase.from("project_files").delete().eq("id", fileId);
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("파일이 삭제되었습니다");
    } catch {
      toast.error("파일 삭제에 실패했습니다");
    }
  };

  /* ─── 저장 ─── */
  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("프로젝트 이름을 입력하세요");
      return;
    }

    setSaving(true);
    setUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      let thumbnailUrl = form.thumbnail_url;

      // 썸네일 업로드
      if (thumbnailFile) {
        const ext = thumbnailFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("thumbnails")
          .upload(fileName, thumbnailFile);
        if (upErr) throw upErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from("thumbnails").getPublicUrl(fileName);
        thumbnailUrl = publicUrl;
      }

      const projectData = {
        user_id: user.id,
        title: form.title.trim(),
        description: form.description || null,
        tech_stack: form.tech_stack,
        category: form.category || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: form.status,
        github_url: form.github_url || null,
        demo_url: form.demo_url || null,
        is_featured: form.is_featured,
        thumbnail_url: thumbnailUrl,
      };

      let projectId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("projects")
          .update(projectData)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert(projectData)
          .select()
          .single();
        if (error) throw error;
        projectId = (data as Project).id;
      }

      // 프로젝트 파일 업로드
      if (projectFiles.length > 0 && projectId) {
        for (const file of projectFiles) {
          const fileName = `${projectId}/${Date.now()}-${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("project-files")
            .upload(fileName, file);
          if (upErr) {
            console.error("File upload error:", upErr);
            continue;
          }
          const {
            data: { publicUrl },
          } = supabase.storage.from("project-files").getPublicUrl(fileName);

          await supabase.from("project_files").insert({
            project_id: projectId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type,
            file_size: file.size,
          });
        }
      }

      toast.success(editingId ? "수정되었습니다" : "프로젝트가 생성되었습니다");
      closeModal();
      fetchProjects();
    } catch {
      toast.error("저장에 실패했습니다");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  /* ─── 스켈레톤 ─── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div className="h-8 w-40 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-8 w-16 bg-gray-200 rounded-full animate-pulse"
            />
          ))}
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl shadow-sm overflow-hidden"
            >
              <div className="h-48 bg-gray-200 animate-pulse" />
              <div className="p-5 space-y-3">
                <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="h-5 w-14 bg-gray-200 rounded-full animate-pulse"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ──── 상단 ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">나의 포트폴리오</h1>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-2 hover:bg-blue-600 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />새 프로젝트
        </button>
      </div>

      {/* ──── 필터 ──── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-1">
          {[
            { value: "all", label: "전체" },
            ...STATUS_OPTIONS,
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? "bg-blue-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white"
        >
          <option value="newest">최신순</option>
          <option value="oldest">오래된순</option>
          <option value="featured">Featured 우선</option>
        </select>
      </div>

      {/* ──── 통계 ──── */}
      {projects.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
            전체 {stats.total}
          </span>
          <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">
            진행중 {stats.inProgress}
          </span>
          <span className="text-xs bg-green-50 text-green-600 px-2.5 py-1 rounded-full">
            완료 {stats.completed}
          </span>
          {stats.featured > 0 && (
            <span className="text-xs bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full">
              ⭐ Featured {stats.featured}
            </span>
          )}
        </div>
      )}

      {/* ──── 프로젝트 그리드 / 빈 상태 ──── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            아직 프로젝트가 없어요
          </h2>
          <p className="text-gray-500 mb-6">
            첫 번째 프로젝트를 등록하고 포트폴리오를 시작하세요!
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-lg px-5 py-2.5 hover:bg-blue-600 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            프로젝트 추가하기
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => {
            const badge = getStatusBadge(project.status);
            return (
              <div
                key={project.id}
                className="bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow group relative"
              >
                {/* 썸네일 */}
                <Link href={`/portfolio/${project.id}`} className="block">
                <div className="h-48 w-full relative overflow-hidden">
                  {project.thumbnail_url ? (
                    <img
                      src={project.thumbnail_url}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                      <span className="text-4xl font-bold text-white/80">
                        {project.title.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  {project.is_featured && (
                    <div className="absolute top-3 left-3 bg-yellow-400 text-yellow-900 rounded-full p-1.5 shadow-sm">
                      <Star className="w-3.5 h-3.5 fill-current" />
                    </div>
                  )}
                </div>
                </Link>
                {/* 편집 버튼 */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openEditModal(project);
                  }}
                  className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                >
                  <Pencil className="w-3.5 h-3.5 text-gray-600" />
                </button>

                {/* 콘텐츠 */}
                <Link href={`/portfolio/${project.id}`} className="block p-5">
                  <h3 className="font-semibold text-lg text-gray-900 truncate">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  {project.tech_stack.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {project.tech_stack.slice(0, 4).map((tech) => (
                        <span
                          key={tech}
                          className="bg-blue-50 text-blue-600 text-xs rounded-full px-2.5 py-0.5"
                        >
                          {tech}
                        </span>
                      ))}
                      {project.tech_stack.length > 4 && (
                        <span className="bg-gray-100 text-gray-500 text-xs rounded-full px-2.5 py-0.5">
                          +{project.tech_stack.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex justify-between items-center mt-4">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {format(parseISO(project.created_at), "yyyy.MM.dd")}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* ──── 생성/편집 모달 ──── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto py-8">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? "프로젝트 수정" : "새 프로젝트"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* 제목 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  프로젝트 이름 *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="프로젝트 이름을 입력하세요"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
              </div>

              {/* 설명 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="프로젝트에 대해 설명해주세요. 목적, 과정, 결과 등"
                  className="w-full min-h-[150px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none resize-y"
                />
              </div>

              {/* 기술 스택 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  기술 스택
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tech_stack.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-600 text-xs rounded-full px-2.5 py-1"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-800"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="기술 입력 후 Enter"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-400 outline-none"
                />
                <div className="flex flex-wrap gap-1 mt-2">
                  {SUGGESTED_TAGS.filter(
                    (t) => !form.tech_stack.includes(t)
                  )
                    .slice(0, 8)
                    .map((tag) => (
                      <button
                        key={tag}
                        onClick={() => addTag(tag)}
                        className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5 hover:bg-gray-200 transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                </div>
              </div>

              {/* 카테고리 & 상태 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-400 outline-none"
                  >
                    <option value="">선택</option>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상태
                  </label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        status: e.target.value as Project["status"],
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-blue-400 outline-none"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 날짜 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    종료일
                  </label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* URL */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Github className="w-3.5 h-3.5 inline mr-1" />
                    GitHub URL
                  </label>
                  <input
                    type="url"
                    value={form.github_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, github_url: e.target.value }))
                    }
                    placeholder="https://github.com/..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <ExternalLink className="w-3.5 h-3.5 inline mr-1" />
                    데모 URL
                  </label>
                  <input
                    type="url"
                    value={form.demo_url}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, demo_url: e.target.value }))
                    }
                    placeholder="https://..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-blue-400 outline-none"
                  />
                </div>
              </div>

              {/* Featured 토글 */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, is_featured: !f.is_featured }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    form.is_featured ? "bg-yellow-400" : "bg-gray-200"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      form.is_featured ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-gray-700">
                  ⭐ Featured 프로젝트
                </span>
              </div>

              {/* 썸네일 업로드 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  썸네일 이미지
                </label>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleThumbnailSelect}
                  className="hidden"
                />
                {thumbnailPreview ? (
                  <div className="relative">
                    <img
                      src={thumbnailPreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => {
                        setThumbnailFile(null);
                        setThumbnailPreview(null);
                        setForm((f) => ({ ...f, thumbnail_url: null }));
                      }}
                      className="absolute top-2 right-2 bg-white/80 rounded-full p-1 hover:bg-white"
                    >
                      <X className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => thumbnailInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-400 transition-colors text-gray-400"
                  >
                    <Upload className="w-6 h-6" />
                    <span className="text-sm">
                      클릭하여 이미지 업로드 (최대 5MB)
                    </span>
                  </button>
                )}
              </div>

              {/* 프로젝트 파일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  첨부 파일
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFilesSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors text-gray-400"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-xs">
                    파일을 끌어다 놓거나 클릭하세요
                  </span>
                </button>

                {/* 기존 파일 */}
                {existingFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">
                      기존 파일
                    </p>
                    {existingFiles.map((f) => {
                      const Icon = getFileIcon(f.file_type);
                      return (
                        <div
                          key={f.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm"
                        >
                          <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="flex-1 truncate text-gray-700">
                            {f.file_name}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatFileSize(f.file_size)}
                          </span>
                          <button
                            onClick={() =>
                              deleteExistingFile(f.id, f.file_url)
                            }
                            className="p-1 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 새 파일 */}
                {projectFiles.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-gray-500 font-medium">
                      새로 추가할 파일
                    </p>
                    {projectFiles.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg text-sm"
                      >
                        <File className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <span className="flex-1 truncate text-gray-700">
                          {f.name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {formatFileSize(f.size)}
                        </span>
                        <button
                          onClick={() => removeNewFile(idx)}
                          className="p-1 hover:bg-red-50 rounded"
                        >
                          <X className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 모달 하단 */}
            <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
              >
                {saving
                  ? uploading
                    ? "업로드 중..."
                    : "저장 중..."
                  : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
