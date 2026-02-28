"use client";

import { X, CheckCircle, AlertTriangle, Lightbulb, MessageSquare } from "lucide-react";

interface AIReviewData {
  overall_score: number | null;
  feedback: string | null;
  created_at: string;
}

interface AIReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewData: AIReviewData | null;
  documentTitle?: string;
}

function ScoreCircle({ score }: { score: number }) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color =
    score >= 80
      ? "text-green-500"
      : score >= 60
      ? "text-yellow-500"
      : "text-red-500";
  const strokeColor =
    score >= 80
      ? "#22c55e"
      : score >= 60
      ? "#eab308"
      : "#ef4444";

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="#e5e7eb"
          strokeWidth="8"
          fill="none"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke={strokeColor}
          strokeWidth="8"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold ${color}`}>{score}</span>
        <span className="text-xs text-gray-400">/ 100</span>
      </div>
    </div>
  );
}

function parseFeedback(feedback: string): {
  strengths: string[];
  improvements: string[];
  summary: string;
} {
  const strengths: string[] = [];
  const improvements: string[] = [];
  let summary = "";

  try {
    // Try JSON parse first
    const parsed = JSON.parse(feedback);
    if (parsed.strengths) strengths.push(...(Array.isArray(parsed.strengths) ? parsed.strengths : [parsed.strengths]));
    if (parsed.improvements) improvements.push(...(Array.isArray(parsed.improvements) ? parsed.improvements : [parsed.improvements]));
    if (parsed.summary) summary = parsed.summary;
    if (parsed.overall_feedback) summary = parsed.overall_feedback;
    return { strengths, improvements, summary };
  } catch {
    // Plain text parsing
  }

  // Try section-based parsing
  const lines = feedback.split("\n").filter((l) => l.trim());
  let currentSection: "none" | "strengths" | "improvements" | "summary" = "none";

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("강점") || lower.includes("장점") || lower.includes("strengths") || lower.includes("잘된")) {
      currentSection = "strengths";
      continue;
    }
    if (lower.includes("개선") || lower.includes("보완") || lower.includes("improvements") || lower.includes("부족")) {
      currentSection = "improvements";
      continue;
    }
    if (lower.includes("총평") || lower.includes("종합") || lower.includes("summary") || lower.includes("결론")) {
      currentSection = "summary";
      continue;
    }

    const cleanLine = line.replace(/^[-•*\d.)\s]+/, "").trim();
    if (!cleanLine) continue;

    if (currentSection === "strengths") strengths.push(cleanLine);
    else if (currentSection === "improvements") improvements.push(cleanLine);
    else if (currentSection === "summary") summary += (summary ? " " : "") + cleanLine;
    else summary += (summary ? " " : "") + cleanLine;
  }

  // If nothing was categorized, treat all as summary
  if (strengths.length === 0 && improvements.length === 0 && !summary) {
    summary = feedback;
  }

  return { strengths, improvements, summary };
}

export default function AIReviewModal({
  isOpen,
  onClose,
  reviewData,
  documentTitle,
}: AIReviewModalProps) {
  if (!isOpen || !reviewData) return null;

  const { strengths, improvements, summary } = reviewData.feedback
    ? parseFeedback(reviewData.feedback)
    : { strengths: [], improvements: [], summary: "피드백 데이터가 없습니다." };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white rounded-t-2xl">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              AI 첨삭 결과
            </h2>
            {documentTitle && (
              <p className="text-sm text-gray-500 mt-0.5">{documentTitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Score */}
          {reviewData.overall_score != null && (
            <div>
              <ScoreCircle score={reviewData.overall_score} />
              <p className="text-center text-sm text-gray-500 mt-2">
                {reviewData.overall_score >= 80
                  ? "우수한 수준입니다!"
                  : reviewData.overall_score >= 60
                  ? "개선 여지가 있습니다"
                  : "보완이 필요합니다"}
              </p>
            </div>
          )}

          {/* Strengths */}
          {strengths.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <h3 className="text-sm font-semibold text-gray-900">강점</h3>
              </div>
              <ul className="space-y-2">
                {strengths.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 bg-green-50 rounded-lg px-3 py-2"
                  >
                    <span className="text-green-500 mt-0.5">+</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {improvements.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                <h3 className="text-sm font-semibold text-gray-900">개선점</h3>
              </div>
              <ul className="space-y-2">
                {improvements.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 bg-yellow-50 rounded-lg px-3 py-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-purple-500" />
                <h3 className="text-sm font-semibold text-gray-900">총평</h3>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {summary}
                </p>
              </div>
            </div>
          )}

          {/* Date */}
          <p className="text-xs text-gray-400 text-center">
            분석일: {new Date(reviewData.created_at).toLocaleDateString("ko-KR")}
          </p>
        </div>
      </div>
    </div>
  );
}
