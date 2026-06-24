/**
 * ============================================================
 * FUNCTION: mondayOnboarding  ⚠️ LEGACY — superseded
 * ============================================================
 * PURPOSE:
 *   Original onboarding webhook. When a Monday item's status changed
 *   to "Onboarded", this function immediately invited the user and
 *   sent them a welcome email with a temporary password.
 *
 * STATUS: LEGACY / PARTIALLY ACTIVE
 *   This function has been functionally superseded by the two-step
 *   flow in mondayOnboardingWebhook + inviteUserWithType, where:
 *     1. mondayOnboardingWebhook stores profile data in PendingInvitation
 *     2. An admin explicitly sends the invite via inviteUserWithType
 *
 *   This file still handles requests sent to its endpoint. If both
 *   webhooks are registered in Monday simultaneously, a single item
 *   status change to "Onboarded" could trigger BOTH functions, resulting
 *   in duplicate invites and duplicate PendingInvitation records.
 *
 * KNOWN DIVERGENCES FROM mondayOnboardingWebhook:
 *   1. Uses GENERIC column IDs ('text', 'text1', 'email0', etc.) that
 *      do NOT match the real board column IDs in mondayOnboardingWebhook.
 *      Profile extraction will silently return nulls for most fields.
 *   2. PendingInvitation is created WITHOUT profile_data — so
 *      processNewUserRegistration will find the record but have nothing
 *      to merge. The user gets a blank profile.
 *   3. Generates a tempPassword that is included in the email body but
 *      is never actually set as the user's password anywhere. The
 *      tempPassword variable is misleading dead code.
 *   4. No WEBHOOK_BEARER_TOKEN auth check (unlike mondayOnboardingWebhook).
 *   5. Writes medical_issues to the User record — this field is explicitly
 *      BLOCKED in mondayOnboardingWebhook for privacy reasons.
 *
 * KNOWN BUGS (do not fix until Phase 1 of the fix plan):
 *   [Step 1.5] PendingInvitation is created without profile_data,
 *     making processNewUserRegistration unable to merge the profile.
 *     Also writes blocked fields (medical_issues) to User record.
 *
 * RECOMMENDATION:
 *   Audit whether this webhook is still registered in Monday.com.
 *   If mondayOnboardingWebhook is the active path, deregister this
 *   function's Monday webhook automation to prevent double-firing.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Helper: generate a random temporary password ─────────────────────────────
// ⚠️ MISLEADING: tempPassword is included in the welcome email body but
//   is never set as the user's actual password via any API. The user receives
//   a password they cannot use. This is dead code in effect.
function generatePassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// ─── Helper: extract a column value from Monday column_values array ───────────
// ⚠️ NOTE: This is a simplified version of the col() helper in
//   mondayOnboardingWebhook. The logic is equivalent but the column IDs
//   this function uses (below) are generic placeholders that don't match
//   the real board. Most extractions will return null.
function getColumnValue(columnValues: any[], columnId: string): string | null {
  const col = columnValues.find(c => c.id === columnId);
  if (!col) return null;
  if (col.text !== undefined && col.text !== null && col.text !== '') return col.text;
  if (col.value) {
    try {
      const parsed = JSON.parse(col.value);
      if (parsed && parsed.text)  return parsed.text;
      if (parsed && parsed.email) return parsed.email;
      if (parsed && parsed.phone) return parsed.phone;
    } catch { /* ignore */ }
  }
  return null;
}

