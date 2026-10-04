import { WorkflowChangePanel } from "@/components/shared/WorkflowChangePanel";

// L2 covers the single-lease path: a new lease signed on an already-owned property,
// entered in Yardi by one person doing create-through-activate (create lease, attach
// billing contact, add unit, build charge schedules, activate).
// Bulk acquisition inheritance (inheriting in-place leases at closing) is A5's path.
export function WorkflowNarrative() {
  return (
    <WorkflowChangePanel
      withDemoLabel="With L2 (single-lease path)"
      today="Lease signed in DocuSign and emailed to accounting. One person opens Yardi and works through five steps manually: create lease record, attach a billing contact, link the unit, build each charge schedule line, then activate. Each field is typed from the PDF. With a complex lease this takes 15+ minutes and escalation errors slip through unbilled when rent steps are keyed incorrectly."
      withDemo="Lease signed in DocuSign. The executed PDF is uploaded to L2 (a manual upload of the signed document, no DocuSign integration required). L2 extracts the ~15-20 fields the Yardi create-through-activate sequence needs (tenant name, billing contact, unit code, charge schedules, lease dates, security deposit, lease type) and delivers them paste-ready in under a minute. Accounting reviews confidence-flagged fields, approves, and opens Yardi with the output already filled in. Yardi stays current; escalation steps are locked in before the first billing cycle. New abstracts feed C3 within seconds. Bulk acquisition inheritance at closing is handled by A5 (not this path)."
    />
  );
}
