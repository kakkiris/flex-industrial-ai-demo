# Design Direction — KFP Demo Suite Visual Revamp — 2026-05-27

Read-only audit + visual direction produced before any code changes per the design-revamp prompt. Phase 2 implementation depends on user approval of this document.

**Revision (2026-05-27, post user feedback):** Direction pivoted toward a conservative, spacious, approachable, sans-only visual language: near-black chrome with brand indigo starved to one rare accent. Earlier framing leaned Bloomberg Terminal / data-density; that's been softened for a calmer everyday tool. Key shifts from the original draft:
- Dropped Newsreader editorial serif (sans-only throughout)
- Sidebar dominant color shifts from brand indigo to near-black/charcoal; brand indigo is reserved for the single primary action per surface
- Card padding generous, not compressed
- Layouts breathe more than originally framed; tabular density preserved only where the data demands it (CompsTable, TaskList, lease list)
- Implementation discipline: **never break the code** — token + className changes only, no API shifts, no new dependencies that could fail at runtime

---

## 0. Audit Findings (what works vs what feels weak)

### Works
- **Token system.** `app/globals.css` uses OKLCH variables; light + dark both defined. Modern, easy to retune.
- **Component-API discipline.** shadcn primitives are intact; the heavy lifting lives in tailwind classes, not bespoke component shapes. Visual revamp can happen at the token + class layer without breaking props.
- **Existing density choices.** Button default `h-8`, dialog/sheet defaults, table `text-sm` are already moderately dense, well-suited to CRE professionals.
- **Brand indigo anchored as primary.** `#4F46E5` flows through `--primary` and reaches the right surfaces.
- **C3 citation panel** already has a hint of editorial treatment (`border-l-2 border-primary/50` blockquote) — the strongest existing visual moment to lean into.
- **L2 confidence-grouped editor** (Needs review block) is conceptually right; just needs typographic refinement.

### Feels weak
- **Geist Sans everywhere.** This is the "default modern Next.js" font. The audience will pattern-match it to "AI demo built last week" — exactly the AI-slop aesthetic the design skill warns against. No display contrast; no numeric font; `--font-heading` is aliased to `--font-sans` so there is literally no heading distinction.
- **Active sidebar item = full brand indigo fill.** Too loud for a tool a CRE manager keeps open all day. Brand indigo should be reserved for *one* primary action per surface, not for navigation state.
- **No tabular figures.** Rent per sqft, total sqft, monthly amounts, deviation %, confidence scores — every numeric column in every demo renders in proportional digits. Numbers don't align across rows. Major dignity loss for a CRE tool.
- **Card radius `rounded-xl` (18px+).** Soft, marketing-y. CRE pros respond to tighter geometry — Bloomberg, Argus, Yardi don't use pill-rounded panels.
- **Status pills are duplicated and slightly inconsistent.** L2 uses one palette, A3 BlockerView uses a different palette, A3 TaskList another, L1 LeadInbox another. The shapes (`rounded-full` vs `rounded-md`) and weights drift across pages.
- **Card borders use `ring-1 ring-foreground/10`.** Rings are softer than borders. For dense data surfaces the lack of crisp delineation between panels makes the layout feel undifferentiated.
- **Loading = Skeleton everywhere.** The animated gradient feels marketing-y. Operating tools usually show a single muted rect or a thin progress line.
- **No background atmosphere.** Full-bleed white canvas reads as "AI demo template" the moment a user lands.
- **Heavy focus ring (`ring-3 ring/50`).** Accessibility-positive intent but visually noisy on dense panels. Can be lighter + crisper without losing AA compliance.
- **Sidebar item icons + labels are spaced generously (`gap-3`, `py-2`).** A 7-item nav has room to compress to `gap-2`, `py-1.5` and still hit comfortable touch target.
- **Hardcoded `bg-amber-100`, `bg-emerald-50`, `text-rose-700` literals scattered.** Should route through a small semantic-tone helper so a color tune-up is one file.

---

## 1. Aesthetic Positioning

> **"An internal tool that feels calm, competent, and built for people who keep it open all day."**

Reference points (in this order of weight):

