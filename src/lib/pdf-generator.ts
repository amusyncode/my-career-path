import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";


function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  // Purple gradient header bar
  doc.setFillColor(124, 58, 237);
  doc.rect(0, 0, 210, 35, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text(title, 20, 18);
  if (subtitle) {
    doc.setFontSize(11);
    doc.setTextColor(220, 220, 255);
    doc.text(subtitle, 20, 28);
  }
  doc.setTextColor(0, 0, 0);
}

function addFooter(doc: jsPDF, instructorName: string) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `${instructorName} | MyCareerPath | ${new Date().toLocaleDateString("ko-KR")}`,
      105, 290, { align: "center" }
    );
    doc.text(`${i} / ${pageCount}`, 195, 290, { align: "right" });
  }
}

// Generate AI Review PDF
export function generateReviewPDF(data: {
  studentName: string;
  instructorName: string;
  documentType: "resume" | "cover_letter";
  overallScore: number;
  feedback: string;
  improvementPoints: { category: string; score: number; comment: string }[];
}) {
  const doc = new jsPDF();
  const docLabel = data.documentType === "resume" ? "이력서" : "자기소개서";

  addHeader(doc, `AI ${docLabel} 첨삭 결과`, `${data.studentName}`);

  let y = 45;

  // Score
  doc.setFontSize(12);
  doc.setTextColor(107, 114, 128);
  doc.text("총점", 20, y);
  doc.setFontSize(28);
  const scoreColor = data.overallScore >= 80 ? [22, 163, 74] : data.overallScore >= 60 ? [202, 138, 4] : [220, 38, 38];
  doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2]);
  doc.text(`${data.overallScore}`, 20, y + 14);
  doc.setFontSize(14);
  doc.text("/ 100", 48, y + 14);
  y += 28;

  // Feedback
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81);
  doc.text("종합 피드백", 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  const feedbackLines = doc.splitTextToSize(data.feedback, 170);
  doc.text(feedbackLines, 20, y);
  y += feedbackLines.length * 5 + 10;

  // Table
  if (data.improvementPoints.length > 0) {
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    doc.text("항목별 평가", 20, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["항목", "점수", "코멘트"]],
      body: data.improvementPoints.map((p) => [p.category, `${p.score}`, p.comment]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 20, halign: "center" },
        2: { cellWidth: "auto" },
      },
      margin: { left: 20, right: 20 },
    });
  }

  addFooter(doc, data.instructorName);
  return doc;
}