Deno.serve(async (req) => {

  if (req.method === 'POST') {
    const body = await req.json();

    // ── Monday webhook verification challenge ──────────────────────────────
    if (body.challenge) {
      return Response.json({ challenge: body.challenge });
    }

    // ── Auth note ──────────────────────────────────────────────────────────
    // ⚠️ DIVERGENCE: This function reads Deno.env.get('Monday') as a shared
    //   secret but never actually validates it against the incoming request.
    //   The variable 'incomingSecret' is read and immediately discarded.
    //   mondayOnboardingWebhook implements proper WEBHOOK_BEARER_TOKEN auth.
    const secret = Deno.env.get('Monday');
    const incomingSecret = req.headers.get('x-monday-signature') || req.headers.get('authorization');
    // ⚠️ No validation performed — 'incomingSecret' is never compared to 'secret'.

    const event = body.event;
    if (!event) {
      return Response.json({ error: 'No event in payload' }, { status: 400 });
    }

    // This function only fires when the Monday status changes to "Onboarded".
    // All other status changes are ignored.
    const newStatus = event.value?.label?.text || event.value?.label;
    if (typeof newStatus === 'string' && newStatus.toLowerCase() !== 'onboarded') {
      return Response.json({ skipped: true, reason: 'Status not Onboarded' });
    }

    const itemId = String(event.pulseId || event.itemId);

    // ── Fetch full item from Monday API ────────────────────────────────────
    const mondayApiKey = Deno.env.get('Monday');
    const query = `
      query {
        items(ids: [${itemId}]) {
          id
          name
          column_values { id text value }
        }
      }
    `;

    const mondayRes = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': mondayApiKey },
      body: JSON.stringify({ query })
    });

    const mondayData = await mondayRes.json();
    const item = mondayData?.data?.items?.[0];
    if (!item) {
      return Response.json({ error: 'Item not found in Monday' }, { status: 404 });
    }

    const cols = item.column_values;

    // ── Extract profile fields ─────────────────────────────────────────────
    // ⚠️ DIVERGENCE: These column IDs are generic placeholders ('text', 'text1',
    //   'email0', etc.). The real board uses specific IDs defined in
    //   mondayOnboardingWebhook's COL map (e.g. 'emailqz5ikwrq').
    //   These extractions will return null for all fields on the actual board.
    const firstName  = getColumnValue(cols, 'text')  || getColumnValue(cols, 'first_name') || '';
    const lastName   = getColumnValue(cols, 'text1') || getColumnValue(cols, 'last_name')  || item.name || '';
    const fullName   = firstName && lastName ? `${firstName} ${lastName}` : (firstName || lastName || item.name);
    const email      = getColumnValue(cols, 'email') || getColumnValue(cols, 'email0');
    const phone      = getColumnValue(cols, 'phone') || getColumnValue(cols, 'phone0');

    // ⚠️ PRIVACY VIOLATION: medical_issues is extracted and written to the
    //   User record below. mondayOnboardingWebhook explicitly BLOCKS this field.
    const medicalIssues = getColumnValue(cols, 'long_text') || getColumnValue(cols, 'medical_issues') || getColumnValue(cols, 'text2');

    const about              = getColumnValue(cols, 'long_text0') || getColumnValue(cols, 'about') || getColumnValue(cols, 'text3');
    const sex                = getColumnValue(cols, 'gender')     || getColumnValue(cols, 'sex')   || getColumnValue(cols, 'dropdown');
    const emergencyName      = getColumnValue(cols, 'text4')  || getColumnValue(cols, 'emergency_contact_name');
    const emergencyRelationship = getColumnValue(cols, 'text5') || getColumnValue(cols, 'emergency_contact_relationship');
    const emergencyPhone     = getColumnValue(cols, 'phone1') || getColumnValue(cols, 'emergency_contact_phone');

    if (!email) {
      return Response.json({ error: 'No email found for this item' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Idempotency: skip if user already exists (prevents re-inviting on re-webhook)
    const existingUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (existingUsers.length > 0) {
      return Response.json({ skipped: true, reason: 'User already exists', email });
    }

    // Send the base44 invite email
    await base44.users.inviteUser(email, 'user');

    // ⚠️ DEAD CODE: tempPassword is generated and sent in the email, but is
    //   never set as the user's actual password. The user receives a string
    //   they cannot use to log in.
    const tempPassword = generatePassword(10);

    // ── Store PendingInvitation ────────────────────────────────────────────
    // ⚠️ BUG [Step 1.5]: profile_data is NOT included in this payload.
    //   processNewUserRegistration looks for invite.profile_data to merge
    //   into the User record. Without it, the user gets a blank profile.
    //   mondayOnboardingWebhook correctly includes profile_data here.
    await base44.asServiceRole.entities.PendingInvitation.create({
      email,
      user_type:  'participant',
      invited_by: 'monday-automation',
      invited_at: new Date().toISOString(),
      processed:  false
      // ⚠️ Missing: profile_data: { ...full profile fields }
    });

    // Optimistically apply profile data if the User was already created by invite
    const newUsers = await base44.asServiceRole.entities.User.filter({ email });
    if (newUsers.length > 0) {
      await base44.asServiceRole.entities.User.update(newUsers[0].id, {
        user_type:                    'participant',
        participant_status:           'active',
        phone:                         phone || undefined,
        medical_issues:                medicalIssues || undefined, // ⚠️ PRIVACY: blocked field
        about:                         about || undefined,
        sex:                           sex ? sex.toLowerCase() : undefined,
        emergency_contact_name:        emergencyName || undefined,
        emergency_contact_relationship: emergencyRelationship || undefined,
        emergency_contact_phone:       emergencyPhone || undefined,
        monday_item_id:                itemId,
        join_date:                     new Date().toISOString().slice(0, 10)
      });
    }

    // Send welcome email (note: tempPassword is included but unusable — see above)
    await base44.asServiceRole.integrations.Core.SendEmail({
      to:      email,
      subject: 'Welcome to Tzevet Mikey! Your App Access Details',
      body: `Shalom ${fullName},\n\nWelcome to Tzevet Mikey! You have been onboarded and your profile has been created on the Tzevet Mikey App.\n\nHere are your login details:\n\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password at your earliest convenience.\n\nYou can also sign in using Google with the same email address.\n\nSee you on the field!\nTzevet Mikey Team`
    });

    return Response.json({
      success:  true,
      message:  `User ${email} invited and welcome email sent`,
      fullName
    });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});
