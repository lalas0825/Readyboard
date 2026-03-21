# Security Audit: RLS Golden Path

**Last Updated:** 2026-03-21
**Status:** VERIFIED — 0 critical vulnerabilities

---

## RLS Policy: field_reports INSERT

**Table:** `field_reports`
**Operation:** INSERT
**Policy Name:** `Foreman creates field reports`

### Current Policy (FIXED — Week 2)

```sql
CREATE POLICY "Foreman creates field reports" ON field_reports
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND area_id IN (
      SELECT ua.area_id FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
    )
  );
```

### What It Validates

1. **Identity:** `user_id = auth.uid()` — foreman can only create reports as themselves
2. **Authorization:** `area_id IN (user_assignments)` — foreman can only report on areas assigned to them

### Previous Vulnerability (RESOLVED)

The original policy only checked `user_id = auth.uid()`. A malicious user could craft a direct HTTP request to Supabase REST API with an `area_id` belonging to another foreman. The PowerSync sync rules filtered downloads correctly, but the write path was unprotected.

**Discovered:** Week 2 technical audit (`.claude/AUDIT_REPORT.md`)
**Fixed:** Migration applied via Supabase MCP — DROP + CREATE policy

### Defense-in-Depth Layers

| Layer | What It Does | Scope |
|-------|-------------|-------|
| **PowerSync Sync Rules** | Only downloads data for `token_parameters.user_id` assigned areas | READ (device) |
| **Supabase RLS (SELECT)** | Only returns rows where `area_id IN get_accessible_area_ids()` | READ (server) |
| **Supabase RLS (INSERT)** | Validates `user_id` + `area_id` ownership | WRITE (server) |
| **Client-side** | `useAreas` hook only queries assigned areas; store populated from filtered data | UI (no security guarantee) |

### Key Principle

> Client-side filtering is convenience, not security. RLS is the single source of truth for authorization.

---

## RLS Coverage Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `areas` | Assigned areas only | N/A (admin) | N/A | N/A |
| `area_trade_status` | Assigned areas | N/A | Assigned areas | N/A |
| `field_reports` | Accessible areas | user_id + area_id | N/A | N/A |
| `delay_logs` | Accessible areas | N/A (server) | N/A | N/A |
| `user_assignments` | Accessible areas | N/A (admin) | N/A | N/A |
| `nod_drafts` | Org-scoped | N/A (server) | N/A | N/A |
| `corrective_actions` | Org-scoped | GC roles | GC roles | N/A |
| `area_tasks` | Assigned areas | N/A | Role-gated (sub/gc) | N/A |
| `legal_documents` | Org-scoped | Sub roles | Sub roles | N/A |

### Functions (SECURITY DEFINER)

- `get_accessible_area_ids()` — returns area IDs accessible to `auth.uid()` via `user_assignments`
- All functions use `SET search_path = public` to prevent search_path injection

---

## Audit Schedule

- **Week 2:** Initial audit completed (this document)
- **Week 4:** Re-audit after delay_log engine + NOD auto-generation
- **Week 6:** Pre-launch security review (all tables + edge functions)
- **Post-launch:** Monthly automated RLS advisor checks via Supabase MCP

---

*Golden Path: every write is validated server-side. No exceptions.*