1. **Conservative CRE operating tools** — near-black chrome and text on white canvas; sans-serif throughout; restrained accent use; generous breathing room; rectangular cards.
2. **Linear** — restrained precision; brand color used sparingly; tight type; status pills that feel like ledger entries, not UI candy.
3. **Stripe Dashboard** — disciplined neutrals; brand color reserved for one primary action per view; numeric typography respected when the data is numeric.

**What we're explicitly NOT.** Not Bloomberg Terminal (too aggressive for this audience). Not Notion's friendly maximalism. Not Vercel's marketing polish. Not "minimal SaaS with a hero gradient." Not pastel. Not playful. Not editorial-magazine.

**What it *should feel like* on first load.** Quiet. Confident. White-dominant canvas, near-black chrome, generous spacing. The user notices that the panels breathe, the buttons are minimal, and brand indigo shows up exactly once per view — on the one action they're being asked to take. Every surface reads as the same design hand.

---

## 2. Color System

Keep OKLCH. Keep brand indigo `#4F46E5` as `--primary` but starve it dramatically — brand indigo anchors the *primary action button per view* and nothing else. Sidebar chrome, headings, and active-state accents all move to near-black/charcoal.

### Token roles (light mode primary)

| Token | OKLCH | Hex (approx) | Used for |
| --- | --- | --- | --- |
| `--background` | `oklch(1 0 0)` | `#FFFFFF` | App canvas |
| `--background-subtle` | `oklch(0.985 0 0)` | `#F8F8F8` | Sidebar background, table header strip, citation panel surface |
| `--foreground` | `oklch(0.18 0 0)` | `#222222` | Body text and the **dominant chrome color** — sidebar headings, active states, button outlines |
| `--foreground-muted` | `oklch(0.50 0 0)` | `#6C6C6C` | Secondary text, captions |
| `--foreground-faint` | `oklch(0.70 0 0)` | `#A4A4A4` | Disabled, placeholder, "pending capture" markers |
| `--border` | `oklch(0.91 0 0)` | `#E5E5E5` | Default panel borders |
| `--border-strong` | `oklch(0.82 0 0)` | `#CDCDCD` | Active/selected borders |
| `--primary` | `oklch(0.5106 0.2301 276.97)` | `#4F46E5` | **Primary action only.** One button per view. Nothing else. |
| `--primary-subtle` | `oklch(0.96 0.03 277)` | `#EEF2FF` | Tint for hover states on primary; never used as a fill |
| `--ring` | `oklch(0.708 0 0 / 0.25)` | neutral 25% | Focus rings (lighter than current `ring/50` ring-3) |

**Critical shift from earlier draft:** sidebar active state previously proposed as "soft brand-tinted bg + 2px brand indigo left bar." Revised: **soft `--background` (white) bg + 2px `--foreground` (near-black) left bar + foreground text in medium weight**. Charcoal active state keeps nav quiet. Brand indigo still does not appear in the sidebar except on the FlexOps AI × KFP wordmark lockup (which is a brand placement, not navigation state).

### Semantic tones (5 only — no others)

Each tone gets three slots: `tint` (background), `text` (foreground on tint), `dot` (solid indicator).

| Tone | Used for | Tint | Text | Dot |
| --- | --- | --- | --- | --- |
| **emerald** | success, pushed-to-yardi, qualified, on-plan UW | `oklch(0.96 0.04 152)` | `oklch(0.30 0.10 152)` | `oklch(0.55 0.15 152)` |
| **amber** | awaiting-review, due-soon, manual-review | `oklch(0.96 0.06 75)` | `oklch(0.36 0.12 75)` | `oklch(0.65 0.18 75)` |
| **rose** | overdue, unqualified, underperforming, blocker | `oklch(0.96 0.05 18)` | `oklch(0.40 0.16 18)` | `oklch(0.58 0.20 18)` |
| **sky** | in-progress, info, neutral notification | `oklch(0.96 0.04 235)` | `oklch(0.35 0.13 235)` | `oklch(0.55 0.16 235)` |
| **violet** | docusign-source, simulated, demo-marker | `oklch(0.96 0.04 295)` | `oklch(0.35 0.13 295)` | `oklch(0.55 0.16 295)` |

That's five tones plus brand indigo plus a 7-step neutral. **Total of 8 hues across the whole app.** No more.

### Dark mode
- Stretch goal only. Tokens already defined in `globals.css`. We will *not* spend cycles on dark-mode polish this pass. Light is the default; dark may be incidentally broken and that's acceptable until a follow-up session.

