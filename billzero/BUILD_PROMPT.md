# BillZero: Build Brief for an Autonomous Agent

> Paste this whole document into the agent as its task. It is written to the agent.

---

## 0. Who you are and what you're building

You are the founding engineer, product designer, and product lead for **BillZero**. You will build it end to end: research, the data pipeline, backend, frontend, design, motion, tests, and deployment. I'm the founder. I own every account, all money, all legal decisions, and anything that needs my identity. You have a computer with a browser and a terminal. Work on your own, and ask me only for the things listed in §15.

**The product in one line:** *"Your hospital bill might legally be $0."* BillZero reads a patient's hospital bill, works out whether the hospital is legally required to offer free or discounted care, checks whether the patient qualifies, fills out and sends the hospital's own financial-assistance application, follows up until there's a decision, and recovers refunds of money the patient already paid. We charge a fee only when we save the patient money.

**Two non-negotiable quality bars:**
1. **It has to look and feel like Apple designed and built it.** That means premium, restrained, precise, and physical, with a considered animation on every interaction (§5–§6).
2. **It has to actually work.** It's not a demo. A real person with a real bill from a real US hospital must be able to go from photo to submitted application in under 5 minutes, and the application must be correct (§14).

---

## 1. Operating rules (read twice)

1. **Truth over speed.** Every legal or regulatory claim in code, data, or user-facing copy must trace back to a primary source: eCFR, irs.gov, cms.gov, hhs.gov, a state legislature or agency site, or the hospital's own published policy. Log each one in `docs/sources.md` with the URL, the date you retrieved it, and the exact quoted text. If you can't verify something, mark it `UNVERIFIED` and keep it out of user-facing copy.
2. **Never contact a real third party** (hospital, collection agency, government office, company) and never send a real fax, letter, or email to anyone without my explicit written approval for that specific case. Every outbound channel defaults to sandbox/mock mode in every environment except production, and production sending sits behind a feature flag I turn on.
3. **Never create accounts, accept terms of service, spend money, solve CAPTCHAs, or enter my personal information.** Ask me (§15). You *may* freely browse public websites, read docs, and download public datasets.
4. **Never put real patient data** in fixtures, tests, prompts, logs, screenshots, commits, or analytics. Generate realistic synthetic data. If I hand you a real bill for testing, keep it out of git, logs, and third-party tools (except the production pipeline it's meant to go through), and delete it afterward.
5. **Don't sit idle.** When you're waiting on me, put the dependency behind an interface, build a mock implementation, and keep going. Batch your requests to me (§15).
6. **Keep four files current at the repo root:**
   - `PROGRESS.md`: what's done, what's next, preview URLs, known issues.
   - `DECISIONS.md`: for each decision, the options, the choice, and why (short ADRs).
   - `HUMAN_TASKS.md`: my checklist (format in §15).
   - `docs/sources.md`: the citation log.
7. **Git hygiene.** Make small conventional commits on feature branches and merge to `main` through PRs you describe clearly. CI (typecheck, lint, unit, e2e, a11y, Lighthouse) must be green before a merge.
8. **Check your work visually.** After building or changing a screen, run it in a real browser with Playwright. Screenshot it in light and dark mode at 390×844 and 1440×900, look at the screenshots, and fix anything that isn't Apple-grade before moving on (checklist in §12).
9. **Honest UX.** Never promise an outcome. Say "likely", show the reasoning, and quote the hospital's own policy. Never help or nudge a user to misstate income, household, assets, or residency. Every attestation the user signs must be true to their knowledge.
10. **Respect websites you crawl.** Follow robots.txt, rate-limit to one request per second per host, identify as `BillZeroBot/1.0 (+https://<our-domain>/bot)`, and cache everything.

---

## 2. The product

### 2.1 The problem
- Nonprofit hospitals (most US community hospitals) are required by federal law (IRC §501(r)) to have a Financial Assistance Policy (FAP) offering free or discounted care. Many cover households well above the poverty line, sometimes up to 300–400% of it.
- Patients can usually apply up to 240 days after the first bill. If they qualify, the hospital must refund what they overpaid and reverse collection actions.
- Hardly anyone applies. The policy is buried, the forms are confusing, and nobody tells patients.
- Several states impose their own charity-care rules, some of which also apply to for-profit hospitals.
- Separately, itemized bills often contain errors such as duplicate charges, unbundled codes, and impossible quantities.

### 2.2 The golden path (target: under 5 minutes of the user's time)
1. **Scan**: the user snaps or uploads the bill (one or more pages; photo, PDF, or screenshot).
2. **Read**: we extract everything, classify the document (bill, insurance EOB, collections letter, and so on), and the user confirms the key fields.
3. **Identify**: we match the hospital facility and determine whether it's a nonprofit, government, or for-profit facility. We also check whether this bill comes from the hospital itself or from a separate provider group such as ER physicians, anesthesia, or radiology.
4. **Ask**: a few beautiful one-question screens covering household, income, insurance, and state, plus assets only if this hospital's policy considers them.
5. **Reveal**: "You likely qualify for free care", or "about 70% off", or "here are your other options". Each result comes with plain-English reasons and a quote from the hospital's own policy.
6. **Apply**: we fill the hospital's actual application form, list exactly which proof documents are needed (and let the user upload them by photo), and collect an on-screen signature.
7. **Send**: by fax, certified mail, email, or guided portal steps, together with a letter asking the hospital to pause collections while the application is pending.
8. **Track**: a timeline, deadline countdown, automatic follow-ups, handling of incoming responses, appeals, and refund recovery.
9. **Fee**: charged only after a written decision is verified (§8.10).

### 2.3 Secondary features
- **Itemized bill audit** (§8.7) for anyone, eligible or not.
- **Alternatives** when the user isn't eligible (§8.8).
- **Quick Check**: a public eligibility estimate with no account needed (§8.11). This is the main growth hook.
- **Hospital pages**: one SEO page per US hospital (§8.11).

### 2.4 Users
- Uninsured and underinsured US patients with a hospital bill, roughly up to 400% of the federal poverty level.
- Adult children helping a parent: support "I'm helping someone else" with a proper authorization flow.

### 2.5 Business model
- **15% of verified savings, capped at $1,000 per case.**
- **Free** when household income is at or below 200% of the federal poverty level.
- **$0** when nothing is saved.
- **Savings** = patient balance before − patient balance after, plus refunds actually received. Money insurance would have paid anyway doesn't count.
- The card is collected at submission with a plain-English disclosure ("You'll only be charged if your bill goes down. We'll show you the math first.") and charged off-session only after an admin verifies the written decision. The user sees the calculation before the charge and can dispute it.
- Keep the schema ready for a future B2B employee benefit (`organizations` and seats), but build no B2B UI.

---

## 3. Regulatory foundation (research, verify, encode)

Start from these facts. **Verify each against primary sources and cite it** before encoding anything:

**A. IRC §501(r) and Treasury Regulations 26 CFR §1.501(r)-1 through -7.** These apply to each hospital facility operated by a 501(c)(3) organization.
- Each facility must have a written FAP covering:
  - eligibility criteria
  - the basis for calculating amounts charged
  - how to apply
  - a list of the providers delivering care in the facility, saying which ones are and aren't covered by the FAP. This is crucial: separately billing physician groups are often not covered.
- The FAP, the application, and a plain-language summary must be widely available on the hospital's website, and paper copies must be free on request.
- For emergency and other medically necessary care, FAP-eligible patients can't be charged more than the Amounts Generally Billed (AGB) to insured patients.
- **Extraordinary collection actions** (ECAs) include credit reporting, selling the debt, lawsuits, liens, wage garnishment, and deferring care over unpaid bills. They aren't allowed until the hospital has made reasonable efforts to determine eligibility.
- The **notification period** is 120 days from the first post-discharge billing statement. The **application period** ends no earlier than **240 days** after the first post-discharge billing statement.
- When a **complete** application arrives during the application period, the hospital must suspend ECAs, make and communicate a decision in writing, and, if the patient is eligible, issue a corrected bill, **refund amounts paid in excess** (subject to a de minimis threshold; verify the amount), and reverse ECAs. When an application is **incomplete**, the hospital must say in writing what's missing and allow reasonable time to supply it.
- Presumptive eligibility is permitted. Many hospitals presume eligibility for people on Medicaid, SNAP, or WIC, or who are homeless. Capture this from each policy.

**B. IRS Form 990 Schedule H, Part V, Section B** (filed per facility or facility group). Verify the line numbers against the current form.
- **Line 13**: the FPG income limits for free care and for discounted care, as percentages.
- **Line 16**: URLs for the FAP, the FAP application, and the plain-language summary.
- This is the seed for our policy database (§8.3).

**C. State laws** (some cover for-profit hospitals too). Research all 50 states plus DC. Start with CA, WA, CO, NY, IL, MD, NJ, OR, NV, CT, MN, ME, and MA. For each state, record: who's covered, income thresholds, screening requirements, application rules and deadlines, collection limits, and citations. Store this as versioned data (`state_rules`), not as hard-coded logic.

**D. No Surprises Act, uninsured and self-pay patients.** These patients are entitled to a Good Faith Estimate (GFE). If the bill is $400 or more above the GFE, they can start the federal patient-provider dispute resolution process within 120 days of receiving the bill. Verify the fee and the process.

**E. Medicaid retroactive eligibility.** Historically this covered up to 3 months before the application month. Federal law passed in 2025 changes it starting in 2027. Verify the current rules and the effective dates.

**F. HIPAA.**
- **Right of access**, 45 CFR §164.524: patients can request their billing records, including the itemized bill, and the hospital generally must respond within 30 days.
- **Authorization**, 45 CFR §164.508: needed so the hospital can talk to BillZero on the patient's behalf.
- Determine and document whether BillZero is a covered entity or business associate. As a consumer-directed app it likely isn't, but the FTC rules below then apply.

**G. Hospital price transparency, 45 CFR Part 180.** Machine-readable files of standard charges and discounted cash prices. We use them for audit comparisons.

**H. Privacy.**
- The FTC Health Breach Notification Rule (16 CFR Part 318).
- FTC Act §5 enforcement (the GoodRx and BetterHelp cases). That means **no advertising pixels or third-party trackers on any authenticated or health-related page, ever.**
- Washington's My Health My Data Act, plus the Nevada and Connecticut consumer health data laws.
- CCPA/CPRA.

**I. E-signatures.** ESIGN and UETA. Some hospitals require a wet signature, so support a printable packet and mail it for the user.

**J. Our own fee model.** State debt-settlement, debt-adjuster, or debt-relief licensing rules may apply. Also check the FTC Telemarketing Sales Rule's advance-fee rules and unauthorized-practice-of-law concerns. **Don't decide these yourself.** Write `docs/legal-questions.md` as a precise question list for my lawyer, with your research attached.

**K. HHS Poverty Guidelines.** Store every year from 2023 to the present, with separate tables for the 48 contiguous states, Alaska, and Hawaii. Policies differ on whether they use the guideline in effect on the date of service or on the application date, so store that per policy.

---

## 4. Platform and tech stack

Use these defaults. Record them in `DECISIONS.md` and deviate only with a written reason.

- **Platform.** A mobile-first web app, installable as a PWA (iOS home screen, web push). One codebase holds the marketing site, the app, and the admin console. Native iOS (SwiftUI) is a later phase and needs my approval.
- **Framework.** Next.js (latest stable, App Router, React Server Components), TypeScript strict mode, Node 22 LTS, pnpm.
- **Styling.** Tailwind CSS v4 driven by CSS-variable tokens (§5). No off-the-shelf component kit "look": build your own components on Radix UI or React Aria primitives so accessibility comes built in.
- **Motion.** Motion (`motion/react`) for all animation. `vaul` for iOS-style sheets. `@number-flow/react` for animated numbers. `perfect-freehand` for signature ink. Custom toasts, or a heavily restyled `sonner`.
- **Backend.** Supabase: Postgres, Auth (email one-time code, Sign in with Apple, Google), Storage, and Realtime. Row-level security on **every** table. Drizzle ORM with migrations checked in. Develop locally with the Supabase CLI.
- **Jobs.** Inngest for durable workflows: extraction jobs, multi-day follow-ups with sleeps, reminders, scheduled ETL.
- **AI.** The Anthropic TypeScript SDK `@anthropic-ai/sdk` (details in §9).
- **Documents.**
  - `pdfjs-dist` to render PDFs and extract their text.
  - `pdf-lib` to fill AcroForm fields, draw text overlays, and merge packets.
  - `@react-pdf/renderer` to generate letters.
  - `heic2any` for iPhone HEIC photos.
  - `jscanify` + OpenCV.js, lazy-loaded, for live document edge detection.
- **Outbound and inbound mail.**
  - **Fax:** a provider that will sign a BAA and offers inbound numbers. Evaluate Documo, Sinch (Phaxio), and Telnyx, then recommend one in `DECISIONS.md`.
  - **Postal mail:** Lob, for certified mail with tracking and for address verification.
  - **Email:** Resend. Email bodies never contain PHI, only "You have an update" plus a link.
- **Payments.** Stripe: a SetupIntent at submission and an off-session PaymentIntent after the decision. Apple Pay and Google Pay through the Payment Element.
- **Operations.**
  - Upstash Redis for rate limiting.
  - Sentry with PHI scrubbing (`beforeSend` scrubbers plus an allowlist).
  - PostHog with explicitly defined events only: no autocapture, no session replay on app pages, never PHI.
  - Vercel hosting with a preview deploy per PR.
- **Testing.** Vitest, Playwright, axe-core, Lighthouse CI.
- **ETL.** Large-XML ETL may be written in Python if that's clearly better. Keep it in `/data-pipeline` with its own README and Makefile.

**Suggested repo layout:**
```
/app            (marketing)/  (app)/  (admin)/  api/
/components     ui/ (primitives)  motion/ (motion primitives)  domain/
/lib            ai/  eligibility/  documents/  outbound/  billing/  db/  security/
/inngest        functions/
/data-pipeline  hospitals/  irs990/  policies/  fpl/  state-rules/  ncci/
/tests          unit/  e2e/  fixtures/synthetic-bills/  evals/
/docs           sources.md  legal-questions.md  design-system.md  motion.md  runbooks/
```

---

## 5. Design system ("Apple-grade")

### 5.1 Principles
- **Clarity, deference, depth** (Apple's Human Interface Guidelines). Content first, chrome second.
- **One accent tint** in the app. Generous whitespace. Every element sits on the grid.
- No decoration that doesn't carry meaning: no random gradients, glows, or emoji in the UI.
- **Physical**: things have mass, follow springs, and respond to the finger.
- **Calm about money and medicine.** Users are stressed. The UI should feel like a competent friend: no red alarms and no dark patterns.
- **Legal boundary: Apple-like quality, our own identity.** Do **not** use SF Pro font files, SF Symbols, Apple logos, Apple device-frame artwork you don't have rights to, or anything that suggests Apple endorses us.

### 5.2 Tokens (define as CSS variables, with light and dark values)

**Color, light mode:**
- Background `#FFFFFF`; grouped background `#F2F2F7`; secondary surface `#F5F5F7`; elevated card `#FFFFFF`.
- Text: primary `#1D1D1F`, secondary `#6E6E73`, tertiary `#86868B`, quaternary `#C7C7CC`.
- Separator `rgba(60,60,67,0.18)`.
- **Tint (brand green, "paid in full") `#00804A`**: buttons, links, success, money. Verify ≥4.5:1 contrast with white.
- Tint soft `rgba(0,128,74,0.10)`.
- Warning `#C25E00` (text) and `#FF9F0A` (fills). Destructive `#D70015` (text) and `#FF3B30` (fills). Info `#0071E3`, used sparingly.

**Color, dark mode:**
- Background `#000000`; grouped background `#000000`; secondary surface `#1C1C1E`; elevated `#1C1C1E` → `#2C2C2E`.
- Text: primary `#F5F5F7`, secondary `rgba(235,235,245,0.60)`, tertiary `rgba(235,235,245,0.30)`.
- Separator `rgba(84,84,88,0.45)`.
- Tint `#30D158`, with black text on tint fills.
- Run a contrast validator script in CI over every text/background token pair.

**Typography:**
- Font stack: `-apple-system, BlinkMacSystemFont, "Inter Variable", "Inter", system-ui, sans-serif`. This shows the system font on Apple devices; self-host Inter (OFL license) as the fallback everywhere else. Use Inter Display optical sizing at 20px and above if available.
- Use `font-variant-numeric: tabular-nums` for **all money and dates**.

| Style | Size/line-height (px) | Weight |
|---|---|---|
| Large Title | 34/41 | 700 |
| Title 1 | 28/34 | 700 |
| Title 2 | 22/28 | 700 |
| Title 3 | 20/25 | 600 |
| Headline | 17/22 | 600 |
| Body | 17/22 | 400 |
| Callout | 16/21 | 400 |
| Subhead | 15/20 | 400 |
| Footnote | 13/18 | 400 |
| Caption 1 | 12/16 | 400 |
| Caption 2 | 11/13 | 500 |

- Letter-spacing: Body −0.01em; large titles −0.02em. Marketing display sizes run 48/56/80/96px at weight 700 with −0.025em tracking.
- Respect the user's browser font-size setting: use rem units, and layouts must survive 200% zoom.

**Layout:**
- **Spacing:** a 4pt grid (4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96).
- **Page margins:** 16px on mobile, 20px at ≥390px, 32px on tablet. App content max width 680px; on ≥1024px, add an iPadOS-style sidebar. Marketing grid 980px, with wide sections at 1200px.
- **Minimum hit target:** 44×44px.
- **Radii:** 8 for small controls, 12 for buttons and fields, 16 for list groups, 22 for cards, 28 for sheets, full for pills. Where supported, add the CSS `corner-shape: squircle` progressive enhancement for continuous corners.
- **Elevation, light mode:**
  - e1 `0 1px 2px rgba(0,0,0,.04), 0 1px 1px rgba(0,0,0,.03)`
  - e2 `0 6px 16px rgba(0,0,0,.06)`
  - e3 (sheets/popovers) `0 18px 48px rgba(0,0,0,.14)`
- **Elevation, dark mode:** no shadows. Use lighter surfaces plus a 1px hairline `rgba(255,255,255,.08)`.
- **Materials:**
  - Thin: `rgba(255,255,255,.72)` + `backdrop-filter: saturate(180%) blur(20px)`; dark `rgba(28,28,30,.72)`.
  - Thick: 0.86 alpha.
  - Use materials for nav bars, tab bars, sheets, and toasts.
- **Icons:** Lucide (ISC license) at 1.75 stroke, sized 17/20/24, optically aligned to text. One icon family only.

### 5.3 Components (build each with every state: default, hover on pointer devices only, pressed, focus-visible, disabled, loading, error)
- Button (filled, tinted, gray, plain, destructive; sizes S/M/L; icon-only)
- Text field, currency field, date field, search field, OTP code field
- Toggle, segmented control, stepper, slider, checkbox, radio
- Grouped inset list (iOS Settings style) with rows: value, chevron, toggle, subtitle, badge, swipe actions
- Card, hero card, stat tile, progress ring, deadline ring, FPL gauge
- Navigation bar with large title that collapses to inline on scroll, tab bar, sidebar
- Sheet (vaul, with snap points), alert dialog, action sheet, popover, tooltip, toast, banner
- Page indicator dots, skeleton, empty state, error state, offline banner
- Timeline, document thumbnail stack, PDF page viewer, signature pad, camera viewfinder, crop editor
- Hospital card, eligibility result card, savings counter, share card

Build a hidden `/lab` route that showcases every component and every animation, in every state, in both themes. This is your living design system and visual-regression target.

### 5.4 Layout patterns
- The app uses iOS conventions: large titles, grouped inset lists, sheets for sub-tasks, full-screen flows for scan and apply, and a bottom tab bar on mobile.
- **Tabs:** Home, Cases, Savings, Account. "Scan a bill" is the hero action on Home and a `+` button in the nav bar.
- Question flows show one question per screen: big type, a single primary button pinned above the keyboard or safe area, and progress dots.
- Handle safe areas (`env(safe-area-inset-*)`), use `100dvh`, use `overscroll-behavior` to stop accidental pull-to-refresh, and keep the keyboard from covering inputs.

### 5.5 Voice and microcopy
Write short, warm, confident sentences. Use second person. Avoid jargon; when a legal term is necessary, define it inline.
- "Scan your bill." / "We found something." / "You likely owe nothing." / "Here's why." / "Sent. We'll take it from here." / "Your hospital has 30 days to respond. We'll remind them."
- Never: "Guaranteed", "Free money", or "Beat the hospital". Never shame or alarm the user.
- Disclaimers go in readable footnote style, never hidden: "BillZero isn't a law firm and doesn't give legal advice."

### 5.6 Brand assets (make them yourself as SVG)
- **Wordmark:** "BillZero", with the "0" drawn as a perfect ring.
- **App icon:** the ring "0" on a deep-green-to-tint gradient squircle. Export a full PWA icon set, a maskable icon, Apple touch icons, and a favicon.
- **Open Graph template** (via `@vercel/og`) and an iOS PWA splash screen set.

---

## 6. Motion system ("animations for every trigger")

### 6.1 Tokens (put them in `lib/motion.ts` and document them in `docs/motion.md`)
- **Springs:**
  - `snappy` = `{ type: "spring", visualDuration: 0.25, bounce: 0.15 }` for presses, toggles, small UI.
  - `smooth` = `{ type: "spring", visualDuration: 0.4, bounce: 0 }` for navigation, sheets, layout.
  - `gentle` = `{ type: "spring", visualDuration: 0.6, bounce: 0.1 }` for large surfaces.
  - `bouncy` = `{ type: "spring", visualDuration: 0.5, bounce: 0.3 }` for celebrations and badges **only**.
- **Easing** (opacity and color only): standard `cubic-bezier(0.25,0.1,0.25,1)`, out `cubic-bezier(0.22,1,0.36,1)`.
- **Durations:** press 100ms, fades 150–200ms, navigation 300–450ms, hero and celebration moments 600–1200ms (these are the only exceptions).
- **Stagger:** 30–50ms per item, with the total capped at 300ms.

### 6.2 Rules
1. Animate only `transform`, `opacity`, `filter`, and `clip-path`, plus Motion layout animations. Never animate `top`, `left`, `width`, or `height` directly.
2. Every animation is **interruptible** (springs carry velocity). Nothing blocks input except an in-flight submit.
3. Exits run at about 70% of the enter duration.
4. **Reduced motion** (`prefers-reduced-motion`): replace movement with ≤150ms crossfades; no parallax, no looping animations, no particles; numbers jump straight to their final value. Test this mode explicitly.
5. Hold 60fps on a mid-range Android phone. Verify with Chrome DevTools CPU 4× throttling, and record traces for the scan, reveal, and submit moments.
6. Progress animations reflect **real** job progress events, never fake timers.
7. Haptics: `navigator.vibrate(8–12)` where supported (Android). On iOS it silently does nothing. Wrap it in `haptic(kind)`.

### 6.3 Animation inventory (implement every row and showcase it in `/lab`)

| # | Trigger | Animation |
|---|---|---|
| **Global** |||
| 1 | PWA cold start | The ring "0" draws itself (stroke 0→100%, 500ms). It then scales 1→0.92 and fades while Home content rises 12px and fades in. Skipped on warm starts. |
| 2 | Navigate deeper (push) | Incoming page slides from 100%→0 X (`smooth`); outgoing page moves to −25% X under a 0→8% dim. Back reverses this. On mobile, an edge-swipe-back gesture tracks the finger and completes past 35% width or at >500px/s. |
| 3 | Tab switch | Content crossfades with a 4px rise (150ms); the tab icon pops 0.85→1 (`bouncy`); the label color tints. |
| 4 | Scroll under nav | The large title shrinks into the inline title over 0–52px of scroll; the nav-bar material and hairline fade in after 0px. |
| 5 | Sheet open/close | Background scales to 0.94, gains a 12px radius, and dims; the sheet springs up (`smooth`). Drag-to-dismiss uses velocity and rubber-bands past the top; snap points where relevant. |
| 6 | Alert dialog | Dialog scales 1.08→1 and fades (200ms); backdrop fades. |
| 7 | Pull to refresh (Cases) | Spinner arcs grow with pull distance; releasing spins it; content springs back. |
| 8 | Loading | Skeleton shimmer (1.2s loop); static under reduced motion. |
| 9 | Theme change | View Transitions API crossfade, 250ms. |
| **Controls** |||
| 10 | Button press | Scale 0.97 with brightness 0.95 (100ms); release with `snappy`. Hover (pointer devices only): background +4% tint. |
| 11 | Async button | Label crossfades to a spinner and the button width morphs to a pill (layout animation). On success, the spinner morphs into a drawn checkmark (300ms), then the app navigates or the button restores. |
| 12 | Disabled → enabled | Opacity 0.4→1 with a color crossfade, 200ms. |
| 13 | Field focus | Ring and border fade in over 150ms; the floating label moves up and shrinks. |
| 14 | Validation error | The field shakes on X `[0,-8,8,-6,6,-3,3,0]` over 400ms (iOS password shake); error text expands in with a fade; light haptic. |
| 15 | Toggle | iOS-style knob that stretches 28→34px while pressed; `snappy` travel; the track tint crossfades. |
| 16 | Segmented control | The selected thumb slides via `layoutId` (`smooth`); labels crossfade weight. |
| 17 | Stepper (household size) | The digit rolls vertically (NumberFlow); +/− buttons respond to presses. |
| 18 | Income entry | The FPL gauge arc springs to the new percentage, its color moves green→amber→gray across the policy thresholds, and a tick haptic fires on crossing a threshold. |
| 19 | Checkbox/radio | The check path draws in 200ms; the ring fill scales in. |
| 20 | List row tap | The highlight appears instantly and fades out over 300ms; the chevron nudges 2px. |
| 21 | Swipe row actions | Actions reveal with resistance; a full swipe triggers the action with a haptic and the row collapses its height. |
| 22 | Popover/tooltip | Scales 0.96→1 and fades from its anchor point, 150ms. |
| 23 | Copy to clipboard | The icon morphs into a check and a toast says "Copied". |
| **Capture** |||
| 24 | Open camera | Full-screen flow rises; the viewfinder fades in; four corner brackets fly in from 20px outside, staggered 40ms. |
| 25 | Live edge detection | The detected quad appears as a tint outline with a 15% fill. Corners are smoothed (lerp) frame to frame. After 800ms of stability, a ring around the shutter fills to auto-capture; movement cancels it. |
| 26 | Capture | 80ms white flash; shutter press. The captured photo un-warps into a flat rectangle, then shrinks and flies into the page-stack thumbnail (bottom-left), whose count badge pops. |
| 27 | Manual crop | Corner handles show a magnifier loupe while dragging; released handles snap to edges. |
| 28 | Desktop drag-and-drop | The drop zone scales to 1.02 and its dashed border animates (marching ants); on drop, file chips stagger in. |
| 29 | Upload progress | A progress ring completes into a checkmark. |
| **Processing** |||
| 30 | Reading the bill | The page sits centered while a soft tint light band sweeps over it; text regions highlight as real extraction events arrive. |
| 31 | Field extracted | A chip lifts off the field's real location on the page (shared layout) and flies into its slot in the review form. This is the signature moment, so make it perfect. |
| 32 | Step checklist | "Reading your bill → Finding your hospital → Checking nonprofit status → Loading their assistance policy". Each spinner morphs into a check and the next row slides in. |
| 33 | Low-confidence field | Amber underline with one gentle pulse; tapping it zooms into the cropped source snippet. |
| **Results** |||
| 34 | Hospital matched | The card scales in from 0.96; a "Nonprofit hospital" badge stamps in (scale 1.3→1, rotate −6°→0, `bouncy`). |
| 35 | Eligible for free care | The original amount shows large. After 400ms, a strike line draws through it and the number counts down to **$0** with an odometer roll (~1.2s, ease-out). Then a soft green radial glow pulses, a subtle particle burst plays (12–20 particles, 700ms), and a haptic fires. The headline reveals word by word (40ms stagger). |
| 36 | Partial discount | Same sequence, counting to the discounted amount, followed by a "73% off" pill that pops in. |
| 37 | Not eligible | Calm: the headline fades in and alternative-option cards stagger up. No red, no shake. |
| 38 | "Why?" expand | Height animates with a spring as content fades in; the quoted policy sentence gets a highlighter sweep. |
| **Apply and send** |||
| 39 | Application preview | Pages fan in as a stack (±2° rotation, offset); tapping a page zooms it full-screen (shared layout). |
| 40 | Autofill | Each filled field flashes a tint highlight in sequence (20ms per field, 1s cap). |
| 41 | Signature | Ink rendered smoothly with perfect-freehand. "Clear" wipes the ink away left to right; "Adopt" shrinks the signature into its field on the document. |
| 42 | Proof checklist | Rows check off as documents are uploaded; a segmented progress bar fills. |
| 43 | Submit | Button → progress pill → checkmark, Apple Pay style. Then the packet folds into an envelope and slides away (mail) or streaks out as light (fax), 900ms max, and the timeline appears. |
| 44 | Payment method | Sheet with the Payment Element and Apple Pay/Google Pay; success shows a checkmark. |
| **Tracking** |||
| 45 | Case timeline | The connector line draws down to the current step; the current node pulses (2s loop; none under reduced motion); new events slide in and push the rest down. |
| 46 | Deadline ring | Depletes with the days remaining and turns amber at ≤30 days. |
| 47 | Live status update | A pill at the top expands into a banner (Dynamic Island feel), then collapses. |
| 48 | Decision approved | Row 35's sequence, larger, plus "You saved $X". The share CTA slides up. |
| **Savings and share** |||
| 49 | Savings dashboard | The total counts up when it scrolls into view (once per session); bars grow with a stagger. |
| 50 | Share card | The card assembles itself (the amount flips in, the bill icon crossfades to the 0 ring), then the Web Share sheet opens; falls back to a download. |
| **Marketing** |||
| 51 | Hero | Headline lines rise through a mask (60ms stagger). A photoreal SVG/CSS paper bill floats with gentle parallax. As the page scrolls, its "Balance due" amount rolls down to $0.00. |
| 52 | How it works | A pinned (sticky) section; the phone mockup's screens swap in step with scroll progress (scroll-linked via `useScroll`). |
| 53 | Stats | Counters count up when in view. |
| 54 | Hospital search | Results stagger in; the selected hospital card expands into the Quick Check form (shared layout). |
| 55 | FAQ | Accordion height animates with a spring; the chevron rotates. |
| **System feedback** |||
| 56 | Toast | Slides from the top on mobile (above content) or from the bottom-right on desktop; swipe to dismiss; auto-dismisses after 3s. |
| 57 | Offline | A thin banner slides down; the retry action pulses once. |
| 58 | Error state | The icon shakes gently once; a retry button is offered. |
| 59 | Empty state | The illustration fades in and floats 4px on a slow loop (6s); static under reduced motion. |
| 60 | Notification permission primer | A custom pre-prompt card rises *before* the OS prompt, explaining the value. |

---

## 7. Screens and states

Every screen needs loading, empty, error, offline, and partial-data states, designed rather than left as defaults.

### 7.1 Public (marketing)
- **`/` Home:**
  - Hero ("Your hospital bill might legally be $0.")
  - How it works (pinned scroll story)
  - "Is my hospital nonprofit?" search
  - Who qualifies (an interactive FPL table: "Family of 4 earning up to $___")
  - Pricing ("15%, only if we save you money. Free under 200% of the poverty line.")
  - Security and privacy, FAQ, footer with legal links
  - Testimonials appear only once real ones exist. **Never fabricate testimonials or stats.**
- **`/check` Quick Check:** no account needed. Hospital search → household size → yearly income → result card ("At [Hospital], families of 3 earning under $X typically get free care. You're likely eligible.") → CTA to scan the bill. Collecting an email is optional.
- **`/hospitals`**: search plus a state index. **`/hospitals/[state]/[slug]`**: one page per hospital (§8.11).
- `/pricing`, `/how-it-works`, `/security`, `/privacy`, `/terms`, `/about`, `/help` (articles), `/bot` (crawler info).

### 7.2 App (signed in)
- **Onboarding:** a welcome screen of at most 3 cards; sign-in (Apple, Google, email code); an "I'm helping someone else" toggle; a notifications primer.
- **Home:** greeting; "Scan a bill" hero card; active cases with status pills and deadline rings; total saved.
- **Scan** (full-screen): camera with auto-capture; upload (photo, PDF, screenshot); multiple pages; crop and reorder; "Add page / Done".
- **Processing:** row 30–32 animations, driven by real job events over Realtime.
- **Review details:** a grouped inset list of the extracted fields, each editable, with low-confidence fields flagged. Document type detection catches non-bills, e.g. "This looks like an insurance EOB, not a bill. Do you have the bill from the hospital?"
- **Hospital confirmation:** the matched facility card (name, address, ownership, nonprofit status with its source); "Not your hospital?" search.
- **Separate-provider notice:** if the bill comes from a physician or other group, explain whether the hospital's FAP covers them (from the FAP's provider list) and what to do if not.
- **Eligibility questions,** one per screen:
  - household members (with the policy's definition shown)
  - income sources, amounts, and frequency, with an "Auto-fill from a pay stub, W-2, or tax return" photo option
  - assets, only if the policy requires them
  - insurance status
  - state of residence and service-area check
  - public benefits, for presumptive eligibility
  - date of service, if it wasn't extracted
- **Result:** rows 35–38; reasons; the policy quote with a link to the source PDF and page; deadline; next step.
- **Apply:**
  - preview of the filled form
  - missing-info questions
  - required-documents checklist with photo upload
  - signature
  - review and consent: HIPAA authorization, fee disclosure, attestations
  - delivery method
  - submit
- **Case detail:**
  - timeline, deadline ring, documents (sent and received), next actions
  - "Upload a letter you received" (classified by AI, then the case is updated)
  - mark a refund received; request an appeal; notes
- **Itemized audit:** request the itemized bill (a generated letter citing the HIPAA right of access), upload it, review findings, generate a dispute letter.
- **Savings:** total saved, cases, fee receipts, share card.
- **Account:** profile, household (reused across cases), payment method, notifications, people I'm helping (with authorizations), data export, account deletion (a real hard delete), help, legal.

### 7.3 Admin (role-gated, 2FA required, every access audit-logged)
- **Case review queue:** approve, edit, or reject every outbound packet before it's sent (human-in-the-loop for v1); verify decisions before charging.
- **Hospital DB editor:** facilities, systems, EIN links, ownership, contacts, fax numbers, mailing addresses.
- **Policy review:** each policy version side by side with its source PDF, the extracted fields with their verbatim quotes, and an approve-or-correct action.
- **Form mapper:** map a hospital's application PDF to our schema. For AcroForms this is automatic with review; for flat PDFs, place fields by dragging boxes on the page, with AI proposals.
- **ETL runs and coverage dashboard**, metrics, user lookup (audited), feature flags (including `outbound.production.enabled`).

---

## 8. Core engines (this is where "it actually works" lives)

### 8.1 Bill capture and extraction
- Client side:
  - Convert HEIC; correct perspective and de-skew.
  - Compress to a sensible resolution while keeping the text legible.
  - Show the page-stack thumbnail.
  - Upload to private Storage under an encrypted path.
- Server side (an Inngest job):
  1. **Classify** the document: hospital statement, itemized bill, insurance EOB, collections letter, FAP decision letter, missing-info letter, Medicaid notice, or other.
  2. **Extract** to a strict schema:
     - Provider: billing entity name, facility name, address, phone, fax, website, NPI, and tax ID if printed.
     - Patient and guarantor names, account number, statement date, first-statement date if shown, service dates, encounter type (ER, inpatient, outpatient, clinic).
     - Amounts: total charges, insurance paid, adjustments, patient payments, balance due. Due date.
     - Insurance, if any; collection agency, if any.
     - Line items: date, code and code type (CPT, HCPCS, revenue code, NDC), description, quantity, unit price, total.
     - Any "financial assistance available" text.
     - **Per-field confidence plus the page number and bounding box of the source**, which drives rows 31 and 33.
  3. **Validate arithmetic:** line items should sum to the total, and charges − payments − adjustments should equal the balance. On a mismatch, mark the fields as low-confidence.
  4. Push progress events to the UI.
- Multi-page and multi-document cases: merge statements for the same account; detect duplicates.

### 8.2 Hospital identification and nonprofit status
- **Master facility table:** load the CMS Provider Data Catalog "Hospital General Information" dataset (facility ID/CCN, name, address, type, ownership such as "Voluntary non-profit – Private/Church/Other", "Government – …", or "Proprietary", and emergency services). Also use CMS Provider of Services files where they help.
- **Nonprofit verification:** the IRS Exempt Organizations Business Master File (EO BMF), including subsection 03 and the hospital foundation code, plus a 990 Schedule H filing. Link each facility to its filer EIN using Schedule H Part V Section A facility listings and fuzzy name/address matching. Store match confidence; low-confidence matches go to admin review.
- **Bill → facility matching:** fuzzy-match on extracted name, address, and phone, with a geographic tiebreak. Also index health-system names ("billed by X Health System for Y Medical Center").
- Record **why** we believe each facility is a nonprofit, citing the dataset row, EIN, and 990 tax year. Show it on the hospital card.

### 8.3 Policy database pipeline (the moat)
1. **Ingest 990 e-file data.** The IRS publishes Form 990 series XML in bulk; ProPublica's Nonprofit Explorer API is useful for metadata. Stream-parse it, keep only filings with Schedule H, and extract per facility (or facility group):
   - free-care and discounted-care FPG percentages (Part V, Section B, line 13)
   - the FAP, application, and plain-language summary URLs (line 16)
   - the tax year
2. **Crawl the URLs.** Download the FAP, the application, the plain-language summary, and any separate provider list. When a URL is dead, search the hospital's site for the current versions. Store each file with its source URL, retrieval timestamp, and SHA-256 hash.
3. **Extract structured policy data** with Claude (§9):
   - free and discount thresholds and the sliding scale
   - asset test details
   - household and income definitions, and the income lookback period (for example 3 versus 12 months)
   - insured/underinsured eligibility
   - residency and service area
   - presumptive-eligibility criteria
   - catastrophic or medical-indigence provisions (for example, the bill exceeds X% of income)
   - application deadline language
   - required documents
   - submission methods with addresses, fax, email, portal URL, and phone
   - covered and uncovered provider groups
   - the AGB method and percentage
   - the appeal process
   - **For every field, a verbatim quote plus a page number.** Verify each quote by string-matching it against the PDF's extracted text, and reject the field if the quote isn't found.
4. **Versioning:** a new hash means a new policy version, a diff, and a re-review. Re-crawl monthly.
5. **Coverage targets:**
   - ≥95% of CMS-listed nonprofit acute-care and critical-access hospitals linked to an EIN
   - ≥85% with thresholds
   - ≥80% with a downloaded, current FAP and application
   - 50 hospitals hand-verified by you against their source PDFs
   - Publish a coverage report in admin.
6. **State rules** (§3C) overlay hospital policies. When state law is more generous, it wins.
7. **FPL tables** (§3K).

### 8.4 Eligibility engine (pure, deterministic, versioned, heavily tested)
- **Input:** household (size per the policy's definition), income (annualized according to the policy's lookback rules), assets if relevant, insurance status, state, ZIP, service area, date of service, first-statement date, the facility's policy version, state rules, and the FPL table.
- **Output:**
  - `fplPercent`
  - `tier` (`free` | `discount` with percentage or formula | `sliding` | `catastrophic` | `presumptive` | `not_eligible` | `unknown`)
  - `estimatedNewBalance`
  - `confidence`
  - `reasons[]`, each with a citation (policy quote and page, or the statute)
  - `deadline` (application period end, computed conservatively when the first-statement date is unknown, with the uncertainty shown)
  - `requiredDocuments[]`
  - `providerCoverage` (whether this bill's provider is covered by the FAP)
- **Tests:** at least 100 unit tests, including:
  - boundary incomes exactly at thresholds
  - Alaska and Hawaii guidelines
  - FPL year selection
  - insured versus uninsured patients
  - expired deadlines (still recommend applying: many hospitals accept late applications, and a decision can still help)
  - for-profit hospitals with state-law coverage
  - government hospitals
  - unknown policies
- **Never** turn "unknown" into "eligible". If the policy isn't verified, say so and give the user the general route.

### 8.5 Application generator and e-signature
- **The hospital's own form, when we have it:**
  - AcroForm: map fields with the form mapper, fill with pdf-lib, and flatten.
  - Flat PDF: draw text overlays at mapped coordinates.
- **When we don't have the form:** generate a "Request for Financial Assistance Application and Screening" letter citing 26 CFR §1.501(r), plus our universal financial-information sheet, and ask the hospital to send its form and pause collections.
- **Packet contents:**
  - cover letter
  - filled application
  - proof documents (auto-cropped, enhanced, merged)
  - HIPAA authorization naming BillZero
  - a collections-pause letter citing §1.501(r)-6
  - a page index
- **Signature:** capture strokes, save as vector and PNG, and keep an audit trail (timestamp, IP, user agent, document hash). Support a wet-signature fallback (print-and-sign, or we mail a prepaid packet).
- **Letter library** (templates with variables and citations, each version-controlled):
  - FAP application cover letter
  - application request and collections pause
  - itemized bill and records request (HIPAA right of access)
  - billing-error dispute
  - refund request after approval
  - appeal of denial
  - follow-up and status request
  - No Surprises Act dispute guidance (points the user to the federal process)
  - authorization of representative
  - **All templates go to `docs/legal-questions.md` for lawyer review before production.**

### 8.6 Submission, inbound, and tracking
- **Channel choice** follows the policy's submission methods, in this order of preference: fax with confirmation → email → certified mail with return receipt (Lob) → portal, which gets a guided checklist with copy buttons and a screenshot upload of the confirmation.
- **Inbound:**
  - A dedicated inbound fax number and a case-specific reply email address.
  - Inbound documents are classified (approval, denial, missing information, partial approval, new bill) and attached to the case automatically.
  - The user is notified and the timeline advances.
- **Workflows** (Inngest), where day 0 is submission:
  - day 0: confirmation
  - day 10: polite status request
  - day 30: escalation letter
  - day 45: escalation call script for the user
  - missing-info notice: generate the response and request the missing documents from the user
  - denial: appeal workflow
  - approval: corrected-balance check and refund request
- Track the 240-day window. Warn at 60, 30, and 14 days.

### 8.7 Itemized bill audit
- **Deterministic rules first:**
  - exact and near-duplicate lines
  - CMS NCCI procedure-to-procedure edit pairs billed together without a modifier
  - Medically Unlikely Edits unit limits
  - charges dated outside the admission window
  - room-and-board on the discharge day
  - routine supplies billed separately on top of room charges
  - arithmetic errors
  - ER level vs. documented acuity (a heuristic flag only)
  - prices far above the hospital's own published cash price (§3G), fetched per hospital on demand
- **Then Claude** explains each finding in plain English and writes a polite, specific dispute letter that references line numbers.
- **Never** claim fraud. Phrase findings as "please review and correct".

### 8.8 When the user isn't eligible
Present a ranked set of next steps:
- itemized audit
- prompt-pay or self-pay discount request letter
- 0% payment plan request
- No Surprises Act dispute (uninsured or self-pay, bill ≥$400 above the GFE)
- Medicaid application, including retroactive coverage where available (link to the state site)
- state programs
- reapplying if income changed
- for physician-group bills, that group's own assistance policy, if any

### 8.9 Notifications
- Web push (iOS requires the installed PWA) with email as the fallback. SMS is a later phase.
- Notification content never includes medical details or amounts: "Your case has an update."

### 8.10 Payments and the success fee
- Collect a Stripe SetupIntent at submission, after the clear disclosure. Waive the fee automatically at ≤200% FPL.
- When the decision is uploaded or arrives:
  1. An admin verifies it.
  2. Compute savings (§2.5) and show the user the calculation, with a 72-hour window to dispute.
  3. Charge off-session, with the cap enforced, and email a receipt.
- **Refund-dependent savings** are charged only when the user confirms the refund was received, or after evidence is verified.
- Keep a full ledger table with evidence links. Handle failed payments with a gentle retry flow, and never threaten the user.

### 8.11 Growth surfaces
- **Quick Check** (§7.1). Fast and public, using the same eligibility engine in estimate mode.
- **Hospital pages** (`/hospitals/[state]/[slug]`), generated from the database for every US hospital:
  - nonprofit status (with source)
  - free and discount thresholds translated into dollars for household sizes 1–6
  - how to apply, required documents, submission methods
  - application window
  - which providers are covered
  - "last verified" date and source links
  - CTA to check your bill
  - Use proper structured data (schema.org `Hospital`, `FAQPage`) and a sitemap. **Accuracy beats volume:** hide the threshold sections when the data is unverified.
- **Share card:** "BillZero erased $14,212 of my hospital bill". It shows **no hospital or personal details unless the user opts in**, and is rendered with `@vercel/og`.
- **Referral link:** give $25 when a referral produces a successful case. Ask me before enabling it.

### 8.12 Analytics (no PHI; buckets instead of amounts)
Events: `landing_view`, `quickcheck_start`, `quickcheck_result{tier}`, `signup`, `scan_start`, `scan_success{doc_type}`, `extraction_confirmed{edits_count}`, `hospital_matched{ownership}`, `eligibility_result{tier}`, `application_submitted{channel}`, `decision_received{outcome}`, `fee_charged{bucket}`, `share_created`, `referral_signup`. Build a funnel dashboard in admin.

---

## 9. Claude API usage (Anthropic TypeScript SDK)

- **SDK:** `@anthropic-ai/sdk`. Read the official SDK README and API docs before writing calls, and **don't guess helper names or parameters**. Wrap everything in `lib/ai/` behind typed functions: `classifyDocument`, `extractBill`, `extractPolicy`, `mapFormFields`, `auditItemizedBill`, `classifyInboundLetter`, `draftLetter`.
- **Model:** use `claude-opus-5-5` for every pipeline. Its adaptive thinking is always on: do **not** send `budget_tokens` or `thinking: {type: "disabled"}`, because either returns a 400. Set effort explicitly in `output_config.effort` (the default is `medium`): `medium` for classification and bill extraction, `high` for policy extraction, audit, and letters. Whether to route any pipeline to a cheaper model (`claude-sonnet-5-5`, `claude-haiku-5-5`) is **my** decision. Measure it on the evals, then bring me the accuracy and cost numbers.
- **Structured outputs:**
  - Use `output_config.format` with a JSON schema, through the SDK's `messages.parse()` helper and Zod schemas. Don't use the deprecated `output_format`.
  - Don't use forced `tool_choice` (`any`/`tool`); on this model it returns a 400. Use `auto` plus strict tools, or structured outputs.
  - Don't use assistant-message prefill (also a 400).
  - Citations are incompatible with `output_config.format`, so put the verbatim quote and page number into the schema and verify the quotes in code.
- **Inputs:** images as image blocks, PDFs as document blocks (base64 or the Files API for reuse). Respect the request limits (32MB, 600 pages) and split huge PDFs.
- **Long calls:** run them in Inngest jobs, never in request handlers. Stream and use the SDK's `finalMessage()` helper. Set generous `max_tokens`.
- **Prompt caching:** put the stable system prompt and schema first with `cache_control`, and the variable document after. Verify that `usage.cache_read_input_tokens` is non-zero on repeated calls.
- **Bulk ETL:** use the Message Batches API for the policy pipeline (50% cheaper, asynchronous). Key results by `custom_id`.
- **Stop reasons:** always check `stop_reason` before parsing (`refusal`, `max_tokens`). Enable server-side fallbacks (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta) and note it in `DECISIONS.md`.
- **Errors:** use the SDK's typed errors. Retry 429, 5xx, and connection errors with backoff; don't retry 400s. Make calls idempotent at the job level.
- **Data minimization:** never send SSNs or full dates of birth to the model. Redact identifiers that extraction doesn't need, where feasible. Add a "can we sign a BAA or enable zero data retention with Anthropic?" item to `HUMAN_TASKS.md`; I'll pursue it before launch.
- **Evals** (`/tests/evals`), run in CI on every prompt change, with results recorded in `PROGRESS.md` along with cost per document:
  - **Bill extraction:** ≥40 synthetic bills (§12.1) with ground-truth JSON. Targets: ≥98% field accuracy on clean PDFs, ≥95% on phone photos, 100% correct document type on the EOB-vs-bill set.
  - **Policy extraction:** 30 real public FAP PDFs, hand-labeled by you with sources. Target: ≥95% field accuracy and 0 unverifiable quotes.
  - **Audit:** seeded-error itemized bills. Targets: ≥90% recall, ≥95% precision.

---

## 10. Data model (Postgres; RLS on every table; field-level encryption marked 🔒)

- `users`, `profiles`, `people` (the patient, who may differ from the user), `authorizations` (helper ↔ patient, signed HIPAA authorization 🔒)
- `households`, `household_members`, `income_sources` 🔒, `assets` 🔒
- `documents` (type, storage path 🔒, hash, page count, classification, source: upload/fax/email/mail)
- `bills`, `bill_line_items`, `extraction_runs` (model, prompt version, cost, confidence)
- `facilities` (CCN, name, address, ownership, type, coordinates), `health_systems`, `facility_ein_links` (confidence)
- `nonprofit_orgs` (EIN, EO BMF fields), `irs990_schedule_h` (tax year, facility group, FPG thresholds, URLs)
- `policy_documents` (URL, hash, retrieved at), `policies` (version, structured fields with quotes and pages, review status, reviewer), `policy_provider_coverage`
- `application_forms` (file, AcroForm or flat), `form_field_maps`
- `state_rules` (versioned, with citations), `fpl_guidelines` (year, region, base, increment)
- `cases` (status machine: `draft → ready → in_review → sent → acknowledged → missing_info → decided → refund_pending → closed`), `case_events`, `deadlines`
- `letters` (template version, rendered file), `submissions` (channel, provider message ID, status, proof of delivery), `inbound_messages`
- `decisions` (outcome, old/new balance, refund amount, evidence document), `savings_ledger`, `fees` (computed, waived, charged, disputed), `stripe_customers`
- `audit_findings`, `share_cards`, `referrals`, `notifications`, `push_subscriptions`
- `admin_users`, `admin_reviews`, `access_log` (every PHI read by staff), `feature_flags`, `etl_runs`
- `organizations`, `org_memberships` (schema only, for future B2B)

---

## 11. Security and privacy (build all of this in from day one)

- **Transport and storage:** TLS everywhere, HSTS, a strict CSP (nonces), secure cookies, CSRF protection on mutations.
- **Encryption:** application-level envelope encryption (libsodium) for 🔒 fields and document files on top of Supabase's encryption at rest. Keys come from the environment now and should be KMS-ready.
- **Access:** private storage buckets only; signed URLs that expire in 60 seconds or less; RLS policies tested with dedicated tests (user A can never read user B's data).
- **Abuse limits:** rate limits on auth, upload, Quick Check, and AI endpoints. File checks: type sniffing, size caps, malware scanning if feasible, PDF sanitization.
- **Admin:** a separate role, 2FA required, IP allowlist optional. Every PHI view is written to `access_log` with a reason.
- **Retention:** delete documents 90 days after a case closes unless the user chooses to keep them. Account deletion purges storage, rows, and the Stripe customer, and logs a deletion receipt.
- **Third parties:** no PHI in logs, Sentry, PostHog, or email. No third-party scripts on app pages besides Stripe.
- **Breach response:** write `docs/runbooks/incident-response.md` aligned with the FTC Health Breach Notification Rule.
- **Before launch:** dependency audit, secret scanning, and a self-run threat model (`docs/threat-model.md`).

---

## 12. QA

### 12.1 Synthetic test corpus (build it early; it drives everything)
- **At least 40 realistic synthetic bills** as PDFs and photos, covering:
  - Epic- and Cerner-style statements, small rural hospital bills, ER bills, inpatient stays, itemized UB-04-style lists
  - insurance EOBs ("This is not a bill"), collection agency letters, physician-group bills
  - FAP approval, denial, and missing-information letters
- Use plausible but fictional names and synthetic accounts, attached to *real* hospital names and addresses from the database so matching gets tested.
- **Photo variants:** rotation, perspective, shadows, glare, crumples, low light, partial crops.
- Ground-truth JSON for each document.

### 12.2 Automated tests
- **Unit:** eligibility, FPL, deadlines, fee math, state-rule overlays, matching, letter rendering.
- **Integration:** extraction → matching → eligibility → packet generation against mocks.
- **End-to-end (Playwright):** the golden path (§14), plus the not-eligible, EOB-detected, missing-info, denial-and-appeal, refund, and account-deletion paths.
- **Visual regression:** `/lab` and every screen, in both themes, at mobile and desktop sizes.
- **Accessibility:** axe on every page; manual VoiceOver and keyboard passes documented in `PROGRESS.md`.

### 12.3 Performance budgets
- **Marketing:** LCP < 2.0s on throttled 4G on a mid-range phone; CLS < 0.05; INP < 200ms.
- **App:** initial JS ≤ 180KB gzipped per route; OpenCV.js lazy-loaded only on the camera screen.
- **Lighthouse:** ≥95 for Performance, Accessibility, Best Practices, and SEO on marketing pages; ≥90 on app pages.

### 12.4 Design QA checklist (run per screen before you call it done)
- On the 4pt grid; consistent radii and elevation; one tint; type styles only from the scale.
- No orphaned words in headlines (use `text-wrap: balance` for headings and `pretty` for body).
- Every interactive element has hover, press, focus-visible, disabled, and loading states, plus its §6.3 animation.
- Contrast is AA or better; hit targets ≥44px; dark mode deliberate rather than inverted; safe areas respected; the keyboard never hides the active input.
- Empty, loading, error, and offline states are designed.
- Reduced-motion mode checked.
- It looks right on iOS Safari (iPhone SE through Pro Max widths), Android Chrome, and desktop Safari, Chrome, Firefox, and Edge.
- Ask yourself: "Would this ship from Cupertino?" If not, iterate.

---

## 13. Milestones and acceptance criteria

| # | Milestone | Done when |
|---|---|---|
| M0 | Foundation | Repo, CI, and environment set up; tokens, every §5.3 component, every §6.3 motion primitive, and `/lab` built; screenshots reviewed in both themes; contrast validator in CI. |
| M1 | Data | Facilities, nonprofit links, Schedule H thresholds and URLs, FPL tables, and the first 13 state rule sets loaded; FAP crawl and extraction run; coverage report meets the §8.3 targets; 50 hospitals hand-verified. |
| M2 | Capture and extraction | Camera, upload, and crop work on a real iPhone (via the preview URL) and on Android; extraction evals meet the §9 targets; review screen with confidence flags; rows 24–33 polished. |
| M3 | Eligibility | Engine with ≥100 tests; question flow; result screens (rows 34–38); Quick Check live on the preview. |
| M4 | Documents | Form mapper; real hospital forms filled correctly for 20 hospitals (verify visually); signature; packet builder; letter library drafted and sent for lawyer review. |
| M5 | Send and track | Fax, mail, and email providers integrated (sandbox), with inbound handling and classification; workflows with follow-ups; timeline UI; admin review queue. |
| M6 | Audit | Rules engine, NCCI/MUE data, findings UI, dispute letter; audit evals meet targets. |
| M7 | Payments | Stripe SetupIntent, decision verification, savings calculation, user dispute window, off-session charge, receipts, waiver rule. |
| M8 | Growth | Marketing site, hospital pages (sitemap, structured data), share cards, analytics funnel. |
| M9 | Hardening and launch | Security checklist, threat model, runbooks, legal pages (lawyer-approved), Lighthouse budgets met, full E2E suite green, first real supervised case completed with me (§14). |

Demo each milestone to me with a preview URL, a short screen recording (Playwright video is fine), and a `PROGRESS.md` update.

---

## 14. The "it actually works" test

**Synthetic golden path (automated, in CI):**
1. A synthetic user photographs a synthetic ER bill from a real nonprofit hospital in our database.
2. Extraction is correct.
3. The hospital is matched as a nonprofit, with the source shown.
4. A household of 3 earning just under the policy's free-care threshold gets the "free care" result, with the correct policy quote.
5. That hospital's actual application form is filled correctly.
6. Signature, then submission through the sandbox fax provider.
7. Timeline shows "Sent".
8. A simulated inbound approval fax is classified.
9. The balance updates to $0, savings are computed, and the fee is waived or charged per the rules.

**Real supervised pilot (manual, needs my approval at each step):**
I, or a consenting friend or family member, provide one real bill. You run it through production with the admin review queue on. I approve the packet, and it's sent for real. We track it to a decision. You document every friction point and fix it.

---

## 15. Things you'll need me for (and how to ask)

Keep `HUMAN_TASKS.md` as a checklist grouped by milestone. Each task gets:
- **What**: one line.
- **Why**: one line.
- **Steps**: numbered, exact clicks or URLs.
- **What to send back**: for example, the environment variable names. Never ask me to paste secrets into chat if a secure option exists; prefer `.env.local`, which you'll tell me where to put, or the hosting dashboard.
- **Estimated cost and time.**

Message me only when a batch is ready or something is blocking, and keep building with mocks in the meantime.

**Expected tasks:**
- **Now (M0):**
  - Confirm the platform decision (web PWA first).
  - Create an Anthropic Console API key and set a monthly spend limit.
  - Choose or create the GitHub repo and give you access.
  - Approve the brand name after you run a trademark knockout search (USPTO trademark search plus the web) and list 5 available domains.
- **M1–M2:** buy the domain; create Supabase, Vercel, Inngest, Sentry, PostHog, and Upstash accounts (free tiers) and add the keys.
- **M3:** set up Google OAuth credentials. Optional: join the Apple Developer Program ($99/yr) for Sign in with Apple.
- **M5:**
  - Fax provider account (with a BAA) and an inbound number.
  - Lob account (and a BAA if offered).
  - Resend account plus DNS records (SPF, DKIM, DMARC) on the domain.
- **M7:** a Stripe account with business verification, which means forming the business first.
- **Before launch:**
  - Form the LLC, get an EIN, open a bank account.
  - Lawyer review of `docs/legal-questions.md`, the terms, the privacy policy, the letter templates, and the fee model (including any state licensing).
  - Sign the BAAs.
  - Anthropic BAA or zero-data-retention inquiry.
  - Approve all marketing claims.
  - Provide a real bill for the pilot.
  - Approve the first real submission.
  - Flip `outbound.production.enabled`.
- **Any time:** CAPTCHAs, 2FA codes, payments, anything requiring my identity, any change to pricing, any decision to use a cheaper AI model.

---

## 16. Definition of done (v1 launch)

- Every item in §13 is met. Every row in §6.3 is implemented and visible in `/lab`. Every screen in §7 passes §12.4.
- The evals meet their targets and their numbers are recorded.
- The synthetic golden path passes in CI, and the real supervised pilot case has been submitted, with friction fixes shipped.
- `docs/sources.md` covers every legal claim; the lawyer has signed off on the templates, terms, and privacy policy; BAAs are signed.
- Lighthouse and performance budgets are met; accessibility is AA; RLS tests pass; the security checklist is complete.
- `PROGRESS.md` holds a final handoff: architecture overview, how to run locally, how to deploy, how to re-run the ETL, how to review policies, the on-call runbook, and a prioritized v2 backlog (native iOS app, AI phone follow-ups, SMS, B2B portal, more states, Spanish localization).

**Start now:** read this whole brief, write your plan into `PROGRESS.md`, create `HUMAN_TASKS.md` with the M0 tasks, and begin M0 while you wait on me.
