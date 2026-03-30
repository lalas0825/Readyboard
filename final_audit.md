# ReadyBoard — Final Production Audit

> We are at the end of the build. This is the FINAL audit before going live.
> Run this against the entire codebase. Be brutally honest.

## Step 1: Map the codebase

```bash
# Full tree (exclude noise)
find . -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.next/*' -not -path '*/dist/*' -not -path '*/.expo/*' -not -path '*/android/*' -not -path '*/ios/*' | sort | head -500

# Root and app package.json
cat package.json
cat apps/web/package.json
cat apps/mobile/package.json

# Environment variables (keys only, not values)
grep -h "^[A-Z]" apps/web/.env* apps/mobile/.env* 2>/dev/null | sed 's/=.*//' | sort -u

# Migration count
ls -1 supabase/migrations/ 2>/dev/null | wc -l
```

## Step 2: Audit every feature against the consolidated spec

For each item: ✅ DONE | 🔨 PARTIAL (what's missing) | ❌ NOT BUILT | 🐛 BROKEN

---

### INFRASTRUCTURE
- [ ] Turborepo monorepo (apps/web, apps/mobile, packages/shared, packages/db)
- [ ] Next.js 16 + React 19 + TypeScript (web)
- [ ] Expo SDK 52 + React Native (mobile)
- [ ] Supabase connected (URL + anon key + service role in env)
- [ ] PowerSync offline-first (schema + sync rules + connector)
- [ ] i18n: next-intl (web) + i18next (mobile) with EN + ES
- [ ] Tailwind CSS 4 + shadcn/ui
- [ ] Vercel deployment working
- [ ] TypeScript: `npx tsc --noEmit` — how many errors?
- [ ] Build: `npm run build` — does it pass?
- [ ] Tests: how many test files, how many passing?

### AUTH & ONBOARDING
- [ ] Branded `/login` page (not Supabase default)
- [ ] `/signup` page with role selection (GC / Sub / Owner)
- [ ] Forgot password flow
- [ ] Email verification
- [ ] SMS OTP login for foremen (`/login/foreman` or mobile)
- [ ] Route protection middleware (unauth → /login)
- [ ] Role-based route guards (GC vs Sub vs Foreman)
- [ ] Logout button in sidebar
- [ ] `/onboarding` wizard: org → project → trades → areas → invite team
- [ ] Sub signup + invite acceptance flow
- [ ] Foreman SMS invite flow (super sends → foreman taps → authenticated)

### STRIPE BILLING
- [ ] Stripe SDK installed (stripe + @stripe/stripe-js)
- [ ] 4 products created in Stripe (Starter $399, Pro $699, Portfolio $1999, Sub $59)
- [ ] Stripe env vars configured (SECRET, PUBLISHABLE, WEBHOOK_SECRET, 4 PRICE IDs)
- [ ] organizations table has: stripe_customer_id, stripe_subscription_id, plan, trial_ends_at, subscription_status
- [ ] Stripe customer created on org creation
- [ ] `/api/stripe/checkout` → Stripe Checkout Session
- [ ] `/api/stripe/portal` → Stripe Customer Portal
- [ ] `/billing/success` confirmation page
- [ ] `/api/webhooks/stripe` handling: checkout.completed, invoice.paid, invoice.failed, subscription.updated, subscription.deleted
- [ ] Webhook signature verification
- [ ] `/dashboard/billing` page: plan, trial countdown, upgrade, manage, invoices
- [ ] `usePlan()` hook with feature gating
- [ ] `<UpgradePrompt />` component
- [ ] Trial banner ("X days left")
- [ ] API-level plan enforcement (403 on gated routes)

### GC WEB DASHBOARD — NAVIGATION
- [ ] Full sidebar (not just "Dashboard" link): Overview, Ready Board, Verifications, Delays, Legal, Forecast, CAs, Schedule, Team, Settings, Billing, Logout
- [ ] Separate routes for each (/dashboard/overview, /dashboard/readyboard, etc.) — NOT tabs
- [ ] Active state highlighting on current page
- [ ] Collapsible sidebar (icon-only mode)
- [ ] Badge counts (pending verifications, active delays)
- [ ] Project selector dropdown (for multi-project / Portfolio plan)
- [ ] Notification bell → dropdown with recent notifications
- [ ] User avatar menu → Profile, Billing, Logout
- [ ] Live indicator (green dot)
- [ ] Mobile web: hamburger menu

### GC WEB DASHBOARD — PAGES
- [ ] **Overview** — 1-Screen Dashboard (metrics, alerts ranked by cost, forecast, morning briefing card)
- [ ] **Ready Board** — Floors × trades grid, color cells, click → detail panel, filters, print
- [ ] **Verifications** — GC queue: pending items, approve/correct, task checklist expandable, badges
- [ ] **Delays & Costs** — Cost counter, table with filters, drill-down, "Generate NOD" per row
- [ ] **Legal Docs** — NOD/REA/Evidence list, status badges, generate, receipt tracking, publish to GC
- [ ] **Forecast** — Schedule delta chart, crew performance, critical path, recovery recommendations
- [ ] **Corrective Actions** — Table + Kanban toggle, create modal, response time metrics
- [ ] **Schedule** — Upload dropzone (.csv/.xlsx), preview, column mapper, import via RPC
- [ ] **Team** — Member list, invite (email/SMS), assign foremen to areas, roles, streaks
- [ ] **Settings** — Project info, trade sequence editor, area manager, benchmarks, notifications, trade config (% vs checklist), data export
- [ ] **Billing** — (covered above)

### FOREMAN MOBILE
- [ ] Home screen: color-coded area cards (READY/ALMOST/BLOCKED/HELD)
- [ ] Report Step 1: Slider (percentage) OR TaskChecklist (checklist mode)
- [ ] Report Step 2: Blockers (Yes/No, 80px buttons)
- [ ] Report Step 3: Reason codes (7 icons, 56px+)
- [ ] Photo capture wired to report submit (not just installed)
- [ ] GPS capture wired to report submit (not just installed)
- [ ] Confirmation: full-screen green ✓ + haptic
- [ ] NOD draft banner (purple, when blocked areas exist)
- [ ] Bottom tab navigation: My Areas | Report | Legal | Profile
- [ ] Profile screen: language toggle, notification prefs, sync status, logout
- [ ] Legal tab: NOD drafts + sent docs with status
- [ ] Offline-first: all actions work without connectivity
- [ ] Sync indicator (green/amber dot, never blocks)
- [ ] Checklist mode: TaskChecklist with SUB/GC tags, gate icons
- [ ] GC VERIFY tasks greyed out on foreman ("Awaiting GC")
- [ ] Language auto-detect + toggle (EN/ES)

### CHECKLIST SYSTEM
- [ ] trade_task_templates table with 211 rows (14 trades × 4 area types)
- [ ] area_tasks table (28 columns, SUB/GC ownership, gates, corrections)
- [ ] Template cloning: area creation → clones templates into area_tasks (VERIFY THIS WORKS)
- [ ] Dual reporting mode: percentage slider vs task checklist (configurable per trade)
- [ ] effective_pct calculation from task weights
- [ ] Gate tasks block READY even at high %
- [ ] GC Verification Queue with approve/correct flow
- [ ] Correction flow with reason codes
- [ ] Notification chain: verify needed → 4h reminder → 24h escalation
- [ ] SUB/GC RLS enforcement (foreman can't complete GC tasks)
- [ ] Settings: Trade Config shows 14 trades with mode toggle

### LEGAL DOCUMENTATION ENGINE
- [ ] Auto delay_log on first BLOCKED status
- [ ] NOD draft auto-generation (within 60 sec of BLOCKED)
- [ ] NOD approval: review → finger signature → send
- [ ] Finger signature canvas (pointer events, PNG export, metadata)
- [ ] SHA-256 hash computed on PDF before delivery
- [ ] Hash stored in legal_documents.sha256_hash
- [ ] Hash printed in PDF footer
- [ ] Public verification endpoint: /api/legal/verify?hash=xxx
- [ ] Receipt tracking pixel: /api/legal/track/[uuid] (1x1 PNG, no cache)
- [ ] Receipt events logged (timestamp, IP, device, open count)
- [ ] 48h no-response alert (GC opened, didn't respond)
- [ ] 72h never-opened alert
- [ ] REA generation (itemized cost table, references NODs)
- [ ] Evidence Package generation (8-section arbitration PDF)
- [ ] Bilingual PDFs (EN + ES)
- [ ] AIA A201 §8.3.1 contract references in templates
- [ ] NOD delivery via email with tracking pixel embedded

### FORECAST ENGINE
- [ ] Burn rate calculation (14-day EMA)
- [ ] Projected finish date per area
- [ ] Schedule delta (projected vs P6 baseline)
- [ ] P6 CSV/XLSX import (PapaParse + atomic RPC)
- [ ] At-risk alerts (>3 days behind)
- [ ] Crew performance vs benchmark
- [ ] Change order engine
- [ ] Manual schedule override + audit log

### NOTIFICATIONS
- [ ] notifications table with type-based system
- [ ] Anti-spam: 1 per type per area per 24h
- [ ] Push notification infrastructure (Expo Push API, not just DB polling)
- [ ] users.push_token column
- [ ] Push triggers: READY→foreman, BLOCKED→GC+Sub, NOD→super, verify→GC, 4h/24h reminders, correction→foreman
- [ ] All notifications bilingual (EN/ES)
- [ ] Notification bell UI on web dashboard

### EMAIL SYSTEM
- [ ] Resend installed + configured
- [ ] Sender: noreply@readyboard.ai
- [ ] DNS: SPF, DKIM, DMARC on readyboard.ai
- [ ] Templates (bilingual): welcome, team invite, NOD delivery+pixel, receipt confirmation, trial ending (7/3/1), payment failed
- [ ] NOD email actually sends with tracking pixel

### AI MORNING BRIEFING
- [ ] lib/ai/collectBriefingData.ts (parallel data fetch)
- [ ] lib/ai/briefingPrompt.ts (role-aware, language-aware)
- [ ] lib/ai/generateBriefing.ts (Gemini 2.5 Flash via OpenRouter)
- [ ] OPENROUTER_API_KEY configured
- [ ] briefings table + RLS
- [ ] Cron: 6am daily generation per user × project
- [ ] MorningBriefing.tsx card on Overview (dismissable, read_at tracking)
- [ ] Mobile briefing card (GC/Sub only, never foreman)
- [ ] Past Briefings (last 7 days)
- [ ] Demo: hardcoded briefing (no API call)
- [ ] Cost monitoring (tokens per briefing)

### DEMO ACCOUNT
- [ ] demo-gc@readyboard.ai + demo-sub@readyboard.ai credentials
- [ ] scripts/seed-demo.ts (idempotent)
- [ ] Realistic data: 383 Madison, Tishman/Jantile, 9 floors, 45 areas, 14 trades
- [ ] Field reports with realistic progress (80%/50%/10%)
- [ ] Active delays with costs ($14.4K, $9.6K, $1.6K)
- [ ] Legal docs (NOD draft, NOD sent+opened)
- [ ] Corrective actions (created, acknowledged)
- [ ] Verification queue (3 pending items)
- [ ] Foreman GPS data (NYC coordinates)
- [ ] Demo login works → all tabs show data

### LANDING PAGE & LEGAL
- [ ] `/` marketing page: hero, CTAs, value props, pricing, footer
- [ ] `/terms` — Terms of Service
- [ ] `/privacy` — Privacy Policy

### SECURITY
- [ ] CORS configured
- [ ] CSP headers
- [ ] Rate limiting on /api/auth/*, /api/webhooks/*, /api/stripe/*
- [ ] No hardcoded secrets (grep clean)
- [ ] Stripe webhook signature verification
- [ ] Security headers (X-Frame-Options, X-Content-Type-Options)

### APP STORE READINESS
- [ ] Expo EAS build configured
- [ ] Android APK generated
- [ ] iOS TestFlight build generated
- [ ] App icon (1024px for App Store, 512px for Play Store)
- [ ] Splash screen
- [ ] App Store screenshots (iPhone, iPad)
- [ ] Play Store screenshots (phone, tablet)
- [ ] App Store description text (EN + ES)
- [ ] Play Store description text (EN + ES)
- [ ] Privacy policy URL configured in app stores
- [ ] App Store review guidelines compliance check
- [ ] Play Store content rating questionnaire
- [ ] App name: "ReadyBoard" — check availability in both stores
- [ ] Bundle ID / package name configured (com.readyboard.app or similar)
- [ ] App signing configured (EAS credentials)
- [ ] Deep linking configured (readyboard.ai links open app)

---

## Step 3: Run diagnostics

```bash
# TypeScript
npx tsc --noEmit 2>&1 | tail -20

# Build
npm run build 2>&1 | tail -30

# Tests
npx vitest run 2>&1 | tail -20

# Lint
npx eslint . --ext .ts,.tsx 2>&1 | tail -20

# Secrets check
grep -rn "sk_test\|sk_live\|whsec_\|SUPABASE.*=.*eyJ" --include="*.ts" --include="*.tsx" --include="*.js" | head -10

# TODO/FIXME
grep -rn "TODO\|FIXME\|HACK\|XXX" --include="*.ts" --include="*.tsx" | head -20

# Dead dependencies
npx depcheck 2>&1 | head -30

# Bundle size (web)
ls -lh apps/web/.next/static/chunks/ 2>/dev/null | tail -10
```

## Step 4: Deliver the final audit report

```markdown
## ReadyBoard Final Audit — [Date]

### Overall Status: X% production-ready

### ✅ DONE (count)
### 🔨 PARTIAL (count + what's missing per item)
### ❌ NOT BUILT (count)
### 🐛 BROKEN (count + errors)

### Critical Blockers for Launch
1. ...
2. ...

### Critical Blockers for App Store
1. ...
2. ...

### Nice-to-Have Before Launch (not blocking)
1. ...

### Post-Launch Priority (build after live)
1. ...
```

Be thorough. Check every file. Test every route. This is the last gate before real users.
