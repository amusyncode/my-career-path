"use client";

import { useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { X, Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";

interface UploadDocumentModalProps {
  studentId: string;
  studentName: string;
  documentType: "resume" | "cover_letter";
  onClose: () => void;
  onUpload: () => void;
}

const ACCEPTED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};

type UploadStep = "idle" | "uploading" | "reviewing" | "done" | "error";

export default function UploadDocumentModal({
  studentId,
  studentName,
  documentType,
  onClose,
  onUpload,
}: UploadDocumentModalProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<UploadStep>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [autoReview, setAutoReview] = useState(true);

  const docLabel = documentType === "resume" ? "이력서" : "자기소개서";

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateFile = (f: File): string | null => {
    if (!Object.keys(ACCEPTED_TYPES).includes(f.type)) {
      return "PDF, DOCX, TXT 파일만 업로드할 수 있습니다.";
    }
    if (f.size > 10 * 1024 * 1024) {
      return "파일 크기는 10MB를 초과할 수 없습니다.";
    }
    return null;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      const err = validateFile(droppedFile);
      if (err) {
        setErrorMessage(err);
        return;
      }
      setFile(droppedFile);
      setErrorMessage("");
      if (!title) {
        setTitle(droppedFile.name.replace(/\.[^.]+$/, ""));
      }
    }
  }, [title]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        const err = validateFile(selectedFile);
        if (err) {
          setErrorMessage(err);
          return;
        }
        setFile(selectedFile);
        setErrorMessage("");
        if (!title) {
          setTitle(selectedFile.name.replace(/\.[^.]+$/, ""));
        }
      }
    },
    [title]
  );

  const handleUpload = async () => {
    if (!file) return;

    setStep("uploading");
    setErrorMessage("");

    try {
      // 1. Upload file to Supabase Storage
      const ext = file.name.split(".").pop() || "pdf";
      const storagePath = `${studentId}/${Date.now()}_${file.name}`;
      const bucket = documentType === "resume" ? "resumes" : "cover-letters";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(storagePath);

      const fileUrl = urlData.publicUrl;

      // 3. Insert DB record
      const table =
        documentType === "resume"
          ? "uploaded_resumes"
          : "uploaded_cover_letters";

      const { error: dbError } = await supabase.from(table).insert({
        user_id: studentId,
        file_name: file.name,
        file_url: fileUrl,
        title: title || file.name.replace(/\.[^.]+$/, ""),
        status: autoReview ? "reviewing" : "uploaded",
        file_type: ext.toUpperCase(),
      });

      if (dbError) throw dbError;

      // 4. Auto AI review if enabled
      if (autoReview) {
        setStep("reviewing");

        const endpoint =
          documentType === "resume"
            ? "/api/gemini/review-resume"
            : "/api/gemini/review-cover-letter";

        const formData = new FormData();
        formData.append("file", file);

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            console.error("AI 리뷰 실패:", await res.text());
            // AI review failed but upload succeeded - update status
            await supabase
              .from(table)
              .update({ status: "uploaded" })
              .eq("user_id", studentId)
              .eq("file_url", fileUrl);
          }
        } catch (reviewErr) {
          console.error("AI 리뷰 오류:", reviewErr);
          await supabase
            .from(table)
            .update({ status: "uploaded" })
            .eq("user_id", studentId)
            .eq("file_url", fileUrl);
        }
      }

      setStep("done");
    } catch (err) {
      console.error("업로드 실패:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다."
      );
      setStep("error");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {docLabel} 업로드
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {step === "done" ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                업로드 완료
              </h3>
              <p className="text-sm text-gray-500">
                {studentName}님의 {docLabel}가 성공적으로 업로드되었습니다.
                {autoReview && " AI 첨삭이 요청되었습니다."}
              </p>
              <button
                onClick={onUpload}
                className="mt-4 bg-purple-500 text-white rounded-lg px-6 py-2 text-sm hover:bg-purple-600 transition-colors"
              >
                확인
              </button>
            </div>
          ) : step === "error" ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                업로드 실패
              </h3>
              <p className="text-sm text-red-500 mb-4">{errorMessage}</p>
              <button
                onClick={() => {
                  setStep("idle");
                  setErrorMessage("");
                }}
                className="bg-purple-500 text-white rounded-lg px-6 py-2 text-sm hover:bg-purple-600 transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* Student info */}
              <p className="text-sm text-gray-500">
                대상 학생: <span className="font-medium text-gray-900">{studentName}</span>
              </p>

              {/* Title input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 (선택)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`${docLabel} 제목을 입력하세요`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
                  disabled={step !== "idle"}
                />
              </div>

              {/* Drop zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => step === "idle" && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-purple-400 bg-purple-50"
                    : file
                    ? "border-green-300 bg-green-50"
                    : "border-gray-200 hover:border-purple-300 hover:bg-purple-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-green-500" />
                    <div className="text-left">
                      <p className="font-medium text-sm text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    {step === "idle" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 mb-1">
                      파일을 드래그하거나 클릭하여 업로드
                    </p>
                    <p className="text-xs text-gray-400">
                      PDF, DOCX, TXT (최대 10MB)
                    </p>
                  </>
                )}
              </div>

              {errorMessage && step === "idle" && (
                <p className="text-sm text-red-500">{errorMessage}</p>
              )}

              {/* Auto review toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoReview}
                  onChange={(e) => setAutoReview(e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  disabled={step !== "idle"}
                />
                <span className="text-sm text-gray-700">
                  업로드 후 자동 AI 첨삭 실행
                </span>
              </label>

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={!file || step !== "idle"}
                className="w-full bg-purple-500 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {step === "uploading" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    업로드 중...
                  </>
                )}
                {step === "reviewing" && (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    AI 첨삭 분석 중...
                  </>
                )}
                {step === "idle" && (
                  <>
                    <Upload className="w-4 h-4" />
                    {docLabel} 업로드
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
