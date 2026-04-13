import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatAttachment } from "@/types/chat";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

const DEFAULT_TTL_SEC = 60 * 60 * 24;

type SignableAttachment = {
  bucket: string;
  path: string;
  name: string;
  mime: string;
};

export async function signStoredAttachments(
  supabase: SupabaseClient,
  items: SignableAttachment[],
  expiresInSeconds: number = DEFAULT_TTL_SEC,
): Promise<ChatAttachment[]> {
  if (!items.length) return [];
  const signer = createServiceRoleClient() ?? supabase;
  return Promise.all(
    items.map(async (a): Promise<ChatAttachment> => {
      let url: string | undefined;
      if (a.bucket && a.path) {
        const { data: signed, error } = await signer.storage
          .from(a.bucket)
          .createSignedUrl(a.path, expiresInSeconds);
        if (error) {
          console.error("signStoredAttachments:", error.message);
        }
        url = signed?.signedUrl;
      }
      return {
        name: a.name,
        bucket: a.bucket,
        path: a.path,
        mime: a.mime,
        url,
      };
    }),
  );
}
