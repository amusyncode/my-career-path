"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  FileEdit,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { matchAllFiles, formatFileSize } from "@/lib/file-matching";
import StudentSearchDropdown from "@/components/instructor/StudentSearchDropdown";
import GemSelector from "@/components/instructor/GemSelector";
import UploadProgressPanel from "@/components/instructor/UploadProgressPanel";
import type { UploadFileItem, FileStatus } from "@/components/instructor/UploadProgressPanel";
import type { Profile, EducationLevel } from "@/lib/types";
import toast from "react-hot-toast";

type DocumentType = "resume" | "cover_letter";
type GemMode = "auto" | "manual";

interface FileEntry {
  id: string;
  file: File;
  studentId: string | null;
  studentName: string;
  autoMatched: boolean;
  gemName: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RecentUpload {
  id: string;
  user_id: string;
  file_name: string;
  title: string;
  status: string;
  created_at: string;
  file_type: string | null;
  profiles?: { name: string; education_level: string };
  ai_review_results?: { score: number | null }[];
}

export default function InstructorUploadPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  // Auth & profile
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [instructorName, setInstructorName] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [students, setStudents] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload state
  const [docType, setDocType] = useState<DocumentType>("resume");
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [gemMode, setGemMode] = useState<GemMode>("auto");
  const [manualGemId, setManualGemId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [manualGemName, setManualGemName] = useState("");
  const [autoReview, setAutoReview] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [todayCount, setTodayCount] = useState(0);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processFiles, setProcessFiles] = useState<UploadFileItem[]>([]);

