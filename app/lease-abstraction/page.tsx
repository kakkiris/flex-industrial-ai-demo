"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LeaseList } from "@/components/l2/LeaseList";
import { AbstractEditor } from "@/components/l2/AbstractEditor";
import { WorkflowNarrative } from "@/components/l2/WorkflowNarrative";
import { PDFViewer } from "@/components/shared/PDFViewer";
import { PDFUploader } from "@/components/shared/PDFUploader";
import { Card } from "@/components/ui/card";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading...</div>}>
      <L2PageBody />
    </Suspense>
  );
}

function L2PageBody() {
  const searchParams = useSearchParams();
  const deepLinkLeaseId = searchParams.get("leaseId");
  // Track which deep-link value we last honored so we re-sync only when the URL
  // changes, without calling setState inside an effect on every render.
  const [lastDeepLink, setLastDeepLink] = useState<string | null>(deepLinkLeaseId);
  const [selectedLeaseId, setSelectedLeaseId] = useState<string | null>(deepLinkLeaseId);
  if (deepLinkLeaseId !== lastDeepLink) {
    setLastDeepLink(deepLinkLeaseId);
    if (deepLinkLeaseId) setSelectedLeaseId(deepLinkLeaseId);
  }
  const queryClient = useQueryClient();

  const { data: rows } = useQuery({
    queryKey: ["leases"],
    queryFn: async () => {
      const res = await fetch("/api/lease/abstracts");
      const json = await res.json();
      return json.data as Array<{ leaseId: string; pdfPath: string | null }>;
    },
  });
  const selectedPdf = rows?.find((r) => r.leaseId === selectedLeaseId)?.pdfPath ?? null;

  return (
    <div className="p-6 flex flex-col gap-4 h-full">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.015em] text-foreground mb-1.5">
            Lease Abstraction (Single-Lease Yardi Entry)
          </h1>
          <p className="text-sm text-foreground-muted leading-relaxed max-w-2xl">
            A new lease is signed on an already-owned property. The executed PDF is exported from DocuSign and uploaded here. Today one person does the full create-through-activate sequence in Yardi by hand: create lease, attach billing contact, add unit, build charge schedules, activate. L2 extracts the ~15-20 fields that sequence requires and delivers them paste-ready before the accounting team opens Yardi.
          </p>
        </div>
        <div className="w-72">
          <PDFUploader
            uploadUrl="/api/lease/extract"
            label="Upload signed DocuSign lease (PDF)"
            onSuccess={(data) => {
              const d = data as { leaseId: string };
              setSelectedLeaseId(d.leaseId);
              void queryClient.invalidateQueries({ queryKey: ["leases"] });
            }}
          />
        </div>
      </header>

      <WorkflowNarrative />

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <Card className="col-span-3 p-3 overflow-auto">
          <LeaseList selectedLeaseId={selectedLeaseId} onSelect={setSelectedLeaseId} />
        </Card>
        <Card className="col-span-5 p-2 overflow-hidden">
          {selectedLeaseId && !selectedPdf ? (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">PDF not available for seeded lease.</div>
          ) : selectedPdf ? (
            <PDFViewer relativePath={selectedPdf} className="w-full h-full border rounded" />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Select a lease to preview the PDF.</div>
          )}
        </Card>
        <Card className="col-span-4 p-4 overflow-auto">
          {selectedLeaseId ? (
            <AbstractEditor key={selectedLeaseId} leaseId={selectedLeaseId} />
          ) : (
            <div className="text-muted-foreground text-sm">Select a lease to view its abstract.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
