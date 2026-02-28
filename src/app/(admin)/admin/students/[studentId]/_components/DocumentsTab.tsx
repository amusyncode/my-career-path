"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ko } from "date-fns/locale/ko";
import AIReviewModal from "./AIReviewModal";

interface UploadedResume {
  id: string;
  user_id: string;
  title: string | null;
  file_name: string;
  file_url: string;
  status: "uploaded" | "reviewing" | "reviewed" | "failed";
  uploaded_at: string;
}

interface UploadedCoverLetter {
  id: string;
  user_id: string;
  title: string | null;
  file_name: string;
  file_url: string;
  status: "uploaded" | "reviewing" | "reviewed" | "failed";
  uploaded_at: string;
}

interface AIReviewResult {
  id: string;
  user_id: string;
  document_id: string;
  document_type: "resume" | "cover_letter";
  overall_score: number | null;
  feedback: string | null;
  created_at: string;
}

interface DocumentsTabProps {
  studentId: string;
  onUploadClick?: (type: "resume" | "cover_letter") => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; spinning?: boolean }
> = {
  uploaded: {
    label: "\uB300\uAE30\uC911",
    className: "bg-gray-100 text-gray-600",
  },
  reviewing: {
    label: "\uBD84\uC11D\uC911",
    className: "bg-yellow-100 text-yellow-700",
    spinning: true,
  },
  reviewed: {
    label: "\uC644\uB8CC",
    className: "bg-green-100 text-green-700",
  },
  failed: {
    label: "\uC2E4\uD328",
    className: "bg-red-100 text-red-700",
  },
};

export default function DocumentsTab({
  studentId,
  onUploadClick,
}: DocumentsTabProps) {
  const supabase = createClient();
  const [resumes, setResumes] = useState<UploadedResume[]>([]);
  const [coverLetters, setCoverLetters] = useState<UploadedCoverLetter[]>([]);
  const [reviews, setReviews] = useState<AIReviewResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reviewingIds, setReviewingIds] = useState<Set<string>>(new Set());
  const [selectedReview, setSelectedReview] = useState<AIReviewResult | null>(
    null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resumesRes, coverLettersRes, reviewsRes] = await Promise.all([
        supabase
          .from("uploaded_resumes")
          .select("*")
          .eq("user_id", studentId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("uploaded_cover_letters")
          .select("*")
          .eq("user_id", studentId)
          .order("uploaded_at", { ascending: false }),
        supabase
          .from("ai_review_results")
          .select("*")
          .eq("user_id", studentId),
      ]);

      if (resumesRes.error) throw resumesRes.error;
      if (coverLettersRes.error) throw coverLettersRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      setResumes((resumesRes.data as UploadedResume[]) ?? []);
      setCoverLetters(
        (coverLettersRes.data as UploadedCoverLetter[]) ?? []
      );
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
    async (
      documentId: string,
      docType: "resume" | "cover_letter"
    ) => {
      const endpoint =
        docType === "resume"
          ? "/api/gemini/review-resume"
          : "/api/gemini/review-cover-letter";

      setReviewingIds((prev) => new Set(prev).add(documentId));

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentId,
            userId: studentId,
          }),
        });

        if (!res.ok) {
          throw new Error("AI 리뷰 요청 실패");
        }

        // Refresh documents to get updated status
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

  const handleViewReview = useCallback(
    (review: AIReviewResult) => {
      setSelectedReview(review);
      setIsModalOpen(true);
    },
    []
  );

  const renderDocumentItem = (
    doc: UploadedResume | UploadedCoverLetter,
    docType: "resume" | "cover_letter"
  ) => {
    const review = getReviewForDocument(doc.id, docType);
    const statusConfig = STATUS_CONFIG[doc.status] ?? STATUS_CONFIG.uploaded;
    const isRequesting = reviewingIds.has(doc.id);

    return (
      <div
        key={doc.id}
        className="flex justify-between items-center py-3 border-b last:border-0"
      >
        {/* Left: file info */}
        <div className="flex items-center gap-3 min-w-0">
          <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm text-gray-900 truncate">
              {doc.title || doc.file_name}
            </p>
            {doc.title && (
              <p className="text-xs text-gray-400 truncate">
                {doc.file_name}
              </p>
            )}
            <p className="text-xs text-gray-400">
              {format(new Date(doc.uploaded_at), "yyyy.MM.dd", {
                locale: ko,
              })}
            </p>
          </div>
        </div>

        {/* Right: status, score, actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status badge */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${statusConfig.className}`}
          >
            {statusConfig.spinning && (
              <Loader2 className="w-3 h-3 animate-spin" />
            )}
            {statusConfig.label}
          </span>

          {/* AI score */}
          {doc.status === "reviewed" && review?.overall_score != null && (
            <span className="bg-purple-50 text-purple-700 font-bold text-xs px-2 py-0.5 rounded-full">
              {review.overall_score}점
            </span>
          )}

          {/* AI Review button (only when uploaded) */}
          {doc.status === "uploaded" && (
            <button
              onClick={() => handleRequestReview(doc.id, docType)}
              disabled={isRequesting}
              className="text-purple-600 hover:bg-purple-50 text-xs px-2 py-1 rounded disabled:opacity-50 transition-colors"
            >
              {isRequesting ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  분석중...
                </span>
              ) : (
                "AI 첨삭"
              )}
            </button>
          )}

          {/* View result button (only when reviewed) */}
          {doc.status === "reviewed" && review && (
            <button
              onClick={() => handleViewReview(review)}
              className="text-purple-600 hover:bg-purple-50 text-xs px-2 py-1 rounded transition-colors"
            >
              결과 보기
            </button>
          )}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-xl p-6 animate-pulse"
          >
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
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          업로드된 문서가 없습니다
        </h3>
        <p className="text-gray-500 text-sm">
          학생이 이력서 또는 자기소개서를 업로드하면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumes Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
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
        {resumes.length > 0 ? (
          <div>
            {resumes.map((resume) =>
              renderDocumentItem(resume, "resume")
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            이력서가 없습니다
          </p>
        )}
      </div>

      {/* Cover Letters Section */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
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
        {coverLetters.length > 0 ? (
          <div>
            {coverLetters.map((cl) =>
              renderDocumentItem(cl, "cover_letter")
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-4">
            자기소개서가 없습니다
          </p>
        )}
      </div>

      {/* AI Review Modal */}
      <AIReviewModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReview(null);
        }}
        reviewData={selectedReview ? {
          overall_score: selectedReview.overall_score,
          feedback: selectedReview.feedback,
          created_at: selectedReview.created_at,
        } : null}
      />
    </div>
  );
}
