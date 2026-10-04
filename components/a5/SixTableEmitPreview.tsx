"use client";

// A5 six-table emit preview. One tab per Yardi commercial ETL table the
// bulk-load fans out: CommLeases, CommUnitXrefs, CommUnits, CommSQFTs,
// CommChargeSchedules, CommContacts. Each tab shows the table's row count and a
// small sample grid (first 8 rows, a readable subset of columns, NOT all 120
// export headers). The occupied 6-table fan-out and the vacant CommUnits +
// CommSQFTs shells are tagged so the difference reads at a glance: vacant rows
// carry a "vacant shell" badge and the two tables that hold them show a legend.

import { useState } from "react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { YardiEtlTables } from "@/lib/etl/yardi-tables";

const SAMPLE_ROWS = 8;

// A column descriptor: the row key, the header label, and an optional formatter.
type Column<Row> = {
  key: keyof Row;
  label: string;
  // Right-align + tabular numerals for numeric columns.
  numeric?: boolean;
  format?: (row: Row) => string;
};

function money(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function blank(s: string): string {
  return s.length > 0 ? s : "-";
}

// Definitions for each tab: the table key, the human label, a readable subset
// of columns, and whether the table can hold vacant shells.
type TableTab = {
  key: keyof YardiEtlTables;
  label: string;
  // The set of unit codes that are vacant shells (only meaningful for the two
  // shell-bearing tables); used to tag those rows.
  hasShells: boolean;
};

const TABLE_TABS: TableTab[] = [
  { key: "commLeases", label: "CommLeases", hasShells: false },
  { key: "commUnitXrefs", label: "CommUnitXrefs", hasShells: false },
  { key: "commUnits", label: "CommUnits", hasShells: true },
  { key: "commSqfts", label: "CommSQFTs", hasShells: true },
  { key: "commChargeSchedules", label: "CommChargeSchedules", hasShells: false },
  { key: "commContacts", label: "CommContacts", hasShells: false },
];

// Per-table readable column subsets. The full row carries the real Yardi
// column names; here we surface only the 5-7 most legible.
const COLUMNS: {
  commLeases: Column<YardiEtlTables["commLeases"][number]>[];
  commUnitXrefs: Column<YardiEtlTables["commUnitXrefs"][number]>[];
  commUnits: Column<YardiEtlTables["commUnits"][number]>[];
  commSqfts: Column<YardiEtlTables["commSqfts"][number]>[];
  commChargeSchedules: Column<YardiEtlTables["commChargeSchedules"][number]>[];
  commContacts: Column<YardiEtlTables["commContacts"][number]>[];
} = {
  commLeases: [
    { key: "Lease_Code", label: "Lease_Code" },
    { key: "Lease_Name", label: "Lease_Name" },
    { key: "Lease_Type", label: "Lease_Type" },
    { key: "Lease_Start_Date", label: "Lease_Start_Date" },
    { key: "Lease_End_Date", label: "Lease_End_Date" },
    {
      key: "Contracted_Area",
      label: "Contracted_Area",
      numeric: true,
      format: (r) => r.Contracted_Area.toLocaleString(),
    },
    {
      key: "Security_Deposit",
      label: "Security_Deposit",
      numeric: true,
      format: (r) => money(r.Security_Deposit),
    },
  ],
  commUnitXrefs: [
    { key: "Lease_Code", label: "Lease_Code" },
    { key: "Unit_Code", label: "Unit_Code" },
    { key: "Unit_Start_Date", label: "Unit_Start_Date" },
    { key: "Unit_End_Date", label: "Unit_End_Date" },
    { key: "Status", label: "Status" },
  ],
  commUnits: [
    { key: "Unit_Code", label: "Unit_Code" },
    { key: "Rental_Type", label: "Rental_Type" },
    {
      key: "Rent",
      label: "Rent",
      numeric: true,
      format: (r) => (r.Rent > 0 ? money(r.Rent) : "-"),
    },
    {
      key: "SQFT",
      label: "SQFT",
      numeric: true,
      format: (r) => r.SQFT.toLocaleString(),
    },
    {
      key: "Lease_Type",
      label: "Lease_Type",
      format: (r) => r.Lease_Type ?? "-",
    },
  ],
  commSqfts: [
    { key: "Unit_Code", label: "Unit_Code" },
    { key: "DTDATE", label: "DTDATE", format: (r) => blank(r.DTDATE) },
    {
      key: "DSQFT0",
      label: "DSQFT0",
      numeric: true,
      format: (r) => r.DSQFT0.toLocaleString(),
    },
    { key: "Notes", label: "Notes", format: (r) => blank(r.Notes) },
  ],
  commChargeSchedules: [
    { key: "Lease_Code", label: "Lease_Code" },
    { key: "Charge_Code", label: "Charge_Code" },
    { key: "Schedule_From_Date", label: "Schedule_From_Date" },
    { key: "Schedule_To_Date", label: "Schedule_To_Date" },
    {
      key: "Amount",
      label: "Amount",
      numeric: true,
      format: (r) => money(r.Amount),
    },
    { key: "Amount_Period", label: "Amount_Period" },
  ],
  commContacts: [
    { key: "Record_Code", label: "Record_Code" },
    { key: "Role_Description", label: "Role_Description" },
    { key: "Company_Name", label: "Company_Name", format: (r) => blank(r.Company_Name) },
    { key: "PhoneNumber_1", label: "Phone", format: (r) => blank(r.PhoneNumber_1) },
    { key: "Email", label: "Email", format: (r) => blank(r.Email) },
  ],
};

// A single tab body: row count line, optional shell legend, sample grid.
function TableTabBody({
  tab,
  tables,
  vacantUnitCodes,
}: {
  tab: TableTab;
  tables: YardiEtlTables;
  vacantUnitCodes: Set<string>;
}) {
  // Typed per-table render. We branch on the table key so each column set lines
  // up with its row type without an unsafe cast on the cell values.
  const rows = tables[tab.key] as ReadonlyArray<Record<string, unknown>>;
  const total = rows.length;
  const sample = rows.slice(0, SAMPLE_ROWS);
  const cols = COLUMNS[tab.key] as Column<Record<string, unknown>>[];

  // For the two shell-bearing tables, a row is a vacant shell when its
  // Unit_Code is in the vacant set. Other tables never hold shells.
  function isShellRow(row: Record<string, unknown>): boolean {
    if (!tab.hasShells) return false;
    const code = row["Unit_Code"];
    return typeof code === "string" && vacantUnitCodes.has(code);
  }

  return (
    <div className="flex flex-col gap-3 pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-foreground-muted">
          <span className="font-mono tabular-nums text-foreground">
            {total.toLocaleString()}
          </span>{" "}
          rows emitted
          <span className="text-foreground-faint mx-1.5">·</span>
          showing first {Math.min(SAMPLE_ROWS, total)}
        </p>
        {tab.hasShells ? (
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.06em]">
            <span className="inline-flex items-center gap-1.5 text-foreground-muted">
              <span className="inline-block size-1.5 rounded-full bg-[var(--tone-emerald-dot)]" />
              Occupied
            </span>
            <span className="inline-flex items-center gap-1.5 text-foreground-muted">
              <span className="inline-block size-1.5 rounded-full bg-[var(--tone-amber-dot)]" />
              Vacant shell
            </span>
          </div>
        ) : null}
      </div>

      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead
                  key={String(c.key)}
                  className={c.numeric ? "text-right" : undefined}
                >
                  {c.label}
                </TableHead>
              ))}
              {tab.hasShells ? <TableHead /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sample.map((row, i) => {
              const shell = isShellRow(row);
              return (
                <TableRow key={i}>
                  {cols.map((c) => {
                    const value = c.format
                      ? c.format(row)
                      : String(row[c.key as string] ?? "");
                    return (
                      <TableCell
                        key={String(c.key)}
                        className={
                          c.numeric
                            ? "font-mono text-[12.5px] tabular-nums text-right"
                            : "font-mono text-[12.5px]"
                        }
                      >
                        {value}
                      </TableCell>
                    );
                  })}
                  {tab.hasShells ? (
                    <TableCell className="text-right">
                      {shell ? (
                        <Badge
                          variant="outline"
                          className="border-[var(--tone-amber-dot)]/40 text-[var(--tone-amber-text)]"
                        >
                          vacant shell
                        </Badge>
                      ) : null}
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SixTableEmitPreview({
  tables,
}: {
  tables: YardiEtlTables;
}) {
  const [active, setActive] = useState<string>(TABLE_TABS[0].key);

  // A unit is a vacant shell when it appears in CommUnits but no CommUnitXrefs
  // row references it. Computed once and shared with both shell-bearing tabs.
  const xrefUnitCodes = new Set(
    tables.commUnitXrefs.map((x) => x.Unit_Code),
  );
  const vacantUnitCodes = new Set(
    tables.commUnits
      .filter((u) => !xrefUnitCodes.has(u.Unit_Code))
      .map((u) => u.Unit_Code),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
          Yardi commercial ETL tables
        </p>
        <p className="text-[12px] text-foreground-faint">
          Occupied units fan out across all six tables. Vacant units land as
          CommUnits plus CommSQFTs shells, available to rent.
        </p>
      </div>

      <Tabs value={active} onValueChange={(v) => setActive(v as string)}>
        <TabsList variant="line" className="flex-wrap">
          {TABLE_TABS.map((tab) => {
            const count = tables[tab.key].length;
            return (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
                <span className="ml-1.5 font-mono text-[10.5px] tabular-nums text-foreground-faint">
                  {count.toLocaleString()}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TABLE_TABS.map((tab) => (
          <TabsContent key={tab.key} value={tab.key}>
            <TableTabBody
              tab={tab}
              tables={tables}
              vacantUnitCodes={vacantUnitCodes}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
