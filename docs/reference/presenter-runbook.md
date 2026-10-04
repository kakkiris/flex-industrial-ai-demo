# Presenter Runbook (25-30 minutes)

End-to-end walkthrough of the demo suite for a validation session. Reset the DB before walking: `pnpm db:reset`.

## Walkthrough order

1. **Home** (1 min). Hero + About KFP + the five-card status grid. Each card links to its demo. A2 sits on the grid as a "Removed" card.
2. **A1 Market Intelligence** (4 min). Click into a Kingsley filter at 1500-2500 sqft. Discuss confidence tiers. Click "Ingest a new OM PDF" and upload any public CRE OM; watch the pipeline extract property + units + confidence in 30-60 seconds. Talk through the new comps appearing in the table.
3. **A3 Onboarding Orchestration** (5 min). Open one of the three seeded deals to walk the timeline. Show the overdue blocker on Coastal Flex Center. Upload a sample PSA: the agent extracts deposit + DD + closing dates and the deal lands with six tasks. Generate one of the four DD RFPs; mark it as sent.
4. **L1 Website Chat** (5 min). Open the "keystoneflex.example (Demo)" tab. Click the chat widget. Play a prospect: "I run an HVAC company, need about 2000 sqft in Calder, August move-in, around 3 year term." Watch the streamed reply. After the assistant confirms and ends, switch to the Leasing Team Inbox tab. The lead appears with all Tier 1 + Tier 2 fields populated and the full transcript drawer.
5. **L2 Lease Abstraction** (5 min). Walk through one of the seeded abstracts to show the per-field confidence badges and the "Needs review" group. Upload a sample lease PDF; the high-stakes Opus 4.7 extractor produces a structured abstract in 30-45 seconds. Click "Push to Yardi" to show the paste-ready output.
6. **C3 Lease Intelligence** (5 min). Click the suggested chip "HVAC responsibility for <tenant>". The retrieval + LLM call answers with inline citations. Click a citation chip; the right pane loads the full lease section. Try "Leases expiring next quarter" and "Compare net effective rents" to demonstrate structured filters and comparison tables.
7. **Notifications bell** (1 min). The top-bar bell collects qualified leads, deposit reminders, RFP-ready, and extraction-complete events from the routes you just exercised.

## Failure modes to know

- **Anthropic rate limits.** Stagger heavy extractions (L2 + A1 + A3 + C3 in the same minute can trip burst limits). The runbook above paces this naturally.
- **Scanned PDF quality.** Anthropic's native PDF document support handles most scanned documents; if a file flunks, the route returns 500 and surfaces the error in the toast.
- **DB drift.** If the demo seems off, `pnpm db:reset` restores the seeded baseline.
- **Missing parent-folder fixtures.** Runtime upload flows expect the KFP sample PDFs in a local, gitignored fixtures folder (not shipped with this repo). If a presenter uploads one that isn't there, the route returns 404; presenter falls back to any public CRE PDF.

## Deploy on Railway

`railway.toml` configures the build and start commands. In your Railway project:

1. Connect to the GitHub repo.
2. Set the service **Root Directory** to the folder containing the Next.js app (the repo root).
3. Add env: `ANTHROPIC_API_KEY=<your key>`. Optionally add `SLACK_WEBHOOK_URL` if you want notification relays.
4. Pick a branch to deploy (`main` or `feat/kfp-demo-suite`).
5. Trigger a deploy. Railway runs `pnpm install --frozen-lockfile && pnpm build`, then starts with `pnpm start:railway` (which re-seeds the SQLite DB and starts Next).

Notes:
- Railway's filesystem is ephemeral by default. The seeded DB resets on every container start. For a presenter demo that's actually a feature: every deploy lands on a consistent baseline. For persistence, mount a Railway Volume at the `db/` path and drop the `db:reset` step from `start:railway`.
- The app honors `$PORT` automatically via the start script.
- Local sample-PDF fixtures are not present in Railway containers; the runtime upload affordances surface a "file not found" toast for the seeded sample PDFs. Presenter uploads of public PDFs still work.

## What is mock vs real

- **Property + unit data.** Synthetic, matched to the KFP profile (1000-5000 sqft, $11-$35/sqft NNN depending on submarket and amenities, Marisol submarkets plus other regional expansion markets).
- **Lease abstracts.** Synthetic. Three form-style, three negotiated, with `rawSections` seeded for C3 retrieval. Client lease samples were kept out of the repo; any lease PDF can be used at runtime via the L2 upload affordance.
- **OMs.** Three broker OMs (Crestview, Uptown, Meridian), pre-extracted and fictionalized into committed JSON; the A1 ingest path runs against any uploaded PDF.
- **Deals.** Three synthetic deals at varying stages with seeded onboarding tasks.
- **Notifications.** In-app only by default; Slack relay activates when `SLACK_WEBHOOK_URL` is set.
- **PDFs uploaded at runtime.** Real extraction. Files land in `uploads/`, which is gitignored.
