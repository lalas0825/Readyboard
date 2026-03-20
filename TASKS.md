# ReadyBoard — TASKS.md

> 7-week V1 build. Legal documentation, multilanguage (EN+ES), offline-first, tablet layout, 1-Screen GC Dashboard.
> AI is explicitly OUT of scope for V1.

## Pre-Build (Week 0 — Before Coding)

- [ ] **LEGAL:** Find NYC construction litigation attorney for 2h template review. Budget: $600-1,200
- [ ] **LEGAL:** Schedule attorney review for Week 5-6 (parallel with PDF generation build)
- [ ] **PRODUCT:** Finalize trade sequence templates for tile/stone (bathroom, kitchen, hallway, lobby)
- [ ] **PRODUCT:** Get real production benchmarks from Sal (sqft/hr/person by area type + material)
- [ ] **PRODUCT:** Get real labor rates from current projects ($X/hr fully burdened)
- [ ] **PRODUCT:** Confirm AIA A201 §8.3.1 clause text for NOD template
- [ ] **DESIGN:** Create high-contrast light theme for foreman mobile (test on phone in direct sunlight)
- [ ] **DESIGN:** Design the 3-screen foreman flow (Where? → Status? → Why blocked?) — mockup in Figma or paper
- [ ] **INFRA:** Set up Supabase project (readyboard-prod)
- [ ] **INFRA:** Set up Expo project (readyboard-mobile)
- [ ] **INFRA:** Set up Next.js project via SaaS Factory (readyboard-web)
- [ ] **INFRA:** Set up Turborepo monorepo structure
- [ ] **INFRA:** Set up Vercel project for web dashboard
- [ ] **DEMO:** Show 1-Screen Dashboard to Jantile PM (80 Clarkson). Ask the question. Listen.

---

## Week 1 — Foundation + Data Model

### Supabase Schema
- [ ] Create `organizations` table (name, type: GC|SUB, default_language, logo_url)
- [ ] Create `projects` table (name, address, labor_rate_per_hour, legal_jurisdiction, sha256_enabled, org_id)
- [ ] Create `users` table (email, phone, name, role, language, org_id)
- [ ] Create `areas` table (name, floor, area_type, project_id, total_sqft)
- [ ] Create `trade_sequences` table (project_id, area_type, trade_name, sequence_order)
- [ ] Create `user_assignments` table (user_id, area_id, trade_name)
- [ ] Create `production_benchmarks` table (project_id, trade_name, area_type, sqft_per_hour_per_person)
- [ ] Create `field_reports` table (area_id, user_id, status, progress, reason_code, gps_lat, gps_lng, photo_url, created_at, offline_created_at, device_id)
- [ ] Create `delay_logs` table (area_id, trade_name, reason_code, started_at, man_hours, daily_cost, cumulative_cost, nod_draft_id, rea_id, receipt_confirmed)
- [ ] Create `corrective_actions` table (delay_log_id, assigned_to, deadline, note, created_at, acknowledged_at, in_resolution_at, resolved_at, created_by)
- [ ] Create `legal_documents` table (project_id, org_id, type: NOD|REA|EVIDENCE, sha256_hash, receipt_tracking_uuid, first_opened_at, open_count, sent_at, sent_by, signature_png_url, pdf_url)
- [ ] Create `nod_drafts` table (delay_log_id, draft_content_jsonb, reminder_sent_at, sent_at, sent_by)
- [ ] Create `receipt_events` table (document_id, event_type, ip_address, device_type, opened_at)
- [ ] Write RLS policies: foreman sees only assigned areas
- [ ] Write RLS policies: sub PM sees all areas for their trade
- [ ] Write RLS policies: GC PM sees all areas across all trades
- [ ] Write RLS policies: legal_documents private to sub until published
- [ ] Write RLS policies: organization isolation (GC A ≠ GC B)
- [ ] Seed data: 80 Clarkson project, Suffolk as GC, Jantile as sub, 5 floors, units A-E

