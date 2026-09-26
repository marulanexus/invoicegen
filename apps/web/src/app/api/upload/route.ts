import { NextResponse } from "next/server";

import { requireOrgContext } from "@/server/auth/context";
import { uploadPublicFile } from "@/server/storage";
import { isPublicStorageConfigured } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireOrgContext();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`upload:${ctx.org.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many uploads. Please wait." }, { status: 429 });
  }

  if (!isPublicStorageConfigured) {
    return NextResponse.json(
      { error: "File uploads are not configured. Add the R2 storage settings, or paste a logo URL instead." },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 4 MB)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Random prefix: unique, unguessable keys, so a new logo never collides with an old one.
  const url = await uploadPublicFile(
    `logos/${ctx.org.id}/${crypto.randomUUID()}-${safeName}`,
    buffer,
    file.type
  );

  if (!url) {
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });
  }
  return NextResponse.json({ url });
}
