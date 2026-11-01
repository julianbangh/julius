# Build prompt: Snapworth — "Snap it. Know what it's worth."

You are building a complete, production-quality mobile app called **Snapworth** from an empty folder. This document is the single source of truth. It describes the product, every screen, the backend, the pricing math, monetization, the visual style and the copy.

## 0. Rules for you, the builder

1. **Follow this document exactly.** Every number, color, string and rule here is deliberate. Do not "improve" the product by adding features, screens, settings or copy that are not described.
2. **If something is genuinely missing**, choose the simplest option that fits the rest of this document, then record it in `DECISIONS.md` at the repo root (one line: what you decided and why). Never stop to ask; never leave a TODO in user-facing code.
3. **Values marked `VERIFY`** are best-known defaults that a human must confirm before launch (fees, URLs). Put them in seed data exactly as given and list them in `LAUNCH_CHECKLIST.md`.
4. **Never put secrets in the app.** All API keys live in Supabase Edge Function secrets. The app only knows the Supabase URL + anon key, the RevenueCat public keys, the AdMob IDs and the PostHog key.
5. Use **TypeScript everywhere** with `strict: true`. No `any` except at API boundaries, where you parse with zod.
6. Before you call any third-party API, read that provider's current docs. Where this document gives exact request shapes, they are the intended behavior; if the provider's current docs differ, follow the docs and keep the behavior.
7. Write the tests listed in §15. Pricing math must be covered by unit tests before UI work on the result screen.

---

## 1. Product in one paragraph

Snapworth is a camera app for teens and young adults who flip things for money (thrift stores, garage sales, their own stuff). You point the camera at any item. The app identifies the exact item, judges its condition from the photo plus 1–3 quick questions, searches eBay and the most popular second-hand marketplaces **in the user's country** (for example FINN and Tise in Norway), and shows a **price ladder**: what the item sells for at every condition from sealed/new down to not working, with the user's own condition highlighted. It also shows the cheapest listing right now, the best place to sell, a flip calculator (profit if you buy it at price X), and, for Pro users, a generated listing ready to paste into a marketplace.

**Core promise:** fast, honest prices. Every price is traceable to real listings the user can open. When data is thin, the app says so.

---

## 2. Locked decisions

| Topic | Decision |
|---|---|
| Name | Snapworth. Tagline: "Snap it. Know what it's worth." |
| Platforms | iOS + Android, one codebase |
| Stack | Expo (React Native, latest stable SDK, New Architecture) + TypeScript + Expo Router |
| Backend | Supabase: Postgres, anonymous Auth, Edge Functions (Deno/TypeScript) |
| AI | Anthropic Claude API via the official SDK `@anthropic-ai/sdk`. Model ID comes from the secret `ANTHROPIC_MODEL` (the human sets it to the cheapest current Claude model that accepts images). Used for identification, listing cleanup and listing writing |
| Market | Global. Country is auto-detected and can be changed in Settings. All prices are shown in the user's local currency |
| Price sources | eBay Browse API (official) + the top local marketplaces of the user's country, found through the Serper.dev search API (cheapest option). Never scrape marketplace websites directly |
| Tuned categories | Electronics, Sneakers & streetwear, Trading cards. Everything else works in a "general" mode |
| v1 features | Scan, variant confirm, condition questions, price ladder, listings drill-down, flip calculator, lowest-listed-now, best place to sell, history, **listing generator (Pro)** |
| Not in v1 | Room scan, flip log/profit tracker, share cards, price alerts, dark mode, languages other than English, social features |
| Onboarding | Short: 3 screens, then camera |
| Language | English only (app UI). Generated listings are written in the marketplace's local language, with an English toggle |
| Style | Clean & light: white, lots of space, soft shadows, Apple-like, calm and trustworthy |
| Accounts | No sign-up needed. Anonymous account on first launch; optional Sign in with Apple / Google to keep history and Pro across devices |
| Monetization | 2 free scans/day + up to 8 more per day by watching a rewarded ad each; Day Pass $1.99 (24h unlimited, no ads); Pro $4.99/month or $29.99/year |

---

## 3. Tech stack and project setup

### 3.1 App (folder `app/`)
- `npx create-expo-app@latest` with the TypeScript template, Expo Router.
- Development builds (`expo-dev-client`) are required because of ads and purchases. Build with EAS (`eas.json` with `development`, `preview`, `production` profiles). iOS builds run on EAS cloud, so no Mac is required.
- Libraries (use these, not alternatives):
  - Navigation: `expo-router`
  - Camera: `expo-camera` (`CameraView`); library picker: `expo-image-picker`
  - Image resize: `expo-image-manipulator`
  - Images: `expo-image`
  - Files: `expo-file-system` (local scan thumbnails)
  - Blur: `expo-blur`
  - Haptics: `expo-haptics`
  - Localization: `expo-localization`
  - In-app browser: `expo-web-browser`
  - Clipboard: `expo-clipboard`
  - Sign in: `expo-apple-authentication`, `@react-native-google-signin/google-signin`
  - Ads: `react-native-google-mobile-ads` (rewarded ads, consent via its `AdsConsent` API)
  - Tracking prompt (iOS): `expo-tracking-transparency`
  - Purchases: `react-native-purchases` (RevenueCat)
  - Backend client: `@supabase/supabase-js`
  - Server state: `@tanstack/react-query`; local state: `zustand`
  - Animation & gestures: `react-native-reanimated`, `react-native-gesture-handler`
  - Bottom sheets: `@gorhom/bottom-sheet`
  - Icons: `lucide-react-native` + `react-native-svg`
  - Font: `@expo-google-fonts/inter` (Inter 400, 500, 600, 700)
  - Analytics: `posthog-react-native`
  - Crash reporting: `@sentry/react-native`
  - Validation: `zod`
- `app.json`: `userInterfaceStyle: "light"`, portrait only, bundle id `com.snapworth.app`, camera + photo library usage strings (see §11), the `react-native-google-mobile-ads` config plugin with app IDs from env.

### 3.2 Folder structure
```
app/                      Expo app
  app/                    expo-router routes
    _layout.tsx           providers, fonts, splash, auth bootstrap
    onboarding.tsx
    index.tsx             camera (home)
    analyzing.tsx
    result/[scanId].tsx
    listings/[scanId].tsx
    listing-generator/[scanId].tsx
    history.tsx
    settings.tsx
    paywall.tsx
  src/
    theme/                tokens.ts, typography.ts
    components/           Button, Chip, Card, LadderRow, Sheet, Toast, Skeleton, PriceText, Badge, IconButton
    features/             scan/, result/, monetization/, history/, settings/, listing/
    lib/                  supabase.ts, api.ts, format.ts, analytics.ts, ads.ts, purchases.ts, country.ts
    store/                zustand stores
supabase/
  migrations/             SQL (schema, RLS, seed)
  functions/
    _shared/              anthropic.ts, ebay.ts, serper.ts, fx.ts, pricing.ts, quota.ts, marketplaces.ts, schemas.ts
    identify/
    price/
    reveal/
    status/
    listing/
    admob-ssv/
    revenuecat-webhook/
    delete-account/
DECISIONS.md
LAUNCH_CHECKLIST.md
```

### 3.3 Environment
App (`app/.env`, `EXPO_PUBLIC_` prefix): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `REVENUECAT_IOS_KEY`, `REVENUECAT_ANDROID_KEY`, `ADMOB_IOS_APP_ID`, `ADMOB_ANDROID_APP_ID`, `ADMOB_REWARDED_IOS`, `ADMOB_REWARDED_ANDROID`, `POSTHOG_KEY`, `SENTRY_DSN`, `GOOGLE_WEB_CLIENT_ID`. Use the AdMob **test** ad unit IDs in development builds.

Edge Function secrets: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_EPN_CAMPAIGN_ID` (optional), `EBAY_SOLD_ENABLED` (`false`), `SERPER_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, `MAX_DAILY_AI_USD` (default `20`), `MAX_DAILY_SEARCH_USD` (default `20`).

---

## 4. Architecture

```
[App] --(Supabase JWT)--> [Edge Functions] --> Anthropic (identify, clean listings, write listing)
                                          --> eBay Browse API (OAuth client credentials)
                                          --> Serper.dev (local marketplace search)
                                          --> Frankfurter (daily FX rates, ECB, free)
                                          --> Postgres (quota, scans, cache, results)
[AdMob] --SSV callback--> admob-ssv function
[RevenueCat] --webhook--> revenuecat-webhook function
```

- On first launch the app calls `supabase.auth.signInAnonymously()`. The Supabase user id is also the RevenueCat app user id and the AdMob SSV `userId`.
- **The server is the only authority on quota and entitlements.** The app shows what `/status` returns.
- Every edge function verifies the JWT, validates input with zod, and returns `{ error: { code, message } }` with a proper HTTP status on failure.

