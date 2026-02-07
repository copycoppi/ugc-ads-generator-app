import { JobInput, JobStartResponse, JobStatusResponse } from "./types";

export async function startJob(input: JobInput): Promise<JobStartResponse> {
  const res = await fetch("/api/ugc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "start", ...input }),
  });
  if (!res.ok) throw new Error(`Failed to start job: ${res.statusText}`);
  return res.json();
}

export async function checkStatus(jobId: string): Promise<JobStatusResponse> {
  const res = await fetch("/api/ugc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "status", jobId }),
  });
  if (!res.ok) throw new Error(`Failed to check status: ${res.statusText}`);
  return res.json();
}
