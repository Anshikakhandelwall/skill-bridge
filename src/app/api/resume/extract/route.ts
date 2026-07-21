import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ResumeExtractionError, extractTextFromPdf } from "@/lib/resume/extract-text";
import { resumeIdSchema } from "@/lib/validations/resume";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = resumeIdSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid resumeId is required." }, { status: 400 });
  }
  const { resumeId } = parsed.data;

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, file_path")
    .eq("id", resumeId)
    .eq("profile_id", user.id)
    .single();
  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found." }, { status: 404 });
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from("resumes")
    .download(resume.file_path);
  if (downloadError || !file) {
    return NextResponse.json({ error: "Could not read the stored resume file." }, { status: 500 });
  }

  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractTextFromPdf(buffer);
  } catch (error) {
    if (error instanceof ResumeExtractionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    return NextResponse.json({ error: "Failed to extract text from the resume." }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("resumes")
    .update({ extracted_text: text })
    .eq("id", resumeId)
    .eq("profile_id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ resumeId, textLength: text.length, preview: text.slice(0, 500) });
}
