import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/upload-green-card.mjs /absolute/path/to/file.pdf");
  process.exit(2);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceKey) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(2);
}

const BUCKET = "vehicle-documents";
const OBJECT_PATH = "green-cards/groene-kaart.pdf";

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Ensure bucket exists (idempotent). Uses Storage admin API.
const { error: createBucketErr } = await supabase.storage.createBucket(BUCKET, {
  public: false,
});
if (createBucketErr && !/already exists/i.test(createBucketErr.message)) {
  console.error("Failed to ensure bucket:", createBucketErr.message);
  process.exit(1);
}

const bytes = await readFile(filePath);
const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(OBJECT_PATH, bytes, {
  upsert: true,
  contentType: "application/pdf",
});

if (uploadErr) {
  console.error("Upload failed:", uploadErr.message);
  process.exit(1);
}

console.log(`Uploaded ${filePath} -> ${BUCKET}/${OBJECT_PATH}`);

