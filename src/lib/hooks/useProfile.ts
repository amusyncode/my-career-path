"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile((data as Profile) || null);
    setIsLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
      } else if (event === "SIGNED_IN") {
        fetchProfile();
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile, supabase.auth]);

  return {
    profile,
    user: profile,
    role: profile?.role || null,
    isInstructor:
      profile?.role === "instructor" || profile?.role === "super_admin",
    isSuperAdmin: profile?.role === "super_admin",
    isStudent: profile?.role === "student",
    instructorId: profile?.instructor_id,
    educationLevel: profile?.education_level,
    isLoading,
    refetch: fetchProfile,
  };
}
