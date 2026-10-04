// A5 closing-credits callout. Surfaces the "unpaid leasing costs / closing
// credits" for leases where the seller owed outstanding TI allowances, leasing
// commissions, or estimated landlord work at the time of closing. These become
// buyer credits at closing per PSA Schedule 2. This is a deal-level note, NOT
// a Yardi CommLeases column.

import { BadgeDollarSign } from "lucide-react";
import type { ClosingCredits } from "@/lib/etl/acquisition-preview";

function money(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ClosingCreditsPanel({
  credits,
}: {
  credits: ClosingCredits;
}) {
  if (credits.lines.length === 0) return null;

  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <BadgeDollarSign
          className="size-4 shrink-0 text-foreground-muted"
          aria-hidden="true"
        />
        <p className="font-mono text-[10.5px] uppercase tracking-[0.06em] text-foreground-muted">
          Closing credits to buyer (unpaid leasing costs)
        </p>
      </div>

      <div className="border-t border-border">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-background-subtle">
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                Tenant
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                TI Allowance
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                Leasing Commission
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                Landlord Work
              </th>
              <th className="px-4 py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted">
                Total Credit
              </th>
            </tr>
          </thead>
          <tbody>
            {credits.lines.map((line) => (
              <tr key={line.tenant} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5 font-mono text-foreground">
                  {line.tenant}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground-muted">
                  {line.tiAllowance > 0 ? money(line.tiAllowance) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground-muted">
                  {line.leasingCommission > 0 ? money(line.leasingCommission) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground-muted">
                  {line.landlordWork > 0 ? money(line.landlordWork) : "-"}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums font-medium text-foreground">
                  {money(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-background-subtle border-t border-border">
              <td
                colSpan={4}
                className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.06em] text-foreground-muted"
              >
                Aggregate credit to buyer at closing
              </td>
              <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-foreground">
                {money(credits.aggregateTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="border-t border-border bg-background-subtle px-4 py-2.5">
        <p className="text-[11.5px] leading-relaxed text-foreground-faint">
          These outstanding amounts are credited to the buyer at closing per PSA
          Schedule 2. They are not Yardi CommLeases columns and are excluded from
          the six-table fan-out.
        </p>
      </div>
    </div>
  );
}
