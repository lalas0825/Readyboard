# Invitation System — Complete Flow

## The 4 Invitation Types

In construction, the chain of command determines who invites whom:

```
GC Admin/PM
  ├── invites → Sub PM (email link)
  ├── invites → GC Superintendent (email link)
  └── invites → GC PM (email link)

Sub PM
  ├── invites → Superintendent (email link)
  └── invites → Foreman (SMS magic link — no email, no password)

Superintendent
  └── invites → Foreman (SMS magic link)
```

Each type has a different auth flow because the users are different:
- **GC PM / Sub PM** → office workers, have email, use a computer → email invite + signup
- **Superintendent** → field leader, has email, might use phone or computer → email invite + signup
- **Foreman** → field worker, might not have email, uses phone only → SMS magic link, no password ever

---

## PART 1: Invitation Data Model

### Verify/create `invitations` table

```sql
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  
  -- Who is being invited
  email TEXT,                    -- for PM/Super invites (NULL for foreman SMS)
  phone TEXT,                    -- for foreman SMS invites (NULL for email invites)
  name TEXT,                     -- display name (optional)
  
  -- What role
  role TEXT NOT NULL CHECK (role IN (
    'gc_pm', 'gc_super', 'sub_pm', 'superintendent', 'foreman'
  )),
  
  -- Invite token + status
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  
  -- Optional: assign foreman to specific areas on invite
  assigned_area_ids UUID[] DEFAULT '{}',
  
  -- Tracking
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id),
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invitations_token ON invitations(token) WHERE status = 'pending';
CREATE INDEX idx_invitations_project ON invitations(project_id);
CREATE INDEX idx_invitations_email ON invitations(email) WHERE status = 'pending';
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- RLS: users in the org can view invitations for their projects
CREATE POLICY "Org members can view invitations" ON invitations
  FOR SELECT USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid()
    )
  );

-- Only GC admin/PM and Sub PM can create invitations
CREATE POLICY "Leaders can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    invited_by = auth.uid() AND
    organization_id IN (
      SELECT om.organization_id FROM organization_members om 
      WHERE om.user_id = auth.uid() 
      AND om.role IN ('gc_admin', 'gc_pm', 'sub_pm', 'superintendent')
    )
  );
```

---

## PART 2: Invite Modal (Team Page)

The Team page already has an "Invite Member" button. Wire it to a modal that adapts based on role:

