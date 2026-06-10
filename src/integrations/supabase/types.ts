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
      admin_user_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_user_id: string
          sender_user_id: string | null
          subject: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_user_id: string
          sender_user_id?: string | null
          subject?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_user_id?: string
          sender_user_id?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      agent_reply_counters: {
        Row: {
          agent_id: string
          channel_id: string
          count: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          channel_id: string
          count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          channel_id?: string
          count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_reply_counters_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_reply_counters_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          avatar_url: string | null
          created_at: string
          description: string | null
          display_name: string | null
          enabled: boolean
          handle: string
          id: string
          model: string
          name: string
          personality: string | null
          preferred_route: string | null
          provider: Database["public"]["Enums"]["agent_provider"]
          role: string | null
          system_prompt: string | null
          workspace_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          enabled?: boolean
          handle: string
          id?: string
          model: string
          name: string
          personality?: string | null
          preferred_route?: string | null
          provider: Database["public"]["Enums"]["agent_provider"]
          role?: string | null
          system_prompt?: string | null
          workspace_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string | null
          enabled?: boolean
          handle?: string
          id?: string
          model?: string
          name?: string
          personality?: string | null
          preferred_route?: string | null
          provider?: Database["public"]["Enums"]["agent_provider"]
          role?: string | null
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
      channel_agent_overrides: {
        Row: {
          agent_id: string
          channel_id: string
          created_at: string
          display_name: string | null
          personality: string | null
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_id: string
          channel_id: string
          created_at?: string
          display_name?: string | null
          personality?: string | null
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_id?: string
          channel_id?: string
          created_at?: string
          display_name?: string | null
          personality?: string | null
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_agent_overrides_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_agent_overrides_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_agent_overrides_workspace_id_fkey"
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
      channel_memos: {
        Row: {
          author_agent_id: string | null
          author_type: string
          author_user_id: string | null
          body: string
          channel_id: string
          created_at: string
          id: string
          source_message_id: string | null
          tags: string[]
          title: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_agent_id?: string | null
          author_type: string
          author_user_id?: string | null
          body: string
          channel_id: string
          created_at?: string
          id?: string
          source_message_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_agent_id?: string | null
          author_type?: string
          author_user_id?: string | null
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
          source_message_id?: string | null
          tags?: string[]
          title?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_memos_author_agent_id_fkey"
            columns: ["author_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_memos_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_memos_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_memos_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
      credit_grants: {
        Row: {
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          paddle_transaction_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          paddle_transaction_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          paddle_transaction_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          agent_id: string | null
          completion_tokens: number
          created_at: string
          credits: number
          estimated_cost_usd_micros: number
          id: string
          image_count: number
          kind: string
          message_id: string | null
          model: string
          prompt_tokens: number
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          agent_id?: string | null
          completion_tokens?: number
          created_at?: string
          credits?: number
          estimated_cost_usd_micros?: number
          id?: string
          image_count?: number
          kind: string
          message_id?: string | null
          model: string
          prompt_tokens?: number
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          agent_id?: string | null
          completion_tokens?: number
          created_at?: string
          credits?: number
          estimated_cost_usd_micros?: number
          id?: string
          image_count?: number
          kind?: string
          message_id?: string | null
          model?: string
          prompt_tokens?: number
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_usage_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_usage_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_themes: {
        Row: {
          created_at: string
          id: string
          name: string
          prompt: string | null
          tokens: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          prompt?: string | null
          tokens: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string | null
          tokens?: Json
          user_id?: string
        }
        Relationships: []
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          bucket: string
          channel_id: string | null
          content_text: string | null
          created_at: string
          extraction_error: string | null
          extraction_status: string | null
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
          extraction_error?: string | null
          extraction_status?: string | null
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
          extraction_error?: string | null
          extraction_status?: string | null
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
      invite_links: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          rotated_at: string
          token: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          rotated_at?: string
          token: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          rotated_at?: string
          token?: string
        }
        Relationships: []
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
      landing_content: {
        Row: {
          content: Json
          demo_video_url: string | null
          hero_image_url: string | null
          id: number
          theme_key: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          demo_video_url?: string | null
          hero_image_url?: string | null
          id?: number
          theme_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          demo_video_url?: string | null
          hero_image_url?: string | null
          id?: number
          theme_key?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          status: string
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
          status?: string
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
          status?: string
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
      model_pricing: {
        Row: {
          input_credits_per_1k: number
          kind: string
          model: string
          output_credits_per_1k: number
          per_image_credits: number
          updated_at: string
        }
        Insert: {
          input_credits_per_1k?: number
          kind: string
          model: string
          output_credits_per_1k?: number
          per_image_credits?: number
          updated_at?: string
        }
        Update: {
          input_credits_per_1k?: number
          kind?: string
          model?: string
          output_credits_per_1k?: number
          per_image_credits?: number
          updated_at?: string
        }
        Relationships: []
      }
      plan_credit_allowances: {
        Row: {
          monthly_credits: number
          plan: string
          signup_bonus: number
          updated_at: string
        }
        Insert: {
          monthly_credits?: number
          plan: string
          signup_bonus?: number
          updated_at?: string
        }
        Update: {
          monthly_credits?: number
          plan?: string
          signup_bonus?: number
          updated_at?: string
        }
        Relationships: []
      }
      pricing_config: {
        Row: {
          discount_percent: number
          founder_active: boolean
          founder_price_monthly: number
          founder_seats_remaining: number
          id: number
          pro_price_annual: number
          pro_price_monthly: number
          standard_seat_active: boolean
          team_price_annual: number
          team_price_monthly: number
          updated_at: string
        }
        Insert: {
          discount_percent?: number
          founder_active?: boolean
          founder_price_monthly?: number
          founder_seats_remaining?: number
          id?: number
          pro_price_annual?: number
          pro_price_monthly?: number
          standard_seat_active?: boolean
          team_price_annual?: number
          team_price_monthly?: number
          updated_at?: string
        }
        Update: {
          discount_percent?: number
          founder_active?: boolean
          founder_price_monthly?: number
          founder_seats_remaining?: number
          id?: number
          pro_price_annual?: number
          pro_price_monthly?: number
          standard_seat_active?: boolean
          team_price_annual?: number
          team_price_monthly?: number
          updated_at?: string
        }
        Relationships: []
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
          email_verified_at: string | null
          id: string
          is_comped: boolean
          onboarding_brand_doc_url: string | null
          onboarding_pending_invites: Json
          onboarding_project_name: string | null
          onboarding_step: number
          show_upsell: boolean
          updated_at: string
          upsell_updated_at: string | null
          verification_token: string | null
          verification_token_sent_at: string | null
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
          email_verified_at?: string | null
          id: string
          is_comped?: boolean
          onboarding_brand_doc_url?: string | null
          onboarding_pending_invites?: Json
          onboarding_project_name?: string | null
          onboarding_step?: number
          show_upsell?: boolean
          updated_at?: string
          upsell_updated_at?: string | null
          verification_token?: string | null
          verification_token_sent_at?: string | null
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
          email_verified_at?: string | null
          id?: string
          is_comped?: boolean
          onboarding_brand_doc_url?: string | null
          onboarding_pending_invites?: Json
          onboarding_project_name?: string | null
          onboarding_step?: number
          show_upsell?: boolean
          updated_at?: string
          upsell_updated_at?: string | null
          verification_token?: string | null
          verification_token_sent_at?: string | null
          voice_sample_url?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          admin_note: string | null
          amount_cents: number
          cancel_at_period_end: boolean | null
          cancel_requested_at: string | null
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          interval: string
          paddle_customer_id: string | null
          paddle_subscription_id: string | null
          plan: string
          price_id: string | null
          product_id: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_cents?: number
          cancel_at_period_end?: boolean | null
          cancel_requested_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          interval?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          plan?: string
          price_id?: string | null
          product_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_cents?: number
          cancel_at_period_end?: boolean | null
          cancel_requested_at?: string | null
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          interval?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string | null
          plan?: string
          price_id?: string | null
          product_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          email: string
        }
        Insert: {
          created_at?: string
          email: string
        }
        Update: {
          created_at?: string
          email?: string
        }
        Relationships: []
      }
      support_rate_limit: {
        Row: {
          count: number
          ip: string
          window_start: string
        }
        Insert: {
          count?: number
          ip: string
          window_start?: string
        }
        Update: {
          count?: number
          ip?: string
          window_start?: string
        }
        Relationships: []
      }
      support_ticket_attachments: {
        Row: {
          created_at: string
          file_path: string
          id: string
          kind: string
          mime: string
          size_bytes: number
          ticket_id: string
        }
        Insert: {
          created_at?: string
          file_path: string
          id?: string
          kind: string
          mime: string
          size_bytes: number
          ticket_id: string
        }
        Update: {
          created_at?: string
          file_path?: string
          id?: string
          kind?: string
          mime?: string
          size_bytes?: number
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_messages: {
        Row: {
          author: string
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author: string
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author?: string
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          page_url: string | null
          priority: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          page_url?: string | null
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          page_url?: string | null
          priority?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_ai_connections: {
        Row: {
          connected_at: string
          encrypted_key: string
          id: string
          key_last4: string
          last_validated_at: string | null
          provider: Database["public"]["Enums"]["ai_provider"]
          status: Database["public"]["Enums"]["ai_connection_status"]
          user_id: string
        }
        Insert: {
          connected_at?: string
          encrypted_key: string
          id?: string
          key_last4: string
          last_validated_at?: string | null
          provider: Database["public"]["Enums"]["ai_provider"]
          status?: Database["public"]["Enums"]["ai_connection_status"]
          user_id: string
        }
        Update: {
          connected_at?: string
          encrypted_key?: string
          id?: string
          key_last4?: string
          last_validated_at?: string | null
          provider?: Database["public"]["Enums"]["ai_provider"]
          status?: Database["public"]["Enums"]["ai_connection_status"]
          user_id?: string
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
      user_usage_limits: {
        Row: {
          lovable_gateway_paused: boolean
          monthly_message_cap: number | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          lovable_gateway_paused?: boolean
          monthly_message_cap?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          lovable_gateway_paused?: boolean
          monthly_message_cap?: number | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_user_credit_balance: { Args: { uid: string }; Returns: number }
      has_active_subscription: {
        Args: { check_env?: string; user_uuid: string }
        Returns: boolean
      }
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
      is_email_verified: { Args: { _user_id: string }; Returns: boolean }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_workspace_admin: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      agent_provider: "openai" | "anthropic" | "google" | "manus"
      ai_connection_status: "active" | "invalid" | "revoked"
      ai_provider: "openai" | "anthropic" | "google" | "manus"
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
      ai_connection_status: ["active", "invalid", "revoked"],
      ai_provider: ["openai", "anthropic", "google", "manus"],
      app_role: ["owner", "admin", "member"],
      author_type: ["user", "agent"],
      file_scope: ["chat", "knowledge", "avatar", "voice"],
      kb_kind: ["rule", "brand", "brief", "guideline"],
      member_type: ["user", "agent"],
    },
  },
} as const
