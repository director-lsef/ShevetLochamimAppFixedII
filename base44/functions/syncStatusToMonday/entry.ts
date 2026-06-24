/**
 * ============================================================
 * FUNCTION: syncStatusToMonday
 * ============================================================
 * PURPOSE:
 *   Outbound webhook handler — listens for changes to a User
 *   entity in the app and pushes the updated participant_status
 *   and/or primary_branch values to Monday.com.
 *
 * DIRECTION:  App  →  Monday.com (one-way outbound)
 *
 * TRIGGER:
 *   base44 entity automation — fires when any User record is
 *   created or updated (configured in the entity automation settings).
 *
 * COUNTERPART:
 *   mondayStatusSync/entry.ts handles the reverse direction.
 *   ⚠️ BUG [Step 1.1]: The label strings in APP_TO_MONDAY_STATUS here
 *   differ from what mondayStatusSync expects on the inbound side.
 *   'Drop Out' (sent here) is never matched as 'dropout' by mondayStatusSync.
 *
 * ENV VARS REQUIRED:
 *   - Monday                   : Monday.com API key
 *   - MONDAY_BOARD_MIKEY       : ⚠️ BUG [Step 1.2] — inconsistent name;
 *                                should be MONDAY_PARTICIPANTS_BOARD_ID
 *   - MONDAY_STATUS_COLUMN_ID  : Column ID for the status field (default: 'status')
 *   - MONDAY_BRANCH_COLUMN_ID  : Column ID for the branch field (default: 'branch')
 *
 * PAYLOAD (from base44 entity automation):
 *   { data: User, old_data: User | null }
 *   'data' = the new/updated User record
 *   'old_data' = the previous state (null on create)
 *
 * BRANCHES HANDLED:
 *   'צוות מייקי'   → 'Jerusalem'
 *   'צוות לוחמים'  → 'Herzeliya'
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Outbound status map: app participant_status → Monday label ───────────────
// ⚠️ BUG [Step 1.1]: These are the AUTHORITATIVE outbound labels.
//   mondayStatusSync/entry.ts MUST match these values in its inbound map.
//   Current mismatches:
//     'active'  → 'Active Participant'  (mondayStatusSync handles 'active participant' — OK)
//     'dropout' → 'Drop Out'            (mondayStatusSync handles 'dropout' — BROKEN)
const APP_TO_MONDAY_STATUS: Record<string, string> = {
  'active':  'Active Participant',
  'break':   'Break',
  'dropout': 'Drop Out',   // ⚠️ BUG [Step 1.1]: mondayStatusSync won't match 'drop out'
  'alumni':  'Alumni',
};

// ─── Branch map: app branch value → Monday branch column label ───────────────
const APP_TO_MONDAY_BRANCH: Record<string, string> = {
  'צוות מייקי':  'Jerusalem',
  'צוות לוחמים': 'Herzeliya',
};

// ─── Board / column configuration ────────────────────────────────────────────
// ⚠️ BUG [Step 1.2]: MONDAY_BOARD_MIKEY is an inconsistent env var name.
//   mondayStatusSync uses MONDAY_PARTICIPANTS_BOARD_ID.
//   mondayOnboardingWebhook hardcodes the board ID as '2092723258'.
//   All three should use the same env var: MONDAY_PARTICIPANTS_BOARD_ID.
const BOARD_ID = Deno.env.get('MONDAY_BOARD_MIKEY');
const STATUS_COLUMN_ID = Deno.env.get('MONDAY_STATUS_COLUMN_ID') || 'status';
const BRANCH_COLUMN_ID = Deno.env.get('MONDAY_BRANCH_COLUMN_ID') || 'branch';

// ─── Helper: batch-update multiple Monday columns in one API call ─────────────
// Combines status + branch into a single mutation to avoid rate limit issues
// and reduce latency. Monday's change_multiple_column_values accepts a JSON
// string for column_values, requiring manual escaping of inner quotes.
async function updateMondayColumns(
  mondayItemId: string,
  updates: Record<string, { label: string }>,
  mondayApiKey: string
) {
  // Monday's GraphQL API requires the column_values JSON to be passed
  // as a string with escaped internal quotes (it is not a nested object).
  const columnsJson = JSON.stringify(updates).replace(/"/g, '\\"');
  const mutation = `
    mutation {
      change_multiple_column_values(
        board_id: ${BOARD_ID},
        item_id: ${mondayItemId},
        column_values: "${columnsJson}"
      ) {
        id
      }
    }
  `;

  const res = await fetch('https://api.monday.com/v2', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': mondayApiKey
    },
    body: JSON.stringify({ query: mutation })
  });

  const result = await res.json();
  // Monday returns GraphQL errors in result.errors (HTTP 200 with error body)
  if (result.errors) throw new Error(JSON.stringify(result.errors));
  return result;
}

// ─── Main request handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = await req.json();

  // base44 entity automation payload: { data, old_data }
  // 'data' is the new User record; 'old_data' is the previous state.
  const { data, old_data } = body;

  if (!data) {
    return Response.json({ skipped: true, reason: 'No data' });
  }

  // ── Change detection: only sync if relevant fields changed ────────────────
  // Comparing against old_data prevents a sync loop: if mondayStatusSync
  // updates a User, this function should see no change and skip.
  // However, if old_data is null (new user), both flags will be true —
  // this correctly handles initial sync on participant creation.
  const statusChanged = data.participant_status !== old_data?.participant_status;
  const branchChanged = data.primary_branch !== old_data?.primary_branch;

  if (!statusChanged && !branchChanged) {
    return Response.json({ skipped: true, reason: 'Neither status nor branch changed' });
  }

  // Only users who have been linked to a Monday item can be synced.
  // Unlinked users (e.g. admins, instructors) are silently skipped.
  const mondayItemId = data.monday_item_id;
  if (!mondayItemId) {
    return Response.json({ skipped: true, reason: 'No Monday item ID on this user' });
  }

  const mondayApiKey = Deno.env.get('Monday');

  // ── Build the column update payload ───────────────────────────────────────
  const columnValues: Record<string, { label: string }> = {};

  if (statusChanged) {
    const newLabel = APP_TO_MONDAY_STATUS[data.participant_status];
    if (newLabel) {
      // Monday status (color) columns accept { label: "Label Text" }
      columnValues[STATUS_COLUMN_ID] = { label: newLabel };
    }
    // If newLabel is undefined, the status value isn't in our map —
    // it won't be synced (intentional: avoids pushing unknown values to Monday).
  }

  if (branchChanged && data.primary_branch) {
    const mondayBranch = APP_TO_MONDAY_BRANCH[data.primary_branch];
    if (mondayBranch) {
      columnValues[BRANCH_COLUMN_ID] = { label: mondayBranch };
    }
  }

  if (Object.keys(columnValues).length === 0) {
    // Both fields changed but neither had a mappable value — skip
    return Response.json({ skipped: true, reason: 'No mappable changes' });
  }

  try {
    await updateMondayColumns(mondayItemId, columnValues, mondayApiKey);
    return Response.json({
      success: true,
      direction: 'app→monday',
      mondayItemId,
      boardId: BOARD_ID,
      columnsUpdated: Object.keys(columnValues)
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