---

## 3. Typography

**Font families** (Google Fonts, loaded via `next/font` exactly as Geist is today):

- **Body / UI:** **IBM Plex Sans** (weights 400, 500, 600). Distinctive enough to avoid the Geist generic-ness; humanist-modern profile reads approachable without becoming friendly-cute; pairs identity across sans + mono via the same family.
- **Numeric / IDs / Timestamps:** **IBM Plex Mono** (weights 400, 500). Reserved for digit-heavy contexts: dollar amounts, rent PSF, sqft, deviation %, confidence scores, lease IDs, envelope IDs, page numbers, ISO timestamps. NOT used for general UI text.
- **Editorial accent:** ~~Newsreader serif~~ **dropped.** The direction is sans-only; introducing a serif would break the visual hand. The C3 citation blockquote and L1 verdict reasoning will use Plex Sans italic with a strong charcoal left rule instead. The "wow moment" comes from typography weight + tracking + the rule treatment, not from a serif family swap.

Why Plex. Two reasons: (1) distinctive enough to avoid the AI-default Geist signal that the design skill warns against; (2) the sans + mono in the same family produce a cohesive look across the entire app, which gives the app single-family discipline.

### Type scale

| Role | Family | Size | Weight | Tracking | Line height |
| --- | --- | --- | --- | --- | --- |
| Page title (h1) | Plex Sans | 24px | 500 | -0.015em | 1.2 |
| Section header (h2) | Plex Sans | 16px | 600 | -0.005em | 1.3 |
| Section label (h3 / panel cap) | Plex Mono | 11px | 500 | +0.06em UPPER | 1.0 |
| Body | Plex Sans | 14px | 400 | 0 | 1.55 |
| Body emphasis | Plex Sans | 14px | 500 | 0 | 1.55 |
| Caption / muted | Plex Sans | 12px | 400 | 0 | 1.45 |
| Numeric (tabular) | Plex Mono | 13px | 400 | 0 | 1.4 |
| Numeric emphasis | Plex Mono | 13px | 500 | 0 | 1.4 |
| Editorial quote | Plex Sans italic | 15px | 400 | -0.005em | 1.55 |

Bumped page-title from 22 to 24 and body from 13.5 to 14 for a more generous reading scale. Line heights slightly looser. Numeric stays compact because tabular columns earn the density.

`tabular-nums` is enabled by default on any cell containing only digits (via a `.num` utility class or `font-variant-numeric: tabular-nums` on `<td>` rules where appropriate).

---

## 4. Spacing & Rhythm

4px base scale. Generous where layout needs to breathe, tabular-dense only where the data demands it.

| Scale | Px | Where |
| --- | --- | --- |
| 0.5 | 2 | Internal padding of small pills, badges |
| 1 | 4 | Icon to label gap inside a button |
| 1.5 | 6 | Row internal padding (table cells) |
| 2 | 8 | Inter-item gaps in cards; chip rows |
| 2.5 | 10 | Sidebar nav item vertical padding |
| 3 | 12 | Card padding tight variant |
| 4 | 16 | Card padding default |
| 5 | 20 | Section spacing inside detail views |
| 6 | 24 | Top of page padding |
| 8 | 32 | Below page title |
| 10 | 40 | Between major page sections on Home |

**Revised from earlier draft:** card internal padding **stays at `py-4 px-4` default** (tightening it to `py-3` would compress the design toward Bloomberg). The earlier draft over-corrected for density. Dense tables stay dense (CompsTable, TaskList — those *need* compactness because the data is the value). Cards in narrative surfaces (WorkflowNarrative, LenderPacketPanel, Citation panel) breathe.

Table row height: header `h-10` (kept from current), cells `py-2 px-2`. Hover tint `bg-foreground/[0.025]`. Numeric `<td>` get `font-mono tabular-nums` so digit alignment is precise without compressing the row.

---

## 5. Component Patterns

Treatment described, not coded. Implementation lives in Phase 2.

