import { createClient } from "@/lib/supabase";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 문자 제외: I, O, 0, 1

/**
 * 6자리 초대 코드 생성 (중복 체크 포함)
 */
export async function generateInviteCode(): Promise<string> {
  const supabase = createClient();

  for (let attempt = 0; attempt < 5; attempt++) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
    }

    // 중복 체크
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .eq("invite_code", code)
      .limit(1);

    if (!data || data.length === 0) {
      return code;
    }
  }

  // 최대 시도 초과 시 타임스탬프 기반 fallback
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return ts;
}

/**
 * 동기적 초대 코드 생성 (중복 체크 없이)
 */
export function generateInviteCodeSync(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}
