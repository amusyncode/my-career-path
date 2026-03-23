import { NextResponse } from "next/server";
import { withSuperAdminAuth } from "@/lib/super-admin-auth";
import { createAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const { error: authError } = await withSuperAdminAuth();
  if (authError) return authError;

  try {
    const adminClient = createAdminClient();

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString();

    // Build 6-month range for trend
    const monthLabels: string[] = [];
    const monthStarts: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
      monthStarts.push(d.toISOString());
    }
    // End boundary: start of next month
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    monthStarts.push(nextMonth.toISOString());

    // Run all queries in parallel
    const [
      instructorsRes,
      activeInstructorsRes,
      inactiveInstructorsRes,
      studentsRes,
      highSchoolRes,
      universityRes,
      aiReviewsTotalRes,
      aiReviewsMonthRes,
      aiReviewsScoresRes,
      emailsMonthSentRes,
      emailsMonthFailedRes,
      newInstructorsMonthRes,
      newStudentsMonthRes,
      topInstructorsRes,
      tokenUsageRes,
      totalGemsRes,
      totalResumesRes,
      totalCoverLettersRes,
      totalCounselingRes,
    ] = await Promise.all([
      // Instructor counts
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor"),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor")
        .eq("is_active", true),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor")
        .eq("is_active", false),

      // Student counts
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student"),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("education_level", "high_school"),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("education_level", "university"),

      // AI reviews
      adminClient
        .from("ai_review_results")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("ai_review_results")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thisMonthStart),
      adminClient
        .from("ai_review_results")
        .select("overall_score"),

      // Emails this month
      adminClient
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thisMonthStart)
        .eq("status", "sent"),
      adminClient
        .from("email_logs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", thisMonthStart)
        .eq("status", "failed"),

      // New this month
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "instructor")
        .gte("created_at", thisMonthStart),
      adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .gte("created_at", thisMonthStart),

      // Top 10 instructors by student count
      adminClient
        .from("profiles")
        .select("id, name, school")
        .eq("role", "instructor")
        .eq("is_active", true),

      // Token usage
      adminClient
        .from("ai_token_usage")
        .select("input_tokens, output_tokens, cost"),

      // Totals
      adminClient
        .from("gems")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("uploaded_resumes")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("uploaded_cover_letters")
        .select("id", { count: "exact", head: true }),
      adminClient
        .from("counseling_records")
        .select("id", { count: "exact", head: true }),
    ]);

    // Calculate average score
    const scores = aiReviewsScoresRes.data || [];
    const validScores = scores
      .map((r: { overall_score: number | null }) => r.overall_score)
      .filter((s: number | null): s is number => s !== null && s !== undefined);
    const avgScore =
      validScores.length > 0
        ? Math.round(
            validScores.reduce((a: number, b: number) => a + b, 0) /
              validScores.length
          )
        : 0;

    // Score distribution
    const scoreDistribution = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    for (const s of validScores) {
      if (s <= 20) scoreDistribution[0].count++;
      else if (s <= 40) scoreDistribution[1].count++;
      else if (s <= 60) scoreDistribution[2].count++;
      else if (s <= 80) scoreDistribution[3].count++;
      else scoreDistribution[4].count++;
    }

    // Top instructors - count students for each
    const instructorList = topInstructorsRes.data || [];
    const instructorStudentCounts: {
      id: string;
      name: string;
      school: string | null;
      student_count: number;
    }[] = [];

    for (const inst of instructorList) {
      const { count } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "student")
        .eq("instructor_id", inst.id);

      instructorStudentCounts.push({
        id: inst.id,
        name: inst.name,
        school: inst.school,
        student_count: count || 0,
      });
    }

    const topInstructors = instructorStudentCounts
      .sort((a, b) => b.student_count - a.student_count)
      .slice(0, 10);

    // Monthly signup trend
    const signupTrend: {
      month: string;
      instructors: number;
      students: number;
    }[] = [];

    for (let i = 0; i < 6; i++) {
      const [instRes, studRes] = await Promise.all([
        adminClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "instructor")
          .gte("created_at", monthStarts[i])
          .lt("created_at", monthStarts[i + 1]),
        adminClient
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student")
          .gte("created_at", monthStarts[i])
          .lt("created_at", monthStarts[i + 1]),
      ]);
      signupTrend.push({
        month: monthLabels[i],
        instructors: instRes.count || 0,
        students: studRes.count || 0,
      });
    }

    // Token totals
    const tokenData = tokenUsageRes.data || [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCost = 0;
    for (const t of tokenData) {
      totalInputTokens += t.input_tokens || 0;
      totalOutputTokens += t.output_tokens || 0;
      totalCost += t.cost || 0;
    }

    return NextResponse.json({
      instructors: {
        total: instructorsRes.count || 0,
        active: activeInstructorsRes.count || 0,
        inactive: inactiveInstructorsRes.count || 0,
        newThisMonth: newInstructorsMonthRes.count || 0,
      },
      students: {
        total: studentsRes.count || 0,
        highSchool: highSchoolRes.count || 0,
        university: universityRes.count || 0,
        newThisMonth: newStudentsMonthRes.count || 0,
      },
      aiReviews: {
        total: aiReviewsTotalRes.count || 0,
        thisMonth: aiReviewsMonthRes.count || 0,
        avgScore,
        scoreDistribution,
      },
      emails: {
        sentThisMonth: emailsMonthSentRes.count || 0,
        failedThisMonth: emailsMonthFailedRes.count || 0,
      },
      tokens: {
        totalInputTokens,
        totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        totalCost: Math.round(totalCost * 10000) / 10000,
      },
      totals: {
        gems: totalGemsRes.count || 0,
        resumes: totalResumesRes.count || 0,
        coverLetters: totalCoverLettersRes.count || 0,
        counseling: totalCounselingRes.count || 0,
      },
      topInstructors,
      signupTrend,
    });
  } catch (err) {
    console.error("Stats API error:", err);
    return NextResponse.json(
      { error: "통계 조회 실패" },
      { status: 500 }
    );
  }
}