| Component | Treatment |
| --- | --- |
| **Button (default / primary)** | `h-9`, **`rounded-sm` (4px)** for a near-rectangular CTA treatment, brand indigo fill, Plex Sans 14px/500, no shadow. Hover: 90% opacity, no transform. Active: 1px translate-y (kept). One per view. |
| **Button (outline)** | Same shape, `border border-foreground/15`, transparent fill, foreground text. Hover: `bg-foreground/[0.04]`. This is the dominant button variant in every non-primary slot. |
| **Button (ghost)** | No border, no background; hover tint only. Used in sidebar nav items, dialog close, "Mark all read" in TopBar. |
| **Input** | `h-9`, `rounded-sm`, `border-border`, Plex Sans body text, Plex Mono if numeric. Focus: thin 2px ring at `ring-1 ring-foreground/30` (not brand), for restraint. |
| **Card** | `border border-border` (not ring), **`rounded-md` (8px)**, `py-4 px-4` default, `gap-3` between sections. White fill; shadow only on Dialog and Sheet. Clean rectangular cards. |
| **Table** | `h-10` header rows with `bg-background-subtle` strip. Cells `py-2 px-2`. Numeric `<td>` get `font-mono tabular-nums`. Hover row tint `bg-foreground/[0.025]`. Selected row uses `bg-foreground/[0.04]` (not brand tint) — keeps brand indigo rare. |
| **StatusPill (NEW shared component)** | Replaces 4 duplicate inline implementations across L2 LeaseList / A3 TaskList / A3 BlockerView / L1 LeadInbox. Props: `tone: "emerald"\|"amber"\|"rose"\|"sky"\|"violet"\|"neutral"`, `children`. Shape: `rounded-full`, `h-5`, Plex Sans 10.5px/500, +0.02em tracking, tint background + text from tone tokens above. |
| **ConfidenceBadge** | Switch from current pill to square `rounded-sm`, Plex Mono 10px UPPERCASE, tone-tinted from semantic palette. Reads as a data tag, not a status. |
| **Badge (brand)** | Reserved for the demo ID chips on the home StatusGrid (A1 / A3 / L1 / L2 / C3). Plex Mono 11px, brand indigo fill, sharper corners (`rounded-sm`). Only place outside the primary button where brand indigo appears. |
| **Dialog / Sheet** | Keep shadcn shape but tighten to `rounded-md` corners on content; header gets a thin bottom border instead of bg-muted footer pattern. |
| **Slider** | Keep base-ui shape; thumb gets a foreground-color ring on focus (not brand). |
| **Tabs** | Underlined-active treatment (small 2px **foreground** bar under the active tab — not brand indigo, matching the charcoal chrome treatment). |
| **Citation blockquote (C3)** | The wow moment. **Plex Sans italic** (not serif) at 16px, `border-l-[3px] border-foreground` (charcoal) at full opacity, `pl-5`, Plex Mono section heading + page above the quote in 11px UPPERCASE. Soft `--background-subtle` panel behind, generous padding. |

### Sidebar discipline

- **Background:** `--background-subtle` (very pale gray, `#F8F8F8`) — distinguishable from the main canvas without becoming dark.
- **Active item:** white background, `--foreground` (near-black) label in 500 weight, **2px-wide `--foreground` bar on the left edge** (`border-l-2 border-foreground`). NOT brand indigo. NOT subtle brand tint. This is the single biggest revision from the prior draft — sidebar active state uses charcoal rather than coloring with brand indigo.
- **Hover (inactive):** `bg-foreground/[0.04]`.
- **Inactive item label:** `foreground-muted` color, 400 weight.
- **Icon and label:** `gap-2.5`, `py-2`. Icon `size-4`, foreground-muted color, switches to foreground on active.
- **Sectioning:** Thin horizontal divider between Home/A1/A3/A3-Blockers (Acquisitions stack) and L1/L2/C3 (Leasing stack). Section caps in Plex Mono 10px UPPER `foreground-muted` above each group.
- **Wordmark:** "FlexOps AI × KFP" in Plex Mono 11px, +0.06em tracking, `foreground/80` — feels like a header on a financial report, not a logo. The `×` between FlexOps AI and KFP stays brand indigo (the single brand placement in chrome).

### TopBar discipline

- Bottom border `border-b border-border`.
- Notification bell: same icon button shape, but the unread Badge switches from brand indigo fill to **rose tint with rose text** — semantic "alert" rather than "brand." Brand indigo stays scarce.
- App name in Plex Sans 14px/600 `foreground`, secondary line "FlexOps AI × KFP" in Plex Mono 10.5px UPPER `foreground-muted`.

