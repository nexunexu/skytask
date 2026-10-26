export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assistant_activity: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: Json
          id: string
          kind: string
          operation_id: string | null
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind: string
          operation_id?: string | null
          status: string
          summary: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          operation_id?: string | null
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      attachments: {
        Row: {
          created_at: string
          id: string
          mime_type: string
          name: string
          note_id: string | null
          path: string
          size: number
          task_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type: string
          name: string
          note_id?: string | null
          path: string
          size: number
          task_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string
          name?: string
          note_id?: string | null
          path?: string
          size?: number
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_operations: {
        Row: {
          action: string
          before_record: Json | null
          changes: Json
          conversation_id: string
          created_at: string
          entity: string
          id: string
          record_id: string | null
          result: Json | null
          status: string
          summary: string
          user_id: string
        }
        Insert: {
          action: string
          before_record?: Json | null
          changes?: Json
          conversation_id: string
          created_at?: string
          entity: string
          id?: string
          record_id?: string | null
          result?: Json | null
          status?: string
          summary: string
          user_id?: string
        }
        Update: {
          action?: string
          before_record?: Json | null
          changes?: Json
          conversation_id?: string
          created_at?: string
          entity?: string
          id?: string
          record_id?: string | null
          result?: Json | null
          status?: string
          summary?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          id: string
          progress: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress?: number
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          progress?: number
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          tasks_extracted: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          tasks_extracted?: number
          user_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          tasks_extracted?: number
          user_id?: string
        }
        Relationships: []
      }
      task_lists: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          done: boolean
          due_at: string | null
          id: string
          list_id: string | null
          source: string
          tag: string
          title: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          list_id?: string | null
          source?: string
          tag?: string
          title: string
          user_id?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          done?: boolean
          due_at?: string | null
          id?: string
          list_id?: string | null
          source?: string
          tag?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      execute_copilot_operation: {
        Args: { operation_id: string }
        Returns: Json
      }
      log_assistant_event: {
        Args: {
          conversation: string
          event_details: Json
          event_kind: string
          event_status: string
          event_summary: string
        }
        Returns: undefined
      }
      run_audited_copilot_operation: {
        Args: { confirmed: boolean; operation_id: string }
        Returns: Json
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
