import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The full event catalogue for the Career Twin. Every event is persisted to
 * career_events (profile_id, event_type, payload_json, created_at). Some of
 * these are only emitted by phases not yet built (github.synced,
 * interview.completed) — they're listed here so the type stays the single
 * source of truth for valid event_type values as those phases land.
 */
export const CAREER_EVENT_TYPES = [
  "resume.analyzed",
  "assessment.completed",
  "assessment.failed",
  "project.completed",
  "weekly_hours.changed",
  "career_goal.changed",
  "github.synced",
  "github.analyzed",
  "interview.completed",
  "roadmap.generated",
  "roadmap.changed",
] as const;

export type CareerEventType = (typeof CAREER_EVENT_TYPES)[number];

/** Persists a single career event. This is the only place career_events gets written to. */
export async function recordCareerEvent(
  supabase: SupabaseClient,
  profileId: string,
  eventType: CareerEventType,
  payload: Record<string, unknown>,
) {
  const { data, error } = await supabase
    .from("career_events")
    .insert({ profile_id: profileId, event_type: eventType, payload_json: payload })
    .select("id, created_at")
    .single();
  if (error) {
    // Event logging should never block the primary action (e.g. saving an
    // assessment). Surface it to server logs instead of throwing.
    console.error(`Failed to record career event "${eventType}":`, error.message);
    return null;
  }
  return data;
}
