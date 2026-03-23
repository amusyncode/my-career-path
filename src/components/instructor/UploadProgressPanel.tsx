"use client";

import { Check, X, Clock, Loader2 } from "lucide-react";
import { formatFileSize } from "@/lib/file-matching";

export type FileStatus =
  | "pending"
  | "uploading"
  | "uploaded"
  | "reviewing"
  | "completed"
  | "failed";

export interface UploadFileItem {
  id: string;
  file: File;
  studentName: string;
  studentId: string;
  gemName: string;
  status: FileStatus;
  progress: number;
  score?: number | null;
  error?: string;
  reviewId?: string;
}

interface UploadProgressPanelProps {
  files: UploadFileItem[];
  isProcessing: boolean;
  onRetry: (id: string) => void;
  onComplete: () => void;
  onDownloadPDF: () => void;
  onCopyAll: () => void;
  onReset: () => void;
}

export default function UploadProgressPanel({
  files,
  isProcessing,
  onRetry,
  onComplete,
  onDownloadPDF,
  onCopyAll,
  onReset,
}: UploadProgressPanelProps) {
  const completed = files.filter((f) => f.status === "completed");
  const failed = files.filter((f) => f.status === "failed");
  const totalDone = completed.length + failed.length;
  const percent = files.length > 0 ? Math.round((totalDone / files.length) * 100) : 0;
  const avgScore =
    completed.length > 0
      ? Math.round(
          completed.reduce((sum, f) => sum + (f.score || 0), 0) /
            completed.length
        )
      : 0;

  const allDone = totalDone === files.length && files.length > 0;

  const getStatusIcon = (status: FileStatus) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-gray-400" />;
      case "uploading":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "uploaded":
        return <Check className="w-4 h-4 text-blue-500" />;
      case "reviewing":
        return <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />;
      case "completed":
        return <Check className="w-4 h-4 text-green-500" />;
      case "failed":
        return <X className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusText = (f: UploadFileItem) => {
    switch (f.status) {
      case "pending":
        return <span className="text-gray-400">대기중</span>;
      case "uploading":
        return <span className="text-blue-500">업로드중...</span>;
      case "uploaded":
        return <span className="text-blue-500">업로드 완료</span>;
      case "reviewing":
        return <span className="text-purple-500">AI 분석중...</span>;
      case "completed":
        return (
          <span className="text-green-600 font-bold">
            완료 {f.score != null ? `(${f.score}점)` : ""}
          </span>
        );
      case "failed":
        return (
          <span className="text-red-500">
            실패{" "}
            <button
              onClick={() => onRetry(f.id)}
              className="text-purple-500 underline ml-1 text-xs"
            >
              재시도
            </button>
          </span>
        );
    }
  };

  // 남은 시간 추정 (파일당 약 8초)
  const remaining = files.length - totalDone;
  const estimatedMinutes = Math.ceil((remaining * 8) / 60);

  return (
    <div className="space-y-4">
      {/* 전체 진행 */}
      <div className="bg-purple-50 rounded-xl p-5">
        <p className="font-semibold text-purple-800 mb-2">
          {allDone
            ? "처리 완료!"
            : isProcessing
            ? files.some((f) => f.status === "reviewing")
              ? "AI 첨삭 진행중..."
              : "업로드 진행중..."
            : "준비중..."}
        </p>
        <div className="bg-gray-200 rounded-full h-3 mb-2">
          <div
            className="bg-purple-500 rounded-full h-3 transition-all duration-500"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">
            {totalDone} / {files.length} 건 완료 ({percent}%)
          </span>
          {!allDone && remaining > 0 && (
            <span className="text-xs text-gray-400">
              약 {estimatedMinutes}분 남음
            </span>
          )}
        </div>
      </div>

      {/* 파일별 진행 */}
      <div className="space-y-2">
        {files.map((f) => (
          <div
            key={f.id}
            className="bg-white rounded-lg p-3 flex justify-between items-center"
          >
            <div className="flex items-center gap-3 min-w-0">
              {getStatusIcon(f.status)}
              <span className="text-sm font-medium truncate max-w-[160px]">
                {f.file.name}
              </span>
              <span className="text-xs text-gray-400">
                → {f.studentName}
              </span>
              <span className="text-xs text-purple-400 hidden sm:inline">
                (Gem: {f.gemName})
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs">{getStatusText(f)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 완료 요약 */}
      {allDone && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5">
          <p className="font-semibold text-green-800 mb-3">
            ✅ 업로드가 완료되었습니다
          </p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">성공</p>
              <p className="text-xl font-bold text-green-600">
                {completed.length}건
              </p>
            </div>
            {failed.length > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-500">실패</p>
                <p className="text-xl font-bold text-red-500">
                  {failed.length}건
                </p>
              </div>
            )}
            {avgScore > 0 && (
              <div className="text-center">
                <p className="text-xs text-gray-500">평균 점수</p>
                <p className="text-xl font-bold text-purple-600">
                  {avgScore}점
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {completed.length > 0 && (
              <>
                <button
                  onClick={onDownloadPDF}
                  className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-purple-600 transition"
                >
                  결과 전체 PDF 다운로드
                </button>
                <button
                  onClick={onCopyAll}
                  className="bg-white border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-50 transition"
                >
                  결과 전체 복사
                </button>
              </>
            )}
            <a
              href="/instructor/ai-center"
              className="text-purple-600 text-sm self-center hover:underline"
            >
              AI 분석센터에서 확인 →
            </a>
            <button
              onClick={onReset}
              className="text-gray-500 text-sm self-center hover:underline ml-auto"
            >
              추가 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
