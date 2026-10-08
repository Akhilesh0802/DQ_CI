export type Dataset = {
  id: number;
  file_name: string;
  owner_id: number;
  owner_username: string | null;
  system: string | null;
  reporting_period: string | null;
  created_at: string;
  status: "uploaded" | "processing" | "done" | "failed" | "cancelled" | null;
  version_number: number | null;
  uploaded_by: number | null;
  record_count: number | null;
  uploaded_at: string | null;
  version_id: number | null;
};

export type QualityIssue = {
  column: string | null;
  severity: string;
  message: string;
};

export type ColumnMetricItem = {
  key: string;
  label: string;
  value: string | number | null;
};

export type ColumnProfile = {
  column_name: string;
  inferred_type: "NUMERIC" | "DATE" | "TEXT" | "BOOLEAN";
  detected_format: string | null;
  metrics: ColumnMetricItem[];
};

export type Profile = {
  columns?: ColumnProfile[];
  status: string;
  row_count: number | null;
  null_counts: Record<string, number> | null;
  duplicate_count: number | null;
  unique_counts: Record<string, number> | null;
  numeric_stats: Record<string, { mean: number; min: number; max: number }> | null;
  issues: QualityIssue[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  phone: string | null;
  role: "admin" | "uploader" | "viewer";
};

export type Rule = {
  key: string;
  label: string;
  description: string;
  unit: "%" | "rows";
  column_level: boolean;
  threshold: number;
  severity: "warning" | "error";
  enabled: boolean;
  excluded_columns: string[];
  is_default: boolean;
};

export type AuditEntry = {
  id: number;
  user_id: number;
  username: string;
  action: string;
  details: string | null;
  created_at: string;
};

export type DatasetVersion = {
  id: number;
  version_number: number;
  record_count: number | null;
  status: "uploaded" | "processing" | "done" | "failed" | "cancelled";
  uploaded_by: number;
  uploaded_at: string;
};