---

## 6. Motion Principles

Animation appears in three places. Everywhere else: **none**.

1. **Streaming chat tokens (L1, C3).** The token arrival itself is the animation. Add a 1px-wide blinking cursor immediately after the last streamed token while streaming is in flight; remove on completion. ~600ms blink cycle. Pure CSS keyframe.
2. **Status pill transitions (L2 Approve flow).** When `awaiting_review` flips to `pushed_to_yardi`, the pill background interpolates over 200ms via `transition-colors`. Acknowledges the action without ceremony.
3. **Toast entry/exit (sonner default).** Untouched.

What does NOT animate: button hover, sidebar nav, page navigation, modal open/close (instant), tabs, sliders, citations chips, badges, anything else. Every animation that doesn't earn its place actively hurts a tool used 6 hours a day.

Focus rings appear instantly. Skeletons drop in favor of a single muted-gray placeholder block (no shimmer). Loaders use a 1px-tall indeterminate top bar at the page edge (Linear-style), not centered spinners, except in modal flows where a Loader2 icon stays.

---

## 7. Per-Demo Polish Targets

Two-or-three high-leverage surfaces per demo where polish translates directly to perceived quality. Phase 2 implementation will focus disproportionately on these.

### A1 Market Intelligence Dashboard
1. **CompsTable density and numerics.** Apply Plex Mono + tabular-nums on every numeric column. Pending-capture badge collapses to a small `−` glyph at `foreground/40` to remove visual noise. Confidence column moves to leftmost so reviewers scan it first.
2. **UW Comparison section in CompDetailPanel.** Make this *the* moment of the demo. Side-by-side comp rent / UW rent in Plex Mono, the deviation % rendered large (16px, semibold) with the above/below flag as a colored chevron + tone pill. Performance/Leased/Vacancy impacts as a 3-cell mini-grid below.
3. **Filter sidebar density.** Reduce vertical padding, switch SUBMARKETS scroll area to compact rows, group "Bathroom / Office / Tenant Category / Clear Height" under a thin "Alex 54-col" section label so the reviewer recognizes the rent-roll alignment.

### A3 Property Onboarding Orchestration
1. **TaskList as ticket cards.** Each task: prominent label (Plex Sans 14px/500), team assignee + due-date row in muted, status pill aligned right. Replace per-task `border-rose-300 bg-rose-50/40` ad-hoc styling with the new shared StatusPill component. Adds visual coherence across all 6 task types.
2. **LenderPacketPanel as a lender memo.** Currently four labeled paragraphs. Treatment: thin left rule, section caps in Plex Mono UPPERCASE, body text in Plex Sans, dollar/date figures inline-mono. Reads like a real one-page packet, not a UI panel.
3. **/onboarding/blockers as a command center.** Headline + scan-optimized list of blocker cards; days-overdue rendered prominently (Plex Mono, 14px, rose tone); three action buttons (Draft / Escalate / Contact) as a consistent button row at the bottom of each card. Page padding +8px, gives the dedicated route gravity.

### L1 Website Chat
1. **ChatWidget message bubbles.** Tighter radius (8px not 16px), user message in `--foreground` (near-black) fill with white text — NOT brand indigo, to keep brand indigo rare. Agent bubble in `--background-subtle` with `--foreground` and a thin left rule. Streaming cursor 1px wide pulse after the last token while in flight.
2. **LeadInbox verdict column.** Replace the existing badge with a tone-dot + label + Plex Mono confidence integer (e.g., `● Qualified  88`) in a single tabular row. Reasoning column truncates to 1 line with hover-tooltip for the full sentence; Plex Sans italic.
3. **Lead detail Sheet — verdict explanation.** Reasoning sentence rendered as **Plex Sans italic** block-quote at the top of the drawer with a 3px `--foreground` left rule. Makes the verdict feel like a stated judgment, not a UI annotation. (Earlier draft proposed Newsreader serif here — revised to sans-italic to keep the sans-only discipline.)

