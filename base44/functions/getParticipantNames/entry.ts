/**
 * ============================================================
 * FUNCTION: getParticipantNames
 * ============================================================
 * PURPOSE:
 *   Returns a minimal, privacy-safe list of all users: only id,
 *   full_name, and user_type. No sensitive fields (email, phone,
 *   address, etc.) are exposed.
 *
 *   Used by frontend components that need a name→id mapping for
 *   dropdowns or participant pickers, without requiring the caller
 *   to have full User list permissions.
 *
 * TRIGGER:
 *   Frontend API call — invoked by components that need participant
 *   name resolution (e.g. AttendeeRatingPanel, DrillBankPicker).
 *
 * AUTHENTICATION:
 *   Requires a valid session token (base44.auth.me() must succeed).
 *   Open to all authenticated users regardless of role.
 *
 * NOTE: Uses SDK version 0.8.6 (older than other functions which use
 *   0.8.23). Should be upgraded for consistency once tested.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Confirm the caller is authenticated before exposing any user data.
    // This prevents unauthenticated access to the name list.
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use service role to fetch all users, then strip to the minimum
    // fields needed — only id, full_name, and user_type are returned.
    const allUsers = await base44.asServiceRole.entities.User.list();
    const participants = allUsers.map(u => ({
      id:        u.id,
      full_name: u.full_name,
      user_type: u.user_type  // allows callers to filter by role client-side
    }));

    return Response.json({ participants });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
