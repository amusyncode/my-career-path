"use client";

import { useState, useRef, useCallback } from "react";
import { X, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import type { EducationLevel } from "@/lib/types";

interface BatchDocument {
  id: string;
  document_type: "resume" | "cover_letter";
  title: string;
  student_name: string;
  student_id: string;
  education_level: EducationLevel;
  department?: string;
}

interface Props {
  documents: BatchDocument[];
  gemOverride?: string;
  onClose: () => void;
  onComplete: () => void;
}

type DocStatus = "pending" | "processing" | "success" | "failed";

interface DocProgress {
  doc: BatchDocument;
  status: DocStatus;
  score?: number;
  error?: string;
  gemName?: string;
}

export default function BatchReviewModal({
  documents,
  gemOverride,
  onClose,
  onComplete,
}: Props) {
  const [progress, setProgress] = useState<DocProgress[]>(
    documents.map((doc) => ({ doc, status: "pending" }))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const cancelRef = useRef(false);

  const runBatch = useCallback(async () => {
    setIsRunning(true);
    cancelRef.current = false;

    for (let i = 0; i < documents.length; i++) {
      if (cancelRef.current) break;

      const doc = documents[i];

      setProgress((prev) =>
        prev.map((p, idx) =>
          idx === i ? { ...p, status: "processing" } : p
        )
      );

      try {
        const endpoint =
          doc.document_type === "resume"
            ? "/api/gemini/review-resume"
            : "/api/gemini/review-cover-letter";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            document_id: doc.id,
            ...(gemOverride ? { gem_id: gemOverride } : {}),
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "첨삭 실패");
        }

        const result = await res.json();
        setProgress((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: "success",
                  score: result.overall_score,
                  gemName: result.gem_used,
                }
              : p
          )
        );
      } catch (err) {
        setProgress((prev) =>
          prev.map((p, idx) =>
            idx === i
              ? {
                  ...p,
                  status: "failed",
                  error:
                    err instanceof Error
                      ? err.message
                      : "알 수 없는 오류",
                }
              : p
          )
        );
      }

      // Delay between requests
      if (i < documents.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setIsRunning(false);
    setIsDone(true);
  }, [documents, gemOverride]);

  const successCount = progress.filter((p) => p.status === "success").length;
  const failCount = progress.filter((p) => p.status === "failed").length;
  const processedCount = successCount + failCount;
  const avgScore =
    successCount > 0
      ? Math.round(
          progress
            .filter((p) => p.status === "success" && p.score != null)
            .reduce((sum, p) => sum + (p.score || 0), 0) / successCount
        )
      : 0;
  const percent =
    documents.length > 0
      ? Math.round((processedCount / documents.length) * 100)
      : 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI 일괄 첨삭 진행
          </h2>
          <button
            onClick={() => {
              cancelRef.current = true;
              if (isDone) onComplete();
              else onClose();
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="p-6 space-y-4">
          {!isRunning && !isDone ? (
            <div className="text-center space-y-4">
              <p className="text-gray-700 dark:text-gray-300">
                대기중인 <strong>{documents.length}건</strong>의 문서를 일괄
                AI 첨삭하시겠습니까?
              </p>
              <p className="text-sm text-gray-400">
                각 문서는 학생 전공에 맞는 기본 Gem으로 자동 첨삭됩니다.
              </p>
              <button
                onClick={runBatch}
                className="bg-purple-500 text-white rounded-lg px-6 py-2.5 hover:bg-purple-600 transition-colors font-medium"
              >
                일괄 첨삭 시작
              </button>
            </div>
          ) : (
            <>
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">
                    {processedCount} / {documents.length} 건 처리
                    {isRunning ? "중..." : " 완료"}
                  </span>
                  <span className="text-gray-500">{percent}%</span>
                </div>
                <div className="bg-gray-200 dark:bg-gray-700 h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-purple-500 h-full rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              {/* Log */}
              <div className="max-h-60 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                {progress.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm"
                  >
                    {p.status === "pending" && (
                      <Clock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                    {p.status === "processing" && (
                      <Loader2 className="w-4 h-4 text-purple-500 animate-spin flex-shrink-0" />
                    )}
                    {p.status === "success" && (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {p.status === "failed" && (
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        p.status === "pending"
                          ? "text-gray-400"
                          : p.status === "processing"
                          ? "text-purple-600 dark:text-purple-400"
                          : p.status === "success"
                          ? "text-gray-700 dark:text-gray-300"
                          : "text-red-500"
                      }`}
                    >
                      {p.doc.student_name} - {p.doc.title}
                    </span>
                    {p.status === "success" && p.score != null && (
                      <span className="text-green-600 font-medium flex-shrink-0 ml-auto">
                        {p.score}점
                      </span>
                    )}
                    {p.status === "failed" && (
                      <span className="text-red-400 text-xs flex-shrink-0 ml-auto">
                        {p.error}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Summary */}
              {isDone && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5 text-center">
                  <p className="text-green-800 dark:text-green-200 font-semibold mb-1">
                    일괄 첨삭 완료
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    성공: {successCount}건 / 실패: {failCount}건 / 평균
                    점수: {avgScore}점
                  </p>
                  <button
                    onClick={onComplete}
                    className="mt-3 bg-green-600 text-white rounded-lg px-4 py-2 text-sm hover:bg-green-700 transition-colors"
                  >
                    결과 확인
                  </button>
                </div>
              )}

              {isRunning && (
                <button
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="text-sm text-red-500 hover:text-red-600 mx-auto block"
                >
                  중단
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
