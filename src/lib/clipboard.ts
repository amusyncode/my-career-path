import toast from "react-hot-toast";

// Copy AI review result as formatted text
export function copyReviewToClipboard(data: {
  studentName: string;
  documentType: "resume" | "cover_letter";
  overallScore: number;
  feedback: string;
  improvementPoints: { category: string; score: number; comment: string }[];
}) {
  const docLabel = data.documentType === "resume" ? "이력서" : "자기소개서";
  let text = `[AI ${docLabel} 첨삭 결과] ${data.studentName}\n`;
  text += `총점: ${data.overallScore}점\n\n`;
  text += `📋 종합 피드백\n${data.feedback}\n\n`;
  if (data.improvementPoints.length > 0) {
    text += `📌 항목별 평가\n`;
    data.improvementPoints.forEach((p) => {
      text += `• ${p.category} (${p.score}점): ${p.comment}\n`;
    });
  }
  return copyToClipboard(text, "첨삭 결과가 클립보드에 복사되었습니다");
}

// Copy counseling record as formatted text
export function copyCounselingToClipboard(data: {
  studentName: string;
  title: string;
  counselingType: string;
  counselingDate: string;
  content: string | null;
  actionItems: string | null;
  nextCounselingDate: string | null;
}) {
  const typeMap: Record<string, string> = {
    career: "진로상담",
    resume: "이력서상담",
    interview: "면접준비",
    mental: "고충상담",
    other: "기타",
  };
  let text = `[상담 기록] ${data.studentName}\n`;
  text += `제목: ${data.title}\n`;
  text += `유형: ${typeMap[data.counselingType] || data.counselingType}\n`;
  text += `상담일: ${data.counselingDate}\n\n`;
  if (data.content) text += `📋 상담 내용\n${data.content}\n\n`;
  if (data.actionItems) text += `✅ 후속 조치\n${data.actionItems}\n\n`;
  if (data.nextCounselingDate) text += `📅 다음 상담: ${data.nextCounselingDate}\n`;
  return copyToClipboard(text, "상담 기록이 클립보드에 복사되었습니다");
}

// Copy AI suggestion as formatted text
export function copySuggestionToClipboard(data: {
  studentName: string;
  suggestedTopics: string[];
  keyObservations: string[];
  actionSuggestions: string[];
  concerns?: string[];
  encouragement: string;
}) {
  let text = `[AI 상담 제안] ${data.studentName}\n\n`;
  if (data.suggestedTopics.length > 0) {
    text += `💡 추천 상담 주제\n`;
    data.suggestedTopics.forEach((t, i) => { text += `${i + 1}. ${t}\n`; });
    text += `\n`;
  }
  if (data.keyObservations.length > 0) {
    text += `👁 주요 관찰 사항\n`;
    data.keyObservations.forEach((o) => { text += `• ${o}\n`; });
    text += `\n`;
  }
  if (data.actionSuggestions.length > 0) {
    text += `🎯 추천 활동\n`;
    data.actionSuggestions.forEach((a) => { text += `• ${a}\n`; });
    text += `\n`;
  }
  if (data.concerns && data.concerns.length > 0) {
    text += `⚠️ 주의 사항\n`;
    data.concerns.forEach((c) => { text += `• ${c}\n`; });
    text += `\n`;
  }
  if (data.encouragement) text += `💚 격려 메시지\n${data.encouragement}\n`;
  return copyToClipboard(text, "AI 제안이 클립보드에 복사되었습니다");
}

// Base copy utility
async function copyToClipboard(text: string, successMsg: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMsg);
    return true;
  } catch {
    // Fallback
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      toast.success(successMsg);
      return true;
    } catch {
      toast.error("클립보드 복사에 실패했습니다");
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
