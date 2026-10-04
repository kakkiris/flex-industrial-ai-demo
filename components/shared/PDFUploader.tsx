"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2 } from "lucide-react";

export type PDFUploaderProps = {
  uploadUrl: string;
  extraFields?: Record<string, string>;
  onSuccess: (data: unknown) => void;
  label?: string;
};

export function PDFUploader({ uploadUrl, extraFields, onSuccess, label }: PDFUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      for (const [k, v] of Object.entries(extraFields ?? {})) form.set(k, v);
      const res = await fetch(uploadUrl, { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || json.error) {
        setError(json.error ?? `Upload failed (${res.status})`);
        return;
      }
      onSuccess(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4 flex flex-col items-center gap-3 border-dashed border-2 text-center">
      <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-sm text-muted-foreground">{label ?? "Upload a PDF"}</div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Extracting</>) : "Choose file"}
      </Button>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </Card>
  );
}
