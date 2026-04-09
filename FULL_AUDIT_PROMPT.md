# ReadyBoard — Full Audit (April 4, 2026)

## Instructions

Run a comprehensive audit of the ENTIRE codebase — web AND mobile. Check every item below. 
For each item, report one of:
- ✅ DONE — working correctly
- 🔨 PARTIAL — code exists but incomplete or broken
- ❌ NOT BUILT — no code found
- 🐛 BUG — code exists but has errors

**DO NOT FIX ANYTHING.** Just report the status. Output a markdown table for each section.

After completing all sections, output:
1. A summary table with totals per category
2. A prioritized list of what to fix first
3. Any TypeScript errors (`npx tsc --noEmit`)
4. Build status (`npm run build`)

---

## SECTION 1: Infrastructure

Check:
- [ ] Turborepo monorepo structure (apps/web, apps/mobile, packages/*)
- [ ] Next.js version and React version
- [ ] Expo SDK version and React Native version
- [ ] Supabase connection (URL + keys in env)
- [ ] PowerSync connection (URL + sync rules)
- [ ] i18n setup — web (next-intl) and mobile (i18next)
- [ ] Tailwind CSS + shadcn/ui
- [ ] Vercel deployment config
- [ ] TypeScript: run `npx tsc --noEmit`, report errors
- [ ] Build: run `npm run build`, report pass/fail
- [ ] Total files in project
- [ ] SQL migrations count
- [ ] Env vars count

---

## SECTION 2: Database Schema

Check Supabase tables. For each table, verify it exists and list key columns:
- [ ] `organizations` — id, name, type, default_language, stripe fields
- [ ] `projects` — id, org_id, name, address, labor_rate_per_hour, jurisdiction
- [ ] `floors` — id, project_id, number, name
- [ ] `units` — id, project_id, floor_id, name, unit_type, sort_order (NEW TABLE)
- [ ] `areas` — id, project_id, floor_id, unit_id (nullable), name, area_type, area_code, description, sort_order
- [ ] `trade_sequences` — id, project_id, trade_name, sequence_order, straight_time_hours, ot_multiplier, dt_multiplier, saturday_rule, typical_crew
- [ ] `area_trade_status` — id, area_id, trade_name, effective_pct, status, reporting_mode
- [ ] `labor_rates` — id, project_id, trade_name, role, hourly_rate (NEW TABLE)
- [ ] `trade_task_templates` — 211 rows seeded?
- [ ] `area_tasks` — columns for SUB/GC ownership, gates, corrections
- [ ] `delay_logs` — area_id, trade_name, reason, started_at, resolved_at, crew_composition, daily_cost, cumulative_cost
- [ ] `legal_documents` — sha256_hash, receipt_tracking_uuid, sent_at, signature_png_url
- [ ] `receipt_events` — document_id, event_type, ip_address, opened_at
- [ ] `nod_drafts` — draft_content, reminder_sent_at, sent_at
- [ ] `corrective_actions` — acknowledged_at, in_resolution_at, resolved_at
- [ ] `field_reports` — area_id, trade_name, progress_pct, gps_lat, gps_lng, reported_at
- [ ] `forecast_snapshots` — overall_pct, projected_completion, delta_days
- [ ] `notifications` — type, read_at
- [ ] `invitations` — token, role, trade_name, email, phone, status, assigned_area_ids, language
- [ ] `briefings` — project_id, user_id, content, read_at
- [ ] `project_subscriptions` — stripe_customer_id, plan, trial_ends_at, subscription_status
- [ ] `organization_members` — user_id, org_id, role, trade_name
- [ ] `user_assignments` — user_id, area_id, project_id
- [ ] RLS policies count
- [ ] Functions count  
- [ ] Triggers count
- [ ] Indexes count

---

## SECTION 3: Auth & Onboarding

- [ ] Branded `/login` page (not Supabase default)
- [ ] `/signup` with role selection (GC / Specialty Contractor / Building Owner)
- [ ] Forgot password flow
- [ ] Email verification
- [ ] SMS OTP login for foremen — real or console.log?
- [ ] Route protection middleware (unauth → /login)
- [ ] Role-based route guards (GC → /dashboard, Sub → /dashboard-sub)
- [ ] Logout button in sidebar
- [ ] `/onboarding` wizard: how many steps? What does each step do?
- [ ] Onboarding Step: Organization setup
- [ ] Onboarding Step: Project setup — does it still have single "Labor Rate ($/hr)" field?
- [ ] Onboarding Step: Trade selection — 14 trades with sequence
- [ ] Onboarding Step: Areas — Quick Add with presets? Multi-select area types? Custom text input? CSV import?
- [ ] Onboarding Step: Team invites
- [ ] Sub signup + invite acceptance flow (`/signup/sub`, `/join/[token]`)
- [ ] Foreman invite flow — magic link, no password

---

## SECTION 4: Invitation System

- [ ] `invitations` table exists with all fields (token, role, trade_name, email, phone, status, assigned_area_ids, language)
- [ ] Invite modal on Team page — does it show trade selector for Sub PM / Super / Foreman?
- [ ] Invite modal — does Foreman show phone field instead of email?
- [ ] Invite modal — does it show area assignment selector?
- [ ] Area assignment selector — flat dropdown or grouped (Floor → Unit → Area)?
- [ ] `/join/[token]` page — handles new user, existing user, foreman scenarios?
- [ ] Foreman join — magic link flow, no password?
- [ ] After foreman invite — shows copy-to-clipboard link for WhatsApp?
- [ ] Pending invitations shown on Team page with resend/revoke?
- [ ] Invite email template — bilingual? Includes trade name?
- [ ] `organization_members.trade_name` field exists?

---

## SECTION 5: Stripe Billing

- [ ] Stripe SDK installed
- [ ] Price IDs configured — how many? (need 4: Starter $399, Pro $699, Portfolio $1999, Sub $59)
- [ ] `project_subscriptions` table with stripe columns
- [ ] Checkout session creation
- [ ] Customer portal session
- [ ] Webhook handler — which events handled?
- [ ] `/dashboard/billing` page
- [ ] `getPlanForProject` + `hasFeature()` 
- [ ] `UpgradePrompt` component on gated features
- [ ] Trial banner with countdown — exists?
- [ ] `/billing/success` dedicated page — exists?

---

## SECTION 6: GC Dashboard — Navigation & Pages

### Navigation
- [ ] Full sidebar with all pages listed
- [ ] Separate routes for each page (not tabs)
- [ ] Active state highlighting
- [ ] Badge counts (legal, verifications)
- [ ] Project selector dropdown
- [ ] User info + role badge + logout
- [ ] Mobile hamburger menu
- [ ] Notification bell dropdown — exists?
- [ ] Live indicator (green dot) — exists?
- [ ] Collapsible sidebar — exists?

### Pages — check each exists AND has real data (not empty state)
- [ ] **Overview** — metrics cards, alerts ranked by cost, forecast section, morning briefing
- [ ] **Ready Board** — is it the NEW collapsible hierarchy (Floor → Unit → Area) or the OLD flat grid?
  - [ ] Floor rows with aggregate status bars?
  - [ ] Unit rows (collapsible) with child areas?
  - [ ] Areas without units shown directly under floor?
  - [ ] Floor quick-jump tabs?
  - [ ] "Expand all / Collapse all" buttons?
  - [ ] "Show problems only" filter?
  - [ ] Area codes displayed?
  - [ ] Area descriptions displayed?
  - [ ] IN PROGRESS (blue) status for 1-99% progress?
  - [ ] 7 statuses in legend (PENDING, READY, IN PROGRESS, ALMOST, BLOCKED, HELD, DONE)?
- [ ] **Verifications** — GC queue, approve/correct modal
- [ ] **Delays & Costs** — summary cards, filterable table, daily cost uses trade-specific rates or flat rate?
- [ ] **Legal Docs** — NOD/REA/Evidence list, receipt tracking, escalation alerts
- [ ] **Forecast** — trend line with historical data? Or "insufficient data"?
- [ ] **Corrective Actions** — Kanban + table toggle
- [ ] **Schedule** — CSV upload, preview, column mapper
- [ ] **Team** — member list, invite button, pending invitations
- [ ] **Settings** — how many tabs? List them
  - [ ] General — project name, address, labor rate (single field or removed?)
  - [ ] Trades & Costs — 14 trades toggle. Does it have labor rate matrix (per trade × role)? OT hours config?
  - [ ] Legal
  - [ ] Integrations
  - [ ] Roles
  - [ ] Audit Logs
- [ ] **Billing** — plan card, upgrade, feature comparison

---

## SECTION 7: Foreman Mobile App

### Auth & Login
- [ ] Login screen — background image (the dark construction image with indicators)?
- [ ] Email + SMS toggle on login?
- [ ] SMS magic link login working?

### Home Screen
- [ ] Areas displayed — flat list or grouped by unit?
- [ ] Area cards show area_code?
- [ ] Area cards show description?
- [ ] Status colors correct (READY green, ALMOST amber, BLOCKED red, HELD purple, WORKING blue)?
- [ ] Unit section headers with aggregate status?

### Report Flow
- [ ] Step 1: Slider (percentage) OR TaskChecklist (checklist mode)?
- [ ] Step 2: Blockers (Yes/No buttons, 80px)?
- [ ] Step 3: Reason codes (7 icons)?
- [ ] Photo capture wired to submit?
- [ ] GPS capture wired to submit?
- [ ] Area code shown in report header?
- [ ] Confirmation: full-screen green ✓ + haptic?
- [ ] Area code shown in confirmation?

### Navigation
- [ ] Bottom tabs: My Areas | Report | Legal | Profile?
- [ ] Tab bar height 80px?

### Legal Tab
- [ ] NOD draft banner (purple)?
- [ ] Pending NODs grouped by unit?
- [ ] Status badges?

### Profile
- [ ] User info, role badge
- [ ] Push notification toggle
- [ ] Language toggle (EN/ES)
- [ ] Assigned units/areas shown?
- [ ] Logout button

### Offline
- [ ] PowerSync connected + syncing?
- [ ] Sync indicator visible?
- [ ] `units` table in PowerSync schema?
- [ ] `area_code`, `description`, `unit_id` synced for areas?

### Carlos Standard Compliance
- [ ] All tap targets ≥ 56px?
- [ ] Body text ≥ 18px?
- [ ] Every action ≤ 3 taps?
- [ ] Language auto-detected from device?

---

## SECTION 8: Labor Rates

- [ ] `labor_rates` table exists?
- [ ] Rates seeded per trade × role (foreman, journeyperson, apprentice, helper)?
- [ ] `trade_sequences` has: straight_time_hours, ot_multiplier, dt_multiplier, saturday_rule, typical_crew?
- [ ] Settings → Trades & Costs shows rate matrix UI (editable per trade × role)?
- [ ] Settings → Trades & Costs shows OT hours configuration?
- [ ] Delay cost calculations use trade-specific rates or flat project rate?
- [ ] NOD PDF shows role-by-role cost breakdown or flat rate?
- [ ] Single "Labor Rate ($/hr)" field removed from onboarding?

---

## SECTION 9: Area Codes & Descriptions

- [ ] `areas.area_code` column exists?
- [ ] `areas.description` column exists?
- [ ] area_code is NOT auto-generated (manual entry only)?
- [ ] area_code is NOT unique (duplicates allowed)?
- [ ] area_code displayed in Ready Board grid?
- [ ] area_code displayed in mobile area cards?
- [ ] area_code displayed in report flow header?
- [ ] area_code editable in Settings or area management?
- [ ] CSV import supports area_code + description columns?

---

## SECTION 10: Legal Documentation

- [ ] Auto delay_log on BLOCKED status
- [ ] NOD draft auto-generation
- [ ] NOD approval: review → finger signature → send
- [ ] Finger signature canvas (20-point min)
- [ ] SHA-256 hash on PDF (2-pass)
- [ ] Hash stored in legal_documents + printed in footer
- [ ] Public verification endpoint `/api/legal/verify?hash=xxx`
- [ ] Receipt tracking pixel `/api/legal/track/[uuid]`
- [ ] Receipt events logged
- [ ] 48h/72h escalation alerts
- [ ] REA generation
- [ ] Evidence Package
- [ ] Bilingual PDFs (EN + ES)
- [ ] AIA A201 references
- [ ] NOD email delivery — does it actually SEND the email or just create the record?

---

## SECTION 11: Demo Data

- [ ] Demo account exists (demo-gc credentials)?
- [ ] Seed script exists (`scripts/seed-demo.ts` or similar)?
- [ ] Does the seed create historical data (2-3 months) or just current state?
- [ ] Forecast page shows trend line with data points or "insufficient data"?
- [ ] Delays page shows resolved + active delays?
- [ ] Legal docs page shows sent NODs with receipt tracking?
- [ ] Corrective Actions page shows items in various states?
- [ ] Team page shows members with roles + trades?
- [ ] Verifications page shows pending + approved + corrected?
- [ ] Overview page shows meaningful alerts ranked by cost?

---

## SECTION 12: Landing Page & Legal

- [ ] Landing page exists at `/`
- [ ] Hero section — has background image? Which image?
- [ ] Hero badge text — what does it say? (should be "Built for foremen. Trusted by GCs.")
- [ ] "Built for Carlos" section — has it been changed to "Built for the crew"?
- [ ] Pricing section — how many cards? (should be 4: Starter, Pro, Portfolio, Sub)
- [ ] "View Demo" button — does it work?
- [ ] `/terms` page exists?
- [ ] `/privacy` page exists?
- [ ] Footer links work?

---

## SECTION 13: Security

- [ ] CSP headers
- [ ] Security headers (X-Frame-Options, etc.)
- [ ] No hardcoded secrets in code
- [ ] Rate limiting on auth routes?
- [ ] Rate limiting on webhook routes?
- [ ] No TODOs/FIXMEs in code?

---

## SECTION 14: App Store Readiness (Mobile)

- [ ] `eas.json` configured?
- [ ] `app.json` / `app.config.js` has all required fields?
- [ ] App icon exists (1024×1024)?
- [ ] Adaptive icon exists (Android)?
- [ ] Splash screen image exists?
- [ ] Login background image — which image is it using?
- [ ] Bundle ID: `com.readyboard.foreman`?
- [ ] Android permissions (camera, location, vibrate)?
- [ ] iOS infoPlist (camera, location descriptions)?
- [ ] Last successful APK build date?
- [ ] Deep linking configured?

---

## SECTION 15: Email System

- [ ] Resend installed + configured?
- [ ] Sender address configured (`noreply@readyboard.ai`)?
- [ ] Email templates exist — list which ones
- [ ] Missing templates — list which ones are needed but don't exist
- [ ] NOD email dispatch — does it actually send email with tracking pixel?
- [ ] DNS (SPF/DKIM/DMARC) configured?

---

## SECTION 16: Notifications

- [ ] Notifications table exists?
- [ ] `users.push_token` or `profiles.push_token` column exists?
- [ ] `sendPushNotification()` function exists?
- [ ] Which notification types are actually wired (list them)?
- [ ] Anti-spam index (1 per type per area per 24h)?
- [ ] Notification bell on web dashboard?

---

## SECTION 17: AI Morning Briefing

- [ ] `collectBriefingData.ts` exists?
- [ ] `MorningBriefingCard.tsx` exists?
- [ ] `briefings` table exists (migration applied)?
- [ ] OPENROUTER_API_KEY configured?
- [ ] Cron scheduler configured?
- [ ] Demo hardcoded briefing for demo account?

---

## OUTPUT FORMAT

After checking everything, output:

### 1. Summary Table
| Section | Done | Partial | Not Built | Bugs | Total |
|---------|------|---------|-----------|------|-------|

### 2. Critical Blockers (will crash or break core functionality)
Numbered list, severity, estimated fix time

### 3. Launch Blockers (must fix before showing to a PM)  
Numbered list, severity, estimated fix time

### 4. Nice-to-Have (can fix after launch)
Numbered list

### 5. TypeScript Errors
Output of `npx tsc --noEmit`

### 6. Build Status
Output of `npm run build`