### i18n Architecture
- [ ] Set up i18next in shared package
- [ ] Create EN translation file (all UI strings)
- [ ] Create ES translation file (all UI strings)
- [ ] Create reason_codes translations (EN + ES)
- [ ] Create notification_templates translations (EN + ES)

### SHA-256 Infrastructure
- [ ] Create shared/legal/hash.ts — SHA-256 hash function for PDF buffers
- [ ] Create shared/legal/verify.ts — hash verification endpoint logic
- [ ] Add sha256_hash column to legal_documents (done in schema above)

### PowerSync Schema
- [ ] Define PowerSync sync rules (which tables sync to mobile)
- [ ] Define conflict resolution strategy (last-write-wins with offline_created_at)
- [ ] Set up PowerSync project + connect to Supabase

---

## Week 2 — Foreman Mobile App (Offline-First)

### Expo Setup
- [ ] Initialize Expo project with TypeScript
- [ ] Configure expo-localization for auto language detection
- [ ] Configure expo-camera for photo evidence
- [ ] Configure expo-location for GPS capture
- [ ] Configure expo-haptics for confirmation feedback
- [ ] Set up PowerSync + SQLite in mobile app
- [ ] Verify offline-first: all reads/writes go to local SQLite first

### Auth (SMS Magic Link)
- [ ] Create SMS magic link flow in Supabase Auth
- [ ] Superintendent sends invite → foreman receives SMS with link
- [ ] Foreman taps link → authenticated → sees assigned areas
- [ ] Zero form fields. Zero password. Zero onboarding screens
- [ ] GC/Sub PM: email + password login (standard Supabase auth)

### Foreman Home Screen
- [ ] Build "Where are you working?" screen
- [ ] Show ONLY areas assigned to this foreman (from user_assignments)
- [ ] Color-coded cards: green (READY), yellow (ALMOST), red (BLOCKED), purple (HELD)
- [ ] Large cards (56px+ height), readable in sunlight
- [ ] High contrast light theme
- [ ] Header: foreman name, trade, project name, sync status indicator
- [ ] Language auto-detected. Hidden toggle in profile

### Report Flow — Screen 2: Status
- [ ] Three large buttons: DONE ✓ / WORKING ◔ / BLOCKED ✕
- [ ] If DONE → save field_report(status=DONE, progress=100) → confirmation screen
- [ ] If WORKING → sub-buttons: ALMOST DONE / HALFWAY / JUST STARTED → save → confirmation
- [ ] If BLOCKED → go to Screen 3

### Report Flow — Screen 3: Why Blocked
- [ ] Display reason codes as large icon buttons (56px+)
- [ ] Reason codes: No Heat 🌡, Prior Trade 🔨, No Access 🚫, Inspection 📋, Plumbing 🔧, Material 📦, Moisture 💧
- [ ] Optional: camera button to take photo
- [ ] Photo queued locally if offline, uploads on sync
- [ ] Submit → save field_report with reason_code + GPS + photo_url
- [ ] Auto-create delay_log entry on first BLOCKED report for this area

### Confirmation Screen
- [ ] Full-screen green checkmark
- [ ] Haptic feedback (expo-haptics)
- [ ] Show: area name + status + "Syncing..." → "Synced ✓"
- [ ] Auto-return to home after 2 seconds

### Tablet Responsive Layout
- [ ] Test all screens on iPad / Android tablet
- [ ] Adjust card sizes and spacing for larger screens
- [ ] Maintain single-column layout (no desktop-style grids on mobile)

### Offline Testing
- [ ] Enable airplane mode
- [ ] Submit 5 field reports
- [ ] Take 3 photos
- [ ] Verify all saved locally
- [ ] Re-enable connectivity
- [ ] Verify all synced to Supabase within 30 seconds

---

## Week 3 — Ready Board + GC Dashboard

### Ready Board (Web)
- [ ] Build cross-trade readiness grid (floors × trades)
- [ ] Each cell shows status color + label (RDY, ALM, BLK, HLD, DONE)
- [ ] Click cell → detail panel: area info, hours blocked, cost, GPS, photos
- [ ] Real-time updates via Supabase Realtime subscriptions
- [ ] Filter by: floor, trade, status
- [ ] Legend for color codes