---

## 5. Data model (Postgres)

All tables have RLS on. Users can `select` their own rows in `profiles`, `daily_usage`, `scans`, `price_results`. All writes happen in edge functions with the service role. `price_cache`, `fx_rates`, `marketplaces`, `config`, `ad_rewards`, `purchases`, `cost_ledger` are service-role only.

```sql
profiles (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now(),
  country text not null,             -- ISO 3166-1 alpha-2, e.g. 'NO'
  currency text not null,            -- ISO 4217, e.g. 'NOK'
  timezone text not null,            -- IANA, e.g. 'Europe/Oslo'
  pro_until timestamptz,
  day_pass_until timestamptz,
  ad_reveals_blocked_until timestamptz
)

daily_usage (
  user_id uuid references profiles on delete cascade,
  day date,                          -- the user's local date
  free_reveals_used int default 0,
  ad_reveals_used int default 0,
  nofill_grants int default 0,
  unverified_ad_claims int default 0,
  identify_calls int default 0,
  listing_calls int default 0,
  primary key (user_id, day)
)

scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade,
  created_at timestamptz default now(),
  status text,                       -- identify status (see §7.2)
  category text,                     -- electronics | sneakers | streetwear | trading_cards | general
  candidates jsonb,                  -- from identify
  chosen jsonb,                      -- {display_name, variant_label, search_query}
  answers jsonb,                     -- condition answers
  visible_condition jsonb,
  condition_tier text,               -- final tier code
  country text, currency text,
  price_result_id uuid,
  revealed boolean default false,
  revealed_via text                  -- free | ad | nofill | day_pass | pro
)

price_cache (
  key text primary key,              -- sha256(normalized search_query|size|grade|country)
  created_at timestamptz default now(),
  expires_at timestamptz,
  comps jsonb                        -- cleaned comps, original currencies
)

price_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid references scans on delete cascade,
  created_at timestamptz default now(),
  status text,                       -- ok | insufficient_data
  currency text,
  tiers jsonb,                       -- [{tier, label, price, n, estimated}]
  your_tier text,
  your_value numeric,
  adjustments jsonb,                 -- [{label, delta}]
  confidence text,                   -- high | medium | low
  lowest_listed jsonb,               -- {source, price, original_price, original_currency, url, title}
  best_place jsonb,                  -- {marketplace_id, name, median}
  comps jsonb,                       -- converted comps for the listings screen
  sources jsonb                      -- [{marketplace_id, name, n}]
)

ad_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, scan_id uuid,
  ad_session_id text unique,         -- generated by the app per ad view
  client_claimed_at timestamptz,
  ssv_transaction_id text unique,
  ssv_verified_at timestamptz
)

purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid, product_id text, store text,
  transaction_id text unique,
  purchased_at timestamptz, expires_at timestamptz,
  raw jsonb
)

fx_rates (day date primary key, base text default 'EUR', rates jsonb)

marketplaces (
  id text primary key,               -- 'finn'
  name text,                         -- 'FINN'
  domain text,                       -- 'finn.no'
  countries text[],                  -- ['NO']
  kind text,                         -- ebay_api | search
  ebay_marketplace_id text,          -- for kind = ebay_api
  categories text[],                 -- empty = all categories
  fee_percent numeric, fee_fixed numeric, fee_currency text,
  fee_verified boolean default false,
  local_pickup boolean,
  sell_url text,
  priority int,                      -- lower = searched first (order in §7.7)
  enabled boolean default true
)

config (key text primary key, value jsonb)  -- ratios, limits, constants from this doc

cost_ledger (day date, kind text, usd numeric, primary key (day, kind))  -- 'ai' | 'search'
```

---

## 6. Monetization and quota (exact rules)

### 6.1 Definitions
- **Identify** = sending a photo to be identified. Free and unlimited for the user, but capped at **40/day** for free users and **300/day** for Day Pass/Pro as an abuse limit. Over the cap: error `identify_limit`.
- **Reveal** = seeing the prices of an identified item. This is what is limited. A reveal is consumed **only** when a result with status `ok` is shown. Failures, `insufficient_data`, and re-opening a past result from history never consume a reveal.
- **Day** = the user's local calendar day (`profiles.timezone`). Counters reset at local midnight.

### 6.2 Plans
| Plan | Reveals | Ads | Listing generator | History |
|---|---|---|---|---|
| Free | 2 free/day + up to 8 ad reveals/day | Rewarded ad per extra reveal | No (shows Pro paywall) | Last 20 scans |
| Day Pass ($1.99, 24h) | Unlimited | None | No | Last 20 scans |
| Pro ($4.99/mo or $29.99/yr) | Unlimited | None | Yes | Unlimited |

### 6.3 Reveal decision (server, in `/price` and `/reveal`)
Check in this order:
1. `pro_until > now` → reveal, `revealed_via = 'pro'`.
2. `day_pass_until > now` → reveal, `'day_pass'`.
3. `free_reveals_used < 2` → reveal, increment, `'free'`.
4. Otherwise return the result **locked** (§7.8) with `unlock: { ads_left: 8 - ad_reveals_used, can_watch_ad: ads_left > 0 && !blocked }`.

### 6.4 Rewarded ads
- One completed rewarded ad = one reveal, maximum **8 per day**.
- The app generates `ad_session_id` (uuid v4), loads a `RewardedAd` with `serverSideVerificationOptions: { userId: <supabase user id>, customData: "<scan_id>:<ad_session_id>" }`, and shows it.
- When the SDK fires the earned-reward event, the app calls `POST /reveal { scan_id, method: 'ad', ad_session_id }`.
- `/reveal` accepts the claim if the SSV row for that `ad_session_id` is verified, **or**, if SSV has not arrived yet, it accepts it as an unverified claim (`unverified_ad_claims += 1`). When the SSV callback later arrives, `admob-ssv` marks it verified and subtracts 1 from `unverified_ad_claims`.
- If a user has more than **3** unverified claims still open in one day, set `ad_reveals_blocked_until = now + 24h` and stop accepting ad reveals. The UI then hides the ad button and shows Day Pass / Pro.
- `admob-ssv` (GET): verify the signature with Google's published AdMob verifier keys (ECDSA, `https://www.gstatic.com/admob/reward/verifier-keys.json`, cached 24h). The signed message is the query string up to, but not including, `&signature=`. Reject invalid signatures. Upsert `ad_rewards` by `ad_session_id` (parsed from `custom_data`) and `ssv_transaction_id` (idempotent).
- **No-fill fallback:** if a rewarded ad fails to load **twice in a row** for the same scan, the app calls `/reveal` with `method: 'nofill'`. The server grants it if `nofill_grants < 3` today; it counts toward the 8 ad reveals.
- Ad settings: `maxAdContentRating: 'T'`. Run Google UMP consent (`AdsConsent`) before the first ad request in EEA/UK/CH. On iOS, show the App Tracking Transparency prompt right before the **first** ad is loaded, never at launch. Do not show banner or interstitial ads anywhere.