```tsx
function InviteModal({ projectId, orgId, onClose, onSuccess }) {
  const [role, setRole] = useState('');
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  // Determine available roles based on current user's role
  const currentUserRole = useCurrentUserRole();
  const availableRoles = getInvitableRoles(currentUserRole);
  // gc_admin → can invite: gc_pm, gc_super, sub_pm
  // gc_pm → can invite: gc_super, sub_pm
  // sub_pm → can invite: superintendent, foreman
  // superintendent → can invite: foreman

  // Auto-switch to SMS when foreman is selected
  useEffect(() => {
    if (role === 'foreman') setMethod('sms');
    else setMethod('email');
  }, [role]);

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Invite team member</DialogTitle>
      <DialogContent>
        
        {/* Step 1: Select role */}
        <div className="mb-4">
          <label className="text-sm text-muted mb-2 block">Role</label>
          <div className="flex flex-wrap gap-2">
            {availableRoles.map(r => (
              <button
                key={r.value}
                onClick={() => setRole(r.value)}
                className={`px-3 py-2 rounded-lg border text-sm ${
                  role === r.value 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'border-white/20 text-muted'
                }`}
              >
                <div className="font-medium">{r.label}</div>
                <div className="text-xs opacity-60">{r.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Contact info (adapts based on role) */}
        {role && (
          <>
            <div className="mb-4">
              <label className="text-sm text-muted mb-1 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Carlos Martinez"
              />
            </div>

            {method === 'email' ? (
              <div className="mb-4">
                <label className="text-sm text-muted mb-1 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="carlos@jantile.com"
                />
              </div>
            ) : (
              <div className="mb-4">
                <label className="text-sm text-muted mb-1 block">Phone number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 (212) 555-0123"
                />
                <p className="text-xs text-muted mt-1">
                  They'll receive an SMS with a login link. No password needed.
                </p>
              </div>
            )}

            {/* Step 3: For foreman — assign to areas (optional) */}
            {role === 'foreman' && (
              <div className="mb-4">
                <label className="text-sm text-muted mb-1 block">
                  Assign to areas (optional — can do later)
                </label>
                <AreaMultiSelect
                  projectId={projectId}
                  selected={selectedAreas}
                  onChange={setSelectedAreas}
                />
              </div>
            )}

            {/* For sub_pm — which trade */}
            {role === 'sub_pm' && (
              <div className="mb-4">
                <label className="text-sm text-muted mb-1 block">Trade</label>
                <TradeSelector projectId={projectId} />
                <p className="text-xs text-muted mt-1">
                  The Sub PM will only see areas and data for their trade.
                </p>
              </div>
            )}
          </>
        )}

        <div className="flex gap-3 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!role || (!email && !phone) || sending}
            className="px-4 py-2 bg-green-500 text-black rounded font-bold text-sm disabled:opacity-50"
          >
            {sending ? 'Sending...' : method === 'sms' ? 'Send SMS Invite' : 'Send Email Invite'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const INVITABLE_ROLES = {
  gc_admin: [
    { value: 'gc_pm', label: 'GC Project Manager', description: 'Full dashboard access' },
    { value: 'gc_super', label: 'GC Superintendent', description: 'Field + dashboard access' },
    { value: 'sub_pm', label: 'Sub PM', description: 'Trade-specific access + legal docs' },
  ],
  gc_pm: [
    { value: 'gc_super', label: 'GC Superintendent', description: 'Field + dashboard access' },
    { value: 'sub_pm', label: 'Sub PM', description: 'Trade-specific access + legal docs' },
  ],
  sub_pm: [
    { value: 'superintendent', label: 'Superintendent', description: 'Manages foremen, reviews NODs' },
    { value: 'foreman', label: 'Foreman', description: 'Field reporting — SMS login, no password' },
  ],
  superintendent: [
    { value: 'foreman', label: 'Foreman', description: 'Field reporting — SMS login, no password' },
  ],
};

function getInvitableRoles(currentRole: string) {
  return INVITABLE_ROLES[currentRole] || [];
}
```

---

## PART 3: API Routes

### POST `/api/invite` — Create and send invitation

```typescript
// app/api/invite/route.ts
export async function POST(req: Request) {
  const { projectId, role, email, phone, name, assignedAreaIds } = await req.json();
  const user = await getAuthUser(req);
  
  // Validate: can this user invite this role?
  const canInvite = validateInvitePermission(user.role, role);
  if (!canInvite) return Response.json({ error: 'Not authorized to invite this role' }, { status: 403 });

  // Create invitation record
  const { data: invitation } = await supabase.from('invitations').insert({
    project_id: projectId,
    organization_id: user.organization_id,
    invited_by: user.id,
    email: email || null,
    phone: phone || null,
    name: name || null,
    role,
    assigned_area_ids: assignedAreaIds || [],
  }).select().single();

  // Send the invite
  if (email) {
    await sendEmailInvite(invitation);
  } else if (phone) {
    await sendSMSInvite(invitation);
  }

  return Response.json({ success: true, invitation });
}
```

### Email invite (for PM, Super)

