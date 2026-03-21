-- ============================================================
-- ReadyBoard — RLS Security Test Suite
-- Run against Supabase to verify Row Level Security policies
--
-- Tests 3 critical security invariants:
--   1. Cross-org isolation (foreman can't see other org's data)
--   2. SUB/GC task ownership (foreman can't complete GC tasks)
--   3. Legal doc privacy (GC can't see unpublished docs)
--
-- Each test includes a POSITIVE CONTROL to verify legitimate access works.
-- All test data is created and cleaned up within this script.
-- ============================================================

-- ===================== SETUP =====================

-- Test auth users (handle_new_user trigger auto-creates public.users)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'foreman.jantile@test.com', '$2a$10$placeholder', now(), now(), now(), '',
   '{"provider":"email","providers":["email"]}',
   '{"name":"Carlos Test","role":"foreman","language":"es","org_id":"a0000000-0000-0000-0000-000000000002"}'),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'gcpm.tishman@test.com', '$2a$10$placeholder', now(), now(), now(), '',
   '{"provider":"email","providers":["email"]}',
   '{"name":"John Test","role":"gc_pm","language":"en","org_id":"a0000000-0000-0000-0000-000000000001"}');

-- Second GC org + project (cross-org isolation target)
INSERT INTO organizations (id, name, type, default_language)
VALUES ('a0000000-0000-0000-0000-000000000099', 'Turner Construction', 'gc', 'en');

INSERT INTO projects (id, name, address, gc_org_id)
VALUES ('b0000000-0000-0000-0000-000000000099', 'One World Trade', '285 Fulton St, NYC', 'a0000000-0000-0000-0000-000000000099');

INSERT INTO areas (id, name, floor, area_type, project_id, total_sqft)
VALUES ('c0000000-0000-0000-0000-000000990001', 'Bath 50A', '50', 'bathroom', 'b0000000-0000-0000-0000-000000000099', 100.0);

-- Assign foreman to ONE area in 383 Madison
INSERT INTO user_assignments (user_id, area_id, trade_name)
VALUES ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000200001', 'Tile / Stone');

-- Area tasks: SUB task + GC VERIFY task
INSERT INTO area_tasks (id, area_id, trade_type, task_order, task_name_en, task_name_es, task_owner, is_gate, weight, status) VALUES
  ('e0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000200001', 'Tile / Stone', 1, 'Lay tiles', 'Colocar azulejos', 'sub', false, 1.00, 'pending'),
  ('e0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000200001', 'Tile / Stone', 2, 'Inspect grout', 'Inspeccionar lechada', 'gc', true, 1.00, 'pending');

-- Unpublished legal document (Jantile's private NOD)
INSERT INTO legal_documents (id, project_id, org_id, type, published_to_gc)
VALUES ('f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'nod', false);


-- ===================== TEST 1: CROSS-ORG ISOLATION =====================
-- Actor: Carlos Test (foreman @ Jantile/Sub)
-- Attack: See areas from Turner Construction (different org)
-- Expected: turner=0, own=1, unassigned=0, total=1

BEGIN;
SET LOCAL ROLE 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT
  (SELECT count(*) FROM areas WHERE project_id = 'b0000000-0000-0000-0000-000000000099') as turner_areas_MUST_BE_0,
  (SELECT count(*) FROM areas WHERE id = 'c0000000-0000-0000-0000-000000200001') as own_area_MUST_BE_1,
  (SELECT count(*) FROM areas WHERE project_id = 'b0000000-0000-0000-0000-000000000001' AND id != 'c0000000-0000-0000-0000-000000200001') as unassigned_MUST_BE_0,
  (SELECT count(*) FROM areas) as total_MUST_BE_1;

ROLLBACK;


-- ===================== TEST 2: SUB/GC TASK OWNERSHIP =====================
-- Actor: Carlos Test (foreman @ Jantile/Sub)
-- Attack: Complete a GC VERIFY task
-- Expected: gc_attack=0, sub_positive=1

BEGIN;
SET LOCAL ROLE 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Attack: complete GC task
WITH attack AS (
  UPDATE area_tasks SET status = 'complete', completed_at = now()
  WHERE id = 'e0000000-0000-0000-0000-000000000002' AND task_owner = 'gc'
  RETURNING id
)
SELECT count(*) as gc_attack_MUST_BE_0 FROM attack;

ROLLBACK;

BEGIN;
SET LOCAL ROLE 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- Positive: complete own SUB task
WITH positive AS (
  UPDATE area_tasks SET status = 'complete', completed_at = now()
  WHERE id = 'e0000000-0000-0000-0000-000000000001' AND task_owner = 'sub'
  RETURNING id
)
SELECT count(*) as sub_positive_MUST_BE_1 FROM positive;

ROLLBACK;


-- ===================== TEST 3: LEGAL DOC PRIVACY =====================
-- Actor: John Test (gc_pm @ Tishman/GC)
-- Attack: Read unpublished NOD (published_to_gc = false)
-- Expected: gc_attack=0, sub_positive=1

BEGIN;
SET LOCAL ROLE 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000002","role":"authenticated"}';

SELECT count(*) as gc_attack_MUST_BE_0 FROM legal_documents
WHERE id = 'f0000000-0000-0000-0000-000000000001';

ROLLBACK;

BEGIN;
SET LOCAL ROLE 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"d0000000-0000-0000-0000-000000000001","role":"authenticated"}';

SELECT count(*) as sub_positive_MUST_BE_1 FROM legal_documents
WHERE id = 'f0000000-0000-0000-0000-000000000001';

ROLLBACK;


-- ===================== CLEANUP =====================
DELETE FROM legal_documents WHERE id = 'f0000000-0000-0000-0000-000000000001';
DELETE FROM area_tasks WHERE id IN ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002');
DELETE FROM user_assignments WHERE user_id = 'd0000000-0000-0000-0000-000000000001';
DELETE FROM areas WHERE id = 'c0000000-0000-0000-0000-000000990001';
DELETE FROM projects WHERE id = 'b0000000-0000-0000-0000-000000000099';
DELETE FROM organizations WHERE id = 'a0000000-0000-0000-0000-000000000099';
DELETE FROM users WHERE id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002');
DELETE FROM auth.users WHERE id IN ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002');
