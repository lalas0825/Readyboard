'use server';

import { getSession } from '@/lib/auth/getSession';
import { createServiceClient } from '@/lib/supabase/service';

export type AuditEntry = {
  id: string;
  tableName: string;
  recordId: string;
  action: string;
  changedByName: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
};

/**
 * Fetches audit log entries scoped to the user's organization.
 * Uses service client for cross-table joins but filters by org membership.
 */
export async function fetchAuditLog(
  projectId: string,
  limit = 50,
  offset = 0,
): Promise<{ entries: AuditEntry[]; total: number }> {
  const session = await getSession();
  if (!session) return { entries: [], total: 0 };

  const supabase = createServiceClient();

  // Scope: only show audit entries from users in the same org
  const { data: orgUsers } = await supabase
    .from('users')
    .select('id')
    .eq('org_id', session.user.org_id);

  const orgUserIds = (orgUsers ?? []).map((u) => u.id);
  if (orgUserIds.length === 0) return { entries: [], total: 0 };

  // Count total (scoped to org)
  const { count } = await supabase
    .from('audit_log')
    .select('id', { count: 'exact', head: true })
    .in('changed_by', orgUserIds);

  // Fetch entries (scoped to org)
  const { data: rows } = await supabase
    .from('audit_log')
    .select('id, table_name, record_id, action, changed_by, old_value, new_value, reason, created_at')
    .in('changed_by', orgUserIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!rows) return { entries: [], total: count ?? 0 };

  // Resolve user names
  const userIds = [...new Set(rows.map((r) => r.changed_by))];
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .in('id', userIds);

  const nameMap = new Map<string, string>();
  for (const u of users ?? []) {
    nameMap.set(u.id, u.name);
  }

  const entries: AuditEntry[] = rows.map((r) => ({
    id: r.id,
    tableName: r.table_name,
    recordId: r.record_id,
    action: r.action,
    changedByName: nameMap.get(r.changed_by) ?? 'System',
    oldValue: r.old_value as Record<string, unknown> | null,
    newValue: r.new_value as Record<string, unknown> | null,
    reason: r.reason,
    createdAt: r.created_at,
  }));

  return { entries, total: count ?? 0 };
}
