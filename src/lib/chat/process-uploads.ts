import type { SupabaseClient } from "@supabase/supabase-js";
import type { StoredChatAttachment } from "@/lib/queries/chat-history";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function sanitizeFileName(name: string): string {
  const stripped = name
    .replace(/[^\w.\-() \u00C0-\u024F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 120) || "bestand";
}

/**
 * Uploads files to Storage and returns DB-ready attachment rows + lines for the AI prompt.
 */
export async function uploadChatFilesForPrompt(
  userSupabase: SupabaseClient,
  params: {
    userId: string;
    files: File[];
    bucket: string;
  },
): Promise<{
  stored: StoredChatAttachment[];
  promptLines: string[];
}> {
  /** Service role bypasses Storage RLS so uploads work without per-user storage policies. */
  const storageClient = createServiceRoleClient() ?? userSupabase;

  const stored: StoredChatAttachment[] = [];
  const promptLines: string[] = [];
  let seq = 0;

  for (const file of params.files) {
    const safe = sanitizeFileName(file.name);
    const path = `${params.userId}/${Date.now()}-${seq}-${safe}`;
    seq += 1;

    if (!path.startsWith(`${params.userId}/`)) {
      console.error("Chat attachment: invalid path prefix");
      promptLines.push(`- ${safe} (upload niet gelukt)`);
      continue;
    }

    const { error: uploadError } = await storageClient.storage
      .from(params.bucket)
      .upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });

    if (uploadError) {
      console.error(
        "Chat attachment upload:",
        uploadError.message,
        `(bucket: ${params.bucket})`,
      );
      promptLines.push(`- ${safe} (upload niet gelukt)`);
      continue;
    }

    const mime = file.type || "application/octet-stream";
    stored.push({
      bucket: params.bucket,
      path,
      name: safe,
      mime,
    });

    const { data: signed, error: signError } = await storageClient.storage
      .from(params.bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signError || !signed?.signedUrl) {
      console.error("Chat attachment signed URL:", signError?.message);
      promptLines.push(`- ${safe} (tijdelijke link niet beschikbaar)`);
    } else {
      promptLines.push(`- ${safe}: ${signed.signedUrl}`);
    }
  }

  return { stored, promptLines };
}
