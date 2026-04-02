'use client';

import { useState } from 'react';
import { generateInviteLink, type InviteRole } from '../services/generateInviteLink';
import { revokeInvite, resendInvite } from '../services/manageInvite';
import { toast } from 'sonner';
import type { TeamPageData, TeamMember, PendingInvite } from '../services/fetchTeamMembers';

// ─── Types ──────────────────────────────────────────

type Props = {
  data: TeamPageData;
  userRole: string;
};

// ─── Role Config ────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  gc_admin: 'GC Admin',
  gc_pm: 'GC PM',
  gc_super: 'GC Super',
  owner: 'Owner',
  sub_pm: 'Sub PM',
  superintendent: 'Superintendent',
  foreman: 'Foreman',
};

const ROLE_COLORS: Record<string, string> = {
  gc_admin: 'border-emerald-800/50 bg-emerald-950/30 text-emerald-400',
  gc_pm: 'border-blue-800/50 bg-blue-950/30 text-blue-400',
  gc_super: 'border-cyan-800/50 bg-cyan-950/30 text-cyan-400',
  owner: 'border-purple-800/50 bg-purple-950/30 text-purple-400',
  sub_pm: 'border-amber-800/50 bg-amber-950/30 text-amber-400',
  superintendent: 'border-orange-800/50 bg-orange-950/30 text-orange-400',
  foreman: 'border-zinc-700 bg-zinc-800 text-zinc-400',
};

// ─── Component ──────────────────────────────────────