### 1-Screen GC Dashboard
- [ ] Section 1: "What's happening right now?" — 4 metric cards (project %, on track, attention, action)
- [ ] Section 2: "What needs attention?" — Alert list ranked by daily cost of inaction
- [ ] Each alert: floor, trade, reason, daily cost, cumulative cost, days blocked, action button
- [ ] Expandable alert detail with context + action input
- [ ] Section 3: "When does this end?" — P6 date vs projected date, delta, recovery actions
- [ ] Right sidebar: Cost of Inaction counter (animated), Legal Status, AI Insight (placeholder for V2)
- [ ] Floor status strip (left sidebar): color-coded per floor with progress bars
- [ ] Bottom bar: demo tagline + live indicator

### Corrective Action Module
- [ ] GC PM can create corrective action from any BLOCKED/HELD alert
- [ ] Fields: assigned_to (user), deadline (date), note (text)
- [ ] Assigned user receives push notification
- [ ] Track lifecycle: created → acknowledged → in_resolution → resolved
- [ ] When resolved → area status recalculated automatically

### Safety Clearance Gate
- [ ] Project-level toggle (off by default)
- [ ] If on: foreman must attach safety photo + mark "Cleared" before area shows READY
- [ ] Simple binary gate — not a full JHA

### Push Notifications (Bilingual)
- [ ] Set up Expo push notifications
- [ ] Area READY notification to assigned foreman (in their language)
- [ ] Area BLOCKED notification to GC PM + Sub PM
- [ ] NOD draft ready notification to superintendent
- [ ] All notifications use i18next templates

---

## Week 4 — Delay Logging + Legal Triggers

### Delay Log Engine
- [ ] Auto-create delay_log on first BLOCKED/HELD field_report per area
- [ ] Calculate man_hours: crew_size × hours since blocked
- [ ] Calculate daily_cost: man_hours × project.labor_rate_per_hour
- [ ] Accumulate cumulative_cost across days
- [ ] GPS evidence attached from field_report
- [ ] Photo evidence linked from field_report

### NOD Draft Auto-Generation
- [ ] Trigger: first BLOCKED status on any area
- [ ] Generate draft within 60 seconds
- [ ] Draft content (JSONB): project info, area, date, cause, exhibits list, contract references
- [ ] Push notification to superintendent: "Legal notice draft ready"
- [ ] 20-hour reminder if not sent

### Finger Signature Component
- [ ] Canvas-based signature capture (works on mobile + tablet)
- [ ] Save as PNG with timestamp + GPS + device_id
- [ ] Store in Supabase Storage
- [ ] Link to legal_document.signature_png_url

### Change Order Engine
- [ ] Log scope changes (new sqft, reason, who initiated)
- [ ] Recalculate all downstream forecasts
- [ ] Flag GC-initiated changes as evidence

---

## Week 5 — Forecast Engine + Schedule Import

### Schedule Import
- [ ] Upload P6 export as CSV or XLSX
- [ ] Parse: area, trade, scheduled_start, scheduled_end
- [ ] Store in schedule_items table
- [ ] Map imported areas to ReadyBoard areas (fuzzy match + manual override)

### Forecast Calculation
- [ ] For each area + trade: calculate actual production rate
- [ ] Compare actual vs benchmark → performance percentage
- [ ] Project completion date based on actual rate
- [ ] Calculate delta vs P6 scheduled date
- [ ] Generate daily forecast_snapshots

### Schedule Delta Alerts
- [ ] Alert when projected date > scheduled date by > 3 days
- [ ] Include: area, trade, delta days, cause, recommended action
- [ ] Show in GC Dashboard section 3

### REA Threshold Triggers
- [ ] Monitor cumulative delay cost per area per cause
- [ ] When $5,000 OR 3 crew-days exceeded → auto-generate REA draft
- [ ] REA references all NODs already sent for this cause
- [ ] Notify Sub PM