```typescript
async function sendEmailInvite(invitation) {
  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${invitation.token}`;
  
  await resend.emails.send({
    from: 'ReadyBoard <noreply@readyboard.ai>',
    to: invitation.email,
    subject: `You're invited to ${invitation.project_name} on ReadyBoard`,
    html: `
      <h2>You've been invited to ReadyBoard</h2>
      <p><strong>${invitation.invited_by_name}</strong> invited you to join 
         <strong>${invitation.project_name}</strong> as <strong>${invitation.role_label}</strong>.</p>
      <p>ReadyBoard gives you real-time visibility into what's ready, what's blocked, 
         and what needs your attention — before the morning meeting.</p>
      <a href="${inviteUrl}" style="display:inline-block; padding:12px 24px; 
         background:#22c55e; color:#000; font-weight:bold; border-radius:8px; 
         text-decoration:none;">
        Accept Invitation
      </a>
      <p style="color:#666; font-size:12px; margin-top:20px;">
        This invitation expires in 7 days.
      </p>
    `,
  });
}
```

### SMS invite (for Foreman)

```typescript
async function sendSMSInvite(invitation) {
  const magicLinkUrl = `${process.env.NEXT_PUBLIC_APP_URL}/join/${invitation.token}`;
  
  // For V1: Use Supabase Auth magic link or a simple token-based auth
  // The foreman taps the link → auto-authenticated → sees their areas
  
  const message = invitation.language === 'es'
    ? `ReadyBoard: ${invitation.invited_by_name} te invitó al proyecto ${invitation.project_name}. Toca aquí para entrar: ${magicLinkUrl}`
    : `ReadyBoard: ${invitation.invited_by_name} invited you to ${invitation.project_name}. Tap to join: ${magicLinkUrl}`;

  // V1: Log to console (no SMS provider yet)
  console.log(`[SMS INVITE] To: ${invitation.phone} | Message: ${message}`);
  
  // V2: Use Twilio
  // await twilioClient.messages.create({
  //   to: invitation.phone,
  //   from: process.env.TWILIO_PHONE_NUMBER,
  //   body: message,
  // });
  
  // For now: also send via email if we have one, as backup
  // Most superintendents can forward the link to the foreman via WhatsApp
}
```

---

## PART 4: Join Page — `/join/[token]`

This page handles invitation acceptance. It must support 3 scenarios:

### Scenario A: New user with email (PM, Super)
1. User clicks email link → lands on `/join/[token]`
2. Page shows: project name, role, who invited them
3. User creates account (name, email pre-filled, password)
4. On submit: create Supabase auth user → create org member → mark invitation accepted
5. Redirect to dashboard

### Scenario B: Existing user with email
1. User clicks link → already logged in
2. Page shows: "You've been invited to [project] as [role]"
3. One button: "Accept Invitation"
4. On click: add to project → mark invitation accepted → redirect

### Scenario C: Foreman via SMS (no email, no password)
1. Foreman taps SMS link on their phone → lands on `/join/[token]`
2. Page shows: project name, their name, "Welcome to ReadyBoard"
3. NO signup form — just a "Start" button
4. On tap: create Supabase auth user with phone (or anonymous + metadata) → create org member with foreman role → assign to areas from invitation → mark accepted
5. Redirect to mobile foreman app (or web foreman view)

```tsx
// app/join/[token]/page.tsx
export default async function JoinPage({ params }) {
  const { token } = params;
  
  // Fetch invitation
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*, projects(name), organizations(name)')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (!invitation) {
    return <ExpiredInvitePage />;
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return <ExpiredInvitePage />;
  }

  // Check if user is already logged in
  const session = await getSession();

  if (invitation.role === 'foreman') {
    return <ForemanJoinPage invitation={invitation} />;
  }

  if (session) {
    return <AcceptInvitePage invitation={invitation} user={session.user} />;
  }

  return <SignupWithInvitePage invitation={invitation} />;
}
```

### ForemanJoinPage — SMS magic link flow

```tsx
function ForemanJoinPage({ invitation }) {
  const [joining, setJoining] = useState(false);
  const t = useTranslations(); // auto-detect language

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-6">
      <div className="w-full max-w-sm text-center">
        <FloorPulseLogo size={48} />
        <h1 className="text-2xl font-bold mt-4 text-white">ReadyBoard</h1>
        
        <div className="mt-8 p-4 rounded-lg bg-white/5 border border-white/10">
          <p className="text-muted text-sm">{t('invited_to')}</p>
          <p className="text-lg font-bold text-white mt-1">{invitation.projects.name}</p>
          <p className="text-muted text-sm mt-2">
            {t('invited_by')} {invitation.invited_by_name}
          </p>
          {invitation.name && (
            <p className="text-white font-medium mt-2">{invitation.name}</p>
          )}
          <div className="mt-2 inline-block px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">
            {t('role_foreman')}
          </div>
        </div>

        <button
          onClick={handleForemanJoin}
          disabled={joining}
          className="w-full mt-6 py-4 bg-[#e67e22] text-white text-lg font-bold rounded-xl"
        >
          {joining ? t('joining') : t('start_working')}
        </button>

        <p className="text-xs text-muted mt-4">
          {t('no_password_needed')}
        </p>
      </div>
    </div>
  );
}