export function TeamManagementView({ data, userRole }: Props) {
  const [showInviteModal, setShowInviteModal] = useState(false);
  const isAdmin = userRole === 'gc_admin' || userRole === 'gc_pm' || userRole === 'owner';

  const gcMembers = data.members.filter((m) => ['gc_admin', 'gc_pm', 'gc_super', 'owner'].includes(m.role));
  const subMembers = data.members.filter((m) => ['sub_pm', 'superintendent', 'foreman'].includes(m.role));

  return (
    <div className="space-y-6">
      {/* ─── Summary ──────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniCard label="Total Members" value={data.members.length} />
        <MiniCard label="GC Team" value={gcMembers.length} accent="blue" />
        <MiniCard label="Sub Team" value={subMembers.length} accent="amber" />
        <MiniCard label="Pending Invites" value={data.pendingInvites.filter((i) => !i.isExpired).length} accent="zinc" />
      </div>

      {/* ─── Actions ──────────────────────────── */}
      {isAdmin && (
        <div className="flex gap-2">
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-amber-500"
          >
            + Invite Member
          </button>
        </div>
      )}

      {/* ─── GC Team ─────────────────────────── */}
      {gcMembers.length > 0 && (
        <MemberSection title="GC Team" members={gcMembers} />
      )}

      {/* ─── Sub Team ────────────────────────── */}
      {subMembers.length > 0 && (
        <MemberSection title="Subcontractor Team" members={subMembers} />
      )}

      {data.members.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 p-12 text-center">
          <p className="text-sm text-zinc-400">No team members found.</p>
          <p className="mt-1 text-xs text-zinc-600">
            Invite your first team member to start collaborating.
          </p>
        </div>
      )}

      {/* ─── Pending Invites ──────────────────── */}
      {data.pendingInvites.length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Pending Invites ({data.pendingInvites.length})
          </p>
          <div className="space-y-2">
            {data.pendingInvites.map((inv) => (
              <InviteRow key={inv.id} invite={inv} />
            ))}
          </div>
        </div>
      )}

      {/* ─── Invite Modal ─────────────────────── */}
      {showInviteModal && (
        <InviteModal
          projectId={data.projectId}
          areas={data.areas}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
}

// ─── Member Section ─────────────────────────────────

function MemberSection({ title, members }: { title: string; members: TeamMember[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Role</th>
              <th className="pb-2 font-medium">Contact</th>
              <th className="pb-2 font-medium">Organization</th>
              <th className="pb-2 font-medium">Assigned Areas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {members.map((m) => (
              <tr key={m.id}>
                <td className="py-2.5 font-medium text-zinc-200">{m.name}</td>
                <td className="py-2.5">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${ROLE_COLORS[m.role] ?? 'border-zinc-700 bg-zinc-800 text-zinc-400'}`}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                </td>
                <td className="py-2.5 text-zinc-400">
                  {m.email ?? m.phone ?? '--'}
                </td>
                <td className="py-2.5 text-zinc-500">{m.orgName ?? '--'}</td>
                <td className="py-2.5">
                  {m.assignedAreas.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {m.assignedAreas.slice(0, 3).map((a, i) => (
                        <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                          {a}
                        </span>
                      ))}
                      {m.assignedAreas.length > 3 && (
                        <span className="text-[10px] text-zinc-600">+{m.assignedAreas.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] text-zinc-600">--</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Invite Row ─────────────────────────────────────

function InviteRow({ invite, onRefresh }: { invite: PendingInvite; onRefresh?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [acting, setActing] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(invite.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Invite link copied!');
  };

  const handleRevoke = async () => {
    setActing(true);
    const result = await revokeInvite(invite.id);
    setActing(false);
    if (result.ok) {
      toast.success('Invite revoked');
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  };

  const handleResend = async () => {
    setActing(true);
    const result = await resendInvite(invite.id);
    setActing(false);
    if (result.ok) {
      toast.success('Invite resent — expiration extended');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 ${
      invite.isExpired ? 'border-zinc-800 opacity-50' : 'border-zinc-800'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${ROLE_COLORS[invite.role] ?? ''}`}>
          {ROLE_LABELS[invite.role] ?? invite.role}
        </span>
        {invite.areaName && (
          <span className="text-xs text-zinc-400">{invite.areaName}</span>
        )}
        <span className="text-[10px] text-zinc-600">
          {invite.isExpired ? 'Expired' : `Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex items-center gap-1">
        {!invite.isExpired && (
          <>
            <button onClick={handleCopy} disabled={acting}
              className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 hover:bg-zinc-800 disabled:opacity-40">
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button onClick={handleResend} disabled={acting}
              className="rounded px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 disabled:opacity-40">
              Resend
            </button>
          </>
        )}
        <button onClick={handleRevoke} disabled={acting}
          className="rounded px-2 py-1 text-[10px] text-red-500 hover:text-red-400 disabled:opacity-40">
          Revoke
        </button>
      </div>
    </div>
  );
}

// ─── Invite Modal ───────────────────────────────────

const INVITABLE_ROLES: { value: InviteRole; label: string; description: string; method: 'email' | 'sms' }[] = [
  { value: 'gc_pm', label: 'GC Project Manager', description: 'Full dashboard access', method: 'email' },
  { value: 'gc_super', label: 'GC Superintendent', description: 'Field + dashboard access', method: 'email' },
  { value: 'sub_pm', label: 'Sub PM', description: 'Trade-specific access + legal docs', method: 'email' },
  { value: 'superintendent', label: 'Superintendent', description: 'Manages foremen, reviews NODs', method: 'email' },
  { value: 'foreman', label: 'Foreman', description: 'Field reporting — no password needed', method: 'sms' },
];

function InviteModal({
  projectId,
  areas,
  onClose,
}: {
  projectId: string;
  areas: { id: string; name: string; floor: string }[];
  onClose: () => void;
}) {
  const [role, setRole] = useState<InviteRole | ''>('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

  const selectedRole = INVITABLE_ROLES.find((r) => r.value === role);
  const isForeman = role === 'foreman';

  const handleGenerate = async () => {
    if (!role) return;
    if (!isForeman && !email) { toast.error('Email is required'); return; }
    if (isForeman && !phone) { toast.error('Phone is required for foreman'); return; }

    setLoading(true);
    const result = await generateInviteLink({
      projectId,
      role,
      areaId: isForeman ? areaId || undefined : undefined,
      email: !isForeman ? email : undefined,
      phone: isForeman ? phone : undefined,
      name: name || undefined,
    });
    if (result.ok) {
      setGeneratedUrl(result.url);
      toast.success(isForeman ? 'Invite link generated — share via WhatsApp' : 'Invite email sent!');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleCopy = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      toast.success('Copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100">Invite Team Member</h3>

        <div className="mt-4 space-y-3">
          {/* Role chips */}
          <div>
            <label className="text-[10px] font-medium text-zinc-400">Role</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {INVITABLE_ROLES.map((r) => (
                <button key={r.value} type="button"
                  onClick={() => { setRole(r.value); setGeneratedUrl(null); }}
                  className={`rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    role === r.value
                      ? 'border-emerald-600 bg-emerald-950/40'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}>
                  <p className={`text-xs font-medium ${role === r.value ? 'text-emerald-400' : 'text-zinc-300'}`}>
                    {r.label}
                  </p>
                  <p className="text-[10px] text-zinc-500">{r.description}</p>
                </button>
              ))}
            </div>
          </div>

          {role && (
            <>
              {/* Name */}
              <div>
                <label className="text-[10px] font-medium text-zinc-400">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Carlos Martinez"
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:border-amber-600 focus:outline-none" />
              </div>

              {/* Email or Phone */}
              {isForeman ? (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Phone</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (212) 555-0123"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:border-amber-600 focus:outline-none" />
                  <p className="mt-1 text-[10px] text-zinc-600">Share the link via WhatsApp — no password needed.</p>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@company.com"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:border-amber-600 focus:outline-none" />
                </div>
              )}

              {/* Area select (foreman only) */}
              {isForeman && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Assign to Area (optional)</label>
                  <select value={areaId} onChange={(e) => setAreaId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none">
                    <option value="">Assign later...</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>F{a.floor} — {a.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          {/* Generated URL */}
          {generatedUrl && (
            <div className="rounded-lg border border-green-900/50 bg-green-950/20 p-3">
              <p className="text-[10px] font-medium text-green-400">
                {isForeman ? 'Share this link via WhatsApp:' : 'Invite email sent! Link (expires 7 days):'}
              </p>
              <div className="mt-1 flex gap-2">
                <input type="text" value={generatedUrl} readOnly
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300" />
                <button onClick={handleCopy}
                  className="rounded border border-green-700 px-2 py-1 text-[10px] font-medium text-green-400 hover:bg-green-950/30">
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <button onClick={onClose}
            className="rounded-md border border-zinc-700 px-4 py-2 text-xs text-zinc-400 hover:bg-zinc-800">
            Close
          </button>
          {!generatedUrl && (
            <button onClick={handleGenerate} disabled={loading || !role}
              className="rounded-md bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50">
              {loading ? 'Sending...' : isForeman ? 'Generate Link' : 'Send Invite'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Mini Card ──────────────────────────────────────

function MiniCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  const text = { blue: 'text-blue-400', amber: 'text-amber-400', zinc: 'text-zinc-300' }[accent ?? 'zinc'] ?? 'text-zinc-300';
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${text}`}>{value}</p>
    </div>
  );
}
