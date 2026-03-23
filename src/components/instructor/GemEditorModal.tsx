"use client";

import { useState, useEffect } from "react";
import { X, Loader2, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Gem, GemCategory, EducationLevelWithAll } from "@/lib/types";
import toast from "react-hot-toast";

interface GemEditorModalProps {
  gem?: Gem;
  onClose: () => void;
  onSave: () => void;
  instructorId: string;
}

const CATEGORIES: { value: GemCategory | "custom"; label: string }[] = [
  { value: "resume", label: "이력서 첨삭" },
  { value: "cover_letter", label: "자기소개서 첨삭" },
  { value: "analysis", label: "역량 분석" },
  { value: "counseling", label: "상담 제안" },
];

const EDU_LEVELS: { value: EducationLevelWithAll; label: string }[] = [
  { value: "high_school", label: "특성화고" },
  { value: "university", label: "대학생" },
  { value: "all", label: "공통" },
];

const RESPONSE_TEMPLATES: Record<string, string> = {
  resume: `\n\n[응답 형식 - 아래 JSON만 출력하세요]\n{\n  "revised_content": "수정된 전체 이력서 내용",\n  "feedback": "종합 피드백 (2~3문장)",\n  "score": 0,\n  "improvement_points": [\n    { "category": "항목명", "score": 0, "comment": "개선 사항" }\n  ]\n}`,
  cover_letter: `\n\n[응답 형식 - 아래 JSON만 출력하세요]\n{\n  "revised_content": "수정된 전체 자기소개서 내용",\n  "feedback": "종합 피드백 (2~3문장)",\n  "score": 0,\n  "improvement_points": [\n    { "category": "항목명", "score": 0, "comment": "개선 사항" }\n  ]\n}`,
  analysis: `\n\n[응답 형식 - 아래 JSON만 출력하세요]\n{\n  "overall_score": 0,\n  "strengths": ["강점1"],\n  "weaknesses": ["약점1"],\n  "recommendations": ["추천1"],\n  "summary": "요약"\n}`,
  counseling: `\n\n[응답 형식 - 아래 JSON만 출력하세요]\n{\n  "suggested_topics": ["주제1"],\n  "key_observations": ["관찰1"],\n  "action_suggestions": ["제안1"],\n  "encouragement": "격려 메시지"\n}`,
};

