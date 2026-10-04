"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export type CitationData = {
  rawQuote: string | null;
  page: number | null;
  sourceFilename?: string | null;
  sourcePath?: string | null;
  sourceType?: string | null;
};

export function CitationCard({ citation }: { citation: CitationData }) {
  if (!citation.rawQuote && !citation.sourceFilename) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6 text-xs text-muted-foreground">
          No external citation. This is internal portfolio data.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {citation.rawQuote ? (
          <blockquote className="text-sm italic border-l-2 border-primary/40 pl-3 text-foreground/90">
            &ldquo;{citation.rawQuote}&rdquo;
          </blockquote>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {citation.sourceFilename ? (
            <span>
              <strong>Source:</strong> {citation.sourceFilename}
            </span>
          ) : null}
          {citation.page != null ? (
            <span>
              <strong>Page:</strong> {citation.page}
            </span>
          ) : null}
          {citation.sourceType ? (
            <span>
              <strong>Type:</strong> {citation.sourceType.replace(/_/g, " ")}
            </span>
          ) : null}
        </div>
        {citation.sourcePath ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open(
                `/api/files/${encodeURI(citation.sourcePath!)}`,
                "_blank"
              )
            }
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Open source PDF
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
