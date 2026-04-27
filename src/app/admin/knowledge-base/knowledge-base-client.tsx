"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/app-header";
import { TbNotebook } from "react-icons/tb";

type UploadedDoc = {
  ok: boolean;
  document?: { id: string; title: string; source_ref: string };
  bucket?: string;
  path?: string;
  source_ref?: string;
  error?: string;
};

export function KnowledgeBaseClient(props: { userEmail: string; userDisplayName: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastDoc, setLastDoc] = useState<UploadedDoc | null>(null);

  const canUpload = !!file && !busy;
  const canIngest = !!lastDoc?.document?.id && !busy;

  const accept = useMemo(() => ".pdf,.docx,.md,.txt", []);

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      if (version.trim()) form.set("version", version.trim());

      const res = await fetch("/api/admin/kb-documents/upload", {
        method: "POST",
        body: form,
      });
      const json = (await res.json()) as UploadedDoc;
      if (!json.ok) {
        toast.error(json.error ?? "Upload failed");
        setLastDoc(json);
        return;
      }
      toast.success("Upload ok");
      setLastDoc(json);
    } catch (e) {
      console.error(e);
      toast.error("Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const ingest = async () => {
    const id = lastDoc?.document?.id;
    if (!id) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/kb-documents/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      const json = await res.json();
      if (!json.ok) {
        toast.error(json.error ?? "Ingest failed");
        return;
      }
      toast.success(`Ingest ok (${json.chunkCount} chunks)`);
    } catch (e) {
      console.error(e);
      toast.error("Ingest failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={props.userEmail} userDisplayName={props.userDisplayName} />

      <main className="app-page-shell app-page-shell-wide">
        <header className="touch-manipulation pt-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                aria-hidden="true"
              >
                <TbNotebook className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                Knowledge base
              </h1>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Upload een document naar de Supabase bucket <code>kb-documents</code> en start daarna ingest (chunks +
              embeddings).
            </p>
          </div>
        </header>

        <section className="mt-8 sm:mt-10" aria-label="Upload & ingest">
          <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            Upload & ingest
          </h2>

          <div className="app-ios-group">
            <div className="px-4 py-4">
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold text-muted-foreground">Bestand</span>
                  <input
                    type="file"
                    accept={accept}
                    disabled={busy}
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-muted file:px-4 file:py-2 file:text-[13px] file:font-semibold file:text-foreground hover:file:bg-muted/70"
                  />
                  <span className="text-[12px] text-muted-foreground">Ondersteund: PDF, DOCX, MD, TXT</span>
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold text-muted-foreground">Titel (optioneel)</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={busy}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm"
                    placeholder="bv. Procedure bandenwissel"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold text-muted-foreground">Versie (optioneel)</span>
                  <input
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    disabled={busy}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm"
                    placeholder="bv. 2026-04-26"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button onClick={() => void upload()} disabled={!canUpload} className="h-10">
                    {busy ? "Bezig…" : "Upload"}
                  </Button>
                  <Button onClick={() => void ingest()} disabled={!canIngest} variant="outline" className="h-10">
                    {busy ? "Bezig…" : "Ingest"}
                  </Button>
                </div>
              </div>
            </div>

            {lastDoc?.document?.id ? (
              <div className="border-t border-border/60 px-4 py-4">
                <p className="text-[13px] font-semibold text-foreground">Laatste upload</p>
                <div className="mt-2 grid gap-1 text-[12px] text-muted-foreground">
                  <div>
                    <span className="font-semibold">Document ID:</span> <code>{lastDoc.document.id}</code>
                  </div>
                  <div>
                    <span className="font-semibold">Source ref:</span> <code>{lastDoc.document.source_ref}</code>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

