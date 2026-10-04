# L2 Lease Abstraction: Current vs Demo Process

**Perspective:** Keystone leasing out.
**Trigger:** A new lease is signed on an already-owned property.

This is the single-lease path. One person on the leasing team does the full create-through-activate sequence in Yardi: create lease record, attach billing contact, add unit, build charge schedules, activate. L2 extracts the ~15-20 fields that sequence requires. Bulk acquisition inheritance (inheriting in-place leases at closing) is A5's path, not this one.

## Current Process (what KFP does today)

1. Lease signed in DocuSign and distributed via email to leasing and property management [Pre-discovery-KFP-initiatives].
2. The leasing team reads the lease open in Yardi by hand and types each input field (parties, dates, base rent, escalations, security deposit, CAM, options) [Discovery-Jordan 01:12:15, 01:13:03].
3. Per Jordan, properly done this should not be faster than 15 minutes per lease [Discovery-Jordan 01:14:26].
4. Abstraction is acknowledged as something KFP should do for every lease but lacks capacity for at current volume [Discovery-Jordan 01:01:29].
5. Errors slip through: abstraction errors (for example, a missed escalation) can cause billing mistakes that surface only later in financial review [Discovery-Jordan 01:13:03].
6. Lease distribution to abstraction is currently a complete GAP in the leasing workflow [Pre-discovery-KFP-initiatives, system landscape diagram in `CLAUDE.md`].

## Demo Process (what this solution does)

Framing: the demo narrates the Yardi create-through-activate sequence as five steps one person does. L2 delivers the extracted fields before that person opens Yardi.

1. Signed leases enter by **manual upload** of the executed PDF (exported from DocuSign). The presenter uses "Upload signed DocuSign lease (PDF)", which runs the extraction pipeline and inserts a `leaseAbstracts` row with `source = "upload"`, `status = "awaiting_review"`. **(replaces)** Current step 1's manual distribution chain (signed, emailed to leasing, quarterly type-in). Note: automated DocuSign intake (DocuSign Connect / envelope webhook) is intentionally out of scope; intake is a manual upload of the signed document.
2. The upload runs the dual-path extraction pipeline: page-1 text density routes the PDF to either the text path (unpdf + Sonnet 4.6) or the vision path (Opus 4.7 native PDF). The chosen path is stored in `extractionPath` metadata and shown on the abstract. **(replaces)** Current step 2's manual reading.
3. Structured `LeaseAbstract` JSON produced in 30 to 45 seconds with per-field confidence badges. The ~15-20 fields map directly to the five Yardi steps: tenant name and billing contact (step 1 and 2), unit code and square footage (step 3), charge code, amount, and schedule dates (step 4), and lease-level fields needed for activation (step 5). **(replaces)** Current step 2's manual typing into Yardi.
4. Review queue: lease list filters to "Awaiting review" by default for new arrivals. Reviewer opens the abstract, corrects any low-confidence fields inline, then clicks "Approve and push to Yardi". **(new)** Closes the gap where KFP acknowledged abstraction should happen but did not.
5. "Approve and push to Yardi" flips `status = "pushed_to_yardi"` and stamps `pushedToYardiAt`. The Push-to-Yardi modal shows the paste-ready column mapping for the create-through-activate sequence. **(augments)** Current step 2; the leasing team still owns the paste, but the typing is done and the review is one-click.
6. Low-confidence fields surface in a "Needs review" group at the top of the editor so the human reviewer focuses where it matters. **(new)**
7. Operating-expense recovery extraction: the pipeline pulls a structured `operatingExpenseRecovery` object (recovery type, base year, recovery method, pro-rata share %, expense categories, annual cap %, reconciliation basis, plus a notes clause) and renders it in the AbstractEditor "Recoveries" group; low-confidence fields fall into the "Needs review" group. Stated lease terms only; reconciliation math against budgets is out of scope (no budget data in the lease). The Push-to-Yardi modal shows the recovery setup (type + base year + method + share) alongside the EstUtil line so the leasing team sees how the recovery is billed. The recovery clause(s) are captured into `rawSections` so C3 can cite them. This was Alex's top L2 ask: OpEx recoveries are the most billing-critical Yardi field, and pass-throughs vary by lease [Validation 2026-06-04]. **(new)**
8. Abstract persisted in `leaseAbstracts` table (now including an `operatingExpenseRecovery` JSON column), with `rawSections` populated into the FTS5 index that drives C3 chat. Synchronous FTS write at extract time means new abstracts are queryable in C3 within seconds. **(new)**
9. "Ask C3 about this lease" deep-link on the abstract editor jumps directly to C3 with the lease pre-selected and an opening query auto-fired. **(new)**
10. Narrative panel on the page contrasts the current manual-entry workflow with the demo's same-day flow, so reviewers see the value proposition without reading process.md. **(new)**

## Mapping

| Current Step | Demo Step | Relationship | Notes |
| --- | --- | --- | --- |
| 1 (signed lease distribution) | 1 (manual upload of signed PDF) | replaces | Manual PDF upload replaces the email distribution chain; DocuSign Connect is out of scope |
| 2 (manual read + Yardi typing) | 2+3+5 (extraction + paste-ready) | replaces | The largest time saving; fields map to the five Yardi UI steps |
| 3 (15 min per lease) | n/a | benchmark | Demo target is sub-one-minute review + approve for a text-native lease |
| 4 (abstraction gap) | 4+8 (review queue + persisted abstract) | replaces | Every lease gets an abstract; reviewer approves before it lands |
| 5 (escalation errors) | 6 (confidence flag) | augments | Catches the error class Jordan described (missed escalations that lead to billing mistakes) |
| 6 (workflow gap) | full demo | replaces | The GAP arrow on the system landscape closes |
| new: OpEx recovery accuracy | 7 (recovery extraction) | new | Alex's top L2 ask: the most billing-critical Yardi field; stated terms extracted and surfaced in the editor + Yardi output, fed to C3 [Validation 2026-06-04] |
| cross-demo handoff | 9 (Ask C3 about this lease) | new | Bi-directional link with C3; abstract feeds FTS5 synchronously |

## What the demo does NOT cover

- Automated DocuSign intake (DocuSign Connect / envelope webhook): intentionally excluded. Leases are brought in by manual upload of the signed PDF. A Connect webhook or mailbox watcher could be added later, but is deliberately out of scope for now (DocuSign developer integration was judged too costly to build at this stage).
- Real Yardi API push (paste-ready output only; production needs Yardi API or import format confirmation).
- Bulk acquisition inheritance: when Keystone closes on a property and inherits the seller's in-place leases, that is A5's path (Acquisition Lease Bulk-Load), not L2. A5 emits the full six-table Yardi ETL payload.
- Operating-expense recovery reconciliation math: the demo extracts the stated recovery terms only; it does not compute reconciliations against budgets or expense data (no budget data lives in the lease; a portfolio / C3 follow-up).
- Lease amendment / addendum extraction.
- Re-extraction after lease modifications.
- COI matching / insurance verification.
- Lease distribution routing across leasing, property management, and portfolio reporting (demo writes to one table).