// Generate Counseling PDF
export function generateCounselingPDF(data: {
  studentName: string;
  instructorName: string;
  title: string;
  counselingType: string;
  counselingDate: string;
  content: string | null;
  actionItems: string | null;
  nextCounselingDate: string | null;
}) {
  const doc = new jsPDF();
  const typeMap: Record<string, string> = {
    career: "진로상담", resume: "이력서상담", interview: "면접준비", mental: "고충상담", other: "기타",
  };

  addHeader(doc, "상담 기록", `${data.studentName} · ${typeMap[data.counselingType] || data.counselingType}`);

  let y = 45;

  // Title & date
  doc.setFontSize(14);
  doc.setTextColor(31, 41, 55);
  doc.text(data.title, 20, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(156, 163, 175);
  doc.text(`상담일: ${data.counselingDate}`, 20, y);
  y += 14;

  // Content
  if (data.content) {
    doc.setFontSize(12);
    doc.setTextColor(55, 65, 81);
    doc.text("상담 내용", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    const lines = doc.splitTextToSize(data.content, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 10;
  }

  // Action items
  if (data.actionItems) {
    doc.setFontSize(12);
    doc.setTextColor(6, 95, 70);
    doc.text("후속 조치", 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(4, 120, 87);
    const lines = doc.splitTextToSize(data.actionItems, 170);
    doc.text(lines, 20, y);
    y += lines.length * 5 + 10;
  }

  // Next date
  if (data.nextCounselingDate) {
    doc.setFontSize(10);
    doc.setTextColor(29, 78, 216);
    doc.text(`다음 상담 예정일: ${data.nextCounselingDate}`, 20, y);
  }

  addFooter(doc, data.instructorName);
  return doc;
}

// Generate AI Suggestion PDF
export function generateSuggestionPDF(data: {
  studentName: string;
  instructorName: string;
  suggestedTopics: string[];
  keyObservations: string[];
  actionSuggestions: string[];
  concerns?: string[];
  encouragement: string;
}) {
  const doc = new jsPDF();

  addHeader(doc, "AI 상담 제안", data.studentName);

  let y = 45;

  const addSection = (title: string, items: string[], color: [number, number, number]) => {
    doc.setFontSize(12);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(title, 20, y);
    y += 8;
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    items.forEach((item, i) => {
      const lines = doc.splitTextToSize(`${i + 1}. ${item}`, 170);
      if (y + lines.length * 5 > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(lines, 20, y);
      y += lines.length * 5 + 3;
    });
    y += 6;
  };

  if (data.suggestedTopics.length > 0) addSection("추천 상담 주제", data.suggestedTopics, [107, 33, 168]);
  if (data.keyObservations.length > 0) addSection("주요 관찰 사항", data.keyObservations, [37, 99, 235]);
  if (data.actionSuggestions.length > 0) addSection("추천 활동", data.actionSuggestions, [22, 163, 74]);
  if (data.concerns && data.concerns.length > 0) addSection("주의 사항", data.concerns, [234, 88, 12]);

  if (data.encouragement) {
    doc.setFillColor(236, 253, 245);
    doc.roundedRect(20, y, 170, 20, 4, 4, "F");
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    const lines = doc.splitTextToSize(data.encouragement, 160);
    doc.text(lines, 25, y + 8);
  }

  addFooter(doc, data.instructorName);
  return doc;
}

// Generate Student Report PDF
export function generateStudentReportPDF(data: {
  studentName: string;
  school: string;
  department: string;
  educationLevel: "high_school" | "university";
  grade: string;
  instructorName: string;
  generatedDate: string;
  stats: {
    goals: number;
    projects: number;
    certificates: number;
    studyHours: number;
    streak: number;
  };
  roadmapGoals?: { title: string; status: string; target_date?: string }[];
  projects?: { title: string; status: string; tech_stack?: string[] }[];
  certificates?: { name: string; status: string; target_date?: string }[];
  skills?: { skill_name: string; proficiency_level?: number }[];
  aiReviews?: { document_type: string; score?: number; created_at: string }[];
  counselingRecords?: { title: string; counseling_type: string; counseling_date: string }[];
}) {
  const doc = new jsPDF();
  const eduLabel = data.educationLevel === "high_school" ? "특성화고" : "대학교";

  addHeader(doc, `${data.studentName} 학생 리포트`, `${data.school} ${data.department} · ${eduLabel}`);

  let y = 45;

  // Info
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`생성일: ${data.generatedDate}`, 20, y);
  y += 10;

  // Stats summary
  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81);
  doc.text("활동 요약", 20, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["목표", "프로젝트", "자격증", "학습시간", "연속출석"]],
    body: [[
      `${data.stats.goals}개`,
      `${data.stats.projects}개`,
      `${data.stats.certificates}개`,
      `${data.stats.studyHours}시간`,
      `${data.stats.streak}일`,
    ]],
    styles: { fontSize: 10, cellPadding: 5, halign: "center" },
    headStyles: { fillColor: [124, 58, 237], textColor: 255 },
    margin: { left: 20, right: 20 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // Roadmap Goals
  if (data.roadmapGoals && data.roadmapGoals.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(107, 33, 168);
    doc.text("로드맵 목표", 20, y);
    y += 6;
    const statusMap: Record<string, string> = { not_started: "미시작", in_progress: "진행중", completed: "완료" };
    autoTable(doc, {
      startY: y,
      head: [["목표", "상태", "목표일"]],
      body: data.roadmapGoals.map((g) => [
        g.title, statusMap[g.status] || g.status, g.target_date?.slice(0, 10) || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [147, 51, 234], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Projects
  if (data.projects && data.projects.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text("프로젝트", 20, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["프로젝트명", "상태", "기술스택"]],
      body: data.projects.map((p) => [
        p.title, p.status, (p.tech_stack || []).join(", ") || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Certificates
  if (data.certificates && data.certificates.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text("자격증", 20, y);
    y += 6;
    const certStatusMap: Record<string, string> = { planned: "계획", studying: "학습중", acquired: "취득" };
    autoTable(doc, {
      startY: y,
      head: [["자격증명", "상태", "목표일"]],
      body: data.certificates.map((c) => [
        c.name, certStatusMap[c.status] || c.status, c.target_date?.slice(0, 10) || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [34, 197, 94], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Skills
  if (data.skills && data.skills.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(234, 88, 12);
    doc.text("보유 스킬", 20, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["스킬", "숙련도"]],
      body: data.skills.map((s) => [
        s.skill_name, s.proficiency_level ? `${s.proficiency_level}/5` : "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [249, 115, 22], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // AI Reviews
  if (data.aiReviews && data.aiReviews.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(124, 58, 237);
    doc.text("AI 첨삭 기록", 20, y);
    y += 6;
    autoTable(doc, {
      startY: y,
      head: [["문서유형", "점수", "날짜"]],
      body: data.aiReviews.map((r) => [
        r.document_type === "resume" ? "이력서" : "자소서",
        r.score != null ? `${r.score}점` : "-",
        r.created_at?.slice(0, 10) || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [124, 58, 237], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // Counseling Records
  if (data.counselingRecords && data.counselingRecords.length > 0) {
    if (y > 250) { doc.addPage(); y = 20; }
    doc.setFontSize(12);
    doc.setTextColor(6, 95, 70);
    doc.text("상담 기록", 20, y);
    y += 6;
    const typeMap: Record<string, string> = {
      career: "진로상담", resume: "이력서상담", interview: "면접준비", mental: "고충상담", other: "기타",
    };
    autoTable(doc, {
      startY: y,
      head: [["제목", "유형", "상담일"]],
      body: data.counselingRecords.map((c) => [
        c.title, typeMap[c.counseling_type] || c.counseling_type, c.counseling_date?.slice(0, 10) || "-",
      ]),
      styles: { fontSize: 9, cellPadding: 4 },
      headStyles: { fillColor: [5, 150, 105], textColor: 255 },
      margin: { left: 20, right: 20 },
    });
  }

  addFooter(doc, data.instructorName);
  return doc;
}

// --- Batch Review PDF ---

export interface BatchReviewItem {
  studentName: string;
  school: string;
  department: string;
  educationLevel: "high_school" | "university";
  documentType: "resume" | "cover_letter";
  gemName: string;
  score: number;
  feedback: string;
  improvementPoints: { category?: string; score?: number; comment?: string }[];
  revisedContent: string;
}

export function generateBatchReviewPDF(
  items: BatchReviewItem[],
  instructorName: string
) {
  const doc = new jsPDF();
  const now = new Date().toLocaleDateString("ko-KR");
  const avgScore =
    items.length > 0
      ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
      : 0;

  // --- Cover page ---
  addHeader(doc, "MyCareerPath AI 일괄 첨삭 결과", `담당 강사: ${instructorName}`);

  let y = 50;
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text(`생성일: ${now}`, 20, y);
  y += 8;
  doc.text(`총 ${items.length}건 / 평균 ${avgScore}점`, 20, y);
  y += 14;

  // Summary table
  const eduLabel = (l: string) => (l === "high_school" ? "특성화고" : "대학교");
  const docLabel = (d: string) => (d === "resume" ? "이력서" : "자소서");

  autoTable(doc, {
    startY: y,
    head: [["#", "학생", "학교급", "문서유형", "Gem", "점수"]],
    body: items.map((item, i) => [
      `${i + 1}`,
      item.studentName,
      eduLabel(item.educationLevel),
      docLabel(item.documentType),
      item.gemName || "-",
      `${item.score}`,
    ]),
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255 },
    columnStyles: {
      0: { cellWidth: 12, halign: "center" },
      5: { cellWidth: 18, halign: "center" },
    },
    margin: { left: 20, right: 20 },
  });

  // --- Each document detail ---
  items.forEach((item, idx) => {
    doc.addPage();
    addHeader(
      doc,
      `${item.studentName} - ${docLabel(item.documentType)}`,
      `Gem: ${item.gemName || "-"} / 점수: ${item.score}점`
    );

    let dy = 45;

    // Feedback
    if (item.feedback) {
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      doc.text("총평", 20, dy);
      dy += 8;
      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      const lines = doc.splitTextToSize(item.feedback, 170);
      doc.text(lines, 20, dy);
      dy += lines.length * 5 + 10;
    }

    // Improvement points
    if (item.improvementPoints && item.improvementPoints.length > 0) {
      if (dy > 250) { doc.addPage(); dy = 20; }
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      doc.text("개선점", 20, dy);
      dy += 6;
      autoTable(doc, {
        startY: dy,
        head: [["항목", "점수", "코멘트"]],
        body: item.improvementPoints.map((p) => [
          p.category || "-",
          p.score != null ? `${p.score}` : "-",
          p.comment || "-",
        ]),
        styles: { fontSize: 9, cellPadding: 4 },
        headStyles: { fillColor: [124, 58, 237], textColor: 255 },
        margin: { left: 20, right: 20 },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dy = (doc as any).lastAutoTable.finalY + 10;
    }

    // Revised content
    if (item.revisedContent) {
      if (dy > 240) { doc.addPage(); dy = 20; }
      doc.setFontSize(12);
      doc.setTextColor(55, 65, 81);
      doc.text("수정본", 20, dy);
      dy += 8;
      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      const lines = doc.splitTextToSize(item.revisedContent, 170);
      // 페이지 분할 처리
      for (const line of lines) {
        if (dy > 280) { doc.addPage(); dy = 20; }
        doc.text(line, 20, dy);
        dy += 5;
      }
    }
  });

  addFooter(doc, instructorName);
  return doc;
}

// Download helper
export function downloadPDF(doc: jsPDF, filename: string) {
  doc.save(`${filename}.pdf`);
}
