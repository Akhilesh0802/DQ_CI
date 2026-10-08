import { AuditEntry, CurrentUser, Dataset, DatasetVersion, Profile, Rule } from "./types";

// Live deploy par Vercel ke env variable NEXT_PUBLIC_API_URL se aata hai; local par localhost:8000
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function registerUser(payload: {
  username: string;
  email: string;
  phone: string;
  password: string;
}) {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, role: "uploader" }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Registration failed");
  }
  return res.json();
}

export async function loginUser(username: string, password: string): Promise<string> {
  const body = new URLSearchParams();
  body.append("grant_type", "password");
  body.append("username", username);
  body.append("password", password);

  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("Username ya password galat hai.");
  const data = await res.json();
  return data.access_token;
}

export async function requestPasswordReset(email: string) {
  const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Kuch galat ho gaya.");
  return res.json();
}

export async function resetPassword(email: string, otpCode: string, newPassword: string) {
  const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp_code: otpCode, new_password: newPassword }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Reset fail ho gaya.");
  }
  return res.json();
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchDatasets(): Promise<Dataset[]> {
  const res = await fetch(`${API_BASE_URL}/datasets/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch datasets");
  return res.json();
}

export async function fetchProfile(versionId: number): Promise<Profile> {
  const res = await fetch(`${API_BASE_URL}/datasets/versions/${versionId}/profile`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

function parseErrorText(text: string): string {
  try {
    const data = JSON.parse(text);
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // JSON nahi tha - raw text niche return hoga
  }
  return text || "Upload failed";
}

// XMLHttpRequest isliye (fetch upload progress nahi deta, aur xhr.abort() se cancel bhi hota hai)
function xhrUpload<T>(
  path: string,
  formData: FormData,
  onProgress: (percent: number) => void
): { promise: Promise<T>; xhr: XMLHttpRequest } {
  const token = getToken();
  const xhr = new XMLHttpRequest();

  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", `${API_BASE_URL}${path}`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(parseErrorText(xhr.responseText)));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload cancelled"));
    xhr.send(formData);
  });

  return { promise, xhr };
}

export function uploadDataset(
  file: File,
  system: string,
  reportingPeriod: string,
  onProgress: (percent: number) => void
): { promise: Promise<Dataset>; xhr: XMLHttpRequest } {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("system", system);
  formData.append("reporting_period", reportingPeriod);
  return xhrUpload<Dataset>("/datasets/", formData, onProgress);
}

export function uploadNewVersion(
  datasetId: number,
  file: File,
  onProgress: (percent: number) => void
): { promise: Promise<DatasetVersion>; xhr: XMLHttpRequest } {
  const formData = new FormData();
  formData.append("file", file);
  return xhrUpload<DatasetVersion>(`/datasets/${datasetId}/versions`, formData, onProgress);
}

export async function cancelVersion(versionId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/datasets/versions/${versionId}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Cancel nahi ho paya.");
  }
}

export async function fetchDatasetVersions(datasetId: number): Promise<DatasetVersion[]> {
  const res = await fetch(`${API_BASE_URL}/datasets/${datasetId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Versions load nahi ho paye.");
  const data = await res.json();
  return data.versions;
}

export async function downloadLog(versionId: number, fileName: string) {
  const res = await fetch(`${API_BASE_URL}/datasets/versions/${versionId}/log`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch log");
  const text = await res.text();
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-log.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadReport(versionId: number, fileName: string) {
  const res = await fetch(`${API_BASE_URL}/datasets/versions/${versionId}/report`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || "Report download fail ho gaya.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-profiling-report.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchRules(): Promise<Rule[]> {
  const res = await fetch(`${API_BASE_URL}/rules/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Rules load nahi ho paye.");
  return res.json();
}

export async function updateRule(
  key: string,
  payload: { threshold: number; severity: "warning" | "error"; enabled: boolean; excluded_columns: string[] }
): Promise<Rule> {
  const res = await fetch(`${API_BASE_URL}/rules/${key}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : "Rule save nahi ho paya.");
  }
  return res.json();
}

export async function resetRule(key: string): Promise<Rule> {
  const res = await fetch(`${API_BASE_URL}/rules/${key}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Rule reset nahi ho paya.");
  return res.json();
}

export async function fetchAuditLogs(limit = 500): Promise<AuditEntry[]> {
  const res = await fetch(`${API_BASE_URL}/audit-logs/?limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Audit trail load nahi ho paya.");
  return res.json();
}
