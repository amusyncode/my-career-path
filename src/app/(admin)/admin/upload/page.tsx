"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import {
  FileText,
  FileEdit,
  Upload,
  X,
  Check,
  Clock,
  Loader2,
  Sparkles,
  AlertCircle,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";

interface StudentOption {
  id: string;
  name: string;
  school: string | null;
  department: string | null;
}

interface UploadFile {
  file: File;
  studentId: string | null;
  autoMatched: boolean;
  status: "pending" | "uploading" | "uploaded" | "reviewing" | "done" | "failed";
  score: number | null;
  error: string | null;
  documentId: string | null;
}

interface RecentUpload {
  id: string;
  title: string;
  file_name: string;
  status: string;
  uploaded_at: string;
  user_id: string;
  studentName: string;
  documentType: "resume" | "cover_letter";
}

type DocType = "resume" | "cover_letter";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + "B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + "KB";
  return (bytes / (1024 * 1024)).toFixed(1) + "MB";
}

function matchFileToStudent(
  fileName: string,
  students: StudentOption[]
): string | null {
  const baseName = fileName.replace(/\.[^.]+$/, "").replace(/[_\-\s]/g, "");
  const matches = students.filter((s) => {
    const nameNoSpace = s.name.replace(/\s/g, "");
    return baseName.includes(nameNoSpace);
  });
  return matches.length === 1 ? matches[0].id : null;
}

