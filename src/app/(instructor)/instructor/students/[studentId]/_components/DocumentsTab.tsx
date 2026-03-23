"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { FileText, Loader2, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import AIReviewModal from "@/components/instructor/AIReviewModal";

interface UploadedDoc {
  id: string;
  user_id: string;
  title: string | null;
  file_name: string;
  file_url: string;
  status: "uploaded" | "reviewing" | "reviewed" | "failed";
  uploaded_by: string | null;
  created_at?: string;
  uploaded_at?: string;
}

interface AIReviewResult {
  id: string;
  user_id: string;
  document_id: string;
  document_type: "resume" | "cover_letter";
  overall_score: number | null;
  score: number | null;
  feedback: string | null;
  created_at: string;
}

interface DocumentsTabProps {
  studentId: string;
  studentEmail?: string | null;
  onUploadClick?: (type: "resume" | "cover_letter") => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; spinning?: boolean }
> = {
  uploaded: { label: "대기중", className: "bg-gray-100 text-gray-600" },
  reviewing: {
    label: "분석중",
    className: "bg-yellow-100 text-yellow-700",
    spinning: true,
  },
  reviewed: { label: "완료", className: "bg-green-100 text-green-700" },
  failed: { label: "실패", className: "bg-red-100 text-red-700" },
};

