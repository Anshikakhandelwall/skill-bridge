"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Celebration } from "@/components/ui/celebration";
import { ScoreRadarChart } from "@/components/interview/score-radar-chart";
import type { InterviewFeedback, InterviewQuestion } from "@/lib/validations/interview";

const QUESTION_TYPE_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  project_discussion: "Project discussion",
  follow_up: "Follow-up",
};

type Stage = "idle" | "starting" | "answering" | "submitting" | "results" | "error";

interface AdaptationResult {
  adapted: boolean;
  reason: string;
}

interface RespondResult {
  feedback: InterviewFeedback;
  readinessScore: number;
  previousReadinessScore: number;
  readinessDelta: number;
  weakSkills: string[];
  adaptation?: AdaptationResult;
}

export function InterviewSession() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("idle");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<RespondResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setStage("starting");
    setError(null);
    try {
      const response = await fetch("/api/interviews/start", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not start the interview.");
      setInterviewId(data.interviewId);
      setTargetRole(data.targetRole);
      setDifficulty(data.difficulty);
      setQuestions(data.questions);
      setAnswers({});
      setStage("answering");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Something went wrong.");
      setStage("error");
    }
  }

  async function handleSubmit() {
    if (!interviewId) return;
    setStage("submitting");
    setError(null);
    try {
      const response = await fetch(`/api/interviews/${interviewId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((q) => ({ questionId: q.id, answerText: answers[q.id] ?? "" })),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not submit your answers.");
      setResult(data);
      setStage("results");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setStage("error");
    }
  }

  if (stage === "idle" || stage === "error") {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-center">
        <p className="text-slate-400">Generate a role-specific mock interview based on your Career Twin.</p>
        <Button onClick={handleStart} className="mt-4 gap-2">
          <Sparkles className="size-4" aria-hidden="true" />
          Start interview
        </Button>
        {error && (
          <p className="mt-3 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (stage === "starting") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-8 text-slate-300">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparing your interview…
      </div>
    );
  }

  if (stage === "answering" || stage === "submitting") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-400">
          {targetRole} · <span className="capitalize">{difficulty}</span> difficulty · {questions.length} questions
        </div>
        {questions.map((question, index) => (
          <div key={question.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-cyan-100">
                {QUESTION_TYPE_LABEL[question.type] ?? question.type}
              </span>
              <span className="text-slate-500">Q{index + 1} · targets {question.target_skill}</span>
            </div>
            <p className="mt-3 text-base text-slate-100">{question.prompt}</p>
            <textarea
              value={answers[question.id] ?? ""}
              onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
              disabled={stage === "submitting"}
              rows={4}
              placeholder="Type your answer…"
              className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-950/60 p-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
          </div>
        ))}
        <Button onClick={handleSubmit} disabled={stage === "submitting"} className="gap-2">
          {stage === "submitting" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
          {stage === "submitting" ? "Evaluating your answers…" : "Submit answers"}
        </Button>
        {error && (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // stage === "results"
  if (!result) return null;
  const { feedback } = result;

  return (
    <div className="space-y-6">
      <Celebration active={feedback.overall_score >= 70} message={`Great interview — ${feedback.overall_score}% overall!`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm font-medium text-cyan-200">Score dashboard</p>
          <p className="mt-2 text-4xl font-semibold text-slate-100">{feedback.overall_score}%</p>
          <p className="mt-1 text-sm text-slate-400">Overall score</p>
          <div className="mt-4 space-y-2 text-sm">
            {[
              ["Communication", feedback.communication_score],
              ["Technical", feedback.technical_score],
              ["Problem solving", feedback.problem_solving_score],
              ["Confidence", feedback.confidence_score],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{label}</span>
                  <span>{value}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-cyan-300" style={{ width: `${value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <ScoreRadarChart
            scores={[
              { label: "Comm.", value: feedback.communication_score },
              { label: "Technical", value: feedback.technical_score },
              { label: "Problem solving", value: feedback.problem_solving_score },
              { label: "Confidence", value: feedback.confidence_score },
              { label: "Overall", value: feedback.overall_score },
            ]}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm font-medium text-cyan-200">Feedback</p>
        <p className="mt-2 text-sm leading-6 text-slate-200">{feedback.feedback}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/5 p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Strengths
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
            {feedback.strengths.map((s) => (
              <li key={s}>· {s}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6">
          <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
            <AlertTriangle className="size-4" aria-hidden="true" /> Weaknesses
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
            {feedback.weaknesses.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm font-medium text-cyan-200">Recommended study plan</p>
        <div className="mt-3 space-y-2">
          {feedback.improvement_tasks.map((task) => (
            <div key={task.title} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-sm font-medium text-slate-100">{task.title}</p>
              <p className="text-xs text-slate-500">Skill: {task.skill}</p>
              <p className="mt-1 text-sm text-slate-400">{task.description}</p>
            </div>
          ))}
        </div>
        {feedback.recommended_next_topics.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {feedback.recommended_next_topics.map((topic) => (
              <span key={topic} className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs text-cyan-100">
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
        <p className="text-sm font-medium text-cyan-200">Career Twin impact</p>
        <p className="mt-2 text-sm text-slate-300">
          Readiness {result.readinessDelta >= 0 ? "increased" : "decreased"} from {result.previousReadinessScore}% to{" "}
          {result.readinessScore}%
          {result.readinessDelta !== 0 && (
            <span className={result.readinessDelta > 0 ? "text-emerald-300" : "text-rose-300"}>
              {" "}
              ({result.readinessDelta > 0 ? "+" : ""}
              {result.readinessDelta})
            </span>
          )}
          . {result.weakSkills.length > 0 ? `Weak competencies identified: ${result.weakSkills.join(", ")}.` : "No weak competencies identified this round."}
        </p>
        {result.adaptation?.adapted && (
          <p className="mt-3 text-sm text-amber-200">
            ⚡ Your roadmap was updated: {result.adaptation.reason}{" "}
            <Link href="/roadmap" className="underline">
              View roadmap
            </Link>
          </p>
        )}
      </div>

      <Button onClick={handleStart} variant="outline" className="gap-2">
        <Sparkles className="size-4" aria-hidden="true" />
        Start another interview
      </Button>
    </div>
  );
}