export default function BulkUploadPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [docType, setDocType] = useState<DocType>("resume");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [autoReview, setAutoReview] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [recentUploads, setRecentUploads] = useState<RecentUpload[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const cancelRef = useRef(false);

  // 학생 목록 로드
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, school, department")
        .eq("role", "student")
        .order("name");
      setStudents(data || []);
    })();
  }, [supabase]);

  // 최근 업로드 이력 로드
  const loadRecentUploads = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [resumesRes, clRes] = await Promise.all([
      supabase
        .from("uploaded_resumes")
        .select("id, title, file_name, status, uploaded_at, user_id")
        .eq("uploaded_by", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(10),
      supabase
        .from("uploaded_cover_letters")
        .select("id, title, file_name, status, uploaded_at, user_id")
        .eq("uploaded_by", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(10),
    ]);

    const userIds = new Set<string>();
    resumesRes.data?.forEach((r) => userIds.add(r.user_id));
    clRes.data?.forEach((r) => userIds.add(r.user_id));

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", Array.from(userIds));
    const nameMap = new Map((profiles || []).map((p) => [p.id, p.name || "이름없음"]));

    const all: RecentUpload[] = [
      ...(resumesRes.data || []).map((r) => ({
        ...r,
        studentName: nameMap.get(r.user_id) || "이름없음",
        documentType: "resume" as const,
      })),
      ...(clRes.data || []).map((r) => ({
        ...r,
        studentName: nameMap.get(r.user_id) || "이름없음",
        documentType: "cover_letter" as const,
      })),
    ];
    all.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    setRecentUploads(all.slice(0, 10));

    // 오늘 업로드 수
    const today = format(new Date(), "yyyy-MM-dd");
    setTodayCount(all.filter((r) => r.uploaded_at.startsWith(today)).length);
  }, [supabase]);

  useEffect(() => {
    loadRecentUploads();
  }, [loadRecentUploads]);

  // 파일 추가
  const addFiles = (newFiles: FileList | File[]) => {
    const validExts = [".pdf", ".docx", ".txt"];
    const added: UploadFile[] = [];

    Array.from(newFiles).forEach((file) => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!validExts.includes(ext)) {
        toast.error(`${file.name}: 지원하지 않는 파일 형식입니다`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: 10MB를 초과합니다`);
        return;
      }
      const matched = matchFileToStudent(file.name, students);
      added.push({
        file,
        studentId: matched,
        autoMatched: !!matched,
        status: "pending",
        score: null,
        error: null,
        documentId: null,
      });
    });

    if (added.length > 0) {
      setFiles((prev) => [...prev, ...added]);
      const matchedCount = added.filter((f) => f.autoMatched).length;
      if (matchedCount > 0) {
        toast.success(`${matchedCount}건 자동 매칭 완료`);
      }
    }
  };

  // 드래그 앤 드롭
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  // 학생 변경
  const updateStudentId = (index: number, studentId: string) => {
    setFiles((prev) =>
      prev.map((f, i) =>
        i === index ? { ...f, studentId, autoMatched: false } : f
      )
    );
  };

  // 파일 제거
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // 업로드 가능 여부
  const canUpload =
    files.length > 0 &&
    files.every((f) => f.studentId) &&
    !isProcessing;

  // 업로드 실행
  const handleUpload = async () => {
    if (!canUpload) return;
    setIsProcessing(true);
    setIsComplete(false);
    cancelRef.current = false;

    toast("업로드를 시작합니다", { icon: "📤" });

    const results: { success: number; failed: number; totalScore: number; scoreCount: number } = {
      success: 0,
      failed: 0,
      totalScore: 0,
      scoreCount: 0,
    };

    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;
      const f = files[i];

      // 업로드 시작
      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading" } : item
        )
      );

      try {
        // 1. 관리자 업로드 API 호출
        const formData = new FormData();
        formData.append("file", f.file);
        formData.append("student_id", f.studentId!);
        formData.append("document_type", docType);
        formData.append("title", f.file.name.replace(/\.[^.]+$/, ""));

        const uploadRes = await fetch("/api/admin/upload-document", {
          method: "POST",
          body: formData,
        });

        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || "업로드 실패");
        }

        const { data: record } = await uploadRes.json();

        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "uploaded", documentId: record.id }
              : item
          )
        );

        // 2. AI 자동 첨삭
        if (autoReview && !cancelRef.current) {
          setFiles((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "reviewing" } : item
            )
          );

          const reviewFormData = new FormData();
          reviewFormData.append("file", f.file);

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
            const score = reviewData.overall_score ?? reviewData.score ?? null;

            // DB에 결과 저장
            const table = docType === "resume" ? "uploaded_resumes" : "uploaded_cover_letters";
            await supabase
              .from(table)
              .update({ status: "reviewed" })
              .eq("id", record.id);

            // ai_review_results에 저장
            await supabase.from("ai_review_results").insert({
              user_id: f.studentId,
              document_type: docType,
              document_id: record.id,
              overall_score: score,
              improvement_points: reviewData.improvement_points || [],
              reviewer_comment: reviewData.feedback || reviewData.summary || "",
              input_tokens: reviewData.usage?.input_tokens || 0,
              output_tokens: reviewData.usage?.output_tokens || 0,
              model_name: reviewData.usage?.model || "gemini-2.5-flash",
            });

            setFiles((prev) =>
              prev.map((item, idx) =>
                idx === i ? { ...item, status: "done", score } : item
              )
            );

            if (score != null) {
              results.totalScore += score;
              results.scoreCount++;
            }
          } else {
            // AI 실패해도 업로드는 성공
            await supabase
              .from(docType === "resume" ? "uploaded_resumes" : "uploaded_cover_letters")
              .update({ status: "failed" })
              .eq("id", record.id);

            setFiles((prev) =>
              prev.map((item, idx) =>
                idx === i
                  ? { ...item, status: "done", error: "AI 첨삭 실패 (업로드는 완료)" }
                  : item
              )
            );
          }

          results.success++;
        } else {
          setFiles((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: "done" } : item
            )
          );
          results.success++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "업로드 실패";
        setFiles((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "failed", error: msg } : item
          )
        );
        results.failed++;
      }

      // 다음 파일 전 딜레이
      if (i < files.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setIsProcessing(false);
    setIsComplete(true);
    loadRecentUploads();

    if (results.failed === 0) {
      const avgMsg =
        results.scoreCount > 0
          ? ` 평균 AI 점수: ${Math.round(results.totalScore / results.scoreCount)}점`
          : "";
      toast.success(`${results.success}건 업로드 완료!${avgMsg}`);
    } else {
      toast.error(`${results.success}건 완료, ${results.failed}건 실패`);
    }
  };

  // 재시도
  const retryFile = async (index: number) => {
    const f = files[index];
    if (!f.studentId) return;

    setFiles((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, status: "uploading", error: null }
          : item
      )
    );

    try {
      const formData = new FormData();
      formData.append("file", f.file);
      formData.append("student_id", f.studentId);
      formData.append("document_type", docType);
      formData.append("title", f.file.name.replace(/\.[^.]+$/, ""));

      const uploadRes = await fetch("/api/admin/upload-document", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("업로드 실패");

      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === index ? { ...item, status: "done" } : item
        )
      );
      toast.success(`${f.file.name} 재업로드 완료`);
    } catch {
      setFiles((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? { ...item, status: "failed", error: "재시도 실패" }
            : item
        )
      );
    }
  };

  // 초기화
  const resetAll = () => {
    setFiles([]);
    setIsComplete(false);
    setIsProcessing(false);
    cancelRef.current = false;
  };

  // 진행률 계산
  const completedCount = files.filter((f) =>
    ["done", "failed"].includes(f.status)
  ).length;
  const progress = files.length > 0 ? Math.round((completedCount / files.length) * 100) : 0;
  const successCount = files.filter((f) => f.status === "done").length;
  const failedCount = files.filter((f) => f.status === "failed").length;
  const avgScore = (() => {
    const scored = files.filter((f) => f.score != null);
    if (scored.length === 0) return null;
    return Math.round(
      scored.reduce((sum, f) => sum + f.score!, 0) / scored.length
    );
  })();

  const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    uploaded: { label: "대기", cls: "bg-gray-100 text-gray-600" },
    reviewing: { label: "분석중", cls: "bg-yellow-100 text-yellow-700" },
    reviewed: { label: "완료", cls: "bg-green-100 text-green-700" },
    failed: { label: "실패", cls: "bg-red-100 text-red-700" },
  };

  return (
    <div>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            이력서 일괄업로드
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            학생 이력서/자소서를 업로드하고 AI 첨삭을 실행합니다
          </p>
        </div>
        {todayCount > 0 && (
          <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full font-medium">
            오늘 {todayCount}건 업로드
          </span>
        )}
      </div>

      {/* 업로드 영역 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Upload className="w-5 h-5 text-purple-600" />
          파일 업로드
        </h2>

        {/* 문서 유형 선택 */}
        <div className="flex gap-3 mb-4">
          {[
            { type: "resume" as DocType, label: "이력서", icon: FileText },
            { type: "cover_letter" as DocType, label: "자기소개서", icon: FileEdit },
          ].map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => setDocType(type)}
              disabled={isProcessing}
              className={`flex items-center gap-2 px-4 py-3 border-2 rounded-xl transition-colors ${
                docType === type
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              } ${isProcessing ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{label}</span>
            </button>
          ))}
        </div>

        {/* 드래그&드롭 영역 */}
        {!isProcessing && !isComplete && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-4 ${
              isDragging
                ? "border-purple-500 bg-purple-100"
                : "border-gray-300 hover:border-purple-400 hover:bg-purple-50"
            }`}
          >
            <Upload
              className={`w-12 h-12 mx-auto mb-3 ${
                isDragging ? "text-purple-600" : "text-gray-400"
              }`}
            />
            <p
              className={`font-medium ${
                isDragging ? "text-purple-600" : "text-gray-600"
              }`}
            >
              {isDragging
                ? "여기에 파일을 놓으세요"
                : "파일을 드래그하거나 클릭하여 업로드"}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              PDF, DOCX, TXT 파일 지원 · 최대 10MB · 여러 파일 동시 업로드 가능
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>
        )}

        {/* 자동 매칭 안내 */}
        {files.length > 0 && !isProcessing && !isComplete && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 text-sm text-blue-700">
            💡 파일명에 학생 이름이 포함되어 있으면 자동으로 매칭됩니다 (예:
            &quot;홍길동_이력서.pdf&quot;)
          </div>
        )}

        {/* 파일 목록 */}
        {files.length > 0 && (
          <div className="space-y-2 mb-4">
            {/* 진행 상태 바 (처리 중일 때) */}
            {isProcessing && (
              <div className="bg-purple-50 rounded-xl p-5 mb-4">
                <p className="font-semibold text-purple-800 mb-2">
                  {files.some((f) => f.status === "reviewing")
                    ? "AI 첨삭 진행중..."
                    : "업로드 진행중..."}
                </p>
                <div className="bg-gray-200 rounded-full h-3 mb-2">
                  <div
                    className="bg-purple-500 rounded-full h-3 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600">
                  {completedCount} / {files.length} 건 완료 ({progress}%)
                </p>
              </div>
            )}

            {/* 완료 요약 */}
            {isComplete && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-4">
                <p className="font-semibold text-green-800 mb-3">
                  ✅ 업로드가 완료되었습니다
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xl font-bold text-green-600">
                      {successCount}건
                    </p>
                    <p className="text-sm text-gray-500">성공</p>
                  </div>
                  {failedCount > 0 && (
                    <div>
                      <p className="text-xl font-bold text-red-500">
                        {failedCount}건
                      </p>
                      <p className="text-sm text-gray-500">실패</p>
                    </div>
                  )}
                  {avgScore !== null && (
                    <div>
                      <p className="text-xl font-bold text-purple-600">
                        {avgScore}점
                      </p>
                      <p className="text-sm text-gray-500">평균 AI 점수</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-4">
                  <Link
                    href="/admin/ai-center"
                    className="flex items-center gap-1 text-sm text-purple-600 font-medium hover:underline"
                  >
                    결과 상세 보기 <ArrowRight className="w-3 h-3" />
                  </Link>
                  <button
                    onClick={resetAll}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    추가 업로드
                  </button>
                </div>
              </div>
            )}

            {/* 개별 파일 행 */}
            {files.map((f, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 flex items-center gap-3 ${
                  f.status === "failed"
                    ? "bg-red-50"
                    : f.status === "done"
                    ? "bg-green-50"
                    : "bg-gray-50"
                }`}
              >
                {/* 상태 아이콘 */}
                <div className="w-8 flex-shrink-0 flex justify-center">
                  {f.status === "pending" && (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                  {f.status === "uploading" && (
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  {f.status === "uploaded" && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                  {f.status === "reviewing" && (
                    <Sparkles className="w-5 h-5 text-purple-500 animate-pulse" />
                  )}
                  {f.status === "done" && (
                    <Check className="w-5 h-5 text-green-500" />
                  )}
                  {f.status === "failed" && (
                    <AlertCircle className="w-5 h-5 text-red-500" />
                  )}
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500 flex-shrink-0" />
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {f.file.name}
                    </span>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {formatFileSize(f.file.size)}
                    </span>
                  </div>
                  {f.error && (
                    <p className="text-xs text-red-500 mt-0.5">{f.error}</p>
                  )}
                </div>

                {/* 학생 매칭 */}
                {!isProcessing && !isComplete ? (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={f.studentId || ""}
                      onChange={(e) => updateStudentId(idx, e.target.value)}
                      className={`text-sm border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-500 max-w-[200px] ${
                        f.studentId
                          ? "border-green-300 bg-green-50"
                          : "border-yellow-300 bg-yellow-50"
                      }`}
                    >
                      <option value="">학생 선택</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.school ? ` (${s.school})` : ""}
                        </option>
                      ))}
                    </select>
                    {f.studentId ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1 text-red-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">
                      → {students.find((s) => s.id === f.studentId)?.name}
                    </span>
                    {f.status === "done" && f.score != null && (
                      <span className="text-sm font-bold text-purple-600">
                        {f.score}점
                      </span>
                    )}
                    {f.status === "failed" && (
                      <button
                        onClick={() => retryFile(idx)}
                        className="flex items-center gap-1 text-xs text-orange-500 hover:underline"
                      >
                        <RotateCw className="w-3 h-3" />
                        재시도
                      </button>
                    )}
                    {["uploading", "reviewing"].includes(f.status) && (
                      <span className="text-xs text-purple-500">
                        {f.status === "uploading" ? "업로드중..." : "AI 분석중..."}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* AI 자동 첨삭 옵션 + 버튼 */}
        {files.length > 0 && !isProcessing && !isComplete && (
          <>
            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={autoReview}
                onChange={(e) => setAutoReview(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="font-medium text-gray-700">
                업로드 후 AI 자동 첨삭 실행
              </span>
              <span className="text-xs text-gray-400">
                Gemini 2.5 Flash 사용
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleUpload}
                disabled={!canUpload}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${
                  canUpload
                    ? "bg-purple-500 text-white hover:bg-purple-600"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                <Upload className="w-4 h-4" />
                업로드 시작 ({files.length}건)
              </button>
              <button
                onClick={resetAll}
                className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                전체 초기화
              </button>
            </div>
          </>
        )}

        {/* 빈 상태 */}
        {files.length === 0 && !isProcessing && !isComplete && (
          <p className="text-center text-sm text-gray-400 py-2">
            파일을 선택하면 학생 매칭 후 업로드할 수 있습니다
          </p>
        )}
      </div>

      {/* 최근 업로드 이력 */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-900">최근 업로드 이력</h3>
          <Link
            href="/admin/data"
            className="text-sm text-purple-600 hover:underline flex items-center gap-1"
          >
            전체보기 <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentUploads.length === 0 ? (
          <div className="text-center py-8">
            <Upload className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              아직 업로드 이력이 없습니다
            </p>
            <p className="text-gray-400 text-xs mt-1">
              위에서 파일을 업로드해보세요
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-medium text-gray-500">
                    파일명
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">
                    학생
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-gray-500">
                    유형
                  </th>
                  <th className="text-center px-3 py-2 font-medium text-gray-500">
                    상태
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">
                    업로드일
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUploads.map((r) => (
                  <tr
                    key={`${r.documentType}-${r.id}`}
                    className="border-b border-gray-50 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2.5 text-gray-800 max-w-[200px] truncate">
                      {r.title || r.file_name}
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">
                      {r.studentName}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.documentType === "resume"
                            ? "bg-blue-50 text-blue-700"
                            : "bg-green-50 text-green-700"
                        }`}
                      >
                        {r.documentType === "resume" ? "이력서" : "자소서"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          STATUS_BADGE[r.status]?.cls || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_BADGE[r.status]?.label || r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-500">
                      {format(new Date(r.uploaded_at), "yyyy.MM.dd HH:mm")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