### 6.5 Day Pass and Pro (RevenueCat)
- Products: `snapworth_daypass_24h` (consumable, $1.99 tier), `snapworth_pro_monthly` ($4.99 tier), `snapworth_pro_yearly` ($29.99 tier). Entitlement `pro` covers both subscriptions. Let the stores localize prices; always display RevenueCat's `priceString`, never a hardcoded price.
- No free trials, no intro offers.
- `revenuecat-webhook` (check the `Authorization` header against `REVENUECAT_WEBHOOK_SECRET`):
  - `NON_RENEWING_PURCHASE` with product `snapworth_daypass_24h` → `day_pass_until = max(now, day_pass_until) + 24h` (passes stack).
  - `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `UNCANCELLATION` → `pro_until = expiration_at`.
  - `EXPIRATION` → `pro_until = expiration_at`.
  - Store every event in `purchases` (idempotent on `transaction_id`).
- After a purchase, the app refetches `/status` every 1s for up to 10s until the entitlement shows, then continues. If still not visible, it trusts RevenueCat's `customerInfo` for UI and retries `/status` in the background.

### 6.6 Upsell triggers (all in the app)
- **Thrift-run sheet** (Day Pass): show once per day for free users when either (a) they reach a locked result having completed 3 or more reveals in the last 10 minutes, or (b) they finish their 2nd ad in 10 minutes. See §8.9.
- **Pro paywall**: opens from the Create listing button (non-Pro), from Settings > Upgrade, and from the locked/exhausted card's "Go Pro" link. Never auto-open at launch.

### 6.7 Cost guard
Record estimated cost per AI and search call in `cost_ledger` (AI: input tokens × input price + output tokens × output price, both prices stored in `config`; Serper: $0.001 per query; eBay: $0). If today's AI or search total exceeds `MAX_DAILY_AI_USD` / `MAX_DAILY_SEARCH_USD`, `identify` and `price` return HTTP 503 with code `busy` for **free** users only; Day Pass and Pro continue.

---

## 7. The scan pipeline

### 7.1 Capture and image prep (app)
1. The user taps the shutter (or picks a photo from the library).
2. `takePictureAsync({ quality: 0.8 })`, then resize with `expo-image-manipulator` so the longest side is **1024 px**, JPEG compression **0.7**, base64.
3. Also save a **256 px** thumbnail to `FileSystem.documentDirectory + 'scans/<scan_id>.jpg'` after `/identify` returns the `scan_id`. Thumbnails stay on the device only.
4. The full photo is never stored on the server. The server holds it only in memory for the AI call.

### 7.2 `POST /identify`
Request: `{ image_base64, country, currency, timezone }`. The server upserts `profiles` (country/currency/timezone) on every call, checks the identify cap, then calls Claude.

**Claude call** (identical shape for all three AI calls):
- `client.messages.parse({ model: ANTHROPIC_MODEL, max_tokens: 4000, system, messages, output_config: { effort: 'low', format: zodOutputFormat(Schema) } })`, using `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`. In Deno, import with `npm:` specifiers.
- The user message content is `[{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } }, { type: 'text', text: 'Country: <CC>. Identify the item.' }]`.
- Do **not** send `temperature`, `top_p` or `top_k` (the current API rejects them), and do not use assistant prefill.
- If `stop_reason === 'refusal'` or `parsed_output` is null, return status `unclear_photo`.
- Timeout 20s, 1 retry on 429/5xx with 1s backoff.

**Identify output schema (zod):**
```ts
const Tier = z.enum(['sealed','open_box','like_new','good','fair','for_parts',      // electronics/general
                     'new_tags','worn_out','damaged',                                 // sneakers/streetwear (+ like_new, good, fair)
                     'nm','lp','mp','hp','dmg']);                                     // trading cards
const IdentifySchema = z.object({
  status: z.enum(['ok','no_item','multiple_items','unclear_photo','prohibited']),
  category: z.enum(['electronics','sneakers','streetwear','trading_cards','general']),
  confidence: z.number(),                       // 0..1 for candidates[0]
  candidates: z.array(z.object({
    display_name: z.string(),                   // "Nintendo Switch OLED"
    variant_label: z.string(),                  // "White · 64 GB" ('' if none)
    search_query: z.string(),                   // "Nintendo Switch OLED White"
  })),                                          // 1..4, most likely first
  visible_condition: z.object({
    suggested_tier: Tier,
    issues: z.array(z.object({ label: z.string(), severity: z.enum(['minor','major']) })),  // max 5
    box_visible: z.boolean(),
    sealed_visible: z.boolean(),
  }),
  expected_accessories: z.array(z.string()),    // electronics only, max 4, e.g. "Joy-Con controllers"
  needs_size: z.boolean(),                      // true for sneakers and streetwear
  card: z.object({                              // trading cards only, else nulls
    game: z.string().nullable(), set_name: z.string().nullable(),
    card_number: z.string().nullable(), language: z.string().nullable(),
    graded_visible: z.boolean(), grader: z.string().nullable(), grade: z.string().nullable(),
  }),
  photo_tip: z.string(),                        // '' unless status is unclear_photo/no_item
});
```

**Identify system prompt (use verbatim):**
```
You identify second-hand items from a single photo for a resale price app. Return JSON that matches the schema.

Status:
- no_item: there is no sellable item in the photo.
- multiple_items: several different sellable items and no clear main one.
- unclear_photo: too dark, blurry or cropped to identify. Put one short fix in photo_tip (e.g. "Show the label or logo").
- prohibited: weapons or ammunition, drugs or drug paraphernalia, vapes, e-cigarettes or tobacco, alcohol, adult products, prescription medicine, live animals, counterfeit goods, ID documents or money.
- ok: otherwise.

Identification:
- Be as specific as a reseller would be: brand, model, generation, and the variant that changes the price (storage size, edition, colorway, year, set and card number).
- Read every visible logo, label, model number and text. Never invent text you cannot see.
- If the photo cannot separate variants (for example 64 GB vs 128 GB), return up to 4 candidates ordered by likelihood and lower confidence.
- search_query is the shortest string a seller would put in a listing title to find exactly this item. English names. No condition words, no "used", no prices.
  Examples: "Nintendo Switch OLED White", "Air Jordan 1 High OG Chicago Lost and Found", "Charizard ex 199/165 Pokemon 151", "AirPods Pro 2 USB-C".
- category: electronics (devices, consoles, games, cameras, audio), sneakers, streetwear (clothing, bags, caps from fashion brands), trading_cards (Pokemon, sports, Magic, Yu-Gi-Oh and similar), general (everything else).

Condition (judge only what is visible, never guess whether it works):
- Tier codes: electronics and general use sealed, open_box, like_new, good, fair, for_parts. Sneakers and streetwear use new_tags, like_new, good, fair, worn_out, damaged. Trading cards use nm, lp, mp, hp, dmg.
- issues: plain English, max 5, e.g. "Light scratches on screen", "Creasing on toe box", "Whitening on card edges".
- box_visible: original retail box is in the photo. sealed_visible: factory seal or shrink wrap is visible.
- expected_accessories (electronics only): up to 4 included items that change the price, e.g. "Charger", "Joy-Con controllers", "Original box", "Dock".
```

**App behavior on response:**
- `no_item`, `multiple_items`, `unclear_photo`, `prohibited` → error screens (§8.12).
- `ok` with `confidence ≥ 0.85` and exactly one candidate → skip the variant sheet and go straight to condition questions.
- Otherwise → variant sheet (§8.5).

### 7.3 Condition questions (app)
Max 3 questions, chosen by category. Answers prefill from `visible_condition` where noted. Single-select chips unless marked multi.

**Electronics**
1. "Does it turn on and work?" — `Yes, fully` · `Partly / has issues` · `No`
2. Only if `sealed_visible` or `box_visible`: "Is it still sealed?" — `Sealed` · `Opened`
3. "What's included?" (multi) — chips for `Original box` + each `expected_accessories` item. Prefill `Original box` if `box_visible`.

**Sneakers**
1. "Size" — horizontal picker. Size system by country: US/CA → US sizes 4–15 in 0.5 steps; GB/IE → UK 3–14; everywhere else → EU 35–49 (incl. thirds as listed by Nike: 36.5, 37.5 …). Remember the last chosen size.
2. "How much have they been worn?" — `Never` · `1–2 times` · `A few times` · `A lot`
3. "Original box?" — `Yes` · `No` (prefill from `box_visible`)

**Streetwear**
1. "Size" — `XS` · `S` · `M` · `L` · `XL` · `XXL`
2. "Tags still on?" — `Yes` · `No`
3. "Any flaws?" — `None` · `Small (pilling, fading)` · `Big (holes, stains)`

**Trading cards**
1. "Is it graded?" — `No` · `PSA` · `BGS` · `CGC` (prefill from `card.grader`)
2. If graded: "Grade" — picker 1–10 (BGS/CGC also offer 9.5); prefill from `card.grade`.
   If raw: "Card condition" — `Near Mint` · `Lightly played` · `Moderately played` · `Heavily played` · `Damaged` (prefill from `suggested_tier`).
3. "Language" — `English` · `Japanese` · `Other` (prefill from `card.language`)

**General**
1. "Does it work?" — `Yes` · `Partly` · `No` · `Doesn't apply`
2. "Condition" — `New` · `Like new` · `Good` · `Fair` · `Broken` (prefill from `suggested_tier`)

### 7.4 Final condition tier (server, deterministic)
Tier order (best → worst):
- electronics/general: `sealed > open_box > like_new > good > fair > for_parts`
- sneakers/streetwear: `new_tags > like_new > good > fair > worn_out > damaged`
- cards (raw): `nm > lp > mp > hp > dmg`

