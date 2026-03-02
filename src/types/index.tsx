export interface Screenshot {
  id: string
  path: string
  timestamp: number
  thumbnail: string // Base64 thumbnail
}

export interface Solution {
  initial_thoughts: string[]
  thought_steps: string[]
  description: string
  code: string
}

// ─── Meeting Bot Types ──────────────────────────────────────

export type MeetingMode = "transparent" | "bot"

export type BotStatus = "scheduling" | "joining" | "in_meeting" | "ended" | "error"

export type MeetingPlatform = "google_meet" | "microsoft_teams" | "zoom"

export interface BotSessionInfo {
  session_id: string
  status: BotStatus
  platform?: MeetingPlatform
  participant_count?: number
  duration_s?: number
  error_message?: string
}

export interface DispatchBotResult {
  session_id: string
  status: BotStatus
  message: string
}
