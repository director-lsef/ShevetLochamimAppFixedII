/**
 * ============================================================
 * FUNCTION: notifyInstructorsSubmission
 * ============================================================
 * PURPOSE:
 *   Entity automation hook — fires when a new PerformanceRecord is
 *   created with status 'pending_verification'. Sends an in-app
 *   UserNotification to the staff members configured to receive
 *   submission review alerts.
 *
 * DIRECTION:  App entity event  →  UserNotification records
 *
 * TRIGGER:
 *   base44 entity automation — fires on PerformanceRecord.create
 *   events. Configured in the entity automation settings.
 *
 * RECIPIENT LOGIC:
 *   1. Check AppSettings for key 'submission_notification_recipients'
 *      (a JSON array of User IDs).
 *   2. If found and non-empty: notify only those specific users.
 *   3. If not configured (or empty): notify ALL instructors + admins.
 *
 * ENTITY USED (correctly): UserNotification
 *   This function uses the correct entity name and payload shape.
 *   Contrast with SubmissionReviewCard.jsx and Notifications.jsx
 *   which incorrectly use 'Notification' — see BUG [Step 2.1] and
 *   BUG [Step 2.2] in the fix plan.
 *
 * NO KNOWN BUGS in this file.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only act on new record creation — skip updates, deletes, etc.
    if (event?.type !== 'create') {
      return Response.json({ skipped: true });
    }

    const record = data;

    // Only notify for records that need admin review.
    // Records with status 'verified', 'rejected', or others are ignored.
    if (!record || record.status !== 'pending_verification') {
      return Response.json({ skipped: true, reason: 'Not a pending submission' });
    }

    // ── Resolve submitter's display name ──────────────────────────────────
    // Non-critical — fall back to a generic label if lookup fails.
    let submitterName = 'A participant';
    try {
      const users = await base44.asServiceRole.entities.User.filter({ id: record.participant_id });
      if (users[0]?.full_name) submitterName = users[0].full_name;
    } catch { /* silent — generic fallback is safe */ }

    // ── Format drill label and time for the notification message ──────────
    const drillLabels: Record<string, string> = {
      '1k_run':                '1K Run',
      '2k_run':                '2K Run',
      '3km_run':               '3KM Run',
      '300m_crawl':            '300M Crawl',
      'full_gan_saccer_crawl': 'Full Gan Saccer Crawl',
      'other':                 'Other'
    };
    const drillLabel = drillLabels[record.drill_type] || record.drill_name || record.drill_type;

    // Format seconds → M:SS string (e.g. 247 → "4:07")
    const mins = Math.floor((record.time_seconds || 0) / 60);
    const secs = ((record.time_seconds || 0) % 60).toString().padStart(2, '0');
    const timeStr = `${mins}:${secs}`;

    // ── Load configured notification recipients ────────────────────────────
    // AppSettings key 'submission_notification_recipients' stores a JSON
    // array of User IDs. Admins configure this on the Notifications page.
    let recipientIds: string[] | null = null;
    try {
      const settings = await base44.asServiceRole.entities.AppSettings.filter({
        key: 'submission_notification_recipients'
      });
      if (settings[0]?.value) {
        recipientIds = JSON.parse(settings[0].value);
      }
    } catch { /* fall through to default recipient logic */ }

    // ── Resolve staff to notify ────────────────────────────────────────────
    const allUsers = await base44.asServiceRole.entities.User.list();
    let staffToNotify = [];

    if (recipientIds && recipientIds.length > 0) {
      // Use the configured list — only specific users will be notified
      staffToNotify = allUsers.filter(u => recipientIds.includes(u.id));
    } else {
      // No setting configured — fall back to all instructors and admins
      staffToNotify = allUsers.filter(u =>
        u.user_type === 'instructor' ||
        u.user_type === 'admin' ||
        u.role === 'admin'
      );
    }

    // ── Create one UserNotification per staff member ───────────────────────
    // Note: using the correct entity name 'UserNotification' and the correct
    // payload shape { user_id, title, message, type, read, link }.
    for (const staff of staffToNotify) {
      await base44.asServiceRole.entities.UserNotification.create({
        user_id: staff.id,
        title:   `New submission to review`,
        message: `${submitterName} submitted a ${drillLabel} result: ${timeStr}${record.proof_url ? ' (with proof photo)' : ' (no photo)'}`,
        type:    'submission_review',
        read:    false,
        link:    'SubmissionReview'  // deep link — navigates to the review page
      });
    }

    return Response.json({ success: true, notified: staffToNotify.length });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
