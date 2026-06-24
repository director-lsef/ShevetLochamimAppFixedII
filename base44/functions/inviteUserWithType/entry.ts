/**
 * ============================================================
 * FUNCTION: inviteUserWithType
 * ============================================================
 * PURPOSE:
 *   Admin-only endpoint to invite a new user to the platform.
 *   Sends the base44 invite email and upserts a PendingInvitation
 *   record with timestamps so the admin can track invite history.
 *
 *   This function does NOT apply Monday.com profile data — that
 *   happens in processNewUserRegistration after the user signs up.
 *
 * TRIGGER:
 *   Frontend admin action — called from PendingInvitationsPanel
 *   when an admin taps "Send Invite" for a participant.
 *
 * AUTHENTICATION:
 *   Admin only. Returns 403 if user_type or role is not 'admin'.
 *
 * PAYLOAD:
 *   { email: string, user_type: 'participant' | 'instructor' | 'admin' }
 *
 * UPSERT LOGIC:
 *   - If a PendingInvitation already exists for this email, updates
 *     last_invited_at and invited_by (supports re-inviting).
 *   - If duplicates exist (edge case), deletes extras (deduplicates).
 *   - If no record exists, creates a new PendingInvitation.
 *
 * NOTE: The invite email is sent via base44.users.inviteUser().
 *   If this call throws, the error is logged but execution continues —
 *   the PendingInvitation is still updated so the admin can retry.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Authorization: admin only ──────────────────────────────────────────
    // Both user_type and role are checked because some admins may have the
    // role field set instead of (or in addition to) user_type.
    const user = await base44.auth.me();
    if (user?.user_type !== 'admin' && user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, user_type } = await req.json();

    if (!email || !user_type) {
      return Response.json({ error: 'Email and user_type are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // base44 platform role: only 'admin' and 'user' are valid platform-level roles.
    // The app-specific user_type (participant, instructor, admin) is stored on the
    // User entity separately — it controls app permissions, not platform access.
    const platformRole = user_type === 'admin' ? 'admin' : 'user';
    const now = new Date().toISOString();

    // ── Send the invite email ──────────────────────────────────────────────
    // base44.users.inviteUser() sends a sign-up email with a one-time link.
    // The error is non-fatal — if sending fails, we still record the attempt.
    try {
      await base44.users.inviteUser(normalizedEmail, platformRole);
      console.log(`Invitation email sent to ${normalizedEmail} as ${platformRole}`);
    } catch (inviteErr) {
      console.error(`Failed to send invitation to ${normalizedEmail}:`, inviteErr.message);
      // Continue — PendingInvitation is still updated to track the attempt
    }

    // ── Upsert PendingInvitation ───────────────────────────────────────────
    // Maintains one canonical record per email. The record serves two purposes:
    //   1. Shows the admin which invites are pending/re-sent
    //   2. Will be used by processNewUserRegistration to merge Monday profile data
    try {
      const existing = await base44.asServiceRole.entities.PendingInvitation.filter({ email: normalizedEmail });

      if (existing && existing.length > 0) {
        // Update the canonical record with the new invite timestamp
        await base44.asServiceRole.entities.PendingInvitation.update(existing[0].id, {
          last_invited_at: now,
          invited_by: user.id,
        });

        // Clean up any duplicate records for this email (defensive deduplication)
        for (let i = 1; i < existing.length; i++) {
          await base44.asServiceRole.entities.PendingInvitation.delete(existing[i].id);
        }
      } else {
        // First invite for this email — create a new record
        await base44.asServiceRole.entities.PendingInvitation.create({
          email:            normalizedEmail,
          user_type:        user_type,
          invited_by:       user.id,
          invited_at:       now,
          last_invited_at:  now,
        });
      }
    } catch (err) {
      console.warn("Could not update pending invitation:", err.message);
    }

    return Response.json({
      success: true,
      message: `Invitation sent to ${normalizedEmail} as ${user_type}`
    });

  } catch (error) {
    console.error('Error inviting user:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
