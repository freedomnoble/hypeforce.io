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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          enabled: boolean
          handle: string
          id: string
          model: string
          name: string
          provider: Database["public"]["Enums"]["agent_provider"]
          system_prompt: string | null
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          handle: string
          id?: string
          model: string
          name: string
          provider: Database["public"]["Enums"]["agent_provider"]
          system_prompt?: string | null
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          enabled?: boolean
          handle?: string
          id?: string
          model?: string
          name?: string
          provider?: Database["public"]["Enums"]["agent_provider"]
          system_prompt?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          agent_id: string | null
          channel_id: string
          created_at: string
          id: string
          member_type: Database["public"]["Enums"]["member_type"]
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          channel_id: string
          created_at?: string
          id?: string
          member_type: Database["public"]["Enums"]["member_type"]
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          channel_id?: string
          created_at?: string
          id?: string
          member_type?: Database["public"]["Enums"]["member_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_pinned: boolean
          name: string
          topic: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          name: string
          topic?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_pinned?: boolean
          name?: string
          topic?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          created_at: string
          created_by: string
          id: string
          title: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          title?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          title?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_participants: {
        Row: {
          agent_id: string | null
          dm_id: string
          id: string
          member_type: Database["public"]["Enums"]["member_type"]
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          dm_id: string
          id?: string
          member_type: Database["public"]["Enums"]["member_type"]
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          dm_id?: string
          id?: string
          member_type?: Database["public"]["Enums"]["member_type"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dm_participants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_participants_dm_id_fkey"
            columns: ["dm_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket: string
          channel_id: string | null
          content_text: string | null
          created_at: string
          filename: string
          id: string
          is_pinned: boolean
          message_id: string | null
          mime_type: string | null
          path: string
          scope: Database["public"]["Enums"]["file_scope"]
          size_bytes: number | null
          uploader_id: string
          workspace_id: string
        }
        Insert: {
          bucket: string
          channel_id?: string | null
          content_text?: string | null
          created_at?: string
          filename: string
          id?: string
          is_pinned?: boolean
          message_id?: string | null
          mime_type?: string | null
          path: string
          scope?: Database["public"]["Enums"]["file_scope"]
          size_bytes?: number | null
          uploader_id: string
          workspace_id: string
        }
        Update: {
          bucket?: string
          channel_id?: string | null
          content_text?: string | null
          created_at?: string
          filename?: string
          id?: string
          is_pinned?: boolean
          message_id?: string | null
          mime_type?: string | null
          path?: string
          scope?: Database["public"]["Enums"]["file_scope"]
          size_bytes?: number | null
          uploader_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_base: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          file_id: string | null
          id: string
          kind: Database["public"]["Enums"]["kb_kind"]
          title: string
          workspace_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["kb_kind"]
          title: string
          workspace_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          file_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["kb_kind"]
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_base_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_base_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          author_agent_id: string | null
          author_type: Database["public"]["Enums"]["author_type"]
          author_user_id: string | null
          channel_id: string | null
          content: string
          created_at: string
          dm_id: string | null
          id: string
          mentions: string[]
          workspace_id: string
        }
        Insert: {
          attachments?: Json
          author_agent_id?: string | null
          author_type: Database["public"]["Enums"]["author_type"]
          author_user_id?: string | null
          channel_id?: string | null
          content?: string
          created_at?: string
          dm_id?: string | null
          id?: string
          mentions?: string[]
          workspace_id: string
        }
        Update: {
          attachments?: Json
          author_agent_id?: string | null
          author_type?: Database["public"]["Enums"]["author_type"]
          author_user_id?: string | null
          channel_id?: string | null
          content?: string
          created_at?: string
          dm_id?: string | null
          id?: string
          mentions?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_dm_id_fkey"
            columns: ["dm_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_generated_at: string | null
          avatar_generation_model: string | null
          avatar_generation_status: string
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          voice_sample_url: string | null
        }
        Insert: {
          avatar_generated_at?: string | null
          avatar_generation_model?: string | null
          avatar_generation_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
          voice_sample_url?: string | null
        }
        Update: {
          avatar_generated_at?: string | null
          avatar_generation_model?: string | null
          avatar_generation_status?: string
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          brand_voice: string | null
          created_at: string
          icon_url: string | null
          id: string
          name: string
          owner_id: string
          slug: string
        }
        Insert: {
          brand_voice?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name: string
          owner_id: string
          slug: string
        }
        Update: {
          brand_voice?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          name?: string
          owner_id?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_dm_participant: {
        Args: { _dm_id: string; _user_id: string }
        Returns: boolean
      }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      agent_provider: "openai" | "anthropic" | "google" | "manus"
      app_role: "owner" | "admin" | "member"
      author_type: "user" | "agent"
      file_scope: "chat" | "knowledge" | "avatar" | "voice"
      kb_kind: "rule" | "brand" | "brief" | "guideline"
      member_type: "user" | "agent"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      agent_provider: ["openai", "anthropic", "google", "manus"],
      app_role: ["owner", "admin", "member"],
      author_type: ["user", "agent"],
      file_scope: ["chat", "knowledge", "avatar", "voice"],
      kb_kind: ["rule", "brand", "brief", "guideline"],
      member_type: ["user", "agent"],
    },
  },
} as const
