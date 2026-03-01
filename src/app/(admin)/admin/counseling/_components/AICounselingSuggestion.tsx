"use client";

import { useState } from "react";
import {
  Sparkles,
  Loader2,
  Lightbulb,
  Eye,
  Target,
  AlertTriangle,
  MessageCircle,
  Paperclip,
} from "lucide-react";
import type { AICounselingSuggestion as AISuggestionType } from "@/lib/types";

interface AICounselingSuggestionProps {
  studentId: string;
  onAttach?: (suggestion: AISuggestionType) => void;
  existingSuggestion?: AISuggestionType | null;
}

export default function AICounselingSuggestion({
  studentId,
  onAttach,
  existingSuggestion,
}: AICounselingSuggestionProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestionType | null>(
    existingSuggestion || null
  );
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(!!existingSuggestion);

  const fetchSuggestion = async () => {
    setIsLoading(true);
    setError(null);
    setIsVisible(true);

    try {
      const response = await fetch("/api/gemini/suggest-counseling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: studentId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "AI 상담 제안 생성 실패");
      }

      setSuggestion(data as AISuggestionType);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "AI 상담 제안 중 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!isVisible && !existingSuggestion) {
    return (
      <button
        onClick={fetchSuggestion}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-purple-300 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors disabled:opacity-50"
      >
        <Sparkles className="w-4 h-4" />
        AI 상담 제안 받기
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-6 mb-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-purple-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI 상담 제안
        </h3>
        {!existingSuggestion && (
          <button
            onClick={fetchSuggestion}
            disabled={isLoading}
            className="text-xs text-purple-500 hover:text-purple-700"
          >
            다시 생성
          </button>
        )}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
          <span className="text-sm text-purple-600">
            AI가 학생 데이터를 분석하고 있습니다...
          </span>
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 결과 */}
      {suggestion && !isLoading && (
        <div className="space-y-4">
          {/* 추천 상담 주제 */}
          {suggestion.suggested_topics?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <Lightbulb className="w-4 h-4 text-yellow-500" />
                추천 상담 주제
              </h4>
              <div className="space-y-2">
                {suggestion.suggested_topics.map((topic, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-700"
                  >
                    <span className="text-purple-500 font-medium mr-2">
                      {i + 1}.
                    </span>
                    {topic}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주요 관찰 사항 */}
          {suggestion.key_observations?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <Eye className="w-4 h-4 text-blue-500" />
                주요 관찰 사항
              </h4>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <ul className="space-y-1.5">
                  {suggestion.key_observations.map((obs, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-blue-400 mt-0.5">•</span>
                      {obs}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 추천 활동 */}
          {suggestion.action_suggestions?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <Target className="w-4 h-4 text-green-500" />
                추천 활동
              </h4>
              <div className="space-y-2">
                {suggestion.action_suggestions.map((action, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-lg p-3 shadow-sm text-sm text-gray-700 flex items-start gap-2"
                  >
                    <input type="checkbox" disabled className="mt-0.5 rounded" />
                    {action}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주의 사항 */}
          {suggestion.concerns && suggestion.concerns.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                주의 사항
              </h4>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <ul className="space-y-1.5">
                  {suggestion.concerns.map((concern, i) => (
                    <li key={i} className="text-sm text-orange-700">
                      {concern}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 격려 메시지 */}
          {suggestion.encouragement && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-2">
                <MessageCircle className="w-4 h-4 text-green-500" />
                격려 메시지
              </h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-700 italic">
                {suggestion.encouragement}
              </div>
            </div>
          )}

          {/* 기록에 첨부 버튼 */}
          {onAttach && (
            <button
              onClick={() => onAttach(suggestion)}
              className="flex items-center gap-1.5 text-purple-600 text-sm font-medium hover:text-purple-800 transition-colors mt-2"
            >
              <Paperclip className="w-4 h-4" />
              이 제안을 상담 기록에 첨부
            </button>
          )}
        </div>
      )}
    </div>
  );
}
