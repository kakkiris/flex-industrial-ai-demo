"use client";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfidenceBadge } from "@/components/shared/ConfidenceBadge";
import { type ConfidenceLevel } from "@/lib/confidence";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type ConfidenceObj = {
  level: ConfidenceLevel;
  sourceType: string;
  rawQuote: string | null;
  page: number | null;
};

export type CompRow = {
  unitId: string;
  propertyId: string;
  propertyName: string;
  submarket: string;
  state: string;
  suite: string | null;
  sizeSqft: number | null;
  rentPerSqft: number | null;
  leaseType: string | null;
  tenantName: string | null;
  // 2026-05-27: surface filter-relevant fields directly on each row so reviewers
  // see them in the comps table without opening the detail panel.
  tenantCategory: string | null;
  clearHeightFt: number | null;
  hasPrivateBathroom: boolean | null;
  hasOffice: boolean | null;
  legacyRent: number | null;
  kfpRent: number | null;
  confidence: ConfidenceObj;
};

type SortKey = keyof Pick<
  CompRow,
  "propertyName" | "submarket" | "sizeSqft" | "rentPerSqft" | "leaseType" | "tenantName"
>;

type SortDir = "asc" | "desc";

type Props = {
  rows: CompRow[];
  isLoading: boolean;
  selectedUnitId: string | null;
  onSelect: (unitId: string) => void;
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline h-3 w-3 ml-1" />
    : <ChevronDown className="inline h-3 w-3 ml-1" />;
}

export function CompsTable({ rows, isLoading, selectedUnitId, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey] ?? "";
        const bv = b[sortKey] ?? "";
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  const headCls = "cursor-pointer select-none whitespace-nowrap";

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No comps match your filters. Adjust the sidebar and click Search.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className={headCls} onClick={() => handleSort("propertyName")}>
            Property <SortIcon col="propertyName" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead className={headCls} onClick={() => handleSort("submarket")}>
            Submarket <SortIcon col="submarket" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead>Suite</TableHead>
          <TableHead className={headCls} onClick={() => handleSort("sizeSqft")}>
            Sqft <SortIcon col="sizeSqft" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead className={headCls} onClick={() => handleSort("rentPerSqft")}>
            $/sqft <SortIcon col="rentPerSqft" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead className={headCls} onClick={() => handleSort("leaseType")}>
            Lease <SortIcon col="leaseType" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead className={headCls} onClick={() => handleSort("tenantName")}>
            Tenant <SortIcon col="tenantName" sortKey={sortKey} sortDir={sortDir} />
          </TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Bath</TableHead>
          <TableHead>Clear ht.</TableHead>
          <TableHead>Confidence</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow
            key={row.unitId}
            className="cursor-pointer"
            data-state={row.unitId === selectedUnitId ? "selected" : undefined}
            onClick={() => onSelect(row.unitId)}
          >
            {/* Visual revamp 2026-05-27. Numeric columns get Plex Mono +
                tabular-nums so digits align across rows. Pending markers
                collapse to a muted "-" instead of italic text noise. */}
            <TableCell className="font-medium max-w-[140px] truncate text-foreground">
              {row.propertyName}
            </TableCell>
            <TableCell className="text-foreground-muted">{row.submarket}</TableCell>
            <TableCell className="font-mono tabular-nums text-foreground-muted">{row.suite ?? "-"}</TableCell>
            <TableCell className="font-mono tabular-nums text-foreground">
              {row.sizeSqft?.toLocaleString() ?? "-"}
            </TableCell>
            <TableCell className="font-mono tabular-nums text-foreground">
              {row.rentPerSqft != null ? `$${row.rentPerSqft.toFixed(2)}` : "-"}
            </TableCell>
            <TableCell className="font-mono text-foreground-muted text-[12px]">{row.leaseType ?? "-"}</TableCell>
            <TableCell className="max-w-[140px] truncate text-foreground">
              {row.tenantName ?? "-"}
            </TableCell>
            <TableCell className="max-w-[120px] truncate">
              {row.tenantCategory ? (
                <span className="text-[12px] text-foreground-muted">{row.tenantCategory}</span>
              ) : (
                <span className="text-foreground-faint" aria-label="pending capture">-</span>
              )}
            </TableCell>
            <TableCell className="font-mono text-[12px] text-foreground-muted">
              {row.hasPrivateBathroom == null ? (
                <span className="text-foreground-faint">-</span>
              ) : row.hasPrivateBathroom ? (
                "Y"
              ) : (
                "N"
              )}
            </TableCell>
            <TableCell className="font-mono tabular-nums text-foreground-muted">
              {row.clearHeightFt != null ? (
                `${row.clearHeightFt}′`
              ) : (
                <span className="text-foreground-faint">-</span>
              )}
            </TableCell>
            <TableCell>
              <ConfidenceBadge level={row.confidence.level} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