  // Recent uploads
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);

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

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile || (profile.role !== "instructor" && profile.role !== "super_admin")) {
        router.push("/");
        return;
      }

      setInstructorId(user.id);
      setInstructorName(profile.name || "");
      setHasApiKey(!!profile.gemini_api_key);

      // 학생 목록
      const { data: studentList } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "student")
        .eq("instructor_id", user.id)
        .eq("is_active", true)
        .order("name");
      if (studentList) setStudents(studentList);

      // 오늘 업로드 수
      const today = new Date().toISOString().slice(0, 10);
      const { count: rCount } = await supabase
        .from("uploaded_resumes")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", user.id)
        .gte("created_at", today);
      const { count: cCount } = await supabase
        .from("uploaded_cover_letters")
        .select("id", { count: "exact", head: true })
        .eq("instructor_id", user.id)
        .gte("created_at", today);
      setTodayCount((rCount || 0) + (cCount || 0));

      // 최근 업로드
      await fetchRecentUploads(user.id);
      setIsLoading(false);
    };
    init();
  }, []);

  const fetchRecentUploads = async (uid: string) => {
    const { data: resumes } = await supabase
      .from("uploaded_resumes")
      .select("id, user_id, file_name, title, status, created_at, file_type, profiles!uploaded_resumes_user_id_fkey(name, education_level)")
      .eq("instructor_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: coverLetters } = await supabase
      .from("uploaded_cover_letters")
      .select("id, user_id, file_name, title, status, created_at, file_type, profiles!uploaded_cover_letters_user_id_fkey(name, education_level)")
      .eq("instructor_id", uid)
      .order("created_at", { ascending: false })
      .limit(10);

    const combined = [
      ...(resumes || []).map((r) => ({ ...r, _docType: "resume" as const })),
      ...(coverLetters || []).map((c) => ({ ...c, _docType: "cover_letter" as const })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRecentUploads(combined as any);
  };

  // --- File handling ---
  const handleFilesSelected = useCallback(
    (selectedFiles: FileList | File[]) => {
      const validFiles: File[] = [];
      const maxSize = 10 * 1024 * 1024;
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ];
      const allowedExts = [".pdf", ".docx", ".txt"];

      Array.from(selectedFiles).forEach((f) => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        if (f.size > maxSize) {
          toast.error(`${f.name}: 10MB를 초과합니다.`);
          return;
        }
        if (!allowedTypes.includes(f.type) && !allowedExts.includes(ext)) {
          toast.error(`${f.name}: 지원하지 않는 파일 형식입니다.`);
          return;
        }
        // 중복 방지
        if (files.some((e) => e.file.name === f.name && e.file.size === f.size)) {
          toast.error(`${f.name}: 이미 추가된 파일입니다.`);
          return;
        }
        validFiles.push(f);
      });

      if (validFiles.length === 0) return;

      // 자동 매칭
      const matchResults = matchAllFiles(validFiles, students);
      const newEntries: FileEntry[] = validFiles.map((f) => {
        const match = matchResults.get(f.name);
        return {
          id: `${f.name}_${Date.now()}_${Math.random()}`,
          file: f,
          studentId: match?.student?.id || null,
          studentName: match?.student?.name || "",
          autoMatched: match?.auto || false,
          gemName: "",
        };
      });

      setFiles((prev) => [...prev, ...newEntries]);
    },
    [files, students]
  );

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileStudent = (fileId: string, studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? {
              ...f,
              studentId,
              studentName: student?.name || "",
              autoMatched: false,
            }
          : f
      )
    );
  };

  // --- Drag & Drop ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  // --- Upload & Review ---
  const allMatched = files.length > 0 && files.every((f) => f.studentId);

  const startUpload = async () => {
    if (!instructorId || !allMatched) return;
    cancelRef.current = false;
    setIsProcessing(true);

    const items: UploadFileItem[] = files.map((f) => ({
      id: f.id,
      file: f.file,
      studentName: f.studentName,
      studentId: f.studentId!,
      gemName: gemMode === "manual" ? manualGemName : "자동선택",
      status: "pending" as FileStatus,
      progress: 0,
    }));
    setProcessFiles(items);

    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;

      const item = items[i];

      // 1. 업로드
      updateItemStatus(items, i, "uploading", 20);

      try {
        const formData = new FormData();
        formData.append("file", item.file);
        formData.append("student_id", item.studentId);
        formData.append("document_type", docType);
        formData.append("title", item.file.name.replace(/\.[^.]+$/, ""));

        const uploadRes = await fetch("/api/admin/upload-document", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "업로드 실패");
        }

        const uploadData = await uploadRes.json();
        const documentId = uploadData.data?.id;

        updateItemStatus(items, i, "uploaded", 50);

        // 2. AI 첨삭
        if (autoReview && hasApiKey && documentId) {
          updateItemStatus(items, i, "reviewing", 60);

          const reviewFormData = new FormData();
          // 파일을 다시 보내서 텍스트 추출 + 리뷰
          reviewFormData.append("file", item.file);
          if (gemMode === "manual" && manualGemId) {
            reviewFormData.append("gem_id", manualGemId);
          }

          const reviewEndpoint =
            docType === "resume"
              ? "/api/gemini/review-resume"
              : "/api/gemini/review-cover-letter";

          const reviewRes = await fetch(reviewEndpoint, {
            method: "POST",
            body: reviewFormData,
          });

          if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            const score =
              reviewData.data?.overall_score ||
              reviewData.data?.score ||
              null;

            items[i] = {
              ...items[i],
              status: "completed",
              progress: 100,
              score,
              reviewId: reviewData.data?.id,
            };
          } else {
            const err = await reviewRes.json();
            items[i] = {
              ...items[i],
              status: "failed",
              progress: 100,
              error: err.error || "AI 첨삭 실패",
            };
          }
        } else {
          items[i] = { ...items[i], status: "completed", progress: 100 };
        }
      } catch (err) {
        items[i] = {
          ...items[i],
          status: "failed",
          progress: 100,
          error: err instanceof Error ? err.message : "업로드 실패",
        };
      }

      setProcessFiles([...items]);

      // Rate limit 대기
      if (i < items.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setIsProcessing(false);

    // 결과 토스트
    const completed = items.filter((i) => i.status === "completed");
    const failed = items.filter((i) => i.status === "failed");
    const avgScore =
      completed.filter((c) => c.score).length > 0
        ? Math.round(
            completed.reduce((s, c) => s + (c.score || 0), 0) /
              completed.filter((c) => c.score).length
          )
        : 0;

    if (failed.length === 0) {
      toast.success(
        `${completed.length}건 완료!${avgScore > 0 ? ` 평균 AI 점수: ${avgScore}점` : ""}`
      );
    } else {
      toast.error(`${completed.length}건 완료, ${failed.length}건 실패`);
    }

    setTodayCount((prev) => prev + completed.length);
    if (instructorId) fetchRecentUploads(instructorId);
  };

  const updateItemStatus = (
    items: UploadFileItem[],
    index: number,
    status: FileStatus,
    progress: number
  ) => {
    items[index] = { ...items[index], status, progress };
    setProcessFiles([...items]);
  };

  const handleRetry = async (id: string) => {
    // 재시도: 해당 파일만 다시 처리
    const item = processFiles.find((f) => f.id === id);
    if (!item) return;

    const updated = processFiles.map((f) =>
      f.id === id ? { ...f, status: "uploading" as FileStatus, progress: 20, error: undefined } : f
    );
    setProcessFiles(updated);
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("student_id", item.studentId);
      formData.append("document_type", docType);
      formData.append("title", item.file.name.replace(/\.[^.]+$/, ""));

      const uploadRes = await fetch("/api/admin/upload-document", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("업로드 실패");

      const uploadData = await uploadRes.json();
      const documentId = uploadData.data?.id;

      if (autoReview && hasApiKey && documentId) {
        const reviewFormData = new FormData();
        reviewFormData.append("file", item.file);
        if (gemMode === "manual" && manualGemId) {
          reviewFormData.append("gem_id", manualGemId);
        }

        const endpoint =
          docType === "resume"
            ? "/api/gemini/review-resume"
            : "/api/gemini/review-cover-letter";
        const reviewRes = await fetch(endpoint, { method: "POST", body: reviewFormData });

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          setProcessFiles((prev) =>
            prev.map((f) =>
              f.id === id
                ? {
                    ...f,
                    status: "completed" as FileStatus,
                    progress: 100,
                    score: reviewData.data?.overall_score || reviewData.data?.score,
                    reviewId: reviewData.data?.id,
                  }
                : f
            )
          );
        } else {
          throw new Error("AI 첨삭 실패");
        }
      } else {
        setProcessFiles((prev) =>
          prev.map((f) =>
            f.id === id ? { ...f, status: "completed" as FileStatus, progress: 100 } : f
          )
        );
      }
    } catch (err) {
      setProcessFiles((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: "failed" as FileStatus,
                progress: 100,
                error: err instanceof Error ? err.message : "실패",
              }
            : f
        )
      );
    }
    setIsProcessing(false);
  };

  const handleDownloadPDF = async () => {
    try {
      const { generateBatchReviewPDF } = await import("@/lib/pdf-generator");
      const completedItems = processFiles.filter(
        (f) => f.status === "completed" && f.score != null
      );
      // 간단한 PDF (리뷰 데이터 없이 요약만)
      const batchItems = completedItems.map((f) => ({
        studentName: f.studentName,
        school: "",
        department: "",
        educationLevel: "university" as const,
        documentType: docType,
        gemName: f.gemName,
        score: f.score || 0,
        feedback: "",
        improvementPoints: [],
        revisedContent: "",
      }));
      const doc = generateBatchReviewPDF(batchItems, instructorName);
      const { downloadPDF } = await import("@/lib/pdf-generator");
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      downloadPDF(doc, `일괄첨삭결과_${dateStr}`);
    } catch {
      toast.error("PDF 생성에 실패했습니다.");
    }
  };

  const handleCopyAll = async () => {
    try {
      const { copyBatchReviewToClipboard } = await import("@/lib/clipboard");
      const completedItems = processFiles.filter(
        (f) => f.status === "completed" && f.score != null
      );
      const batchItems = completedItems.map((f) => ({
        studentName: f.studentName,
        school: "",
        department: "",
        educationLevel: "university" as const,
        documentType: docType,
        gemName: f.gemName,
        score: f.score || 0,
        feedback: "",
        improvementPoints: [],
        revisedContent: "",
      }));
      await copyBatchReviewToClipboard(batchItems, instructorName);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setProcessFiles([]);
    setIsProcessing(false);
    cancelRef.current = false;
  };

  // --- Render ---
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1-1. 헤더 */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            이력서 일괄업로드
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            학생 이력서/자소서를 업로드하고 AI 첨삭을 실행합니다
          </p>
        </div>
        <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded-full">
          오늘 {todayCount}건 업로드
        </span>
      </div>

      {/* 1-2. API 키 미등록 경고 */}
      {!hasApiKey && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">
                API 키가 등록되지 않았습니다. AI 첨삭을 사용하려면 설정에서
                등록해주세요.
              </p>
              <a
                href="/instructor/settings"
                className="text-sm text-yellow-600 hover:underline mt-1 inline-block"
              >
                설정으로 이동 →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 처리 중이면 ProgressPanel 표시 */}
      {processFiles.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <UploadProgressPanel
            files={processFiles}
            isProcessing={isProcessing}
            onRetry={handleRetry}
            onComplete={() => {}}
            onDownloadPDF={handleDownloadPDF}
            onCopyAll={handleCopyAll}
            onReset={handleReset}
          />
        </div>
      ) : (
        /* 2. 업로드 영역 */
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">📤 파일 업로드</h2>

          {/* 2-1. 문서 유형 선택 */}
          <div className="flex gap-3 mb-4">
            <button
              onClick={() => setDocType("resume")}
              className={`flex items-center gap-2 border-2 rounded-xl p-4 cursor-pointer transition ${
                docType === "resume"
                  ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <FileText
                className={`w-5 h-5 ${
                  docType === "resume" ? "text-purple-600" : "text-gray-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  docType === "resume" ? "text-purple-700" : "text-gray-600"
                }`}
              >
                이력서
              </span>
            </button>
            <button
              onClick={() => setDocType("cover_letter")}
              className={`flex items-center gap-2 border-2 rounded-xl p-4 cursor-pointer transition ${
                docType === "cover_letter"
                  ? "border-purple-500 bg-purple-50 ring-2 ring-purple-500"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <FileEdit
                className={`w-5 h-5 ${
                  docType === "cover_letter"
                    ? "text-purple-600"
                    : "text-gray-400"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  docType === "cover_letter"
                    ? "text-purple-700"
                    : "text-gray-600"
                }`}
              >
                자기소개서
              </span>
            </button>
          </div>

          {/* 2-2. 드래그 & 드롭 */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center transition cursor-pointer mb-4 ${
              isDragging
                ? "border-purple-500 bg-purple-100"
                : "border-gray-300 hover:border-purple-400 hover:bg-purple-50"
            }`}
          >
            {isDragging ? (
              <p className="text-purple-600 font-medium">
                여기에 파일을 놓으세요
              </p>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">
                  파일을 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  PDF, DOCX, TXT 파일 지원 · 최대 10MB · 여러 파일 동시 업로드
                  가능
                </p>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* 2-3. 파일 목록 */}
          {files.length > 0 && (
            <div className="mb-4 space-y-2">
              {files.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-gray-50 rounded-lg p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />
                    <span className="font-medium text-sm truncate max-w-[200px]">
                      {entry.file.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {formatFileSize(entry.file.size)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-48">
                      <StudentSearchDropdown
                        value={entry.studentId}
                        onChange={(sid) => updateFileStudent(entry.id, sid)}
                        instructorId={instructorId || ""}
                        placeholder="학생 선택"
                        className="text-sm"
                      />
                    </div>
                    {entry.studentId && (
                      <span
                        className={`text-xs flex-shrink-0 ${
                          entry.autoMatched
                            ? "text-green-500"
                            : "text-blue-500"
                        }`}
                      >
                        {entry.autoMatched ? "✅ 자동매칭" : "✅ 선택됨"}
                      </span>
                    )}
                    {!entry.studentId && (
                      <span className="text-xs text-yellow-500 flex-shrink-0">
                        ⚠️ 수동선택 필요
                      </span>
                    )}
                    {gemMode === "manual" && manualGemName && (
                      <span className="text-xs text-purple-500 hidden sm:inline">
                        (Gem: {manualGemName})
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => removeFile(entry.id)}
                    className="text-red-400 hover:text-red-600 flex-shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 2-4. 자동 매칭 안내 */}
          {files.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                💡 파일명에 학생 이름이 포함되어 있으면 자동으로 매칭됩니다
              </p>
              <p className="text-xs text-blue-500 mt-1">
                예: &quot;홍길동_이력서.pdf&quot; → 홍길동 학생에게 자동 매칭
              </p>
            </div>
          )}

          {/* 2-5. Gem 선택 */}
          {files.length > 0 && (
            <div className="bg-purple-50 rounded-xl p-4 mb-4">
              <h3 className="font-semibold text-purple-800 mb-3">
                🤖 AI 첨삭 Gem 선택
              </h3>

              <div className="space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gemMode"
                    checked={gemMode === "auto"}
                    onChange={() => setGemMode("auto")}
                    className="mt-1 accent-purple-500"
                  />
                  <div>
                    <span className="text-sm font-medium">
                      학생별 자동 선택
                    </span>
                    <p className="text-xs text-gray-500">
                      각 학생의 학교급과 전공에 맞는 기본 Gem이 자동으로
                      적용됩니다
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="gemMode"
                    checked={gemMode === "manual"}
                    onChange={() => setGemMode("manual")}
                    className="mt-1 accent-purple-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium">
                      모든 파일에 동일 Gem 적용
                    </span>
                    <p className="text-xs text-gray-500">
                      선택한 Gem을 모든 파일에 동일하게 적용합니다
                    </p>
                    {gemMode === "manual" && (
                      <div className="mt-2">
                        <GemSelector
                          category={docType === "resume" ? "resume" : "cover_letter"}
                          educationLevel={"university" as EducationLevel}
                          value={manualGemId}
                          onChange={(id) => {
                            setManualGemId(id);
                          }}
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* 2-6. AI 자동 첨삭 옵션 */}
          {files.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="autoReview"
                checked={autoReview}
                onChange={(e) => setAutoReview(e.target.checked)}
                disabled={!hasApiKey}
                className="accent-purple-500"
              />
              <label htmlFor="autoReview" className="font-medium text-sm">
                업로드 후 AI 자동 첨삭 실행
              </label>
              {hasApiKey ? (
                <span className="text-xs text-gray-400">
                  Gemini 2.5 Flash를 사용하여 선택한 Gem으로 자동 첨삭합니다
                </span>
              ) : (
                <span className="text-xs text-red-400">
                  API 키를 먼저 등록해주세요
                </span>
              )}
            </div>
          )}

          {/* 2-7. 업로드 버튼 */}
          {files.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={startUpload}
                disabled={!allMatched || isProcessing}
                className={`flex items-center gap-2 rounded-lg px-6 py-2.5 font-medium transition ${
                  allMatched && !isProcessing
                    ? "bg-purple-500 text-white hover:bg-purple-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                <Upload className="w-4 h-4" />
                업로드 시작 ({files.length}건)
              </button>
              <button
                onClick={handleReset}
                className="bg-white border border-gray-200 text-gray-600 rounded-lg px-4 py-2.5 hover:bg-gray-50 transition"
              >
                전체 초기화
              </button>
            </div>
          )}
        </div>
      )}

      {/* 8. 최근 업로드 이력 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-gray-900">최근 업로드 이력</h2>
          <a
            href="/instructor/data"
            className="text-sm text-purple-600 hover:underline"
          >
            전체보기 →
          </a>
        </div>

        {recentUploads.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>아직 업로드 이력이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y">
            {recentUploads.map((item) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const docTypeLabel = (item as any)._docType === "resume" ? "이력서" : "자소서";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const docTypeBg = (item as any)._docType === "resume" ? "bg-blue-100 text-blue-600" : "bg-green-100 text-green-600";
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const profile = (item as any).profiles;
              const studentName = profile?.name || "알 수 없음";
              const eduLevel = profile?.education_level;
              const eduBg =
                eduLevel === "high_school"
                  ? "bg-purple-100 text-purple-600"
                  : "bg-blue-100 text-blue-600";
              const eduLabel =
                eduLevel === "high_school" ? "특성화고" : "대학교";

              const statusMap: Record<string, { label: string; cls: string }> = {
                uploaded: { label: "업로드됨", cls: "bg-gray-100 text-gray-600" },
                reviewing: { label: "분석중", cls: "bg-yellow-100 text-yellow-600" },
                reviewed: { label: "완료", cls: "bg-green-100 text-green-600" },
                failed: { label: "실패", cls: "bg-red-100 text-red-600" },
              };
              const st = statusMap[item.status] || statusMap.uploaded;

              return (
                <div
                  key={item.id}
                  className="flex justify-between items-center py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <span className="font-medium text-sm">{studentName}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full ${docTypeBg}`}
                    >
                      {docTypeLabel}
                    </span>
                    {eduLevel && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded-full ${eduBg}`}
                      >
                        {eduLabel}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 truncate max-w-[120px] hidden sm:inline">
                      {item.file_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${st.cls}`}
                    >
                      {st.label}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(item.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
