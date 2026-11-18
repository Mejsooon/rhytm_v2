// Plik generowany. Po zmianie migracji wygeneruj go ponownie:
// pnpm exec supabase gen types typescript --local > src/types/database.ts
// (obecna wersja napisana ręcznie w kształcie generatora, bo lokalny Supabase nie działał w sandboxie)

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      block_exceptions: {
        Row: {
          block_id: string;
          kind: string;
          new_duration_min: number | null;
          new_start_local: string | null;
          new_title: string | null;
          occurrence_date: string;
          user_id: string;
        };
        Insert: {
          block_id: string;
          kind: string;
          new_duration_min?: number | null;
          new_start_local?: string | null;
          new_title?: string | null;
          occurrence_date: string;
          user_id: string;
        };
        Update: {
          block_id?: string;
          kind?: string;
          new_duration_min?: number | null;
          new_start_local?: string | null;
          new_title?: string | null;
          occurrence_date?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "block_exceptions_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      blocks: {
        Row: {
          category_id: string | null;
          created_at: string | null;
          duration_min: number;
          id: string;
          note: string | null;
          recurrence: Json | null;
          remind: boolean;
          start_local: string;
          timezone: string;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string | null;
          duration_min: number;
          id?: string;
          note?: string | null;
          recurrence?: Json | null;
          remind?: boolean;
          start_local: string;
          timezone: string;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string | null;
          duration_min?: number;
          id?: string;
          note?: string | null;
          recurrence?: Json | null;
          remind?: boolean;
          start_local?: string;
          timezone?: string;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "blocks_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string;
          created_at: string | null;
          hidden: boolean;
          id: string;
          is_system: boolean;
          name: string;
          position: number;
          user_id: string;
        };
        Insert: {
          color: string;
          created_at?: string | null;
          hidden?: boolean;
          id?: string;
          is_system?: boolean;
          name: string;
          position: number;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string | null;
          hidden?: boolean;
          id?: string;
          is_system?: boolean;
          name?: string;
          position?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      habit_checks: {
        Row: {
          date: string;
          habit_id: string;
          user_id: string;
        };
        Insert: {
          date: string;
          habit_id: string;
          user_id: string;
        };
        Update: {
          date?: string;
          habit_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_checks_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_notes: {
        Row: {
          created_at: string | null;
          date: string;
          habit_id: string;
          id: string;
          text: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          habit_id: string;
          id?: string;
          text: string;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          habit_id?: string;
          id?: string;
          text?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "habit_notes_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habit_schedules: {
        Row: {
          habit_id: string;
          schedule_type: string;
          times_per_week: number | null;
          user_id: string;
          valid_from: string;
          weekdays: number[];
        };
        Insert: {
          habit_id: string;
          schedule_type: string;
          times_per_week?: number | null;
          user_id: string;
          valid_from: string;
          weekdays?: number[];
        };
        Update: {
          habit_id?: string;
          schedule_type?: string;
          times_per_week?: number | null;
          user_id?: string;
          valid_from?: string;
          weekdays?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "habit_schedules_habit_id_fkey";
            columns: ["habit_id"];
            isOneToOne: false;
            referencedRelation: "habits";
            referencedColumns: ["id"];
          },
        ];
      };
      habits: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          remind_at: string | null;
          show_on_today: boolean;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          remind_at?: string | null;
          show_on_today?: boolean;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          remind_at?: string | null;
          show_on_today?: boolean;
          user_id?: string;
        };
        Relationships: [];
      };
      notification_settings: {
        Row: {
          before_block_min: number | null;
          created_at: string | null;
          habits_enabled: boolean;
          push_enabled: boolean;
          quiet_enabled: boolean;
          quiet_from: string;
          quiet_to: string;
          renewal_days_before: number;
          renewal_hour: number;
          renewals_enabled: boolean;
          user_id: string;
          weekly_summary: boolean;
          weekly_summary_at: string;
        };
        Insert: {
          before_block_min?: number | null;
          created_at?: string | null;
          habits_enabled?: boolean;
          push_enabled?: boolean;
          quiet_enabled?: boolean;
          quiet_from?: string;
          quiet_to?: string;
          renewal_days_before?: number;
          renewal_hour?: number;
          renewals_enabled?: boolean;
          user_id: string;
          weekly_summary?: boolean;
          weekly_summary_at?: string;
        };
        Update: {
          before_block_min?: number | null;
          created_at?: string | null;
          habits_enabled?: boolean;
          push_enabled?: boolean;
          quiet_enabled?: boolean;
          quiet_from?: string;
          quiet_to?: string;
          renewal_days_before?: number;
          renewal_hour?: number;
          renewals_enabled?: boolean;
          user_id?: string;
          weekly_summary?: boolean;
          weekly_summary_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          clock: string | null;
          created_at: string | null;
          currency: string | null;
          display_name: string | null;
          goals: string[] | null;
          height_cm: number | null;
          onboarded_at: string | null;
          onboarding_step: number;
          pending_pages: string[] | null;
          referral_other: string | null;
          referral_source: string | null;
          roles: string[] | null;
          sleep_goal_min: number | null;
          study_field: string | null;
          timezone: string | null;
          user_id: string;
          week_start: string | null;
          km_goal_on: boolean;
          weekly_goal_type: string;
          workouts_goal_on: boolean;
          weekly_km_goal: number | null;
          weekly_workouts_goal: number | null;
          weight_kg: number | null;
        };
        Insert: {
          avatar_path?: string | null;
          clock?: string | null;
          created_at?: string | null;
          currency?: string | null;
          display_name?: string | null;
          goals?: string[] | null;
          height_cm?: number | null;
          onboarded_at?: string | null;
          onboarding_step?: number;
          pending_pages?: string[] | null;
          referral_other?: string | null;
          referral_source?: string | null;
          roles?: string[] | null;
          sleep_goal_min?: number | null;
          study_field?: string | null;
          timezone?: string | null;
          user_id: string;
          week_start?: string | null;
          km_goal_on?: boolean;
          weekly_goal_type?: string;
          workouts_goal_on?: boolean;
          weekly_km_goal?: number | null;
          weekly_workouts_goal?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          avatar_path?: string | null;
          clock?: string | null;
          created_at?: string | null;
          currency?: string | null;
          display_name?: string | null;
          goals?: string[] | null;
          height_cm?: number | null;
          onboarded_at?: string | null;
          onboarding_step?: number;
          pending_pages?: string[] | null;
          referral_other?: string | null;
          referral_source?: string | null;
          roles?: string[] | null;
          sleep_goal_min?: number | null;
          study_field?: string | null;
          timezone?: string | null;
          user_id?: string;
          week_start?: string | null;
          km_goal_on?: boolean;
          weekly_goal_type?: string;
          workouts_goal_on?: boolean;
          weekly_km_goal?: number | null;
          weekly_workouts_goal?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      sleep_logs: {
        Row: {
          created_at: string | null;
          date: string;
          feeling: number | null;
          note: string | null;
          slept_at: string;
          tags: string[];
          updated_at: string | null;
          user_id: string;
          woke_at: string;
        };
        Insert: {
          created_at?: string | null;
          date: string;
          feeling?: number | null;
          note?: string | null;
          slept_at: string;
          tags?: string[];
          updated_at?: string | null;
          user_id: string;
          woke_at: string;
        };
        Update: {
          created_at?: string | null;
          date?: string;
          feeling?: number | null;
          note?: string | null;
          slept_at?: string;
          tags?: string[];
          updated_at?: string | null;
          user_id?: string;
          woke_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          block_id: string | null;
          created_at: string | null;
          done: boolean;
          done_at: string | null;
          due_date: string | null;
          id: string;
          occurrence_date: string | null;
          position: number;
          title: string;
          user_id: string;
        };
        Insert: {
          block_id?: string | null;
          created_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          occurrence_date?: string | null;
          position?: number;
          title: string;
          user_id: string;
        };
        Update: {
          block_id?: string | null;
          created_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          occurrence_date?: string | null;
          position?: number;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tasks_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "blocks";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: { p_categories: Json };
        Returns: undefined;
      };
      move_category: {
        Args: {
          p_dir: number;
          p_id: string;
        };
        Returns: undefined;
      };
      split_block_series: {
        Args: {
          p_block_id: string;
          p_delete: boolean;
          p_from: string;
          p_patch: Json;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
