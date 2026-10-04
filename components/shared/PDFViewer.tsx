"use client";
export function PDFViewer({ relativePath, className }: { relativePath: string; className?: string }) {
  const url = `/api/files/${encodeURI(relativePath)}`;
  return (
    <iframe
      src={url}
      title="Lease PDF"
      className={className ?? "w-full h-full border rounded bg-white"}
    />
  );
}
