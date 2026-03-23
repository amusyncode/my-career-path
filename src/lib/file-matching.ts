import type { Profile } from "@/lib/types";

/**
 * 파일명에서 학생을 자동 매칭
 * 우선순위:
 * 1. 파일명에 학생 이름 정확 포함
 * 2. 파일명에 학생 이름 포함 (공백 무시)
 * 3. 동명이인 → null
 * 4. 매칭 실패 → null
 */
export function matchFileToStudent(
  fileName: string,
  students: Profile[]
): Profile | null {
  if (!fileName || students.length === 0) return null;

  // 파일명에서 확장자 제거 후 정리
  const baseName = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_\-\.]/g, " ")
    .trim();

  // 1차: 정확 포함 매칭
  const exactMatches = students.filter(
    (s) => s.name && baseName.includes(s.name)
  );
  if (exactMatches.length === 1) return exactMatches[0];

  // 2차: 공백 무시 매칭
  const noSpaceBase = baseName.replace(/\s/g, "");
  const fuzzyMatches = students.filter(
    (s) => s.name && noSpaceBase.includes(s.name.replace(/\s/g, ""))
  );
  if (fuzzyMatches.length === 1) return fuzzyMatches[0];

  // 동명이인(2명+) 또는 매칭 실패
  return null;
}

export interface FileMatchResult {
  student: Profile | null;
  auto: boolean;
}

/**
 * 전체 파일 일괄 매칭
 */
export function matchAllFiles(
  files: File[],
  students: Profile[]
): Map<string, FileMatchResult> {
  const results = new Map<string, FileMatchResult>();

  for (const file of files) {
    const matched = matchFileToStudent(file.name, students);
    results.set(file.name, {
      student: matched,
      auto: matched !== null,
    });
  }

  return results;
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
