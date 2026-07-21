"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RESUME_MAX_BYTES } from "@/lib/validations/resume";

type Stage = "idle" | "uploading" | "extracting" | "analyzing" | "done" | "error";

const stageLabel: Record<Stage, string> = {
  idle: "",
  uploading: "Uploading resume…",
  extracting: "Reading resume text…",
  analyzing: "Analyzing skill evidence…",
  done: "Analysis complete",
  error: "",
};

function uploadWithProgress(file: File, onProgress: (percent: number) => void): Promise<{ resumeId: string }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/resume/upload");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(body);
        else reject(new Error(body.error ?? "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(formData);
  });
}

async function postJson(url: string, body: object) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

export function ResumeUploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(selected: File | null) {
    setError(null);
    setStage("idle");
    setProgress(0);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }
    if (selected.size > RESUME_MAX_BYTES) {
      setError("Resumes must be 8MB or smaller.");
      setFile(null);
      return;
    }
    setFile(selected);
  }

  async function processResume() {
    if (!file) return;
    setError(null);
    try {
      setStage("uploading");
      setProgress(0);
      const { resumeId } = await uploadWithProgress(file, setProgress);

      setStage("extracting");
      await postJson("/api/resume/extract", { resumeId });

      setStage("analyzing");
      await postJson("/api/resume/analyze", { resumeId });

      setStage("done");
      router.push("/analyze");
    } catch (processError) {
      setStage("error");
      setError(processError instanceof Error ? processError.message : "Something went wrong.");
    }
  }

  const isBusy = stage === "uploading" || stage === "extracting" || stage === "analyzing";

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={isBusy}
        className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-slate-700 px-6 py-12 text-center transition hover:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <UploadCloud className="size-8 text-cyan-300" aria-hidden="true" />
        <div>
          <p className="font-medium text-slate-100">
            {file ? file.name : "Click to choose your resume (PDF)"}
          </p>
          <p className="mt-1 text-sm text-slate-400">PDF only, up to 8MB</p>
        </div>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        aria-label="Choose resume PDF file"
        className="hidden"
        onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
      />

      {file && stage === "idle" && (
        <div className="mt-5 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-200">
            <FileText className="size-4 text-cyan-300" aria-hidden="true" />
            {file.name}
          </div>
          <Button onClick={processResume}>Analyze resume</Button>
        </div>
      )}

      {isBusy && (
        <div className="mt-5 space-y-2">
          <div className="flex items-center gap-2 text-sm text-cyan-100">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {stageLabel[stage]}
          </div>
          {stage === "uploading" && (
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full rounded-full bg-cyan-300 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      )}

      {stage === "done" && (
        <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          Analysis complete. Redirecting…
        </div>
      )}

      {error && (
        <p className="mt-5 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
