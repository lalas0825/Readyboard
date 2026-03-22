-- Week 5: RLS for schedule_items — INSERT/UPDATE/DELETE policies
-- SELECT already exists ("Users see project schedule" via gc_org_id/sub_org_id)

-- INSERT: gc_admin or owner only (schedule management is GC privilege)
CREATE POLICY schedule_items_insert ON schedule_items
  FOR INSERT WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id()
    )
    AND get_user_role() IN ('gc_admin', 'owner')
  );

-- UPDATE: gc_admin or owner only
CREATE POLICY schedule_items_update ON schedule_items
  FOR UPDATE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id()
    )
    AND get_user_role() IN ('gc_admin', 'owner')
  );

-- DELETE: owner only (destructive)
CREATE POLICY schedule_items_delete ON schedule_items
  FOR DELETE USING (
    project_id IN (
      SELECT p.id FROM projects p
      WHERE p.gc_org_id = get_user_org_id()
    )
    AND get_user_role() = 'owner'
  );
