"use client";

import { useState, useRef } from "react";
import { X, CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface PendingDoc {
  id: string;
  type: "resume" | "cover_letter";
  userId: string;
  title: string;
  studentName: string;
}

interface LogEntry {
  index: number;
  title: string;
  studentName: string;
  status: "pending" | "processing" | "success" | "error";
  score?: number;
  error?: string;
}

export default function BatchReviewModal({
  isOpen,
  onClose,
  pendingDocuments,
}: {
  isOpen: boolean;
  onClose: () => void;
  pendingDocuments: PendingDoc[];
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [progress, setProgress] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const cancelRef = useRef(false);

  const startBatchReview = async () => {
    if (pendingDocuments.length === 0) return;

    setIsProcessing(true);
    setIsDone(false);
    cancelRef.current = false;

    const initialLogs: LogEntry[] = pendingDocuments.map((doc, i) => ({
      index: i,
      title: doc.title,
      studentName: doc.studentName,
      status: "pending" as const,
    }));
    setLogs(initialLogs);

    for (let i = 0; i < pendingDocuments.length; i++) {
      if (cancelRef.current) break;

      const doc = pendingDocuments[i];

      // 현재 처리 중으로 상태 업데이트
      setLogs((prev) =>
        prev.map((log) =>
          log.index === i ? { ...log, status: "processing" as const } : log
        )
      );

      try {
        const response = await fetch("/api/gemini/batch-review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_id: doc.id,
            document_type: doc.type,
            user_id: doc.userId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "처리 실패");
        }

        setLogs((prev) =>
          prev.map((log) =>
            log.index === i
              ? { ...log, status: "success" as const, score: result.overall_score }
              : log
          )
        );
      } catch (error) {
        setLogs((prev) =>
          prev.map((log) =>
            log.index === i
              ? {
                  ...log,
                  status: "error" as const,
                  error:
                    error instanceof Error ? error.message : "알 수 없는 오류",
                }
              : log
          )
        );
      }

      setProgress(i + 1);
    }

    setIsProcessing(false);
    setIsDone(true);
  };

  const handleClose = () => {
    if (isProcessing) {
      cancelRef.current = true;
    }
    // 초기화
    setLogs([]);
    setProgress(0);
    setIsDone(false);
    setIsProcessing(false);
    onClose();
  };

  if (!isOpen) return null;

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;
  const avgScore =
    successCount > 0
      ? Math.round(
          logs
            .filter((l) => l.status === "success" && l.score != null)
            .reduce((sum, l) => sum + (l.score || 0), 0) / successCount
        )
      : 0;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={isProcessing ? undefined : handleClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              일괄 AI 첨삭
            </h3>
            <button
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 바디 */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 시작 전 */}
            {!isProcessing && !isDone && (
              <div className="text-center py-4">
                <p className="text-gray-700 mb-2">
                  <span className="font-semibold text-purple-600">
                    {pendingDocuments.length}건
                  </span>
                  의 대기 문서를 순차적으로 AI 첨삭합니다.
                </p>
                <p className="text-sm text-gray-500">
                  문서당 약 10-30초가 소요되며, 총{" "}
                  {Math.ceil((pendingDocuments.length * 20) / 60)}분 예상됩니다.
                </p>
              </div>
            )}

            {/* 프로그레스 바 */}
            {(isProcessing || isDone) && (
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">
                    {progress}/{pendingDocuments.length} 처리 완료
                  </span>
                  <span className="text-gray-400">
                    {Math.round((progress / pendingDocuments.length) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-purple-600 h-2.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(progress / pendingDocuments.length) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* 로그 */}
            {logs.length > 0 && (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.index}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                      log.status === "processing"
                        ? "bg-blue-50"
                        : log.status === "success"
                        ? "bg-green-50"
                        : log.status === "error"
                        ? "bg-red-50"
                        : "bg-gray-50"
                    }`}
                  >
                    {log.status === "pending" && (
                      <span className="w-5 h-5 text-gray-300">-</span>
                    )}
                    {log.status === "processing" && (
                      <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {log.status === "success" && (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    )}
                    {log.status === "error" && (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-gray-700 truncate block">
                        {log.studentName} - {log.title}
                      </span>
                      {log.status === "error" && (
                        <span className="text-xs text-red-500">
                          {log.error}
                        </span>
                      )}
                    </div>
                    {log.status === "success" && log.score != null && (
                      <span className="text-green-600 font-semibold whitespace-nowrap">
                        {log.score}점
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 완료 요약 */}
            {isDone && (
              <div className="bg-purple-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-700">
                  성공{" "}
                  <span className="font-bold text-green-600">
                    {successCount}건
                  </span>
                  {errorCount > 0 && (
                    <>
                      {" / "}실패{" "}
                      <span className="font-bold text-red-500">
                        {errorCount}건
                      </span>
                    </>
                  )}
                </p>
                {successCount > 0 && (
                  <p className="text-sm text-gray-600 mt-1">
                    평균 점수:{" "}
                    <span className="font-bold text-purple-600">
                      {avgScore}점
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 푸터 */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            {!isProcessing && !isDone && (
              <>
                <button
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={startBatchReview}
                  className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  첨삭 시작
                </button>
              </>
            )}
            {isProcessing && (
              <button
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                중단
              </button>
            )}
            {isDone && (
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