---

## Week 6 — Legal Document Generation

### PDF Generation Engine
- [ ] NOD PDF template (AIA A201 §8.3.1 / ConsensusDocs 200 §6.3)
- [ ] Fields: project, contract no, date, delay start, cause, area, exhibits
- [ ] Include finger signature PNG
- [ ] Include SHA-256 hash in footer (monospace, small)
- [ ] Include receipt tracking UUID
- [ ] **WAIT FOR ATTORNEY REVIEW before finalizing template**

### REA PDF Template
- [ ] Itemized cost table: days × crew × rate + overhead
- [ ] Reference all related NODs
- [ ] Total claim amount
- [ ] SHA-256 hash in footer

### Evidence Package PDF
- [ ] Chronological delay narrative
- [ ] All NODs with receipt confirmations
- [ ] All REAs with cost tables
- [ ] GPS verification log
- [ ] Numbered photo exhibits
- [ ] Corrective action history with GC response times
- [ ] SHA-256 integrity verification appendix
- [ ] Financial summary by cause and responsible party

### Receipt Tracking System
- [ ] Generate unique tracking UUID per document
- [ ] Create 1x1 transparent PNG pixel hosted on ReadyBoard CDN
- [ ] Embed pixel in outbound email
- [ ] Webhook: on pixel load → create receipt_event
- [ ] Update legal_document.first_opened_at + open_count
- [ ] 48h timer: if no corrective_action after open → alert sub

### SHA-256 Verification
- [ ] Compute hash on PDF buffer before storage
- [ ] Store in legal_documents.sha256_hash
- [ ] Print in PDF footer
- [ ] Public verification endpoint: GET /api/legal/verify?hash=[hash]
- [ ] Returns: {valid, generated_at, project_id}

---

## Week 7 — QA + Deploy + First Pilot

### Testing
- [ ] Playwright tests: GC Dashboard loads, all 3 sections render
- [ ] Playwright tests: Ready Board grid renders correctly
- [ ] Playwright tests: corrective action creation flow
- [ ] Mobile tests: 3-tap foreman flow completes in < 15 seconds
- [ ] Mobile tests: offline report + sync flow
- [ ] Mobile tests: photo capture + GPS + queue
- [ ] Mobile tests: NOD draft → signature → send flow
- [ ] Mobile tests: EN ↔ ES language switch
- [ ] Cross-browser: Chrome, Safari, Firefox (GC Dashboard)
- [ ] Tablet: iPad + Android tablet (foreman app)
- [ ] Stress test: 50 simultaneous field reports syncing

### Deploy
- [ ] Vercel production deploy (web dashboard)
- [ ] Expo EAS build (iOS + Android)
- [ ] TestFlight distribution for pilot
- [ ] Custom domain: app.readyboard.io (web), readyboard.io (marketing)

### First Pilot Onboard
- [ ] Create 80 Clarkson project in production
- [ ] Configure trade sequences for tile/stone
- [ ] Set up Suffolk as GC org, Jantile as sub org
- [ ] Create user accounts: Sal (foreman), Anthony (superintendent), John (GC PM)
- [ ] Send SMS magic links to foremen
- [ ] YOU do the onboarding — install app on foreman phones yourself
- [ ] Monitor first 24h of real data
- [ ] Collect feedback: what worked, what confused, what's missing

---

## Post-V1 Backlog (Do NOT build in V1)

- [ ] AI Insights panel (Phase 1 — needs 10 projects + 90 days data)
- [ ] Bid Intelligence (Phase 2 — needs 50 projects + 12 months)
- [ ] Checklist-based progress (instead of status buttons) — V1.5
- [ ] DocuSign integration — V3
- [ ] French, Portuguese, Italian languages — V2
- [ ] Arabic, Mandarin, Polish, Creole — V3
- [ ] Owner portal — V2
- [ ] Multi-project portfolio view — V2
- [ ] API for third-party integrations — V2
- [ ] Industry benchmark reports — V4
