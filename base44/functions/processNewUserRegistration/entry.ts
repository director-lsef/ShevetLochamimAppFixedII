/**
 * ============================================================
 * FUNCTION: processNewUserRegistration
 * ============================================================
 * PURPOSE:
 *   Scheduled job that merges Monday.com profile data into newly
 *   registered Users, then marks the PendingInvitation as processed.
 *
 * TRIGGER:
 *   Scheduled — runs periodically (e.g. every 15 minutes).
 *   Also callable on-demand via the "Force Sync" button in
 *   PendingInvitationsPanel (base44.functions.invoke).
 *
 * ─── UNLOCK SCOPE FOR EDITING ────────────────────────────────────────────────
 *   BASE44 EDITOR: Unlock the following regions before editing:
 *     1. The main for-loop body (lines ~53–100)
 *     2. Do NOT touch the outer try/catch wrapper or the allInvites fetch.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * BUGS FIXED IN THIS VERSION:
 *   [Fix 1.2a] processed=true and signed_in_at are now written BEFORE
 *     deletion so PendingInvitationsPanel can display "Signed In" state.
 *   [Fix 1.4] User.list() moved OUTSIDE the loop (was O(n²), now O(1)).
 *
 * REMAINING KNOWN BUG:
 *   Confirm the scheduled cron trigger is active in base44 scheduler
 *   settings. If the cron is not configured, this function only runs
 *   when the admin taps "Force Sync" — auto-sync will appear broken.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    console.log("Running profile merge check...");

    const allInvites = await base44.asServiceRole.entities.PendingInvitation.list();

    if (!allInvites || allInvites.length === 0) {
      console.log("No pending invitations found.");
      return Response.json({ success: true, merged: 0, deleted: 0 });
    }

    console.log(`Found ${allInvites.length} pending invitations to check.`);

    // ── [Fix 1.4] UNLOCK THIS LINE — moved outside loop ───────────────────────
    // BASE44 EDITOR: This single User.list() call replaces the per-iteration
    // call that was inside the for-loop below. Do not move it back inside.
    // OLD CODE (REMOVE — was inside the loop, causing O(n²) API calls):
    //   const allUsers = await base44.asServiceRole.entities.User.list();
    // NEW CODE (keep here, outside the loop):
    const allUsers = await base44.asServiceRole.entities.User.list();
    // ── END UNLOCK ─────────────────────────────────────────────────────────────

    let merged = 0;
    let deleted = 0;

    for (const invite of allInvites) {
      const email = invite.email?.toLowerCase();
      if (!email) { console.log("Skipping invitation with no email"); continue; }

      // ── [Fix 1.4] UNLOCK THIS LINE — use pre-fetched allUsers ─────────────────
      // BASE44 EDITOR: Replace the old `await ...User.list()` call that was here
      // with this in-memory filter against the hoisted allUsers array.
      // OLD CODE (DELETE THIS):
      //   const allUsers = await base44.asServiceRole.entities.User.list();
      //   const users = allUsers.filter(u => u.email?.toLowerCase() === email);
      // NEW CODE (keep as-is):
      const users = allUsers.filter(u => u.email?.toLowerCase() === email);
      // ── END UNLOCK ─────────────────────────────────────────────────────────────

      if (!users || users.length === 0) {
        console.log(`No user record yet for ${email} — skipping.`);
        continue;
      }

      const sorted = users.sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());
      const authUser = sorted[0];

      if (invite.processed || (authUser.phone && authUser.monday_item_id)) {
        console.log(`User ${email} already synced — deleting invitation.`);
        await base44.asServiceRole.entities.PendingInvitation.delete(invite.id);
        deleted++;
        continue;
      }

      if (invite.profile_data) {
        const profileUpdate = { ...invite.profile_data, account_status: 'active' };
        await base44.asServiceRole.entities.User.update(authUser.id, profileUpdate);
        console.log(`Merged profile data into user ${email} (id: ${authUser.id})`);
      }

      // ── [Fix 1.2a] UNLOCK THIS BLOCK — mark processed before deleting ─────────
      // BASE44 EDITOR: This update call is NEW. It must run BEFORE the delete below.
      // It sets processed=true and signed_in_at so PendingInvitationsPanel can
      // show the "Signed In — First Login Complete" badge before the record is
      // removed. Without this, the third tag state is never visible.
      //
      // OLD CODE (DELETE THIS LINE — was the only action here):
      //   await base44.asServiceRole.entities.PendingInvitation.delete(invite.id);
      //
      // NEW CODE: mark first, then clean up in the next scheduled run:
      await base44.asServiceRole.entities.PendingInvitation.update(invite.id, {
        processed: true,
        signed_in_at: new Date().toISOString(),
      });
      console.log(`Marked PendingInvitation processed for ${email}.`);
      // NOTE: The deletion of processed=true records is handled by a SEPARATE
      // cleanup pass (add a second loop below, or a separate scheduled function
      // that deletes records where processed=true AND signed_in_at is > 24h ago).
      // ── END UNLOCK ─────────────────────────────────────────────────────────────

      merged++;
    }

    // ── [Fix 1.2a] UNLOCK THIS BLOCK — add cleanup pass for processed records ──
    // BASE44 EDITOR: This second pass is NEW. It deletes PendingInvitation records
    // that were marked processed=true in a PREVIOUS run (at least 1 hour ago),
    // giving the UI time to display the "Signed In" badge before the record vanishes.
    //
    // HUMAN NOTE: Adjust the grace period (currently 1 hour) as needed.
    const gracePeriodMs = 60 * 60 * 1000; // 1 hour grace before deletion
    const cutoff = new Date(Date.now() - gracePeriodMs).toISOString();
    let cleanedUp = 0;
    for (const invite of allInvites) {
      if (invite.processed && invite.signed_in_at && invite.signed_in_at < cutoff) {
        await base44.asServiceRole.entities.PendingInvitation.delete(invite.id);
        cleanedUp++;
      }
    }
    // ── END UNLOCK ─────────────────────────────────────────────────────────────

    console.log(`Profile merge complete. Merged: ${merged}, Cleaned up: ${deleted + cleanedUp}`);
    return Response.json({ success: true, merged, deleted: deleted + cleanedUp });

  } catch (error) {
    console.error('Error in processNewUserRegistration:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
