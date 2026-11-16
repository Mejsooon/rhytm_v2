// Plik generowany. Po zmianie migracji wygeneruj go ponownie:
// pnpm exec supabase gen types typescript --local > src/types/database.ts
// (obecna wersja napisana ręcznie w kształcie generatora, bo lokalny Supabase nie działał w sandboxie)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          avatar_path: string | null
          clock: string | null
          created_at: string | null
          currency: string | null
          display_name: string | null
          goals: string[] | null
          height_cm: number | null
          onboarded_at: string | null
          referral_other: string | null
          referral_source: string | null
          roles: string[] | null
          sleep_goal_min: number | null
          study_field: string | null
          timezone: string | null
          user_id: string
          week_start: string | null
          weekly_km_goal: number | null
          weight_kg: number | null
        }
        Insert: {
          avatar_path?: string | null
          clock?: string | null
          created_at?: string | null
          currency?: string | null
          display_name?: string | null
          goals?: string[] | null
          height_cm?: number | null
          onboarded_at?: string | null
          referral_other?: string | null
          referral_source?: string | null
          roles?: string[] | null
          sleep_goal_min?: number | null
          study_field?: string | null
          timezone?: string | null
          user_id: string
          week_start?: string | null
          weekly_km_goal?: number | null
          weight_kg?: number | null
        }
        Update: {
          avatar_path?: string | null
          clock?: string | null
          created_at?: string | null
          currency?: string | null
          display_name?: string | null
          goals?: string[] | null
          height_cm?: number | null
          onboarded_at?: string | null
          referral_other?: string | null
          referral_source?: string | null
          roles?: string[] | null
          sleep_goal_min?: number | null
          study_field?: string | null
          timezone?: string | null
          user_id?: string
          week_start?: string | null
          weekly_km_goal?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
