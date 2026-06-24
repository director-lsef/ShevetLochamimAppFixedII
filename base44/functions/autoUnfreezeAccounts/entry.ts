/**
 * ============================================================
 * FUNCTION: autoUnfreezeAccounts
 * ============================================================
 * PURPOSE:
 *   Scheduled cleanup job — scans all User records and restores
 *   any account whose freeze period has expired.
 *
 *   An account is frozen when an admin sets account_status = 'frozen'
 *   and freeze_end_date to a future date (via FreezeAccountDialog).
 *   This function runs periodically to automatically re-activate them.
 *
 * TRIGGER:
 *   Scheduled — should run at least once per day.
 *   Can also be triggered manually (e.g. via admin panel or cron).
 *
 * ENTITY: User
 *   Reads:  account_status, freeze_end_date
 *   Writes: account_status → 'active', freeze_end_date → null
 *
 * NO KNOWN BUGS in this file.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Service role required — this is a background job with no user context.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const now = new Date();

    // Filter to only frozen accounts whose end date has passed.
    // freeze_end_date is stored as an ISO date string.
    const expiredFrozen = allUsers.filter(u =>
      u.account_status === 'frozen' &&
      u.freeze_end_date &&
      new Date(u.freeze_end_date) <= now
    );

    let unfrozenCount = 0;
    for (const user of expiredFrozen) {
      // Reset account to active and clear the freeze_end_date.
      // This allows the account to be frozen again with a new date in the future.
      await base44.asServiceRole.entities.User.update(user.id, {
        account_status: 'active',
        freeze_end_date: null
      });
      unfrozenCount++;
    }

    return Response.json({
      success: true,
      checked: allUsers.length,      // total users scanned
      unfrozen: unfrozenCount,        // accounts restored this run
      timestamp: now.toISOString()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
