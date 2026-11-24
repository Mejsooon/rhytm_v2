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
      exercises: {
        Row: {
          bodyweight: boolean;
          created_at: string | null;
          id: string;
          muscle_group: string | null;
          name: string;
          user_id: string;
        };
        Insert: {
          bodyweight?: boolean;
          created_at?: string | null;
          id?: string;
          muscle_group?: string | null;
          name: string;
          user_id: string;
        };
        Update: {
          bodyweight?: boolean;
          created_at?: string | null;
          id?: string;
          muscle_group?: string | null;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      gym_sets: {
        Row: {
          done: boolean;
          exercise_id: string;
          exercise_position: number;
          id: string;
          reps: number | null;
          session_id: string;
          set_no: number;
          user_id: string;
          weight_kg: number | null;
        };
        Insert: {
          done?: boolean;
          exercise_id: string;
          exercise_position: number;
          id?: string;
          reps?: number | null;
          session_id: string;
          set_no: number;
          user_id: string;
          weight_kg?: number | null;
        };
        Update: {
          done?: boolean;
          exercise_id?: string;
          exercise_position?: number;
          id?: string;
          reps?: number | null;
          session_id?: string;
          set_no?: number;
          user_id?: string;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "gym_sets_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gym_sets_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sport_sessions";
            referencedColumns: ["id"];
          },
        ];
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
      page_blocks: {
        Row: {
          content: Json;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          page_id: string;
          position: number;
          type: string;
          user_id: string;
        };
        Insert: {
          content?: Json;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          page_id: string;
          position?: number;
          type: string;
          user_id?: string;
        };
        Update: {
          content?: Json;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          page_id?: string;
          position?: number;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_blocks_page_id_fkey";
            columns: ["page_id"];
            isOneToOne: false;
            referencedRelation: "pages";
            referencedColumns: ["id"];
          },
        ];
      };
      page_fields: {
        Row: {
          block_id: string;
          config: Json;
          id: string;
          is_title: boolean;
          name: string;
          position: number;
          type: string;
          user_id: string;
        };
        Insert: {
          block_id: string;
          config?: Json;
          id?: string;
          is_title?: boolean;
          name: string;
          position?: number;
          type: string;
          user_id?: string;
        };
        Update: {
          block_id?: string;
          config?: Json;
          id?: string;
          is_title?: boolean;
          name?: string;
          position?: number;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_fields_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "page_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      page_rows: {
        Row: {
          block_id: string;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          position: number;
          remind: boolean;
          updated_at: string | null;
          user_id: string;
          values: Json;
        };
        Insert: {
          block_id: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          position?: number;
          remind?: boolean;
          updated_at?: string | null;
          user_id?: string;
          values?: Json;
        };
        Update: {
          block_id?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          position?: number;
          remind?: boolean;
          updated_at?: string | null;
          user_id?: string;
          values?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "page_rows_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "page_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      pages: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          favorite: boolean;
          icon: string;
          id: string;
          is_system: boolean;
          position: number;
          template_key: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          favorite?: boolean;
          icon?: string;
          id?: string;
          is_system?: boolean;
          position?: number;
          template_key?: string | null;
          title?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          favorite?: boolean;
          icon?: string;
          id?: string;
          is_system?: boolean;
          position?: number;
          template_key?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      password_check_failures: {
        Row: {
          failed_at: string;
          user_id: string;
        };
        Insert: {
          failed_at?: string;
          user_id: string;
        };
        Update: {
          failed_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_path: string | null;
          clock: string | null;
          created_at: string | null;
          currency: string | null;
          deletion_requested_at: string | null;
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
          deletion_requested_at?: string | null;
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
          deletion_requested_at?: string | null;
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
          workouts_goal_on?: boolean;
          weekly_km_goal?: number | null;
          weekly_workouts_goal?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [];
      };
      push_log: {
        Row: {
          for_date: string;
          kind: string;
          ref: string;
          sent_at: string;
          user_id: string;
        };
        Insert: {
          for_date: string;
          kind: string;
          ref: string;
          sent_at?: string;
          user_id: string;
        };
        Update: {
          for_date?: string;
          kind?: string;
          ref?: string;
          sent_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          enabled: boolean;
          endpoint: string;
          id: string;
          label: string;
          last_seen_at: string;
          p256dh: string;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          enabled?: boolean;
          endpoint: string;
          id?: string;
          label: string;
          last_seen_at?: string;
          p256dh: string;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          enabled?: boolean;
          endpoint?: string;
          id?: string;
          label?: string;
          last_seen_at?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      runs: {
        Row: {
          difficulty: number | null;
          distance_km: number | null;
          duration_s: number | null;
          kcal: number | null;
          kind: string;
          session_id: string;
          user_id: string;
          weight_kg_snapshot: number | null;
        };
        Insert: {
          difficulty?: number | null;
          distance_km?: number | null;
          duration_s?: number | null;
          kcal?: number | null;
          kind?: string;
          session_id: string;
          user_id: string;
          weight_kg_snapshot?: number | null;
        };
        Update: {
          difficulty?: number | null;
          distance_km?: number | null;
          duration_s?: number | null;
          kcal?: number | null;
          kind?: string;
          session_id?: string;
          user_id?: string;
          weight_kg_snapshot?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "runs_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sport_sessions";
            referencedColumns: ["id"];
          },
        ];
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
      sport_sessions: {
        Row: {
          completed: boolean;
          created_at: string | null;
          difficulty: number | null;
          end_local: string | null;
          id: string;
          note: string | null;
          show_in_calendar: boolean;
          start_local: string;
          template_date: string | null;
          template_id: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          completed?: boolean;
          created_at?: string | null;
          difficulty?: number | null;
          end_local?: string | null;
          id?: string;
          note?: string | null;
          show_in_calendar?: boolean;
          start_local: string;
          template_date?: string | null;
          template_id?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          completed?: boolean;
          created_at?: string | null;
          difficulty?: number | null;
          end_local?: string | null;
          id?: string;
          note?: string | null;
          show_in_calendar?: boolean;
          start_local?: string;
          template_date?: string | null;
          template_id?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sport_sessions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "workout_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      template_skips: {
        Row: {
          date: string;
          template_id: string;
          user_id: string;
        };
        Insert: {
          date: string;
          template_id: string;
          user_id: string;
        };
        Update: {
          date?: string;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_skips_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "workout_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      tasks: {
        Row: {
          block_id: string;
          created_at: string | null;
          done: boolean;
          done_at: string | null;
          due_date: string | null;
          id: string;
          occurrence_date: string;
          position: number;
          title: string;
          user_id: string;
        };
        Insert: {
          block_id: string;
          created_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          occurrence_date: string;
          position?: number;
          title: string;
          user_id: string;
        };
        Update: {
          block_id?: string;
          created_at?: string | null;
          done?: boolean;
          done_at?: string | null;
          due_date?: string | null;
          id?: string;
          occurrence_date?: string;
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
      vaults: {
        Row: {
          created_at: string;
          generation: number;
          kdf: Json;
          status: string;
          updated_at: string;
          user_id: string;
          wrap_iv: string;
          wrapped_key: string;
        };
        Insert: {
          created_at?: string;
          generation?: number;
          kdf?: Json;
          status?: string;
          updated_at?: string;
          user_id?: string;
          wrap_iv?: string;
          wrapped_key?: string;
        };
        Update: {
          created_at?: string;
          generation?: number;
          kdf?: Json;
          status?: string;
          updated_at?: string;
          user_id?: string;
          wrap_iv?: string;
          wrapped_key?: string;
        };
        Relationships: [];
      };
      workout_template_items: {
        Row: {
          exercise_id: string;
          id: string;
          position: number;
          reps_text: string;
          rest_s: number;
          sets_count: number;
          template_id: string;
          user_id: string;
        };
        Insert: {
          exercise_id: string;
          id?: string;
          position: number;
          reps_text?: string;
          rest_s?: number;
          sets_count: number;
          template_id: string;
          user_id: string;
        };
        Update: {
          exercise_id?: string;
          id?: string;
          position?: number;
          reps_text?: string;
          rest_s?: number;
          sets_count?: number;
          template_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workout_template_items_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_template_items_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "workout_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_templates: {
        Row: {
          created_at: string | null;
          id: string;
          last_used_at: string | null;
          name: string;
          start_time: string;
          user_id: string;
          weekdays: number[];
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name: string;
          start_time?: string;
          user_id: string;
          weekdays?: number[];
        };
        Update: {
          created_at?: string | null;
          id?: string;
          last_used_at?: string | null;
          name?: string;
          start_time?: string;
          user_id?: string;
          weekdays?: number[];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      change_field_type: {
        Args: {
          p_config: Json;
          p_field_id: string;
          p_type: string;
          p_values: Json;
        };
        Returns: undefined;
      };
      claim_pending_pages: {
        Args: { p_available: string[] };
        Returns: string[];
      };
      claim_due_notifications: {
        Args: { p_now: string };
        Returns: {
          auth: string;
          body: string;
          endpoint: string;
          kind: string;
          p256dh: string;
          tag: string;
          title: string;
          url: string;
        }[];
      };
      complete_onboarding: {
        Args: { p_categories: Json };
        Returns: undefined;
      };
      count_secrets: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      create_page: {
        Args: {
          p_blocks: Json;
          p_icon: string;
          p_template_key: string | null;
          p_title: string;
        };
        Returns: string;
      };
      delete_field: {
        Args: { p_field_id: string };
        Returns: undefined;
      };
      dispatch_notifications: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      duplicate_page: {
        Args: { p_page_id: string };
        Returns: string;
      };
      ensure_passwords_page: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      list_my_sessions: {
        Args: Record<PropertyKey, never>;
        Returns: {
          created_at: string;
          id: string;
          ip: string | null;
          is_current: boolean;
          last_active_at: string;
          user_agent: string | null;
        }[];
      };
      my_has_password: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      move_category: {
        Args: {
          p_dir: number;
          p_id: string;
        };
        Returns: undefined;
      };
      purge_deleted_accounts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      purge_trash: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      remove_push_subscriptions: {
        Args: { p_endpoints: string[]; p_secret: string };
        Returns: number;
      };
      reorder_fields: {
        Args: {
          p_block_id: string;
          p_ids: string[];
        };
        Returns: undefined;
      };
      move_page: {
        Args: { p_ids: string[]; p_page_id: string; p_favorite: boolean };
        Returns: undefined;
      };
      reorder_pages: {
        Args: { p_ids: string[] };
        Returns: undefined;
      };
      revoke_my_session: {
        Args: { p_session_id: string };
        Returns: boolean;
      };
      reset_vault: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      save_push_subscription: {
        Args: {
          p_auth: string;
          p_endpoint: string;
          p_label: string;
          p_p256dh: string;
        };
        Returns: string;
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
      verify_my_password: {
        Args: { p_password: string };
        Returns: boolean;
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