### L2 Lease Abstraction
1. **DocuSign Inbox event stream.** Each event in a compact tile: envelope ID in Plex Mono (e.g., `DS-2026-08815`), tenant + address in Plex Sans, timestamp in muted Plex Mono. Border-l-2 violet to mark "simulated" semantic. "Simulate signed lease" button reads as secondary outline; the dominant primary in the L2 view is "Approve and push to Yardi" on the editor.
2. **AbstractEditor confidence treatment.** Needs-review block: `bg-amber-tint` (token, not literal) + `border-l-2 border-amber-dot`. Confidence badges in Plex Mono small UPPER. Push-to-Yardi modal content uses Plex Mono for the paste-ready column rows so the user sees the spreadsheet shape.
3. **Workflow narrative card.** Two-column grid with a vertical rule between Today and With L2. Section caps in Plex Mono UPPER. Body in Plex Sans 13.5/400. Reads like a one-page case-study clipping.

### C3 Lease Document Intelligence
1. **Citation panel (the wow moment).** Plex Sans italic blockquote at 16px, 3px-wide `--foreground` (charcoal) left rule, `pl-5` generous left padding. Above the quote: Plex Mono UPPERCASE row "TENANT NAME · § 7. MAINTENANCE AND HVAC · P. 12" in `foreground-muted`. Below: muted "Open in L2 →" link aligned right. Background `--background-subtle` with `py-6 px-5` generous internal padding — the citation breathes. This is the surface that should make a CRE reviewer say *huh*.
2. **Suggested-query chips.** Pill row, single tone (`foreground/[0.04]` fill + foreground text + `foreground/15` border on hover), Plex Sans 12px. No brand color. Six chips fit a single row on a 1440 viewport.
3. **Chat streaming polish.** 1px cursor pulse during stream; assistant bubble uses `--background-subtle` not muted; citation chips inside the bubble use Plex Mono for the lease-ID prefix and Plex Sans for the section heading.

---

## 8. Anti-Pattern Watch (from the prompt + the design skill)

- No purple gradients. No illustration mascots. No pastel hero backgrounds. No oversized H1s.
- No marketing-site polish on app surfaces. The home page is the most at-risk surface — keep it tight, list the demos as a clean grid, no hero illustration.
- No 400ms button hovers. No spinning loaders centered on a panel.
- No more than 8 hues anywhere (brand indigo + 5 tones + 7-step neutral, but neutrals count as one).
- No information density loss "for breathing room." If a section feels crowded, tighten typography first, then trim what's not earning its place. Don't add whitespace as a primary fix.
- No component-API changes for visual reasons. If a visual requires changing props, the visual is wrong.
- No new dependencies without explicit approval.

---

## 9. Implementation Notes / Concerns

### Codebase observations that will make Phase 2 cheaper
- All semantic tones (emerald/amber/rose/sky/violet) are already used in places via literal Tailwind classes (`bg-emerald-100`, `text-rose-700` etc.). The revamp consolidates them into 5 token sets; replacing the literals is mechanical.
- shadcn primitives are reasonably unmodified — token changes propagate cleanly.
- Status pills are duplicated across at least 4 files. Extracting into `components/shared/StatusPill.tsx` improves the diff *and* the long-term maintenance.

### Codebase observations that will make Phase 2 trickier
- Some components use `style={{ height: "calc(100vh - 4rem)" }}` (e.g., `app/lease-intelligence/page.tsx:19`). These work but should normalize to Tailwind classes where possible. Low priority; can stay if breaking would risk layout.
- `components/shared/ConfidenceBadge.tsx` consumes `badgeClass(level)` from `lib/confidence.ts`. The styling logic in `lib/confidence.ts` likely returns Tailwind class strings; if so, that file becomes part of the revamp surface.
- A couple of `<details>` elements (RFP Inputs Used disclosure) carry native browser styling; needs custom shadcn-aligned treatment.

