# L1 Website Lead Qualification: Current vs Demo Process

> Reframed 2026-05-31 per the 29-May client feedback (Keystone was building its own structured form, so the qualification engine was repositioned behind a form), and **updated 2026-06-04**: on the 4-Jun validation call Jordan reversed his earlier no on the conversational chat (he liked the chat more than he expected and could see a practical use for it), gated on cost vs. website traffic; Taylor noted it is multi-channel deployable (email signature, referral intake). So **both L1 versions are retained**: the structured form is the default shipped path, and the conversational chatbot is available via `?v=proposal`. The qualification engine (KFP fit profile + verdict rubric) is shared by both, and a match-to-available-units step enriches each lead before it reaches the Leasing team. No "chatbot declined" framing applies any longer [Validation 2026-06-04].

## Current Process (what KFP does today)

1. KFP markets vacancies via LoopNet, CoStar, Crexi, Facebook Marketplace, Apollo email outreach, physical signage at properties, and the keystoneflex.example website [Pre-discovery-KFP-initiatives, Discovery-Jordan 49:45].
2. Prospects contact the leasing team through phone, email, or the keystoneflex.example contact form (name, phone, email, message fields) [Pre-discovery-KFP-initiatives, Discovery-Jordan 49:45, 50:55].
3. Contact form submissions go to `leasing@keystoneflex.example` [Discovery-Jordan 49:45].
4. The leasing team chases leads via email or phone, asking manual qualification questions to fill the gaps the contact form leaves [Discovery-Jordan 54:14].
5. Once terms align, the leasing team forwards the LOI from the tenant to Jordan; the team responds via email or Microsoft Teams [Discovery-Jordan 54:14].
6. Speed is critical to closing leases; turnaround pressure on every lead [Discovery-Jordan 55:12].

## Demo Process (what this solution does)

1. A structured qualification form on keystoneflex.example captures the must-have fields directly: location, square footage, business type, business name, plus an open additional-criteria field. Keystone owns the form front end; this demo is the qualification backend behind it. A conversational chatbot version (reachable via `?v=proposal`) captures the same fit signals through a transcript; it was warmed to on 4-Jun and is retained as a deployable option pending the cost vs. website-traffic call [Validation 2026-06-04]. **(replaces)** Current step 2's free-text contact form, with the structured form as the default path and the chat as a retained alternative front end.
2. The qualification engine reads the structured submission through the same KFP fit profile (flex industrial categories; 500-10,000 sqft band; Marisol plus expansion markets) and verdict rubric used before, and returns a verdict, confidence, and one-sentence reasoning. The engine is unchanged; only the input framing moved from a chat transcript to the form fields. **(augments)** Current step 4's manual qualification round, now an automatic backend step rather than a back-and-forth.
3. Match-to-available-units ranks the prospect's stated need against current vacant inventory (units with no tenant) by submarket match first, then by nearest size proximity. The ranking is rent-independent because empty shells carry no in-place rent. The matched units are attached to the lead so the Leasing team sees concrete options at first glance. **(new)**
4. The enriched lead lands in the in-app Leasing Team Inbox with a verdict badge (qualified / unqualified / manual review), confidence score, reasoning, the structured five-field submission view, and the matched-units panel. Sort defaults to manual-review first, then qualified, then unqualified. **(replaces)** Current step 3's email-to-inbox flow.
5. A notification fires on every lead so the Leasing team does not miss it. **(augments)** Current step 6's speed requirement.

## Mapping

| Current Step | Demo Step | Relationship | Notes |
| --- | --- | --- | --- |
| 1 (multi-channel marketing) | n/a | out of scope | LoopNet / CoStar / signage feeds stay; demo covers the website intake only |
| 2 (prospect contact channels) | 1 (structured form, retained chat option) | replaces | The structured form is the default front end; the conversational chat is retained as a warmed-to option (`?v=proposal`) pending cost vs. traffic [Validation 2026-06-04] |
| 3 (contact form to leasing@) | 4 (lead to in-app inbox) | replaces | Demo writes directly to /api/leads |
| 4 (manual qualification round) | 2 (qualification engine) | augments | The engine qualifies the structured fields automatically |
| 5 (LOI email thread) | n/a | out of scope | Negotiation stays in email / Teams |
| 6 (speed pressure) | 5 (notification) | augments | Faster human response; the lead never sits |
| new: unit matching | 3 (match-to-available-units) | new | Each lead carries the matched vacant units the Leasing team can offer |
| new: verdict triage | 4 (verdict + sort) | new | The inbox is no longer a flat list; reviewers see decision-relevant items first |

## What the demo does NOT cover

- The form UI and chat front end in production (Keystone builds and hosts its own; this demo provides the qualification backend, a representative form, and a retained chat version for the walkthrough).
- The cost vs. website-traffic decision on the conversational chat, and the multi-channel surfaces Taylor noted (email signature, referral intake): both retained but not yet productionized [Validation 2026-06-04].
- Production website integration (the representative form and chat live only inside the demo tab).
- Real CRM integration (the in-app inbox is the destination).
- Voice callback fulfillment (the inbox captures the preference; no automated call is placed).
- Tour scheduling (captured as a visit time; no calendar integration).
- LOI negotiation thread automation (email / Teams stay primary).
- A live availability feed (the matcher reads the seeded inventory; production needs the real unit-availability source).
