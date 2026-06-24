# Tzevet Mikey — COMMIT-READY BUILD
## All fixes implemented as working code. Entities are pure JSON.

This build differs from previous annotation-only versions:
**every fix has been implemented directly in the code.** You can commit
this entire tree to GitHub and sync to Base44 as-is.

---

## What changed from the annotated version

### Entity files (base44/entities/) — 18 files, pure JSON
All comments stripped. Validated with a JSON parser. Base44 will ingest
these without errors. Files: AppSettings, AttendanceRecord, CustomDrill,
Event, EventCategory, EventRegistration, EventReminder, Location,
MentalToughnessRating, PendingInvitation, PerformanceRecord, SessionPlan,
SessionPlanAssignment, SessionPlanDrill, SessionPlanTemplate,
SessionPlanTemplateDrill, User, UserNotification.

### Implemented fixes (previously annotation-only, now live code)

| Fix | File(s) | What it does |
|---|---|---|
| Admin instructor assign/remove | StaffingTiers.jsx | Admins get a per-slot Select dropdown + Remove button across all 5 tiers |
| Staff remove participant | EventDetails.jsx, InstructorPortal.jsx, SessionRoster.jsx | Working remove button on rosters; sets registration to 'cancelled' and notifies the participant |
| Three-state onboarding tags | PendingInvitationsPanel.jsx | "Not Yet Invited" → "Invite Sent" → "✓ Signed In — Syncing Profile" |
| freeze_exempt | Participants.jsx (toggle), UserProfileDetail.jsx (badge), LowEngagementReport.jsx (filter) | Admins can exempt participants from attendance requirements |
| All-5-slots instructor counting | Statistics.jsx | Instructors in any slot get event credit; below-2/month rows highlighted red with "Below min" badge |
| Email reminder preferences | sendEventReminders/entry.ts | Respects each registration's email_reminder setting (none/1_day/1_hour/both); staff always notified |
| useAuth() migration | MyEvents, AssignSessionPlan, ManageCustomDrills, ManageSessionPlans, RateParticipants, SessionPlanBank, InstructorCalendar | No redundant auth.me() round-trip; null-guarded with user-dependent useEffect |

### Already-active fixes carried forward
- Frozen accounts blocked from event registration (EventDetails, Events)
- Attendance marking syncs EventRegistration.status (SwipeAttendance, EventDetails)
- Notification → UserNotification entity (Notifications page, SubmissionReviewCard)
- UserDirectory registered in pages.config.js; hardcoded route removed from App.jsx
- Ulpan threshold corrected to < 2 (LowEngagementReport)
- 'drop out' label handled in mondayStatusSync inbound map
- processNewUserRegistration sets processed=true + signed_in_at before cleanup

### Intentionally left with auth.me() (works, just unoptimized)
SubmissionReview, UserDirectory, Participants, InstructorPortal,
Notifications, Events, Home — these use complex Promise.all destructuring
or role-guard patterns. auth.me() is functionally correct there; the
[Fix P.1] annotations remain in those files for future optimization.

---

## Validation performed on this build

- 107/107 src files parse cleanly under esbuild (real JSX parser)
- 11/11 backend functions parse cleanly as TypeScript
- 18/18 entity files parse as strict JSON
- 0 references to non-existent entities in active code
- All 12 implemented features verified present via grep audit

---

## Commit & deploy

```bash
git checkout -b fix/phase-05-implemented
# copy this tree over your repo working dir (preserve .git)
git add -A
git commit -m "Phase 0.5: entities, attendance sync, notifications, staffing admin, freeze exemption"
git push -u origin fix/phase-05-implemented
# open PR → merge → Base44: Settings → GitHub → Sync from main
```

## Post-deploy smoke tests (in order)

1. **Entities:** Base44 → Entities panel — all 18 entities listed, AttendanceRecord has event_id/participant_id/status
2. **Profile:** participant → Profile → all 4 tabs load (no infinite spinner)
3. **Attendance pipeline:** instructor marks one participant present → Statistics shows +1 for the month
4. **Frozen block:** freeze a participant → their Register buttons disappear
5. **Notify:** admin approves a submission → participant's bell shows "✅ Result Approved!"
6. **Staffing:** admin opens an event → assigns an instructor via dropdown → removes them
7. **Roster removal:** instructor removes a registered participant → participant gets "Removed from event" notification
8. **Onboarding tags:** invite a test email → badge shows "Invite Sent"; after first login + Force Sync → "✓ Signed In"
9. **Exemption:** toggle exempt on a low-attendance participant → they vanish from Low Engagement Report

## Required environment variables (Base44 → Settings → Environment Variables)

| Variable | Value |
|---|---|
| Monday | Monday.com API key |
| MONDAY_PARTICIPANTS_BOARD_ID | e.g. 2092723258 |
| MONDAY_STATUS_COLUMN_ID | status column id (default 'status') |
| MONDAY_BRANCH_COLUMN_ID | branch column id (default 'branch') |
| WEBHOOK_BEARER_TOKEN | shared secret for onboarding webhook |