export default function DocumentsTab({
  studentId,
  studentEmail,
  onUploadClick,
}: DocumentsTabProps) {
  const supabase = createClient();
  const [resumes, setResumes] = useState<UploadedDoc[]>([]);
  const [coverLetters, setCoverLetters] = useState<UploadedDoc[]>([]);
  const [reviews, setReviews] = useState<AIReviewResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [selectedReview, setSelectedReview] = useState<AIReviewResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resumesRes, coverLettersRes, reviewsRes] = await Promise.all([
        supabase
          .from("uploaded_resumes")
          .select("*")
          .eq("user_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("uploaded_cover_letters")
          .select("*")
          .eq("user_id", studentId)
          .order("created_at", { ascending: false }),
        supabase
          .from("ai_review_results")
          .select("*")
          .eq("user_id", studentId),
      ]);

      setResumes((resumesRes.data as UploadedDoc[]) ?? []);
      setCoverLetters((coverLettersRes.data as UploadedDoc[]) ?? []);
      setReviews((reviewsRes.data as AIReviewResult[]) ?? []);
    } catch (err) {
      console.error("문서 조회 실패:", err);
    }
    setIsLoading(false);
  }, [supabase, studentId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const getReviewForDocument = useCallback(
    (documentId: string, docType: "resume" | "cover_letter") => {
      return reviews.find(
        (r) => r.document_id === documentId && r.document_type === docType
      );
    },
    [reviews]
  );

  const handleRequestReview = useCallback(
    async (documentId: string, docType: "resume" | "cover_letter") => {
      const endpoint =
        docType === "resume"
          ? "/api/gemini/review-resume"
          : "/api/gemini/review-cover-letter";

      setReviewingIds((prev) => new Set(prev).add(documentId));

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, userId: studentId }),
        });

        if (!res.ok) throw new Error("AI 리뷰 요청 실패");

        await fetchDocuments();
      } catch (err) {
        console.error("AI 리뷰 요청 실패:", err);
      } finally {
        setReviewingIds((prev) => {
          const next = new Set(prev);
          next.delete(documentId);
          return next;
        });
      }
    },
    [studentId, fetchDocuments]
  );

  const renderDocumentItem = (
    doc: UploadedDoc,
    docType: "resume" | "cover_letter"
  ) => {
    const review = getReviewForDocument(doc.id, docType);
    const statusConfig = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.uploaded;
    const isRequesting = reviewingIds.has(doc.id);
    const score = review?.overall_score ?? review?.score;
    const dateStr = doc.created_at || doc.uploaded_at;

    return (
      <div
        key={doc.id}
        className="flex justify-between items-center p-4 border-b last:border-0"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-purple-500 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate dark:text-white">
              {doc.title || doc.file_name}
            </p>
            {doc.title && (
              <p className="text-xs text-gray-400 truncate">{doc.file_name}</p>
            )}
            <div className="flex items-center gap-2 mt-0.5">
              {dateStr && (
                <p className="text-xs text-gray-400">
                  {format(new Date(dateStr), "yyyy.MM.dd", { locale: ko })}
                </p>
              )}
              <span className="text-xs text-gray-300">
                {doc.uploaded_by ? "강사 업로드" : "본인 업로드"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${statusConfig.className}`}
          >
            {statusConfig.spinning && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {statusConfig.label}
          </span>

          {doc.status === "reviewed" && score != null && (
            <span className="bg-purple-50 text-purple-700 font-bold text-xs px-2 py-0.5 rounded-full dark:bg-purple-900/30 dark:text-purple-300">
              {score}점
            </span>
          )}

          {/* Action menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === doc.id ? null : doc.id);
              }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {openMenuId === doc.id && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setOpenMenuId(null)}
                />
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-20 min-w-[140px] dark:bg-gray-800 dark:border-gray-700">
                  {(doc.status === "uploaded" || doc.status === "failed") && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        handleRequestReview(doc.id, docType);
                      }}
                      disabled={isRequesting}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-purple-600 dark:hover:bg-gray-700"
                    >
                      {isRequesting ? "분석중..." : "AI 첨삭"}
                    </button>
                  )}
                  {doc.status === "reviewed" && review && (
                    <button
                      onClick={() => {
                        setOpenMenuId(null);
                        setSelectedReview(review);
                        setIsModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      결과 보기
                    </button>
                  )}
                  {doc.file_url && (
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => setOpenMenuId(null)}
                    >
                      다운로드
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-6 animate-pulse dark:bg-gray-800">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-3">
              <div className="h-12 bg-gray-100 rounded" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const hasDocuments = resumes.length > 0 || coverLetters.length > 0;

  if (!hasDocuments) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center dark:bg-gray-800">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2 dark:text-white">
          업로드된 문서가 없습니다
        </h3>
        <p className="text-gray-500 text-sm mb-4 dark:text-gray-400">
          이력서 또는 자기소개서를 업로드해주세요
        </p>
        {onUploadClick && (
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onUploadClick("resume")}
              className="bg-purple-500 text-white rounded-lg px-4 py-2 text-sm hover:bg-purple-600"
            >
              이력서 업로드
            </button>
            <button
              onClick={() => onUploadClick("cover_letter")}
              className="bg-purple-100 text-purple-700 rounded-lg px-4 py-2 text-sm hover:bg-purple-200"
            >
              자소서 업로드
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumes */}
      <div className="bg-white rounded-xl shadow-sm dark:bg-gray-800">
        <div className="flex items-center justify-between p-4 pb-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            이력서
            {resumes.length > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {resumes.length}개
              </span>
            )}
          </h3>
          {onUploadClick && (
            <button
              onClick={() => onUploadClick("resume")}
              className="text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              업로드
            </button>
          )}
        </div>
        <div className="bg-gray-50 rounded-b-xl mx-4 mb-4 mt-2 dark:bg-gray-700/50">
          {resumes.length > 0 ? (
            resumes.map((r) => renderDocumentItem(r, "resume"))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              이력서가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* Cover Letters */}
      <div className="bg-white rounded-xl shadow-sm dark:bg-gray-800">
        <div className="flex items-center justify-between p-4 pb-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            자기소개서
            {coverLetters.length > 0 && (
              <span className="ml-2 text-xs text-gray-400 font-normal">
                {coverLetters.length}개
              </span>
            )}
          </h3>
          {onUploadClick && (
            <button
              onClick={() => onUploadClick("cover_letter")}
              className="text-purple-600 hover:bg-purple-50 text-xs px-3 py-1.5 rounded-lg transition-colors"
            >
              업로드
            </button>
          )}
        </div>
        <div className="bg-gray-50 rounded-b-xl mx-4 mb-4 mt-2 dark:bg-gray-700/50">
          {coverLetters.length > 0 ? (
            coverLetters.map((cl) => renderDocumentItem(cl, "cover_letter"))
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              자기소개서가 없습니다
            </p>
          )}
        </div>
      </div>

      {/* AI Review Modal */}
      <AIReviewModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReview(null);
        }}
        reviewData={
          selectedReview
            ? {
                overall_score:
                  selectedReview.overall_score ?? selectedReview.score,
                feedback: selectedReview.feedback,
                created_at: selectedReview.created_at,
              }
            : null
        }
        studentEmail={studentEmail}
      />
    </div>
  );
}
