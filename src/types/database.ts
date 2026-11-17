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
      categories: {
        Row: {
          color: string
          created_at: string | null
          hidden: boolean
          id: string
          is_system: boolean
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color: string
          created_at?: string | null
          hidden?: boolean
          id?: string
          is_system?: boolean
          name: string
          position: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string | null
          hidden?: boolean
          id?: string
          is_system?: boolean
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          before_block_min: number
          created_at: string | null
          habits_enabled: boolean
          push_enabled: boolean
          quiet_enabled: boolean
          quiet_from: string
          quiet_to: string
          renewal_days_before: number
          renewal_hour: number
          renewals_enabled: boolean
          user_id: string
          weekly_summary: boolean
          weekly_summary_at: string
        }
        Insert: {
          before_block_min?: number
          created_at?: string | null
          habits_enabled?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_from?: string
          quiet_to?: string
          renewal_days_before?: number
          renewal_hour?: number
          renewals_enabled?: boolean
          user_id: string
          weekly_summary?: boolean
          weekly_summary_at?: string
        }
        Update: {
          before_block_min?: number
          created_at?: string | null
          habits_enabled?: boolean
          push_enabled?: boolean
          quiet_enabled?: boolean
          quiet_from?: string
          quiet_to?: string
          renewal_days_before?: number
          renewal_hour?: number
          renewals_enabled?: boolean
          user_id?: string
          weekly_summary?: boolean
          weekly_summary_at?: string
        }
        Relationships: []
      }
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
          onboarding_step: number
          pending_pages: string[] | null
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
          onboarding_step?: number
          pending_pages?: string[] | null
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
          onboarding_step?: number
          pending_pages?: string[] | null
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
      complete_onboarding: {
        Args: { p_categories: Json }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
