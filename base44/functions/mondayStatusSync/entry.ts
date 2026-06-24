/**
 * ============================================================
 * FUNCTION: mondayStatusSync
 * ============================================================
 * PURPOSE: Inbound webhook — Monday.com status change → App User.
 * DIRECTION: Monday.com → App
 *
 * ─── UNLOCK SCOPE FOR EDITING ────────────────────────────────────────────────
 *   BASE44 EDITOR: Only unlock:
 *     1. The MONDAY_TO_APP_STATUS constant (add 'drop out' key)
 *     2. The APP_TO_MONDAY_STATUS constant + updateMondayStatus function
 *        (both marked for DELETION — they are dead code)
 *   Do NOT touch the Deno.serve() handler body.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * BUGS FIXED IN THIS VERSION:
 *   [Fix 1.4] Added 'drop out' key to MONDAY_TO_APP_STATUS.
 *   [Fix 1.4] Added 'active participant' already existed — confirmed OK.
 *   [Fix 1.5] Removed dangerous 'YOUR_BOARD_ID' fallback string in
 *     updateMondayStatus (moot — function is dead code and deleted below).
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── [Fix 1.4] UNLOCK THIS CONSTANT — add 'drop out' key ───────────────────────
// BASE44 EDITOR: Add the 'drop out' entry (line 3 in this map).
// REASON: syncStatusToMonday sends 'Drop Out' to Monday. Monday echoes back
// 'drop out' (lowercased). Without this key, the round-trip silently breaks
// and dropout status never syncs back from Monday to the app.
//
// OLD MAP (missing 'drop out'):
//   const MONDAY_TO_APP_STATUS = {
//     'active': 'active',
//     'active participant': 'active',
//     'break': 'break',
//     'dropout': 'dropout',       ← Monday never sends this string
//     'alumni': 'alumni'
//   };
//
// NEW MAP (correct — add 'drop out'):
const MONDAY_TO_APP_STATUS = {
  'active':             'active',
  'active participant': 'active',
  'break':              'break',
  'dropout':            'dropout',   // kept for safety in case any old webhooks still send this
  'drop out':           'dropout',   // [Fix 1.4] THIS IS THE NEW LINE — matches what Monday actually sends
  'alumni':             'alumni',
};
// ── END UNLOCK ─────────────────────────────────────────────────────────────────

// ── [Fix 1.4+1.5] DELETE THIS ENTIRE BLOCK — dead code ────────────────────────
// BASE44 EDITOR: DELETE the APP_TO_MONDAY_STATUS constant and the
// updateMondayStatus() function below. Both are dead code — they are
// defined here but never called. The real outbound map lives in
// syncStatusToMonday/entry.ts. Leaving them here creates a false impression
// that this file handles outbound sync (it does not).
//
// Also: updateMondayStatus() has the dangerous 'YOUR_BOARD_ID' fallback [Fix 1.5].
// Deleting it removes the risk entirely.
//
// DELETED BLOCK START:
// const APP_TO_MONDAY_STATUS = {
//   'active':  'Active',    // ← MISMATCH: syncStatusToMonday sends 'Active Participant'
//   'break':   'Break',
//   'dropout': 'Dropout',   // ← MISMATCH: syncStatusToMonday sends 'Drop Out'
//   'alumni':  'Alumni',
// };
//
// async function updateMondayStatus(itemId, statusColumnId, newLabel, apiKey) {
//   const mutation = `
//     mutation {
//       change_column_value(
//         board_id: ${Deno.env.get('MONDAY_PARTICIPANTS_BOARD_ID') || 'YOUR_BOARD_ID'},
//         ...
//       )
//     }
//   `;
//   await fetch('https://api.monday.com/v2', { ... });
// }
// DELETED BLOCK END
// ── END DELETE ─────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await req.json();

  if (body.challenge) {
    return Response.json({ challenge: body.challenge });
  }

  const event = body.event;
  if (!event) {
    return Response.json({ error: 'No event in payload' }, { status: 400 });
  }

  const mondayApiKey = Deno.env.get('Monday');
  const base44 = createClientFromRequest(req);

  if (event.type === 'update_column_value' || event.columnType === 'color') {
    const newLabel = (event.value?.label?.text || event.value?.label || '').toLowerCase().trim();
    const itemId = String(event.pulseId || event.itemId);

    const appStatus = MONDAY_TO_APP_STATUS[newLabel];
    if (!appStatus) {
      return Response.json({ skipped: true, reason: `Unknown status: ${newLabel}` });
    }

    const users = await base44.asServiceRole.entities.User.filter({ monday_item_id: itemId });
    if (users.length === 0) {
      return Response.json({ skipped: true, reason: 'No user found with this Monday item ID' });
    }

    const user = users[0];
    if (user.participant_status === appStatus) {
      return Response.json({ skipped: true, reason: 'Status already matches' });
    }

    await base44.asServiceRole.entities.User.update(user.id, { participant_status: appStatus });

    return Response.json({ success: true, direction: 'monday→app', email: user.email, newStatus: appStatus });
  }

  return Response.json({ skipped: true, reason: 'Unhandled event type' });
});
