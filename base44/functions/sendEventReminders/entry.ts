/**
 * ============================================================
 * FUNCTION: sendEventReminders
 * ============================================================
 * PURPOSE:
 *   Scheduled job — scans EventReminder records and fires
 *   in-app notifications and/or emails for any reminder whose
 *   trigger window falls within the next 60 minutes.
 *
 * TRIGGER:
 *   Scheduled — should run hourly (not more frequently, not less,
 *   because the detection window is exactly 60 minutes).
 *
 * REMINDER RESOLUTION:
 *   Each EventReminder stores:
 *     - event_id              : the target event
 *     - remind_before_value   : numeric amount (e.g. 2)
 *     - remind_before_unit    : 'hours' or 'days'
 *     - delivery              : 'in_app' | 'email' | 'both'
 *     - sent                  : boolean (false until this function fires)
 *
 *   trigger_time = event.start_datetime - (remind_before_value × unit)
 *   A reminder fires if: now <= trigger_time < now + 60min
 *
 * RECIPIENTS:
 *   Participants: all EventRegistration records with status='registered'
 *   Staff: up to 5 instructor slots on the Event (lead, assistant,
 *          support, instructor_4, instructor_5)
 *
 * DELIVERY:
 *   in_app → creates a UserNotification record (entity: UserNotification)
 *   email  → calls base44.asServiceRole.integrations.Core.SendEmail()
 *   both   → does both; email failure is non-fatal
 *
 * ENTITY USED (correctly): UserNotification
 *   This function correctly uses 'UserNotification' (not 'Notification').
 *
 * NO KNOWN BUGS in this file.
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Detection window: reminders whose trigger time falls in the next 60 minutes.
    // This matches the expected hourly schedule — running more often would
    // re-fire reminders within the same window (mitigated by sent=true guard).
    const windowEnd = new Date(now.getTime() + 60 * 60 * 1000);

    // Fetch only unsent reminders to avoid re-processing already-fired ones.
    const allReminders = await base44.asServiceRole.entities.EventReminder.filter({ sent: false });

    let sent = 0;

    for (const reminder of allReminders) {

      // ── Resolve the associated event ──────────────────────────────────────
      // Skip if the event no longer exists or has been cancelled.
      const events = await base44.asServiceRole.entities.Event.filter({
        id: reminder.event_id,
        status: 'active'
      });
      const event = events[0];
      if (!event) continue;

      // ── Compute trigger time ──────────────────────────────────────────────
      const eventStart = new Date(event.start_datetime);
      const offsetMs = reminder.remind_before_unit === 'days'
        ? reminder.remind_before_value * 24 * 60 * 60 * 1000
        : reminder.remind_before_value * 60 * 60 * 1000;

      const triggerTime = new Date(eventStart.getTime() - offsetMs);

      // Only fire if trigger time is within the current 60-minute window.
      // Reminders whose trigger time has already passed (triggerTime < now)
      // are deliberately skipped — they are stale and should not fire late.
      if (triggerTime < now || triggerTime >= windowEnd) continue;

      // ── Build recipient list ───────────────────────────────────────────────
      // [Fix 2.4] registrations include the email_reminder preference field — used below
      const registrations = await base44.asServiceRole.entities.EventRegistration.filter({
        event_id: event.id,
        status: 'registered'
      });

      // Collect all assigned staff IDs from the event's instructor slots.
      // Deduplicate in case the same instructor is assigned to multiple slots.
      const staffIds = [...new Set([
        event.lead_instructor_id,
        event.assistant_instructor_id,
        event.support_instructor_id,
        event.instructor_4_id,
        event.instructor_5_id
      ].filter(Boolean))];

      const participantIds = registrations.map(r => r.participant_id);

      // Merge participants and staff into a deduplicated recipient list.
      // An instructor who is also registered as a participant would otherwise
      // receive two notifications.
      const allUserIds = [...new Set([...participantIds, ...staffIds])];

      // Format time strings for the notification message
      const timeStr = eventStart.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const dateStr = eventStart.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      const beforeLabel = `${reminder.remind_before_value} ${reminder.remind_before_unit}`;

      for (const userId of allUserIds) {
        const isStaff = staffIds.includes(userId);

        // [Fix 2.4 — IMPLEMENTED] Respect each participant's email_reminder preference.
        // 'none' = skip, '1_day' = ~24h reminders only, '1_hour' = ~1h only, 'both' = all.
        // Staff are always notified regardless of participant preferences.
        const reg = registrations.find(r => r.participant_id === userId);
        const reminderPref = reg?.email_reminder ?? '1_day';
        const offsetHours = reminder.remind_before_unit === 'days'
          ? reminder.remind_before_value * 24
          : reminder.remind_before_value;
        const prefMatchesOffset =
          reminderPref === 'none'   ? false :
          reminderPref === '1_day'  ? offsetHours >= 20 :
          reminderPref === '1_hour' ? offsetHours <= 4  :
          true; // 'both' or unknown value → send

        if (!isStaff && !prefMatchesOffset) continue;

        // ── In-app notification ──────────────────────────────────────────────
        if (reminder.delivery === 'in_app' || reminder.delivery === 'both') {
          await base44.asServiceRole.entities.UserNotification.create({
            user_id: userId,
            title:   `Reminder: ${event.title} in ${beforeLabel}`,
            message: isStaff
              ? `You're assigned as staff for ${event.title} on ${dateStr} at ${timeStr}${event.location ? ` at ${event.location}` : ''}.`
              : `You're registered for ${event.title} on ${dateStr} at ${timeStr}${event.location ? ` at ${event.location}` : ''}.`,
            type:    'event_reminder',
            read:    false,
            link:    `EventDetails?id=${event.id}`
          });
        }

        // ── Email notification ───────────────────────────────────────────────
        // Email is attempted only when delivery is 'email' or 'both'.
        // Failure is non-fatal: in-app notification was already created above.
        if (reminder.delivery === 'email' || reminder.delivery === 'both') {
          try {
            const users = await base44.asServiceRole.entities.User.filter({ id: userId });
            const user = users[0];
            if (user?.email) {
              const roleNote = isStaff
                ? `You are assigned as <strong>staff</strong> for this event.`
                : `You are <strong>registered</strong> for this event.`;

              await base44.asServiceRole.integrations.Core.SendEmail({
                to:      user.email,
                subject: `Reminder: ${event.title} in ${beforeLabel}`,
                body: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #0038A8 0%, #001A3D 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">Tzevet Mikey</h1>
                    </div>
                    <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                      <h2 style="color: #1f2937; margin-top: 0;">Event Reminder</h2>
                      <p style="color: #4b5563; font-size: 16px;">Hi ${user.full_name || 'there'},</p>
                      <p style="color: #4b5563;">${roleNote} <strong>${event.title}</strong> is coming up in <strong>${beforeLabel}</strong>.</p>
                      <div style="background: #f0f9ff; border-left: 4px solid #0038A8; padding: 16px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #1e40af;"><strong>${dateStr}</strong></p>
                        <p style="margin: 4px 0 0; color: #1e40af;"><strong>${timeStr}</strong></p>
                        ${event.location ? `<p style="margin: 4px 0 0; color: #1e40af;"><strong>${event.location}</strong></p>` : ''}
                      </div>
                      <p style="color: #4b5563;">See you there!</p>
                    </div>
                  </div>
                `
              });
            }
          } catch {
            // Email delivery failed — in-app notification is already sent above,
            // so we do not abort or roll back. The sent flag will still be set.
          }
        }
      }

      // ── Mark reminder as sent (idempotency guard) ──────────────────────────
      // This prevents the reminder from firing again on the next hourly run,
      // even if the trigger window calculation would still match.
      await base44.asServiceRole.entities.EventReminder.update(reminder.id, { sent: true });
      sent++;
    }

    return Response.json({ success: true, remindersSent: sent });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