### Estimated scope
- **Foundation:** `app/globals.css`, `app/layout.tsx` (font loading) — 2 files.
- **Shared primitives:** `components/ui/{button,card,badge,input,table,dialog,tabs,sheet,select,checkbox,slider,skeleton}.tsx` — ~12 files. Mostly className changes.
- **Shell:** `components/shell/{Sidebar,TopBar,StatusGrid}.tsx` — 3 files.
- **Shared application:** `components/shared/{ConfidenceBadge,CitationCard,PDFUploader,StreamingResponse,StatusPill}.tsx` + `lib/confidence.ts` — ~6 files (StatusPill new).
- **Per-demo:**
  - A1: 3 files (CompDetailPanel, CompsTable, FilterSidebar)
  - A3: ~9 files (TaskList, BlockerCenter, BlockerView, LenderPacketPanel, RFPDraftTabs, InboxMonitoringPanel, DealList, DealTimeline, PerTaskNotifications)
  - L1: ~4 files (ChatWidget, LeadInbox, ChatLeasingTabs, KeystoneMockSite)
  - L2: ~5 files (LeaseList, AbstractEditor, PushToYardiModal, DocuSignInboxPanel, WorkflowNarrative)
  - C3: 2 files (LeaseIntelligenceClient, CitationDetailPanel)
- **Routes:** 5 page.tsx files (home + 4 demos — onboarding/page already gets touched via a3 components, but page.tsx top-level needs header refresh) + 1 onboarding/blockers route.

**Total estimate: ~50 files.** Matches the prompt's 30-50 expectation.

### Confidence
- **High confidence on:** color tokens, typography swap, sidebar discipline, citation panel treatment, StatusPill consolidation, table numerics. All low-risk, high-leverage.
- **Medium confidence on:** L1 ChatWidget bubble redesign (touches the streaming logic carefully), A3 LenderPacketPanel typography (verifying it reads "memo" not "UI"), the Linear-style top loading bar.
- **Watch:** PDF viewer pane in L2 has fixed-aspect rendering; visual treatment of the pane container matters more than the iframe itself.

---

## 10. Open Questions for User Approval (revised post-pivot)

These are the decisions where a user redirect is cheap right now and expensive in Phase 2:

1. **Type families.** IBM Plex Sans + IBM Plex Mono. Sans-only throughout (no editorial serif). Plex chosen for distinctiveness over Geist + single-family, sans-only discipline. Confirm or counter.
2. **Sidebar active state.** **Soft white bg + 2px `--foreground` (charcoal) left bar + foreground text.** No brand indigo in nav.
3. **Brand indigo discipline.** Brand indigo appears in exactly two places across the app: (a) primary action button per view, (b) the `×` separator in the FlexOps AI × KFP wordmark. Nowhere else. Sidebar active uses charcoal. User bubbles in L1 use charcoal. Confirm this level of restraint.
4. **Spacing direction.** Generous, not tight. Cards `p-4` default. Page sections breathe. Tabular density preserved only where data demands it (CompsTable, TaskList, lease list). Citation panel and narrative cards get extra room. Confirm.
5. **Dark mode.** Stretch goal only. Confirm dropping it from the explicit scope of this pass.
6. **Loading treatment.** Solid muted placeholders + Linear-style 1px top progress bar (no Skeleton shimmer). Confirm.

---

## 11. Implementation Safety Plan (per "NEVER BREAK THE CODE" directive)

Given the strong user constraint that the demo must keep working, Phase 2 will be executed with these safeguards:

1. **Token-first batching.** Foundation (`globals.css` + `layout.tsx` font swap) lands in its own batch. Run `pnpm test && pnpm build` after each batch. If anything fails, isolate to the most recent batch and roll back.
2. **No component API changes.** Every prop, every event handler, every callback contract stays as-is. Visual changes are className + token changes only.
3. **No new dependencies.** Phase 2 introduces zero new runtime packages. The only addition is the IBM Plex Sans / Plex Mono fonts via `next/font/google` (same mechanism as Geist already uses).
4. **One shared StatusPill addition is the only new component.** It's purely additive (replaces inline JSX in 4 callers). The old inline JSX gets removed *after* the new component is in place and verified.
5. **Test after each demo's polish pass.** After A1 polish: run tests. After A3 polish: run tests. Same for L1, L2, C3. Faster failure detection.
6. **Smoke walkthrough before commit.** `pnpm db:reset && pnpm dev`, click every demo, simulate L2 → C3 round-trip, verify TopBar bell, exercise the BlockerCenter actions. Only commit after the walkthrough is clean.
7. **Single commit at the end, not push.** User reviews on the branch before pushing.

---

*Phase 2 implementation depends on user approval of this revised direction document. The file estimate, confidence levels, and per-demo targets above will drive the order of work if the direction is approved.*