export default function GemEditorModal({
  gem,
  onClose,
  onSave,
  instructorId,
}: GemEditorModalProps) {
  const supabase = createClient();
  const isEdit = !!gem;

  const [name, setName] = useState(gem?.name || "");
  const [description, setDescription] = useState(gem?.description || "");
  const [category, setCategory] = useState<GemCategory>(gem?.category || "resume");
  const [educationLevel, setEducationLevel] = useState<EducationLevelWithAll>(
    gem?.education_level || "all"
  );
  const [department, setDepartment] = useState(gem?.department || "");
  const [systemPrompt, setSystemPrompt] = useState(gem?.system_prompt || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [testText, setTestText] = useState("");
  const [testResult, setTestResult] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [defaultGems, setDefaultGems] = useState<Gem[]>([]);
  const [showTemplateList, setShowTemplateList] = useState(false);

  // 기본 Gem 목록 로드 (템플릿용)
  useEffect(() => {
    const fetchDefaults = async () => {
      const { data } = await supabase
        .from("gems")
        .select("*")
        .eq("scope", "global")
        .eq("is_active", true)
        .order("sort_order");
      if (data) setDefaultGems(data);
    };
    fetchDefaults();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Gem 이름을 입력해주세요.");
      return;
    }
    if (!systemPrompt.trim()) {
      toast.error("시스템 프롬프트를 입력해주세요.");
      return;
    }

    setIsSaving(true);
    const gemData = {
      name: name.trim(),
      description: description.trim() || null,
      category,
      education_level: educationLevel,
      department: department.trim() || null,
      system_prompt: systemPrompt.trim(),
      scope: "instructor" as const,
      created_by: instructorId,
      is_active: true,
      is_default: false,
    };

    let error;
    if (isEdit && gem) {
      ({ error } = await supabase
        .from("gems")
        .update(gemData)
        .eq("id", gem.id)
        .eq("created_by", instructorId));
    } else {
      ({ error } = await supabase.from("gems").insert(gemData));
    }

    if (error) {
      toast.error("Gem 저장에 실패했습니다.");
      console.error(error);
    } else {
      toast.success("Gem이 저장되었습니다 ✅");
      onSave();
      onClose();
    }
    setIsSaving(false);
  };

  const handleTest = async () => {
    if (!systemPrompt.trim() || !testText.trim()) {
      toast.error("프롬프트와 테스트 텍스트를 모두 입력해주세요.");
      return;
    }
    setIsTesting(true);
    setTestResult("");
    try {
      const res = await fetch("/api/gems/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          test_text: testText,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(
          typeof data.result === "string"
            ? data.result
            : JSON.stringify(data.result, null, 2)
        );
      } else {
        setTestResult(`❌ 오류: ${data.error}`);
      }
    } catch {
      setTestResult("❌ 테스트 요청 실패");
    }
    setIsTesting(false);
  };

  const insertResponseTemplate = () => {
    const template = RESPONSE_TEMPLATES[category] || RESPONSE_TEMPLATES.resume;
    setSystemPrompt((prev) => prev + template);
    toast.success("응답 형식이 삽입되었습니다");
  };

  const loadTemplate = (g: Gem) => {
    setSystemPrompt(g.system_prompt);
    setShowTemplateList(false);
    toast.success("이 템플릿을 기반으로 수정하세요");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 overflow-y-auto p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-lg font-bold">
            <Sparkles className="w-5 h-5 inline mr-2 text-purple-500" />
            {isEdit ? "Gem 수정" : "새 Gem 만들기"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gem 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 우리 학교 전자과 이력서 전문가"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 Gem의 용도를 간단히 설명하세요"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* Category + Education Level */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리 <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as GemCategory)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                대상 학교급 <span className="text-red-500">*</span>
              </label>
              <select
                value={educationLevel}
                onChange={(e) =>
                  setEducationLevel(e.target.value as EducationLevelWithAll)
                }
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
              >
                {EDU_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              대상 학과/전공
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="특정 학과에만 적용하려면 입력 (비워두면 범용)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              시스템 프롬프트 <span className="text-red-500">*</span>
            </label>

            {/* Tips */}
            <button
              onClick={() => setShowTips(!showTips)}
              className="flex items-center gap-1 text-sm text-blue-600 mb-2"
            >
              💡 프롬프트 작성 팁
              {showTips ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showTips && (
              <div className="bg-blue-50 rounded-lg p-3 mb-2 text-sm text-blue-700">
                <p>1. 역할을 명확히 정의하세요 (예: &apos;당신은 IT 분야 취업 전문가입니다&apos;)</p>
                <p>2. 검토 기준을 구체적으로 나열하세요</p>
                <p>3. 응답 형식을 JSON으로 지정하세요 (아래 템플릿 참고)</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 mb-2">
              <div className="relative">
                <button
                  onClick={() => setShowTemplateList(!showTemplateList)}
                  className="text-sm text-purple-600 hover:underline"
                >
                  기본 템플릿 불러오기
                </button>
                {showTemplateList && (
                  <div className="absolute z-10 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto w-72">
                    {defaultGems.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => loadTemplate(g)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 border-b last:border-0"
                      >
                        <span className="font-medium">{g.name}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          {g.education_level === "high_school"
                            ? "특성화고"
                            : g.education_level === "university"
                            ? "대학생"
                            : "공통"}
                        </span>
                      </button>
                    ))}
                    {defaultGems.length === 0 && (
                      <p className="px-3 py-2 text-sm text-gray-400">
                        기본 Gem이 없습니다
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={insertResponseTemplate}
                className="text-sm text-blue-600 hover:underline"
              >
                필수 응답 형식 삽입
              </button>
            </div>

            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="AI에게 전달할 시스템 프롬프트를 작성하세요..."
              rows={12}
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400"
            />
            <div className="text-right text-xs text-gray-400 mt-1">
              {systemPrompt.length}자
            </div>
          </div>

          {/* Test */}
          <div>
            <button
              onClick={() => setShowTest(!showTest)}
              className="flex items-center gap-1 text-sm font-medium text-gray-600"
            >
              🧪 미리보기 테스트
              {showTest ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>
            {showTest && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="테스트할 이력서/자소서 텍스트를 입력하세요..."
                  rows={4}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
                <button
                  onClick={handleTest}
                  disabled={isTesting}
                  className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
                >
                  {isTesting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isTesting ? "테스트 중..." : "테스트 실행"}
                </button>
                {testResult && (
                  <pre className="bg-gray-50 border rounded-lg p-3 text-xs font-mono max-h-60 overflow-y-auto whitespace-pre-wrap">
                    {testResult}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-purple-500 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
