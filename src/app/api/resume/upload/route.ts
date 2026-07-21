import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESUME_ALLOWED_MIME_TYPES, RESUME_MAX_BYTES } from "@/lib/validations/resume";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A resume file is required." }, { status: 400 });
  }
  if (!RESUME_ALLOWED_MIME_TYPES.includes(file.type as (typeof RESUME_ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json({ error: "Only PDF resumes are supported." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
  }
  if (file.size > RESUME_MAX_BYTES) {
    return NextResponse.json({ error: "Resumes must be 8MB or smaller." }, { status: 400 });
  }

  const resumeId = randomUUID();
  const filePath = `${user.id}/${resumeId}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
  }

  const { error: insertError } = await supabase.from("resumes").insert({
    id: resumeId,
    profile_id: user.id,
    file_path: filePath,
    file_name: file.name,
  });
  if (insertError) {
    // Roll back the uploaded object so we don't leave orphaned storage files.
    await supabase.storage.from("resumes").remove([filePath]);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ resumeId, fileName: file.name, filePath });
}
