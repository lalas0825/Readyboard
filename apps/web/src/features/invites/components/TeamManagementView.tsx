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
          trades={data.trades}
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

const INVITABLE_ROLES: { value: InviteRole; label: string; description: string; method: 'email' | 'sms'; needsTrade: boolean }[] = [
  { value: 'gc_pm', label: 'GC Project Manager', description: 'Full dashboard access', method: 'email', needsTrade: false },
  { value: 'gc_super', label: 'GC Superintendent', description: 'Field + dashboard access', method: 'email', needsTrade: false },
  { value: 'sub_pm', label: 'Sub PM', description: 'Manages their trade — legal docs, delay tracking', method: 'email', needsTrade: true },
  { value: 'superintendent', label: 'Superintendent', description: 'Manages foremen, reviews & sends NODs', method: 'email', needsTrade: true },
  { value: 'foreman', label: 'Foreman', description: 'Reports from the field — joins via link, no account setup', method: 'sms', needsTrade: true },
];

function InviteModal({
  projectId,
  areas,
  trades,
  onClose,
}: {
  projectId: string;
  areas: { id: string; name: string; floor: string; unit_name?: string }[];
  trades?: { trade_name: string; sequence_order: number }[];
  onClose: () => void;
}) {
  const [role, setRole] = useState<InviteRole | ''>('');
  const [tradeName, setTradeName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('en');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const roleConfig = INVITABLE_ROLES.find((r) => r.value === role);
  const isForeman = role === 'foreman';
  const needsTrade = roleConfig?.needsTrade ?? false;

  // Group areas by floor → unit for the selector
  const floorGroups = areas.reduce<Record<string, typeof areas>>((acc, a) => {
    const key = a.floor;
    (acc[key] ??= []).push(a);
    return acc;
  }, {});

  const toggleArea = (id: string) => {
    setSelectedAreas((prev) => prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]);
  };

  const handleGenerate = async () => {
    if (!role) return;
    if (needsTrade && !tradeName) { toast.error('Select a trade'); return; }
    if (!isForeman && !email) { toast.error('Email is required'); return; }
    if (isForeman && !phone) { toast.error('Phone is required'); return; }

    setLoading(true);
    const result = await generateInviteLink({
      projectId,
      role,
      areaId: selectedAreas[0] || undefined,
      email: !isForeman ? email : undefined,
      phone: isForeman ? phone : undefined,
      name: name || undefined,
      tradeName: needsTrade ? tradeName : undefined,
      language,
    });
    if (result.ok) {
      setGeneratedUrl(result.url);
      toast.success(isForeman ? 'Invite link generated — share via WhatsApp' : 'Invite email sent!');
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-900 p-5" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-zinc-100">Invite Team Member</h3>

        <div className="mt-4 space-y-3">
          {/* Role chips */}
          <div>
            <label className="text-[10px] font-medium text-zinc-400">Role</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {INVITABLE_ROLES.map((r) => (
                <button key={r.value} type="button"
                  onClick={() => { setRole(r.value); setGeneratedUrl(null); setCopied(false); }}
                  className={`rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                    role === r.value ? 'border-emerald-600 bg-emerald-950/40' : 'border-zinc-700 hover:border-zinc-600'
                  }`}>
                  <p className={`text-xs font-medium ${role === r.value ? 'text-emerald-400' : 'text-zinc-300'}`}>{r.label}</p>
                  <p className="text-[10px] text-zinc-500">{r.description}</p>
                </button>
              ))}
            </div>
          </div>

          {role && (
            <>
              {/* Trade selector (sub-side roles) */}
              {needsTrade && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Trade</label>
                  <select value={tradeName} onChange={(e) => setTradeName(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:border-amber-600 focus:outline-none">
                    <option value="">Select trade...</option>
                    {(trades ?? []).map((t) => (
                      <option key={t.trade_name} value={t.trade_name}>{t.sequence_order}. {t.trade_name}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-zinc-600">This person will only see data for this trade.</p>
                </div>
              )}

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
                  <p className="mt-1 text-[10px] text-zinc-600">An invite link will be generated. Share it via WhatsApp or text.</p>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="carlos@company.com"
                    className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:border-amber-600 focus:outline-none" />
                </div>
              )}

              {/* Language (foreman) */}
              {isForeman && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">Language</label>
                  <div className="mt-1 flex gap-2">
                    {(['en', 'es'] as const).map((lang) => (
                      <button key={lang} type="button" onClick={() => setLanguage(lang)}
                        className={`rounded-md border px-3 py-1.5 text-xs ${
                          language === lang ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-zinc-700 text-zinc-400'
                        }`}>
                        {lang === 'en' ? 'English' : 'Español'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Area assignment (foreman + superintendent) */}
              {(isForeman || role === 'superintendent') && (
                <div>
                  <label className="text-[10px] font-medium text-zinc-400">
                    Assign to areas ({selectedAreas.length} selected)
                  </label>
                  <div className="mt-1 max-h-48 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-800">
                    {Object.entries(floorGroups)
                      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
                      .map(([floor, floorAreas]) => (
                        <div key={floor}>
                          <div className="sticky top-0 bg-zinc-800 px-3 py-1 text-[10px] font-bold text-zinc-500 border-b border-zinc-700/50">
                            Floor {floor}
                          </div>
                          {floorAreas.map((a) => (
                            <label key={a.id} className="flex items-center gap-2 px-3 py-1 hover:bg-zinc-700/30 cursor-pointer">
                              <input type="checkbox" checked={selectedAreas.includes(a.id)}
                                onChange={() => toggleArea(a.id)} className="rounded border-zinc-600" />
                              <span className="text-xs text-zinc-300">{a.name}</span>
                            </label>
                          ))}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Generated URL */}
          {generatedUrl && (
            <div className="rounded-lg border border-green-900/50 bg-green-950/20 p-3">
              <p className="text-[10px] font-medium text-green-400">
                {isForeman
                  ? `Share this link with ${name || 'the foreman'} via WhatsApp:`
                  : 'Invite email sent! Link (expires 7 days):'}
              </p>
              <div className="mt-1 flex gap-2">
                <input type="text" value={generatedUrl} readOnly
                  className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-mono text-zinc-300" />
                <button onClick={() => { navigator.clipboard.writeText(generatedUrl); setCopied(true); toast.success('Copied!'); }}
                  className="rounded border border-green-700 px-2 py-1 text-[10px] font-medium text-green-400 hover:bg-green-950/30">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {isForeman && (
                <p className="mt-2 text-[10px] text-zinc-600">
                  When {name || 'the foreman'} taps this link, they'll be logged in automatically — no password, no email needed.
                </p>
              )}
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
