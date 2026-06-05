// isi dari file types.ts:

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      asset_units: {
        Row: {
          asset_id: string;
          condition: Database["public"]["Enums"]["asset_condition"];
          created_at: string;
          id: string;
          is_available: boolean;
          notes: string | null;
          unit_code: string;
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          condition?: Database["public"]["Enums"]["asset_condition"];
          created_at?: string;
          id?: string;
          is_available?: boolean;
          notes?: string | null;
          unit_code: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          condition?: Database["public"]["Enums"]["asset_condition"];
          created_at?: string;
          id?: string;
          is_available?: boolean;
          notes?: string | null;
          unit_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "asset_units_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      assets: {
        Row: {
          brand: string | null;
          category: string;
          created_at: string;
          description: string | null;
          id: string;
          image_url: string | null;
          kelengkapan: string | null;
          kode_aset: string | null;
          name: string;
          po_no: string | null;
          serial_number: string | null;
          spmb_no: string | null;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          brand?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          kelengkapan?: string | null;
          kode_aset?: string | null;
          name: string;
          po_no?: string | null;
          serial_number?: string | null;
          spmb_no?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          brand?: string | null;
          category?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          image_url?: string | null;
          kelengkapan?: string | null;
          kode_aset?: string | null;
          name?: string;
          po_no?: string | null;
          serial_number?: string | null;
          spmb_no?: string | null;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      loan_approvals: {
        Row: {
          approver_id: string;
          created_at: string;
          decision: Database["public"]["Enums"]["approval_decision"];
          id: string;
          level: Database["public"]["Enums"]["approval_level"];
          loan_request_id: string;
          reason: string | null;
        };
        Insert: {
          approver_id: string;
          created_at?: string;
          decision: Database["public"]["Enums"]["approval_decision"];
          id?: string;
          level: Database["public"]["Enums"]["approval_level"];
          loan_request_id: string;
          reason?: string | null;
        };
        Update: {
          approver_id?: string;
          created_at?: string;
          decision?: Database["public"]["Enums"]["approval_decision"];
          id?: string;
          level?: Database["public"]["Enums"]["approval_level"];
          loan_request_id?: string;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loan_approvals_loan_request_id_fkey";
            columns: ["loan_request_id"];
            isOneToOne: false;
            referencedRelation: "loan_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_request_items: {
        Row: {
          asset_id: string;
          id: string;
          loan_request_id: string;
          quantity: number;
        };
        Insert: {
          asset_id: string;
          id?: string;
          loan_request_id: string;
          quantity: number;
        };
        Update: {
          asset_id?: string;
          id?: string;
          loan_request_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "loan_request_items_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loan_request_items_loan_request_id_fkey";
            columns: ["loan_request_id"];
            isOneToOne: false;
            referencedRelation: "loan_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      loan_requests: {
        Row: {
          attachment_url: string | null;
          borrow_date: string;
          category: Database["public"]["Enums"]["loan_category"];
          created_at: string;
          dosen_id: string | null;
          id: string;
          last_warning_at: string | null;
          picked_up_at: string | null;
          pickup_notes: string | null;
          purpose: string;
          reject_reason: string | null;
          reminder_sent: boolean;
          requester_id: string;
          return_deadline: string;
          return_notes: string | null;
          returned_at: string | null;
          status: Database["public"]["Enums"]["loan_status"];
          updated_at: string;
          warning_count: number;
        };
        Insert: {
          attachment_url?: string | null;
          borrow_date: string;
          category: Database["public"]["Enums"]["loan_category"];
          created_at?: string;
          dosen_id?: string | null;
          id?: string;
          last_warning_at?: string | null;
          picked_up_at?: string | null;
          pickup_notes?: string | null;
          purpose: string;
          reject_reason?: string | null;
          reminder_sent?: boolean;
          requester_id: string;
          return_deadline: string;
          return_notes?: string | null;
          returned_at?: string | null;
          status?: Database["public"]["Enums"]["loan_status"];
          updated_at?: string;
          warning_count?: number;
        };
        Update: {
          attachment_url?: string | null;
          borrow_date?: string;
          category?: Database["public"]["Enums"]["loan_category"];
          created_at?: string;
          dosen_id?: string | null;
          id?: string;
          last_warning_at?: string | null;
          picked_up_at?: string | null;
          pickup_notes?: string | null;
          purpose?: string;
          reject_reason?: string | null;
          reminder_sent?: boolean;
          requester_id?: string;
          return_deadline?: string;
          return_notes?: string | null;
          returned_at?: string | null;
          status?: Database["public"]["Enums"]["loan_status"];
          updated_at?: string;
          warning_count?: number;
        };
        Relationships: [];
      };
      loan_unit_assignments: {
        Row: {
          asset_unit_id: string;
          created_at: string;
          id: string;
          loan_request_id: string;
          return_condition:
            | Database["public"]["Enums"]["asset_condition"]
            | null;
          return_notes: string | null;
        };
        Insert: {
          asset_unit_id: string;
          created_at?: string;
          id?: string;
          loan_request_id: string;
          return_condition?:
            | Database["public"]["Enums"]["asset_condition"]
            | null;
          return_notes?: string | null;
        };
        Update: {
          asset_unit_id?: string;
          created_at?: string;
          id?: string;
          loan_request_id?: string;
          return_condition?:
            | Database["public"]["Enums"]["asset_condition"]
            | null;
          return_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "loan_unit_assignments_asset_unit_id_fkey";
            columns: ["asset_unit_id"];
            isOneToOne: false;
            referencedRelation: "asset_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "loan_unit_assignments_loan_request_id_fkey";
            columns: ["loan_request_id"];
            isOneToOne: false;
            referencedRelation: "loan_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          link: string | null;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          link?: string | null;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          blocked_at: string | null;
          blocked_reason: string | null;
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_blocked: boolean;
          nim_nip: string | null;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          blocked_at?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          email: string;
          full_name?: string;
          id: string;
          is_blocked?: boolean;
          nim_nip?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          blocked_at?: string | null;
          blocked_reason?: string | null;
          created_at?: string;
          email?: string;
          full_name?: string;
          id?: string;
          is_blocked?: boolean;
          nim_nip?: string | null;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_primary_role: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "dosen" | "student";
      approval_decision: "approved" | "rejected";
      approval_level: "dosen" | "admin";
      asset_condition: "good" | "minor_damage" | "major_damage";
      loan_category: "class" | "event";
      loan_status:
        | "pending_dosen"
        | "pending_admin"
        | "approved"
        | "rejected"
        | "picked_up"
        | "returned"
        | "overdue";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "dosen", "student"],
      approval_decision: ["approved", "rejected"],
      approval_level: ["dosen", "admin"],
      asset_condition: ["good", "minor_damage", "major_damage"],
      loan_category: ["class", "event"],
      loan_status: [
        "pending_dosen",
        "pending_admin",
        "approved",
        "rejected",
        "picked_up",
        "returned",
        "overdue",
      ],
    },
  },
} as const;
