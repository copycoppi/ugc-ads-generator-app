import { JobInput, JobStartResponse, JobStatusResponse } from "./types";

export async function validatePassword(
  password: string
): Promise<{ valid: boolean; isAdmin: boolean; remaining: number }> {
  const res = await fetch("/api/ugc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "validate", password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Invalid password");
  }
  return res.json();
}

export async function startJob(
  input: JobInput,
  password: string
): Promise<JobStartResponse & { remaining?: number; isAdmin?: boolean }> {
  const res = await fetch("/api/ugc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", password, ...input }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      data.error || `Failed to start job: ${res.statusText}`
    );
  }
  return res.json();
}

export async function checkStatus(
  jobId: string
): Promise<JobStatusResponse> {
  const res = await fetch("/api/ugc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", jobId }),
  });
  if (!res.ok) throw new Error(`Failed to check status: ${res.statusText}`);
  return res.json();
}