async function handleForemanJoin(invitation) {
  // Option A: Create anonymous Supabase user with metadata
  const { data: authData } = await supabase.auth.signUp({
    email: `foreman-${invitation.token.slice(0,8)}@readyboard.local`,
    password: crypto.randomUUID(), // random, foreman never types this
    options: {
      data: {
        name: invitation.name,
        phone: invitation.phone,
        role: 'foreman',
        organization_id: invitation.organization_id,
      }
    }
  });

  // Option B (better for V2): Use Supabase phone auth
  // const { data } = await supabase.auth.signInWithOtp({ phone: invitation.phone });

  // Add to organization + project
  await supabase.from('organization_members').insert({
    user_id: authData.user.id,
    organization_id: invitation.organization_id,
    role: 'foreman',
  });

  // Assign to areas if specified in invitation
  if (invitation.assigned_area_ids?.length > 0) {
    await supabase.from('user_assignments').insert(
      invitation.assigned_area_ids.map(areaId => ({
        user_id: authData.user.id,
        area_id: areaId,
        project_id: invitation.project_id,
      }))
    );
  }

  // Mark invitation accepted
  await supabase.from('invitations').update({
    status: 'accepted',
    accepted_at: new Date().toISOString(),
    accepted_by: authData.user.id,
  }).eq('id', invitation.id);

  // Redirect to foreman app
  window.location.href = '/foreman';
}
```

---

## PART 5: Team Page — Pending Invitations

The Team page should show pending invitations below the member list:

```tsx
{/* Pending Invitations Section */}
{pendingInvites.length > 0 && (
  <div className="mt-8">
    <h3 className="text-sm font-bold text-muted mb-3">Pending Invitations</h3>
    <div className="space-y-2">
      {pendingInvites.map(invite => (
        <div key={invite.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{invite.name || invite.email || invite.phone}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">
                {invite.role}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                Pending
              </span>
            </div>
            <div className="text-xs text-muted mt-1">
              Invited by {invite.invited_by_name} · Expires {formatRelative(invite.expires_at)}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => resendInvite(invite.id)}
              className="text-xs text-muted hover:text-white px-2 py-1"
            >
              Resend
            </button>
            <button
              onClick={() => revokeInvite(invite.id)}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
            >
              Revoke
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
)}
```

---

## PART 6: Bilingual Invite Templates

All invites must be bilingual. Detect language from the invited user's phone locale (for SMS) 
or default to English (for email). The GC can also set the language when inviting.

### Email subject lines:
- EN: "You're invited to [Project] on ReadyBoard"
- ES: "Te invitaron a [Project] en ReadyBoard"

### SMS messages:
- EN: "ReadyBoard: [Name] invited you to [Project]. Tap to join: [link]"
- ES: "ReadyBoard: [Name] te invitó a [Project]. Toca para entrar: [link]"

### Join page:
- Auto-detect from browser/phone language
- Foreman join page must be in the foreman's language

---

## PART 7: Security Rules

1. **Token is single-use** — once accepted, cannot be used again
2. **Token expires in 7 days** — configurable per invite
3. **Revokable** — the inviter can revoke before acceptance
4. **Role enforcement** — a foreman invite can ONLY create a foreman user, never a PM
5. **Org isolation** — the invitation is bound to a specific org and project
6. **Rate limiting** — max 20 invitations per hour per user (prevent spam)

---

## Summary — Implementation Order

1. **Migration:** Create/verify `invitations` table with all fields
2. **API route:** `POST /api/invite` — create invitation + send email or SMS
3. **Invite modal:** On Team page, role-aware modal with email/SMS switch
4. **Join page:** `/join/[token]` — 3 scenarios (new user, existing user, foreman SMS)
5. **Foreman auth:** Token-based join flow (no password, no email required)
6. **Team page:** Show pending invitations with resend/revoke
7. **Email templates:** Bilingual invite emails via Resend
8. **SMS:** V1 = console.log + manual WhatsApp. V2 = Twilio integration.
9. **Area assignment:** On foreman invite, optionally pre-assign areas
10. **Run `npx tsc --noEmit` and `npm run build`** after each step

### V1 Workaround for SMS (no Twilio yet)

Since you don't have Twilio configured yet, the foreman invite flow for V1:
1. GC/Super enters foreman's phone + name in the invite modal
2. System creates the invitation + generates the magic link
3. Instead of sending SMS, show the link on screen: "Share this link with the foreman via WhatsApp or text"
4. Copy-to-clipboard button
5. The super copies the link and sends it via WhatsApp (which foremen already use)
6. Foreman taps the link → joins → done

This is actually BETTER for adoption because the super sends it from their own WhatsApp — the foreman trusts a message from their super more than a random SMS from an unknown number.