Rules. "Worse of" means the lower tier in the order above, so the app never flatters the user.
- **Electronics:** `No` → `for_parts`. Else if `Sealed` → `sealed`. Else start from `suggested_tier` (if it was `sealed`, use `like_new`). If `Partly` → worse of (that, `fair`). If the result is `like_new` and `Original box` plus all expected accessories are checked → `open_box`.
- **Sneakers:** wear tier = `Never`+box → `new_tags`; `Never` without box → `like_new`; `1–2 times` → `like_new`; `A few times` → `good`; `A lot` → `fair`. Final = worse of (wear tier, `suggested_tier`).
- **Streetwear:** `Big` flaws → `damaged`; else tags on → `new_tags`; else `Small` flaws → `fair`; else `None` → worse of (`like_new`, `suggested_tier`).
- **Cards:** raw → the chosen condition. Graded → the grader becomes part of the search (`<search_query> PSA`), so results cover several grades, and the ladder shows grades instead of tiers (§7.6 step 9). The user's row is their exact grade.
- **General:** `No` or `Broken` → `for_parts`; `New` → `sealed`; `Like new` → `like_new`; `Good` → `good`; `Fair` → `fair`; `Partly` → worse of (chosen, `fair`).

**Value adjustments** (applied to the user's tier price, shown under "What affects your price"):
- Electronics, not sealed/open_box: no original box → −5%. Each missing expected accessory (other than the box) → −8%, max −20% total.
- Sneakers, tier `like_new` or worse: no original box → −10%.
- Round the adjusted value with the rounding rule in §7.6 step 10.

### 7.5 `POST /price`
Request: `{ scan_id, chosen: { candidate_index } | { custom_query }, answers }`.
1. Compute the final tier (§7.4) and store `answers`, `chosen`, `condition_tier` on the scan.
2. Build or read cached comps (§7.6). Run all sources in parallel, 4s timeout each; a failed source is skipped, not fatal.
3. Compute the result (§7.6), store it in `price_results`.
4. Apply the reveal decision (§6.3). Respond with the full result, or the locked result if no reveal is available.
5. If the scan is already revealed (the user tapped "Not right? Change" and picked another model), re-price it and return the full result without consuming another reveal.

`POST /reveal { scan_id, method: 'ad' | 'nofill', ad_session_id }` applies §6.4 and returns the full stored result.

### 7.6 Pricing algorithm (server, pure functions in `_shared/pricing.ts`)

**Step 1 — Cache.** Key = sha256 of `lowercase(trim(search_query)) | size | grader | country`. TTL 24h, or shorter if the eBay API License Agreement requires shorter caching of eBay data (check it; follow the shorter limit for eBay comps). On a hit, skip to step 5.

**Step 2 — Sources for the user's country** (from the `marketplaces` table, seeded from §7.7):
- **eBay (official API)**: `GET https://api.ebay.com/buy/browse/v1/item_summary/search` with `q=<search_query>[ <size>]`, `limit=50`, header `X-EBAY-C-MARKETPLACE-ID: <id>`, `filter=buyingOptions:{FIXED_PRICE}` (exclude auctions). For countries without their own eBay site, use the fallback marketplace in §7.7 and add `deliveryCountry:<CC>` to the filter; these comps are **international** and get weight 0.5. Auth: OAuth client-credentials token from `https://api.ebay.com/identity/v1/oauth2/token` with scope `https://api.ebay.com/oauth/api_scope`, cached until expiry. If `EBAY_EPN_CAMPAIGN_ID` is set, send `X-EBAY-C-ENDUSERCTX: affiliateCampaignId=<id>` and use `itemAffiliateWebUrl` for links (earns affiliate commission).
  - eBay condition IDs → tiers. Electronics/general: 1000→`sealed`, 1500→`open_box`, 2750→`like_new`, 3000/4000/5000→`good`, 6000→`fair`, 7000→`for_parts`; drop all refurbished (2000–2500). Sneakers/streetwear: 1000→`new_tags`, 1500/1750→`like_new`, 3000/4000→`good`, 5000→`fair`, 6000→`worn_out`, 7000→`damaged`. Cards: ignore the condition ID; the cleaner decides from the title.
  - **Sold prices:** build an adapter for eBay Marketplace Insights (`/buy/marketplace_insights/v1_beta/item_sales/search`), behind `EBAY_SOLD_ENABLED`. It is a limited-release API that needs eBay approval, so it is off by default. When on, sold comps are added with `status: 'sold'`.
- **Local marketplaces (search)**: one Serper query per scan: `POST https://google.serper.dev/search`, header `X-API-KEY`, body `{ q: '<search_query>[ <size>] (site:<d1> OR site:<d2> OR site:<d3>)', gl: '<cc lowercase>', num: 20, tbs: 'qdr:y' }`. Use at most 3 local domains (highest `priority` first).
- **Category reference sites** (one extra Serper query, only for sneakers/streetwear and trading cards): sneakers/streetwear → `stockx.com`, `goat.com`; cards → `tcgplayer.com` for US/CA, `cardmarket.com` everywhere else. These are international and get weight 0.5, unless the site is local to the user (TCGplayer for US).
- Only use Serper's `title`, `snippet`, `link` and any `price` field. **Never fetch the marketplace pages themselves.** Facebook Marketplace is intentionally excluded (no API, not reliably indexed).

**Step 3 — Clean comps with Claude** (text only, same call settings as §7.2). Send the item (display name, variant, category, size/grade) and up to 80 raw comps `{ id, source, title, snippet, price_text, currency_hint, ebay_tier }`.

Cleaner schema:
```ts
z.object({ comps: z.array(z.object({
  id: z.string(),
  match: z.enum(['exact','close','no']),
  price: z.number().nullable(),            // in the listing's own currency, null if unclear
  currency: z.string().nullable(),         // ISO 4217
  tier: Tier.nullable(),
  grade: z.string().nullable(),            // graded cards only, e.g. "PSA 10"
  sold: z.boolean(),
  flags: z.array(z.enum(['bundle','accessory_only','box_only','parts_only','wanted_ad','rental','multiple_quantity'])),
})) })
```
Cleaner system prompt (verbatim):
```
You clean marketplace listings to price one specific item. For each listing:
- match: exact = same model and the variant that matters for price; close = same model, a variant that barely affects price (such as color); no = anything else, including accessories only, bundles with other items, box only, "wanted"/buying ads, rentals, or a different model.
- price: the asking or sold price as a number in the listing's currency. null if missing, a range, or unclear. Never guess. Ignore shipping.
- currency: ISO code from the text or the site (finn.no=NOK, blocket.se=SEK, dba.dk=DKK, ebay.co.uk=GBP, etc.).
- tier: map condition words in any language to the given tier codes. Examples: sealed/uåpnet/oöppnad/uåbnet/OVP/neu versiegelt → sealed; ny/ny med lapp/new with tags/deadstock/DS → new or new_tags; som ny/like new/wie neu/comme neuf → like_new; brukt/begagnad/used/gebraucht/bon état → good; slitt/worn → fair; defekt/ødelagt/for parts/not working/ikke fungerende → for_parts or damaged. For cards: NM/near mint, LP, MP, HP, damaged, and PSA/BGS/CGC grades. Use the provided ebay_tier when present unless the title clearly says otherwise. null if no clue.
- sold: true if the text says the item is sold (Sold, Solgt, Såld, Solgt/Reserveret, Verkauft, Vendu, Venduto, Vendido).
Use only the text provided.
```
Keep `exact` comps. Keep `close` comps with weight 0.5 only if there are fewer than 5 `exact`. Drop comps with null price or any flag. Store cleaned comps in `price_cache`.

**Step 4 — Weights.** Base weight 1.0; international source 0.5; `close` match 0.5 (multiply). Sold comps use their price as is; active (listed) comps are multiplied by `ASKING_TO_SOLD = 0.90`, because asking prices run above what things actually sell for.

**Step 5 — Currency.** Convert every comp to the user's currency with today's ECB rates from Frankfurter (`https://api.frankfurter.dev/v1/latest?base=EUR`, cached once per day in `fx_rates`). If a currency is missing from ECB rates, drop that comp.

**Step 6 — Per-tier medians.** Group comps by tier. In each group with n ≥ 6, remove outliers outside [Q1 − 1.5·IQR, Q3 + 1.5·IQR]. Price = weighted median.

**Step 7 — Fill missing tiers.** A tier is "real" if it has ≥ 3 comps. The anchor is the real tier with the most comps. Each non-real tier = anchor price × ratio[tier] / ratio[anchor], marked `estimated: true`. Ratios (stored in `config`):
- electronics: sealed 1.45, open_box 1.25, like_new 1.12, good 1.00, fair 0.80, for_parts 0.35
- general: sealed 1.40, open_box 1.20, like_new 1.10, good 1.00, fair 0.75, for_parts 0.30
- sneakers/streetwear: new_tags 1.45, like_new 1.20, good 1.00, fair 0.75, worn_out 0.50, damaged 0.25
- cards (raw): nm 1.00, lp 0.80, mp 0.62, hp 0.42, dmg 0.25

**Step 8 — Make it monotonic.** Walking from best to worst tier, each price = min(price, price of the tier above). Real tiers are never raised.

**Step 9 — Graded cards.** If the user's card is graded, the ladder rows are that grader's grades that have ≥ 2 comps (e.g. PSA 10, PSA 9, PSA 8), plus "Raw · Near Mint" for comparison. No estimated rows for grades.

**Step 10 — Rounding** (in the user's currency): < 100 → nearest 1; < 1,000 → nearest 5; < 10,000 → nearest 10; ≥ 10,000 → nearest 50.

**Step 11 — Status and confidence.**
- Fewer than 3 usable comps in total → `status: 'insufficient_data'` (no ladder, no reveal consumed; show whatever listings were found).
- `high`: ≥ 12 comps total and the user's tier is real. `medium`: ≥ 5 comps total. `low`: otherwise.

**Step 12 — Your value** = user's tier price, then the adjustments from §7.4, then rounded.

**Step 13 — Lowest listed now.** The cheapest **active** comp in the user's tier or better, from a local or eBay source, with its original price and currency, converted price, source name, URL and title. Omit it if there is none.

**Step 14 — Best place to sell.** Among the user-country marketplaces (not international) with ≥ 3 comps, the one with the highest median for the user's tier, or the closest real tier. Ties go to more comps. Omit it if there is none.

### 7.7 Marketplace seed data
`priority` is the order for picking the 3 local search domains. Countries not listed use **Fallback**.

| Country | eBay marketplace | Local search domains (priority order) |
|---|---|---|
| US | EBAY_US | mercari.com, offerup.com, depop.com, poshmark.com (poshmark only for sneakers/streetwear) |
| CA | EBAY_CA | kijiji.ca |
| GB | EBAY_GB | vinted.co.uk, depop.com, gumtree.com |
| IE | EBAY_IE | donedeal.ie, adverts.ie |
| NO | EBAY_GB + deliveryCountry:NO (international) | finn.no, tise.com |
| SE | EBAY_DE + deliveryCountry:SE (international) | blocket.se, tradera.com, vinted.se |
| DK | EBAY_DE + deliveryCountry:DK (international) | dba.dk, trendsales.dk (streetwear/sneakers only), vinted.dk |
| FI | EBAY_DE + deliveryCountry:FI (international) | tori.fi, vinted.fi |
| DE | EBAY_DE | kleinanzeigen.de, vinted.de |
| AT | EBAY_AT | willhaben.at, vinted.at |
| CH | EBAY_CH | ricardo.ch, tutti.ch |
| FR | EBAY_FR | leboncoin.fr, vinted.fr |
| ES | EBAY_ES | wallapop.com, vinted.es |
| IT | EBAY_IT | subito.it, vinted.it |
| NL | EBAY_NL | marktplaats.nl, vinted.nl |
| BE | EBAY_BE | 2dehands.be, vinted.be |
| PL | EBAY_PL | olx.pl, allegro.pl, vinted.pl |
| AU | EBAY_AU | gumtree.com.au |
| Fallback | Europe → EBAY_DE, Americas → EBAY_US, Oceania → EBAY_AU, everything else → EBAY_GB; always + deliveryCountry:<CC>, international | No site filter: one Serper query `<search_query> price` with `gl=<cc>`; matching comps are treated as local |

Display names: FINN, Tise, eBay, Mercari, OfferUp, Depop, Poshmark, Kijiji, Vinted, Gumtree, DoneDeal, Adverts, Blocket, Tradera, DBA, Trendsales, Tori, Kleinanzeigen, willhaben, Ricardo, tutti.ch, Leboncoin, Wallapop, Subito, Marktplaats, 2dehands, OLX, Allegro, StockX, GOAT, TCGplayer, Cardmarket.

**Fees** (for the flip calculator; all `fee_verified = false`, `VERIFY` each before launch):
- eBay: 13.25% + 0.40 (in the marketplace currency), ships.
- StockX: 12% total; GOAT: 9.5% + 5 USD; TCGplayer: 13% + 0.30 USD; Cardmarket: 5%; Depop: 3.3% + 0.45 (payment processing); Mercari: 10%; Poshmark: 20% (over $15).
- Vinted, FINN, Tise, Blocket, Tradera, DBA, Trendsales, Tori, Kleinanzeigen, willhaben, Ricardo, tutti.ch, Leboncoin, Wallapop, Subito, Marktplaats, 2dehands, OLX, Allegro, Kijiji, Gumtree, DoneDeal, Adverts, OfferUp: 0% (local pickup assumed).
- `sell_url`: each marketplace's homepage, `VERIFY` the real "create listing" URL.

### 7.8 Locked result shape
When no reveal is available, `/price` returns `{ locked: true, scan, header: { display_name, variant_label, n_listings, sources }, tiers: [{ tier, label, estimated }], your_tier, confidence, unlock: { ads_left, can_watch_ad, day_pass_price_hint: null } }`. It never returns prices, comps or URLs while locked.

### 7.9 `POST /listing` (Pro only)
Request: `{ scan_id, marketplace_id, language: 'local' | 'en' }`. Uses the stored scan + result (no photo). The local language is the marketplace country's main language (NO → Norwegian Bokmål, SE → Swedish, DK → Danish, FI → Finnish, DE/AT/CH → German, FR/BE → French, ES → Spanish, IT → Italian, NL → Dutch, PL → Polish, everything else → English).

Schema: `{ title: string, description: string, suggested_price: number, item_specifics: [{ name, value }] }`.

System prompt (verbatim):
```
You write honest second-hand listings that sell fast. Write in the requested language.
- title: max 80 characters. Brand, model, key variant, size if any, and the condition word. No emojis, no ALL CAPS, no hype words.
- description: 3 short paragraphs. 1) What it is, with the key specs. 2) Condition, stating every known issue plainly. Never hide or soften a flaw. 3) What's included and pickup/shipping (write "Can be picked up or shipped" in the target language).
- suggested_price: the given value, rounded to a typical asking price ending in 9 for amounts under 1,000 (e.g. 199, 1 990 for NOK).
- item_specifics: brand, model, and whichever apply: storage, color, size, set, card number, grade.
```
The cap is 50 listing calls per day per Pro user.

---

## 8. Screens and UX

Navigation: a root stack (no tab bar). The app opens to the **camera**. History and Settings open as pushed screens from the camera's top corners. The paywall is a full-screen modal; sheets use `@gorhom/bottom-sheet`.

Every screen except the camera uses `bg` (#FFFFFF) or `bgSubtle` (#F6F7F9) as described, with a horizontal padding of 20.

### 8.1 Splash
White background, the wordmark "Snapworth" in Inter Bold 32 #0E1116, centered. Hold until fonts load and the anonymous session exists (max 2s, then continue anyway).

### 8.2 Onboarding (first launch only, 3 screens)
Horizontal pager with a page indicator (3 dots: active 20×6 pill #0E1116, inactive 6×6 #D5D8DE). Primary button pinned at the bottom (54 high). Illustrations are simple vector drawings in the app's palette (black line art + one green accent), drawn with `react-native-svg`. No stock photos.

1. Illustration: a phone framing a sneaker, with a mini price ladder next to it.
   Title: "Know what anything's worth"
   Body: "Point your camera at an item. See what it sells for used, from sealed to not working."
   Button: "Continue". Below in caption text: "By continuing you agree to our Terms and Privacy Policy." (links)
2. Illustration: three stacked listing cards with prices.
   Title: "Real prices from real listings"
   Body: "We check eBay and the biggest marketplaces in {Country}, then show prices in {currency name}."
   Under the body, a row of marketplace name chips for the detected country (e.g. "eBay", "FINN", "Tise"). Text chips only, no logos.
   Button: "Continue"
3. Illustration: a camera viewfinder.
   Title: "Allow camera access"
   Body: "Snapworth uses your camera to identify items. Photos aren't saved on our servers."
   Button: "Enable camera" → system prompt. Granted → camera. Denied → camera screen in its denied state (§8.3).

### 8.3 Camera (home)
- Full-bleed `CameraView` (back camera). Light status bar content.
- **Top bar** (inside the safe area, 16 from the top):
  - Left: icon button (44×44 circle, white at 92% opacity, soft shadow) with a `Clock` icon → History.
  - Center: **scan chip** (height 32, radius 999, white 92%, caption 13/600 #0E1116). Text by state:
    - Free with free left: "2 free scans left" / "1 free scan left"
    - Free, 0 free, ads left: "{n} ad scans left"
    - Free, nothing left: "No scans left today"
    - Day Pass: "Day Pass · {h}h left" (minutes when under 1h)
    - Pro: "Pro"
    Tapping the chip opens a small sheet explaining the plan, with the Day Pass and Pro buttons (hidden for Pro).
  - Right: icon button with a `User` icon → Settings.
- **Frame guide**: 4 corner brackets, white, 3 px stroke, 28 px arms, radius 6 at the corners, centered, 78% of screen width, aspect 4:5. Hint text 12 below it: "Fit one item in the frame" (callout 15/500, white, text shadow 0 1 4 rgba(0,0,0,0.4)).
- **Bottom controls** (32 above the bottom safe area):
  - Center: shutter, 76 white circle inside a 4 px white ring with 6 px gap. Press: scale 0.92 spring + `impactMedium` haptic.
  - Left (64 from the shutter center): 48 circle button with an `Image` icon → photo library.
  - Right: 48 circle button with a `Zap`/`ZapOff` icon → flash torch toggle.
- **Denied state**: the camera area becomes `bgSubtle`. Centered icon `CameraOff` 40, title "Camera is off", body "Turn on camera access in Settings to scan items.", primary button "Open Settings", secondary text button "Choose a photo instead".
- On first ever open after onboarding, show a one-time tooltip bubble above the shutter: "Tap to scan your first item" (disappears on tap or after 5s).

### 8.4 Analyzing
- Background `bg`. The captured photo is shown in a card at the top (width 100% minus padding, aspect 4:5, radius 24, card shadow).
- A **scan line** sweeps over the photo: a 2 px line in `accent` with a 40 px soft gradient trail, top → bottom, 1.4s, ease-in-out, looping.
- Below the photo, a status line (headline 17/600), cross-fading through: "Identifying item…" → (after identify) "Checking condition…" → (during /price) "Finding prices in {Country}…" → "Comparing {n} listings…" (use the real count once known).
- A text button "Cancel" at the bottom returns to the camera.
- The variant sheet and question sheet open over this screen. After `/price` returns, replace with the result screen (fade, 250 ms).

### 8.5 Variant sheet ("Which one is it?")
- Snap point 60%. Title "Which one is it?" (title2 22/600). Subtitle "Pick the exact model for the right price." (body, secondary).
- One row per candidate (height 64, radius 16, bg `bgSubtle`, 8 gap): `display_name` (headline) + `variant_label` (callout, secondary). Tap → selected (2 px border #0E1116, `Check` icon on the right) and auto-continue after 200 ms.
- Last row: "Something else" → turns into a text input "Type the exact model" with a "Search" button; the typed text becomes `custom_query`.
- Dragging the sheet down cancels back to the camera.

### 8.6 Question sheet ("A few quick questions")
- Snap point 75%. Title "A few quick questions".
- If `visible_condition.issues` is not empty: a summary card at the top (bg `bgSubtle`, radius 16, padding 16): caption "We spotted" + up to 3 issues as a dot-separated line.
- Each question: label (headline 17/600), 12 below it a wrap of chips (8 gap). Single-select chips act like radio buttons. Haptic `selection` on tap.
- Primary button "See price" pinned at the bottom, disabled until every question is answered. Prefilled answers count as answered.

### 8.7 Result screen (revealed)
Background `bgSubtle`. Scrollable. Top bar: `X` icon button (left, closes to the camera), `MoreHorizontal` button (right) with the menu: "Rescan", "Report a wrong price" (opens a mailto with the scan id).

Content, top to bottom (12 gap between cards, cards are white with radius 20 and padding 20):

1. **Item header** (no card, padding 20): local thumbnail 64×64 radius 14 · `display_name` (title2) · `variant_label` + size/grade (callout, secondary) · meta line (caption, tertiary): "{n} listings · {Source1}, {Source2} · updated {relative time}". Text link "Not right? Change" → reopens the variant sheet, then re-prices. This does **not** consume another reveal; the same scan keeps its reveal.
2. **Value card**: caption "Estimated value" (secondary). Below it the **value** in display 44/700 tabular, with a count-up from 0 over 600 ms (ease-out). Next to it, a condition pill (height 28, radius 999, bg `bgSubtle`, callout 15/600): the tier label. Below that, a confidence badge:
   - high: green dot + "High confidence"
   - medium: amber dot + "Medium confidence"
   - low: grey dot + "Low data: rough estimate"
   And a caption: "Based on {n} listings in {tier label} condition" (or "Estimated from similar listings" if the user's tier is estimated).
3. **Price by condition** card. Title "Price by condition" (headline). One `LadderRow` per tier, best to worst (height 48):
   - Left: tier label (body 16). Middle: dotted leader (1 px dots, `border` color). Right: price (body 16/600 tabular).
   - **User's row**: bg `accentTint`, radius 12, 3 px left bar `accent`, label in 600 weight, plus a small "Yours" tag (micro 11/600 uppercase, `accentText`).
   - **Estimated rows**: price in `textSecondary` with a "≈" prefix and a 14 px `Info` icon; tap → tooltip "Estimated: few listings in this condition."
   - Tap any row → Listings screen filtered to that tier.
   - Rows enter with fade + translateY 8→0, staggered 40 ms.
   - Tier labels: sealed "Sealed", open_box "Open box", like_new "Like new", good "Good", fair "Fair", for_parts "Not working / for parts"; sneakers: new_tags "Deadstock (new)", like_new "Like new", good "Lightly worn", fair "Worn", worn_out "Heavily worn", damaged "Damaged"; streetwear: new_tags "New with tags", like_new "Like new", good "Good", fair "Fair", worn_out "Heavily worn", damaged "Damaged"; cards: nm "Near Mint", lp "Lightly played", mp "Moderately played", hp "Heavily played", dmg "Damaged"; grades "PSA 10" etc.
4. **What affects your price** (only if there are issues or adjustments): one row per item, icon `Minus` in a 20 circle `negativeTint`, label, and the delta on the right in `negativeText` (e.g. "−kr 100"). Issues without a delta show no amount.
5. **Thinking of buying it?** card (flip calculator). Input "You'd pay" (52 high, radius 14, bg `bgSubtle`, currency symbol prefix, numeric keyboard, a "Done" accessory). Below, an empty state caption "Enter a price to see your profit." Once filled: one row per marketplace in the user's country, plus eBay. Each row shows the name, the fee line (caption: "Fees ~kr 0" or "Fees ~$27 + shipping"), and the profit on the right: `+kr 850` in `accentText`, or `−kr 120` in `negativeText`. Sort by profit, highest first. Profit = your value − pay − (fee% × your value + fixed fee). Recompute on every keystroke (debounce 150 ms).
6. **Lowest listed right now** row (if present): caption label, then source name + listing title (1 line, truncated) + price (with the original currency in caption if it differs, e.g. "≈ kr 1 690 · €149"). Chevron → opens the URL in `expo-web-browser`.
7. **Best place to sell** row (if present): "{Name}: highest prices for this near you." Plain text, `TrendingUp` icon.
8. **Footnote** (caption, tertiary, centered, padding 24): "Estimates based on public listings, converted to {currency}. Actual sale prices vary."
9. **Bottom bar** (sticky, white, top hairline `border`, safe-area padding): primary button "Create listing" (flex 1; for non-Pro it shows a small "PRO" badge and opens the paywall) + a 54×54 secondary icon button with `Camera` → "Scan another" (back to camera).

On reveal: `notificationSuccess` haptic.

### 8.8 Result screen (locked)
Same layout, with these changes:
- In the value card and ladder, each price is replaced by a grey rounded placeholder (60–90 px wide, 14 high, `#E9EBEF`) under an `expo-blur` BlurView (intensity 25). Labels, tier pill and confidence stay visible. The flip calculator, lowest-listed and best-place sections are hidden.
- An **unlock card** overlaps the ladder (white, radius 24, shadow `sheet`, padding 24, centered):
  - `Lock` icon in a 44 circle `bgSubtle`
  - Title "See what it's worth" (title2)
  - If `can_watch_ad`: primary button "Watch a short ad" with a `Play` icon, and below it a caption "{ads_left} ad scans left today".
  - Secondary button "Unlimited for 24h · {Day Pass priceString}"
  - Text link "Go Pro"
  - If no ads are left: title "You've used today's scans", body "Free scans reset at midnight.", buttons Day Pass + Go Pro.
- **Watching an ad**: the primary button shows a spinner while loading (max 8s). On close without the reward → nothing changes. On reward → call `/reveal`, then animate: blur intensity 25 → 0 over 400 ms, placeholders cross-fade to prices with the count-up, `notificationSuccess` haptic.
- Ad failed to load: toast "Couldn't load an ad. Try again." Second failure in a row → automatic `nofill` reveal (§6.4).

### 8.9 Day Pass sheet ("On a thrift run?")
Snap point 45%. `ShoppingBag` icon 28 in a 52 circle `accentTint`. Title "On a thrift run?". Body "Unlimited scans for 24 hours. No ads. No subscription." Primary button "Get Day Pass · {priceString}". Text button "Not now". Purchase → success toast "Day Pass active for 24 hours" → the current locked result reveals immediately.

### 8.10 Listings screen
Opened from a ladder row. Title "Listings". Below the header, a horizontal segmented control of tiers (only tiers with comps), with the tapped tier preselected.
Row (height ~84, divider `border`): source name (micro uppercase, tertiary) · title (body, 2 lines) · right side: converted price (headline tabular), original price + currency below in caption if it differs, and a "Sold" (grey pill) or "Listed" (outline pill) tag. Tap → `expo-web-browser`. Caption at the bottom: "Prices converted with today's exchange rates. Asking prices are usually a bit above what items sell for." Empty tier: "No listings in this condition. The price is an estimate."

### 8.11 Listing generator (Pro)
Pushed screen, title "Create listing".
- Marketplace picker (chips for the user's country marketplaces + eBay); defaults to the best place to sell.
- Language toggle: "{Local language}" · "English" (only shown when local ≠ English).
- Generate runs automatically on open and on any change (skeleton shimmer while loading).
- Output cards, each with a "Copy" button (`Copy` icon → `Check` for 1.5s + `selection` haptic): **Title** (with a character count "62/80"), **Description**, **Price** (the suggested price), **Details** (item specifics as a 2-column list).
- Bottom: primary button "Open {Marketplace}" → `sell_url` in the system browser. Caption: "Under 18? Most marketplaces need an adult's account. Ask a parent to post it."
- "Copy all" text button in the top bar copies title + price + description.

### 8.12 Error and empty states (full screen over `bg`, centered, icon 40 in a 72 circle `bgSubtle`)
| Case | Icon | Title | Body | Actions |
|---|---|---|---|---|
| no_item | `ScanSearch` | "We couldn't find an item" | "Fill the frame with one item, in good light." | "Retake" |
| multiple_items | `Layers` | "We see more than one item" | "Scan one item at a time." | "Retake" |
| unclear_photo | `Focus` | "The photo is a bit unclear" | photo_tip, or "Try more light and hold steady." | "Retake" |
| prohibited | `Ban` | "We can't price this item" | "Snapworth doesn't support this kind of item." | "Scan something else" |
| insufficient_data | `SearchX` | "Not enough listings" | "We couldn't find enough listings to price this reliably. No scan was used." Then any found listings below. | "Retake with label visible", "Change model" |
| offline | `WifiOff` | "You're offline" | "Check your connection and try again." | "Try again" |
| busy (503) | `Clock` | "Snapworth is busy" | "Too many people are scanning right now. Try again in a minute, or get unlimited scans." | "Try again", "Day Pass" |
| identify_limit | `Clock` | "Daily limit reached" | "You've hit today's scan limit. It resets at midnight." | "OK" |
| server error | `AlertCircle` | "Something went wrong" | "It's on our side. Try again. No scan was used." | "Try again" |

### 8.13 History
Pushed screen, title "History". The list comes from the server (`scans` joined with `price_results`, newest first), with thumbnails from local files (a `Package` icon placeholder if missing). Row: thumbnail 52 radius 12 · display name (headline, 1 line) · tier label + relative date (caption) · value on the right (headline tabular; "Locked" in tertiary if never revealed). Tap → result screen from the stored result; no reveal used. A locked one opens in the locked state. Swipe left → "Delete". Free users see the last 20, with a footer card: "See your full history with Pro" → paywall. Empty: `Clock` icon, "No scans yet", "Your scans will show up here.", button "Scan something".

### 8.14 Settings
Pushed screen, title "Settings", grouped list (iOS inset-grouped look on both platforms: `bgSubtle` background, white groups radius 16).
- **Plan card** at the top: "Free", "Day Pass: {time} left" or "Pro: renews {date}". Button "Upgrade" (hidden for Pro).
- **Account**: "Sign in to save your history" → sheet with "Continue with Apple" (iOS) / "Continue with Google". Uses `signInWithIdToken` and `linkIdentity`, so the anonymous user keeps their data. When signed in, show the email and "Sign out".
- **Region**: "Country": the detected country (picker of all countries; changing it updates currency and marketplaces). "Currency" is read-only, derived from the country.
- **Purchases**: "Restore purchases".
- **About**: "Rate Snapworth", "Contact support" (mailto: support@snapworth.app, `VERIFY`), "Terms of Service", "Privacy Policy".
- **Danger zone**: "Delete my data" → confirm alert → `/delete-account` → wipe local files → new anonymous session → onboarding.
- Footer: app version, caption tertiary.

### 8.15 Paywall (Pro)
Full-screen modal, `bg`. `X` button top-left, visible immediately.
- Title "Snapworth Pro" (title1 28/700). Subtitle "For people who flip often." (body, secondary).
- Feature list (each row: `Check` icon in a 24 circle `accentTint`, body text):
  - "Unlimited scans, no ads"
  - "Ready-to-post listings for {Marketplace A} and {Marketplace B}" (top 2 for the country)
  - "Your full scan history"
- Plan cards (2, stacked, radius 18, 1.5 px border; the selected one has a 2 px #0E1116 border and a filled radio):
  - Yearly (selected by default): "Yearly" · `priceString`/year · caption "{pricePerMonthString}/month", badge "Best value" (micro, bg `accent`, white text).
  - Monthly: "Monthly" · `priceString`/month.
- Primary button "Continue". Caption below: "Cancels anytime in your {App Store / Google Play} settings. No free trial."
- Divider, then a row "Just need today? Day Pass · {priceString}" → buys the Day Pass.
- Footer links: "Restore" · "Terms" · "Privacy" (caption).

### 8.16 Toasts
Top toast (below the safe area), white, radius 14, shadow card, 16 padding, an icon + callout text, auto-hide after 2.5s, swipe up to dismiss.

---

## 9. Visual design system ("Clean & light")

Put these in `src/theme/tokens.ts`. **Use only these tokens** in components; no raw colors elsewhere.

### 9.1 Colors
| Token | Hex | Use |
|---|---|---|
| bg | #FFFFFF | screens, cards |
| bgSubtle | #F6F7F9 | result/settings background, inputs, secondary buttons |
| textPrimary | #0E1116 | main text, primary buttons |
| textSecondary | #5F6672 | secondary text |
| textTertiary | #9AA1AC | meta, footnotes |
| border | #E7E9EE | dividers, chip borders |
| placeholder | #E9EBEF | locked price placeholders, skeletons |
| primary | #0E1116 | primary button fill |
| primaryDisabled | #C9CDD4 | disabled button fill |
| secondaryFill | #F1F2F5 | secondary button fill |
| accent | #12A150 | large money numbers, "Yours" bar, scan line, badges |
| accentText | #0B7A3B | small green text (contrast safe) |
| accentTint | #EAF7EF | user's ladder row, icon circles |
| negative | #E5484D | icons |
| negativeText | #C62A2F | small red text |
| negativeTint | #FDECEC | icon circles |
| warning | #D9822B | medium-confidence dot |
| link | #2F6BFF | text links |
| scrim | rgba(14,17,22,0.40) | sheet backdrop |

### 9.2 Typography (Inter)
| Style | Size/Line | Weight | Letter spacing |
|---|---|---|---|
| display | 44/48 | 700 | −1.0 |
| title1 | 28/34 | 700 | −0.5 |
| title2 | 22/28 | 600 | −0.3 |
| headline | 17/22 | 600 | 0 |
| body | 16/22 | 400 | 0 |
| callout | 15/20 | 500 | 0 |
| caption | 13/18 | 500 | 0 |
| micro | 11/14 | 600 | +0.4, uppercase |

All prices use `fontVariant: ['tabular-nums']`. Allow font scaling with `maxFontSizeMultiplier: 1.3`.

### 9.3 Spacing, radius, shadows
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40. Screen padding 20. Card padding 20. Gap between cards 12.
- Radius: chip 999, input/button 14, row 16, card 20, hero/unlock card 24, sheet top 28.
- Shadow `card`: color #0E1116, opacity 0.06, radius 20, offset (0, 6); Android elevation 3.
- Shadow `sheet`: opacity 0.12, radius 30, offset (0, −4); Android elevation 12.

### 9.4 Components
- **Button primary**: height 54, radius 14, fill `primary`, label headline 17/600 white. Press: opacity 0.85 + scale 0.98 (spring damping 18, stiffness 220). Loading: white spinner replaces the label. Disabled: `primaryDisabled`.
- **Button secondary**: same size, fill `secondaryFill`, label `textPrimary`.
- **Text button**: callout 15/500 `link`, 44 minimum hit area.
- **IconButton**: 44 (camera overlay) or 40 (top bars) circle; icon 22, stroke 1.75.
- **Chip**: height 40, padding 16 horizontal, radius 999, 1 px `border`, white; selected = fill `textPrimary`, white text, no border.
- **Input**: height 52, radius 14, fill `bgSubtle`, no border; focused = 1.5 px `textPrimary` border.
- **Card**: `bg`, radius 20, padding 20, shadow `card`.
- **Badge/Pill**: height 24–28, radius 999, micro or callout text.
- **Skeleton**: `placeholder` blocks with a 1.2s shimmer (left → right, white at 60% opacity).
- **Sheet**: top radius 28, handle 36×5 #D5D8DE, backdrop `scrim`.

### 9.5 Icons, motion, haptics
- Icons: `lucide-react-native` only, stroke 1.75, size 22 (bars), 18 (inline), color `textPrimary` unless stated.
- Durations: fade 200 ms, sheet 300 ms, screen transitions default native. Count-up 600 ms ease-out. Ladder stagger 40 ms.
- If the OS "reduce motion" setting is on (`useReducedMotion`): no count-up, no stagger, no scan-line sweep (show a static line), and plain cross-fades.
- Haptics: shutter `impactMedium`; chip `selection`; reveal/purchase success `notificationSuccess`; errors `notificationError`.

### 9.6 App icon and store look
- Icon: white background. Four rounded viewfinder corner brackets in #0E1116 frame a small price tag in #12A150. No text. Provide 1024×1024 plus an adaptive Android icon (foreground with the same art on a white background).
- Wordmark: "Snapworth", Inter Bold, letter spacing −0.5, #0E1116.

---

## 10. Copy and tone

- Voice: calm, clear, confident. Like a knowledgeable friend, not a hype account. Short sentences. Sentence case everywhere (only `micro` is uppercase).
- No slang, no emojis, no exclamation marks, no "!!", no fake urgency ("Only 2 left!"), no all caps.
- Numbers first: "kr 1 990 in Good condition", not "In good condition it's worth about…".
- Say "scan", "estimated value", "listings", "condition", "Day Pass", "Pro". Never "AI magic", "guaranteed", "exact price".
- Be honest about uncertainty: "rough estimate", "few listings", "Estimated".
- Currency formatting: `Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 0 })`; show 2 decimals only when the value is under 10 in USD/EUR/GBP-like currencies.
- Relative times: "just now", "5 min ago", "2h ago", "yesterday", then "12 Mar".

All user-facing strings live in `src/copy.ts` (one object, grouped by screen), even though the app is English only. Use the exact strings given in §8.

---

## 11. Privacy, safety and store compliance

- **Photos:** sent to the server only for identification, held in memory, never written to disk or logs on the server, and never sent to analytics or Sentry. Thumbnails stay on the device.
- Usage strings: Camera "Snapworth uses the camera to identify items you want to price." Photo library "Choose a photo of an item to price it."
- **Age:** store age rating 13+. No age gate. No chat, no user-to-user features.
- **Prohibited items** are refused (§7.2).
- **Ads:** rewarded only, `maxAdContentRating: 'T'`, UMP consent in EEA/UK/CH, ATT prompt before the first ad on iOS.
- **Marketplaces:** official eBay APIs + search results only. Never scrape or fetch marketplace pages. Always link out to the original listing. Comply with the eBay API License Agreement (caching limits, attribution).
- **Account deletion** is in Settings (required by Apple and Google).
- Privacy Policy and Terms are hosted pages (`VERIFY` URLs); link them in onboarding, settings and the paywall.
- Logs: never log JWTs, API keys or base64 images. Log scan ids, statuses and timings.

---

## 12. Analytics (PostHog)

Identify with the Supabase user id. No photos, no free text, no emails. Events:
`onboarding_step_viewed {step}`, `camera_permission {granted}`, `scan_captured {source: camera|library}`, `identify_result {status, category, confidence, ms}`, `variant_sheet_shown`, `variant_selected {changed}`, `questions_completed {category}`, `price_result {status, confidence, n_comps, locked, ms}`, `reveal {method}`, `ad_requested`, `ad_loaded`, `ad_failed {code}`, `ad_completed`, `daypass_sheet_shown {trigger}`, `paywall_viewed {source}`, `purchase_started {product}`, `purchase_completed {product}`, `purchase_failed {product, code}`, `flip_calc_used`, `listing_link_opened {marketplace}`, `listing_generated {marketplace, language}`, `listing_copied {field}`, `history_opened`, `error_shown {code}`.

---

## 13. Performance targets

- Shutter → analyzing screen: < 150 ms.
- `/identify` p50 < 3s, p95 < 6s.
- `/price` p50 < 5s (cached < 1s), p95 < 9s.
- Cold start to camera: < 2.5s on a mid-range Android phone.
- Cost: average AI + search cost per scan ≤ $0.003, so check the `cost_ledger` numbers in testing.

---

## 14. Build order (milestones)

1. **Foundation**: Expo project, theme tokens, fonts, components (§9.4), copy file, navigation skeleton, Sentry, PostHog.
2. **Onboarding + camera**: §8.1–8.3, permissions, library picker, image prep.
3. **Backend base**: Supabase project, migrations, RLS, seed (`marketplaces`, `config`), anonymous auth, `/status`.
4. **Identify**: `/identify`, analyzing screen, variant sheet, question sheet, error screens.
5. **Pricing**: eBay + Serper adapters, cleaner, FX, pricing functions with unit tests, `/price`, result screen (revealed), listings screen, flip calculator.
6. **Monetization**: quota, locked state, rewarded ads + SSV, RevenueCat products + webhook, Day Pass sheet, paywall, upsell triggers, cost guard.
7. **Rest**: history, settings, sign-in/linking, delete account, listing generator.
8. **Polish**: animations, haptics, reduce motion, empty/error states, analytics events, performance pass, store assets, `LAUNCH_CHECKLIST.md`.

---

## 15. Tests and acceptance criteria

**Unit tests (Deno, `supabase/functions/_shared/*.test.ts`):**
- Tier mapping (§7.4) for every category and answer combination listed.
- Weighted median, IQR outlier removal (n < 6 skips it), anchor selection, ratio fill, monotonic clamp (real tiers never raised), rounding boundaries (99, 100, 999, 1,000, 9,999, 10,000), confidence levels, insufficient-data cutoff, adjustments.
- Reveal decision order (§6.3), daily reset in a non-UTC timezone, ad cap of 8, no-fill cap of 3, unverified-claim blocking, Day Pass stacking.
- AdMob SSV signature verification with a fixture.

**App tests (Jest + Testing Library):** LadderRow states (yours/estimated/locked), flip calculator math, scan chip text for every plan state, currency formatting for USD, NOK, EUR, JPY.

**Acceptance (manual, on a real iPhone and a real Android phone):**
- [ ] Fresh install → onboarding → camera in under 30 seconds of tapping.
- [ ] Scan a known item (e.g. a game console) in Norway → result shows FINN and/or Tise listings with NOK prices.
- [ ] The same item with the country switched to the US → eBay/Mercari listings in USD.
- [ ] 3rd scan of the day shows the locked state; watching a test ad reveals it; the 11th scan shows the "used today's scans" state.
- [ ] Day Pass purchase (sandbox) reveals the current scan immediately and the chip shows "Day Pass · 23h left".
- [ ] Pro purchase unlocks Create listing; the listing is in Norwegian for FINN and English when toggled.
- [ ] Insufficient data never consumes a reveal.
- [ ] Opening a past scan from history never consumes a reveal.
- [ ] Airplane mode shows the offline screen; nothing crashes.
- [ ] Reduce motion on → no count-up or sweep.
- [ ] Delete my data → the app returns to onboarding with an empty history.

---

## 16. What the human must set up (put this in `LAUNCH_CHECKLIST.md`)

1. Apple Developer account + App Store Connect app; Google Play Console app.
2. Expo account + EAS.
3. Supabase project (enable anonymous sign-ins, Apple and Google providers).
4. Anthropic API key + `ANTHROPIC_MODEL` set to the cheapest current Claude model with image input.
5. eBay Developers Program: production keyset (Browse API). Apply for Marketplace Insights access (sold prices); later set `EBAY_SOLD_ENABLED=true`. Optional: eBay Partner Network campaign id.
6. Serper.dev account + API key.
7. AdMob: iOS + Android apps, one rewarded ad unit each, SSV callback URL = the `admob-ssv` function URL, UMP consent message published.
8. RevenueCat: project, iOS + Android apps, 3 products (§6.5), `pro` entitlement, webhook to `revenuecat-webhook` with the shared secret.
9. PostHog project; Sentry project.
10. Privacy Policy + Terms pages, support email.
11. `VERIFY` every marketplace fee and `sell_url` in §7.7.
12. Check that "Snapworth" is free as an App Store / Play name and trademark in launch countries.
