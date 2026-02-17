"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Project, ProjectFile } from "@/lib/types";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft,
  Github,
  ExternalLink,
  Pencil,
  Trash2,
  Star,
  Download,
  X,
  Image as ImageIcon,
  FileText,
  Code,
  File,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

/* ─── 상수 ─── */
const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  planning: { label: "기획중", cls: "bg-gray-100 text-gray-600" },
  in_progress: { label: "진행중", cls: "bg-blue-100 text-blue-600" },
  completed: { label: "완료", cls: "bg-green-100 text-green-600" },
};

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

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projRes, filesRes] = await Promise.all([
        supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single(),
        supabase
          .from("project_files")
          .select("*")
          .eq("project_id", projectId)
          .order("uploaded_at", { ascending: true }),
      ]);

      if (projRes.error) throw projRes.error;
      setProject(projRes.data as Project);
      setFiles((filesRes.data as ProjectFile[]) || []);
    } catch {
      toast.error("프로젝트를 불러오지 못했습니다");
    } finally {
      setIsLoading(false);
    }
  }, [supabase, projectId]);

  useEffect(() => {
    if (projectId) fetchProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleDelete = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      // 파일 삭제
      for (const f of files) {
        const path = f.file_url.split("/project-files/")[1];
        if (path) {
          await supabase.storage.from("project-files").remove([path]);
        }
      }
      await supabase
        .from("project_files")
        .delete()
        .eq("project_id", project.id);

      // 썸네일 삭제
      if (project.thumbnail_url) {
        const thumbPath = project.thumbnail_url.split("/thumbnails/")[1];
        if (thumbPath) {
          await supabase.storage.from("thumbnails").remove([thumbPath]);
        }
      }

      // 프로젝트 삭제
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", project.id);
      if (error) throw error;

      toast.success("프로젝트가 삭제되었습니다");
      router.push("/portfolio");
    } catch {
      toast.error("삭제에 실패했습니다");
    } finally {
      setDeleting(false);
    }
  };

  const imageFiles = files.filter((f) =>
    f.file_type?.startsWith("image/")
  );
  const otherFiles = files.filter(
    (f) => !f.file_type?.startsWith("image/")
  );

  /* ─── 스켈레톤 ─── */
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-5 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-10 w-28 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
        <div className="h-40 bg-gray-200 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">프로젝트를 찾을 수 없습니다</p>
        <Link
          href="/portfolio"
          className="text-blue-500 hover:underline mt-2 inline-block"
        >
          포트폴리오로 돌아가기
        </Link>
      </div>
    );
  }

  const badge = STATUS_BADGE[project.status] || STATUS_BADGE.planning;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ──── 뒤로가기 ──── */}
      <Link
        href="/portfolio"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        포트폴리오
      </Link>

      {/* ──── 히어로 ──── */}
      <div className="relative">
        {project.thumbnail_url ? (
          <img
            src={project.thumbnail_url}
            alt={project.title}
            className="w-full h-64 object-cover rounded-xl"
          />
        ) : (
          <div className="w-full h-64 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl flex items-center justify-center">
            <span className="text-6xl font-bold text-white/60">
              {project.title.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* ──── 제목 & 메타 ──── */}
      <div>
        <div className="flex items-start gap-3">
          <h1 className="text-3xl font-bold text-gray-900 flex-1">
            {project.title}
          </h1>
          {project.is_featured && (
            <Star className="w-6 h-6 text-yellow-400 fill-current flex-shrink-0 mt-1" />
          )}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${badge.cls}`}
          >
            {badge.label}
          </span>
          {(project.start_date || project.end_date) && (
            <span className="text-sm text-gray-400">
              {project.start_date
                ? format(parseISO(project.start_date), "yyyy.MM.dd")
                : ""}
              {project.start_date && project.end_date && " ~ "}
              {project.end_date
                ? format(parseISO(project.end_date), "yyyy.MM.dd")
                : ""}
            </span>
          )}
          {project.category && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {project.category}
            </span>
          )}
        </div>
      </div>

      {/* ──── 액션 버튼 ──── */}
      <div className="flex flex-wrap gap-3">
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm hover:bg-gray-900 transition-colors"
          >
            <Github className="w-4 h-4" />
            GitHub
          </a>
        )}
        {project.demo_url && (
          <a
            href={project.demo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-blue-600 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            데모 보기
          </a>
        )}
        <Link
          href={`/portfolio?edit=${project.id}`}
          className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 transition-colors"
        >
          <Pencil className="w-4 h-4" />
          수정
        </Link>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center gap-2 bg-red-50 text-red-500 rounded-lg px-4 py-2 text-sm hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          삭제
        </button>
      </div>

      {/* ──── 기술 스택 ──── */}
      {project.tech_stack.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            사용 기술
          </h2>
          <div className="flex flex-wrap gap-2">
            {project.tech_stack.map((tech) => (
              <span
                key={tech}
                className="bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ──── 설명 ──── */}
      {project.description && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            프로젝트 설명
          </h2>
          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
            {project.description}
          </p>
        </div>
      )}

      {/* ──── 파일 갤러리 ──── */}
      {files.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-900">첨부 파일</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {files.length}
            </span>
          </div>

          {/* 이미지 갤러리 */}
          {imageFiles.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {imageFiles.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setLightboxImage(f.file_url)}
                  className="aspect-video rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
                >
                  <img
                    src={f.file_url}
                    alt={f.file_name}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* 기타 파일 */}
          {otherFiles.length > 0 && (
            <div className="space-y-2">
              {otherFiles.map((f) => {
                const Icon = getFileIcon(f.file_type);
                return (
                  <div
                    key={f.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="flex-1 text-sm text-gray-700 truncate">
                      {f.file_name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFileSize(f.file_size)}
                    </span>
                    <a
                      href={f.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ──── 삭제 확인 다이얼로그 ──── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              프로젝트 삭제
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              &quot;{project.title}&quot;을(를) 삭제하시겠습니까?
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
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
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
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
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
