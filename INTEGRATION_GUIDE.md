# Tzevet Mikey — Base44 + GitHub Integration & Testing Guide

> **Scope:** Step-by-step instructions to commit the Phase 0.5 build to GitHub, sync it to Base44, and verify every change is working correctly. Includes a test for every meaningful change made in this build.

---

## Before You Start

### What you need

- [ ] Admin access to the GitHub repository
- [ ] Admin access to the Base44 application
- [ ] Admin login to the live Tzevet Mikey app (for post-deploy tests)
- [ ] An instructor test account
- [ ] A participant test account
- [ ] Access to the Monday.com "Current Participants Database" board
- [ ] The `tzevet-mikey-COMMIT-READY.zip` file extracted on your computer
- [ ] Git installed, or access to GitHub in a browser

### What this build changes

This is a summary of what will change when you deploy. Nothing here is destructive — no existing data is deleted, no existing fields are removed.

**Added to the database (10 new entity schemas):**
AttendanceRecord, PerformanceRecord, MentalToughnessRating, CustomDrill, SessionPlan, SessionPlanDrill, SessionPlanAssignment, SessionPlanTemplate, SessionPlanTemplateDrill, Location

**Updated in the database (2 entities with new fields):**
- `User` — new `freeze_exempt` boolean field
- `EventCategory` — new `category_type` enum field

**Updated backend functions:** mondayStatusSync, processNewUserRegistration, syncStatusToMonday, mondayOnboardingWebhook, sendEventReminders

**Updated frontend:** 30 files with bug fixes and new features (see README.md for full list)

### Important note on environment variables

`syncStatusToMonday` reads `MONDAY_BOARD_MIKEY` (not `MONDAY_PARTICIPANTS_BOARD_ID`). This is a documented inconsistency in the code that was not resolved in this build. You must have **both** of the following set in Base44 to the same board ID value:

- `MONDAY_BOARD_MIKEY` — used by `syncStatusToMonday` (app → Monday)
- `MONDAY_PARTICIPANTS_BOARD_ID` — used by `mondayStatusSync` (Monday → app)

Additionally, `mondayOnboardingWebhook` has the board ID hardcoded as `"2092723258"`. If this is your correct board ID, the function will work. If your board ID is different, you will need to edit that file manually and replace the hardcoded value with `Deno.env.get('MONDAY_PARTICIPANTS_BOARD_ID')`.

---

## Part 1 — GitHub Setup

### Step 1.1 — Clone and create a branch

In your terminal:

```bash
git clone https://github.com/YOUR_ORG/tzevet-mikey.git
cd tzevet-mikey
git checkout -b phase-05-implemented
```

If you're using the GitHub web editor instead of the command line, go to your repository → click the branch dropdown → type `phase-05-implemented` → click "Create branch".

### Step 1.2 — Copy the new files into the repository

Extract `tzevet-mikey-COMMIT-READY.zip`. Inside you will find `src/`, `base44/`, `README.md`, `DEPLOYMENT_ORDER.md`, and config files at the root.

Copy **everything** from the extracted folder into your local repository folder, overwriting existing files. The `.git` folder in your repository will not be affected.

If you're using the GitHub web editor, you will need to paste each file's content manually (the order in Part 2 below tells you which files to do first).

### Step 1.3 — Confirm what changed

Run this to see all changed files:

```bash
git status
```

You should see approximately 50–60 changed or new files. The new entity files in `base44/entities/` will show as "new file". All other changes will show as "modified".

If `git status` shows no changes, the copy didn't work — check that you copied from the correct folder (the extracted zip contents, not the zip itself).

### Step 1.4 — Commit and push

```bash
git add -A
git commit -m "Phase 0.5: entity schemas, attendance sync, notifications fix, admin staffing controls, freeze exemption, profile tabs repair"
git push -u origin phase-05-implemented
```

### Step 1.5 — Open a Pull Request

1. Go to your GitHub repository in a browser
2. Click **Compare & pull request** (banner appears after pushing)
3. Set: base `main` ← compare `phase-05-implemented`
4. Title: `Phase 0.5 — Entity schemas, bug fixes, new features`
5. Click **Create pull request**

Do not merge yet. Proceed to Part 2 first.

---

## Part 2 — Environment Variables (set before merging)

Set these in Base44 before deploying. If they are already set with the correct values, skip those rows.

**Base44 → Settings → Environment Variables**

| Variable | Value | Notes |
|---|---|---|
| `Monday` | Your Monday.com API key | Found in Monday: Avatar → Admin → API |
| `MONDAY_PARTICIPANTS_BOARD_ID` | Your board's numeric ID | Open the board in Monday → the number in the URL after `/boards/` |
| `MONDAY_BOARD_MIKEY` | **Same value** as above | Required by `syncStatusToMonday` — must match `MONDAY_PARTICIPANTS_BOARD_ID` |
| `MONDAY_STATUS_COLUMN_ID` | The column ID for participant status | Default value is `status`. Leave blank unless your board uses a different ID |
| `MONDAY_BRANCH_COLUMN_ID` | The column ID for branch | Default value is `branch`. Leave blank unless your board uses a different ID |
| `WEBHOOK_BEARER_TOKEN` | A shared secret string of your choice | Set the same string as a `?token=` query parameter on the webhook URL in Monday |

**How to find a Monday column ID:** Open the board → click the three dots on a column header → click "Column settings" → the ID is shown there.

**Verifying existing variables:** If you already have `MONDAY_BOARD_MIKEY` set, check whether you also have `MONDAY_PARTICIPANTS_BOARD_ID` set to the same value. If not, add it now.

---

## Part 3 — Merge and Deploy

### Step 3.1 — Merge the Pull Request

Go back to GitHub. On the Pull Request page:

1. Click **Squash and merge** (not regular merge — squash keeps history clean)
2. Confirm the merge
3. Click **Delete branch** on the confirmation screen

### Step 3.2 — Sync Base44 from GitHub

1. Log in to Base44
2. Go to **Settings** → **GitHub Integration**
3. Click **Sync from GitHub** (or "Pull from GitHub")
4. Select branch: `main`
5. Click confirm

Base44 will pull all files from `main` and deploy them. This usually takes 30–60 seconds.

**Watch the deployment log.** It should end with a success state and no errors. Common failure causes:
- A `.jsonc` file has a JSON syntax error (check the file name in the error)
- A JSX file has a syntax error (rare — all files were pre-validated with esbuild)
- A file path doesn't match Base44's expected structure

If the sync fails, see the Rollback section at the end of this guide.

### Step 3.3 — Verify entities registered in Base44

After sync:
1. Go to Base44 → **Entities**
2. Confirm these 10 new entities appear in the list:
   - `AttendanceRecord`
   - `PerformanceRecord`
   - `MentalToughnessRating`
   - `CustomDrill`
   - `SessionPlan`
   - `SessionPlanDrill`
   - `SessionPlanAssignment`
   - `SessionPlanTemplate`
   - `SessionPlanTemplateDrill`
   - `Location`
3. Click `User` → confirm `freeze_exempt` (boolean) appears in the fields list
4. Click `EventCategory` → confirm `category_type` (enum: workout/educational/ulpan/other) appears

If any entity is missing, the file didn't sync correctly. Check that the `.jsonc` file is present in `base44/entities/` on the `main` branch in GitHub, then re-run the sync.

---

## Part 4 — Post-Deploy Tests

Run these tests in the order listed. Each test is independent but they build on each other — complete Stage 1 before Stage 2, etc.

---

### Stage 1 — Profile Page (tests the 3 new entities)

These tests verify that `AttendanceRecord`, `PerformanceRecord`, and `MentalToughnessRating` are registered and the profile tabs can now load.

**Test 1A — All profile tabs load**

1. Log in as a **participant**
2. Navigate to **Profile** (bottom nav or sidebar)
3. Click each of the four tabs in sequence: **Profile**, **Stats**, **History**, **Logs**

✅ **Pass:** All four tabs display without errors. Stats and History will show zeros or empty states if no data exists yet — that is correct.

❌ **Fail:** Any tab shows an infinite loading spinner that never resolves. This means the entity for that tab is not registered. Check which tab fails:
- Stats tab → `PerformanceRecord` or `AttendanceRecord` not registered
- History tab → `AttendanceRecord` not registered
- Logs tab → `MentalToughnessRating` not registered

Go back to Base44 → Entities, find the missing entity, and verify the file exists on `main` in GitHub. Re-sync if needed.

**Test 1B — WarriorDashboard loads**

1. Still logged in as a **participant**
2. Navigate to **Dashboard** (bottom nav)

✅ **Pass:** Page loads. Personal records section and mental toughness radar chart render (may be empty if no data).

❌ **Fail:** Spinner that never resolves → same entity issue as 1A.

---

### Stage 2 — Attendance → Statistics Pipeline (tests the dual-write fix)

This is the most important pipeline test. Before this fix, attendance marking was invisible to all statistics. This test confirms the fix is working.

**Test 2A — Mark attendance and verify it appears in Statistics**

You will need: an event with at least one registered participant, logged in as an instructor or admin.

1. Log in as an **instructor**
2. Navigate to **Instructor Portal**
3. Find a current or recent event you are assigned to
4. Open the event → find the **Session Roster** → click the attendance marking interface
5. Mark one participant as **Present**
6. Navigate to **Statistics** (admin menu, or log in as admin if needed)
7. Ensure the date range includes today
8. Find the participant in the participant breakdown table

✅ **Pass:** The participant's attendance count has increased by 1.

❌ **Fail:** Count is still 0. Check that `EventRegistration` was updated:
- Go to Base44 → Entities → EventRegistration → find the registration record for that participant and event
- The `status` field should now say `attended`
- If it still says `registered`, the dual-write in `SwipeAttendance.jsx` didn't trigger — confirm the updated file synced by checking the file content on GitHub

**Test 2B — Check Home page attendance counter**

1. Log in as the **participant** who was marked present
2. Navigate to **Home**
3. Look at the monthly attendance stats section

✅ **Pass:** The workout/session count has increased by 1.

❌ **Fail:** Still 0. Same root cause as 2A — `EventRegistration.status` not updating. Check both `SwipeAttendance.jsx` and `EventDetails.jsx` are the updated versions on GitHub.

---

### Stage 3 — Notifications (tests the UserNotification entity fix)

Before this fix, `Notifications.jsx` and `SubmissionReviewCard.jsx` called a non-existent `Notification` entity and silently failed.

**Test 3A — Admin sends a notification**

1. Log in as **admin**
2. Navigate to **Notifications** (admin hamburger menu)
3. Fill in a title: `Test Notification`
4. Fill in a message: `This is a test.`
5. Set recipients to **Specific Users**
6. Select one participant from the list
7. Click **Send Notification**

✅ **Pass:** A green success toast appears: "Notification sent to 1 recipients"

❌ **Fail:** An error toast, or nothing happens. Check `Notifications.jsx` on GitHub — confirm `entities.UserNotification.create` appears in the `handleSendNotification` function (not `entities.Notification.create`).

**Test 3B — Participant receives the notification**

1. Log in as the **participant** you sent to in Test 3A
2. Look at the notification bell icon in the header

✅ **Pass:** A red badge appears on the bell showing "1". Clicking the bell shows "Test Notification" in the dropdown.

❌ **Fail:** Bell shows 0. Re-check Test 3A passed first. If 3A showed success but the participant has no notification, check that `NotificationBell.jsx` is the updated version.

**Test 3C — Submission review notification**

You will need an existing `pending_verification` PerformanceRecord, or create one from the WarriorDashboard as a participant.

1. Log in as **admin**
2. Navigate to **Submission Review** (admin hamburger menu)
3. Find a pending record → click **Approve**

✅ **Pass:** A "✅ Result Approved!" notification appears in the participant's notification bell on next load.

❌ **Fail:** No notification delivered. Check `SubmissionReviewCard.jsx` on GitHub — the `handleApprove` function should call `entities.UserNotification.create` (not `entities.Notification.create`).

---

### Stage 4 — Frozen Account Restriction (tests the canRegister fix)

Before this fix, frozen participants could still register for events.

**Test 4A — Freeze a participant**

1. Log in as **admin**
2. Navigate to **Participants**
3. Click on any active participant
4. Click **Freeze Account**
5. Set duration to 7 days
6. Confirm the freeze

✅ **Pass:** The participant's account status badge changes to "Frozen" in the detail panel.

**Test 4B — Frozen participant cannot register**

1. Log in as the **participant** you just froze
2. Navigate to **Events**
3. Find any upcoming event

✅ **Pass:** The Register button is absent or visibly disabled. No registration can be submitted.

❌ **Fail:** Register button still appears and works. Check `Events.jsx` on GitHub — the `canRegister()` function should contain `if (user?.account_status === 'frozen') return false;`

**Test 4C — Frozen participant cannot register via Event Detail page**

1. Still logged in as the frozen **participant**
2. Tap any event to open its detail page
3. Scroll to the registration section

✅ **Pass:** Register button is absent or disabled.

❌ **Fail:** Same check as 4B but in `EventDetails.jsx`.

**Test 4D — Unfreeze restores registration ability**

1. Log in as **admin**
2. Find the same participant → click **Unfreeze** (or wait for the daily scheduled job if testing `autoUnfreezeAccounts`)
3. Log back in as the participant → find an event

✅ **Pass:** Register button returns.

---

### Stage 5 — Admin Staffing Controls (tests StaffingTiers admin assign/remove)

Before this fix, only instructors could claim slots for themselves. Admins had no way to assign a specific instructor to a slot.

**Test 5A — Admin assigns an instructor to an event slot**

1. Log in as **admin**
2. Open any event (via Events page → tap an event)
3. Find the **Staffing** section on the event detail page
4. On the Lead Instructor slot (currently showing "OPEN"), look for a dropdown

✅ **Pass:** A dropdown labeled "Assign" appears. Opening it shows a list of available instructors. Selecting one fills the slot with their name.

❌ **Fail:** No dropdown visible, only a "Claim" button. This means `StaffingTiers.jsx` is not the updated version — check GitHub.

**Test 5B — Admin removes an instructor from a slot**

1. Still on the same event as 5A, with a filled slot
2. Look for a **Remove** button next to the assigned instructor's name

✅ **Pass:** Remove button is visible. Clicking it clears the slot to "OPEN".

❌ **Fail:** No Remove button. Same file check as 5A.

**Test 5C — Instructor can still self-claim a slot**

1. Log in as an **instructor**
2. Open the same event
3. Find an open slot

✅ **Pass:** "Claim" button is visible. Instructors should not see the admin dropdown — only their own Claim button.

---

### Stage 6 — Remove Participant from Session (new feature)

Admins and instructors can now remove a registered participant from a session. The registration is set to `cancelled` (not deleted) and the participant is notified.

**Test 6A — Admin removes participant via Event Details**

1. Log in as **admin**
2. Open an event that has at least one registered participant
3. Scroll to the participant roster section
4. Look for a **Staff View** card showing all registered participants with **Remove** buttons

✅ **Pass:** The Staff View card is visible. Each participant row has a "Remove" button. Clicking Remove on one participant removes them from the list and the button shows "..." while processing.

❌ **Fail:** No Staff View card visible. Check `EventDetails.jsx` on GitHub — look for `Staff View` in the JSX. Also confirm `handleAdminRemoveParticipant` function exists in the file.

**Test 6B — Removed participant's registration shows as cancelled**

1. After removing a participant in 6A
2. Go to Base44 → Entities → EventRegistration
3. Find the registration record for that participant and event

✅ **Pass:** `status` field = `cancelled`, `cancellation_date` is set.

**Test 6C — Removed participant receives notification**

1. Log in as the participant who was removed
2. Check their notification bell

✅ **Pass:** A "Removed from event" notification appears in the bell.

**Test 6D — Instructor can remove via InstructorPortal**

1. Log in as an **instructor** assigned to an event
2. Navigate to **Instructor Portal**
3. Find the event → expand the Session Roster
4. Look for a remove (×) button on each participant row

✅ **Pass:** Each participant row has an × button in the fitness/stats area. Tapping it removes the participant and shows a success toast.

---

### Stage 7 — Three-State Onboarding Tags (tests PendingInvitationsPanel)

**Test 7A — "Not Yet Invited" tag**

1. Log in as **admin**
2. Navigate to **Participants** → **Pending** tab
3. Find a participant who appears on Monday but has not been invited yet

✅ **Pass:** An amber "Not Yet Invited" badge appears on their row.

**Test 7B — "Invite Sent" tag**

1. Still on the Pending tab
2. Click **Send Invite** for a participant who hasn't been invited
3. Watch their badge update

✅ **Pass:** Badge changes to blue "Invite Sent" after the invite is sent.

**Test 7C — "Signed In" tag**

This tag requires a participant to receive their invite email, click the link, and complete sign-up. After they sign up:

1. Stay logged in as **admin** on the Pending tab
2. Wait up to 15 minutes (or click **Force Sync** button) for `processNewUserRegistration` to run

✅ **Pass:** The participant's row shows a green "✓ Signed In — Syncing Profile" badge. Within the next hour the record will disappear from the Pending tab entirely as the cleanup pass runs.

❌ **Fail:** Badge stays on "Invite Sent" even after sign-up. Check that `processNewUserRegistration/entry.ts` on GitHub contains `processed: true` and `signed_in_at: new Date().toISOString()` in the merge block.

---

### Stage 8 — Freeze Exemption (tests freeze_exempt field and UI)

**Test 8A — Mark a participant as exempt**

1. Log in as **admin**
2. Navigate to **Participants** → click a participant
3. In the detail panel, scroll to the account management section
4. Look for a purple toggle labeled **"Exempt from attendance requirements"**

✅ **Pass:** The toggle is visible. Toggling it on shows a success toast: "Participant marked as exempt from attendance requirements".

❌ **Fail:** Toggle not visible. Check that `Participants.jsx` includes the `Switch` import and the freeze_exempt toggle block. Also confirm `User` entity has `freeze_exempt` field (Stage 0 test).

**Test 8B — Exempt participant does not appear in Low Engagement Report**

1. Toggle a low-attendance participant's `freeze_exempt` to ON
2. Navigate to **Statistics** → find the **Low Engagement** tab or report
3. Look for that participant in the flagged list

✅ **Pass:** The participant does not appear in the report, even if they have 0 sessions this month.

**Test 8C — Exempt badge appears on participant profile**

1. Still in Participants, click the participant you exempted
2. Look at their status badges near their name

✅ **Pass:** A purple "⭐ Exempt" badge appears alongside their other status badges.

---

### Stage 9 — Instructor Statistics (tests all-5-slots counting)

Before this fix, an instructor assigned to slot 2, 3, 4, or 5 was counted as having 0 events.

**Test 9A — Instructor in a non-lead slot gets event credit**

You will need an instructor who is assigned to the `assistant_instructor_id`, `support_instructor_id`, `instructor_4_id`, or `instructor_5_id` slot of at least one event (but NOT the `lead_instructor_id` slot).

1. Log in as **admin**
2. Navigate to **Statistics** → Instructor Performance table
3. Find the instructor who is only in non-lead slots

✅ **Pass:** Their `eventsLed` count reflects the events they are assigned to (not 0).

❌ **Fail:** Count is 0. Check `Statistics.jsx` on GitHub — the `instructorMetrics` useMemo should contain `const ALL_SLOTS = ['lead_instructor_id', 'assistant_instructor_id', ...]` and a loop over those slots.

**Test 9B — Below-minimum instructors are highlighted**

1. Find an instructor in the Statistics table who has led fewer than 2 events in the selected month

✅ **Pass:** Their row has a red/pink background, and a red "Below min" badge appears next to their name.

---

### Stage 10 — Ulpan Threshold (tests LowEngagementReport fix)

Before this fix, participants who attended exactly 2 ulpan sessions were incorrectly flagged as below the requirement. The minimum is 2, so attending 2 should be sufficient.

**Test 10A — Participant with exactly 2 ulpan sessions is not flagged**

1. Find (or create) a participant who has attended exactly **2 ulpan/Hebrew sessions** this month and meets the other attendance requirements
2. Log in as **admin** → Statistics → Low Engagement report

✅ **Pass:** The participant does NOT appear in the flagged list.

❌ **Fail:** They are flagged. Check `LowEngagementReport.jsx` on GitHub — the ulpan flag condition should read `ulpanCount < ULPAN_MIN` (not `ulpanCount <= 2`), and `ULPAN_MIN` should be `2`.

---

### Stage 11 — Monday.com Status Sync (tests 'Drop Out' label fix)

Before this fix, changing a participant's status to "Drop Out" in Monday never synced to the app because the label string wasn't recognised.

**Test 11A — "Drop Out" status syncs from Monday to app**

1. Open Monday.com → Current Participants Database board
2. Find a test participant (ideally one you can safely change and change back)
3. Change their status column to **"Drop Out"**
4. Wait 10–30 seconds for the webhook to fire
5. Go to Base44 → Entities → User → find that participant

✅ **Pass:** `participant_status` = `dropout`

❌ **Fail:** `participant_status` unchanged. Check:
- The webhook is still registered in Monday (Monday → Board settings → Webhooks/Automations)
- `WEBHOOK_BEARER_TOKEN` is set in Base44 env vars and matches the Monday webhook URL
- `mondayStatusSync/entry.ts` on GitHub contains `'drop out': 'dropout'` in the `MONDAY_TO_APP_STATUS` map

**Test 11B — Change back to "Active Participant" syncs correctly**

1. Change the same participant's status back to **"Active Participant"** in Monday
2. Wait 10–30 seconds

✅ **Pass:** `participant_status` = `active`

**Test 11C — App status change syncs to Monday**

1. In the app (as admin), go to Participants → find the same participant
2. Change their `participant_status` to `break` and save
3. Check the Monday board

✅ **Pass:** The Monday status column changes to "Break"

---

### Stage 12 — UserDirectory Routing (tests pages.config.js fix)

Before this fix, UserDirectory was only registered via a hardcoded route in App.jsx, which would be lost if pages.config.js was ever regenerated.

**Test 12A — UserDirectory navigates correctly**

1. Log in as **admin**
2. Open the admin menu (hamburger icon)
3. Click **User Directory**

✅ **Pass:** The User Directory page loads showing all users.

**Test 12B — Direct URL navigation works**

1. Type `/UserDirectory` directly in the browser address bar

✅ **Pass:** Page loads. The route is registered via `pages.config.js` and handled by the normal routing loop in `App.jsx`.

---

### Stage 13 — Registration Feedback (tests missing toast fix)

Before this fix, clicking Register on an event gave no feedback whatsoever — silent success or silent failure.

**Test 13A — Successful registration shows a toast**

1. Log in as a **participant** with no freeze
2. Navigate to **Events**
3. Click **Register** on any upcoming event

✅ **Pass:** A green success toast appears: "Registered!"

**Test 13B — Failed registration shows an error toast**

1. Still logged in as a **participant**
2. Find an event that has reached its capacity, or one whose registration deadline has passed
3. If `canRegister()` prevents the button appearing, try submitting a registration programmatically via browser console:
   ```js
   // This is optional — if the button is correctly hidden, the guard is working
   ```

✅ **Pass:** If registration is attempted and fails, an error toast appears rather than silent failure.

---

### Stage 14 — useAuth() Migration (tests 7 page load fixes)

Seven pages were migrated from calling `auth.me()` independently to consuming the user from `AuthContext`. This should not change any visible behaviour, but confirms no regression.

For each of the following pages, log in as each role and navigate there:

| Page | Path | Test as |
|---|---|---|
| My Events | /MyEvents | Participant |
| Assign Session Plan | /AssignSessionPlan | Admin |
| Manage Custom Drills | /ManageCustomDrills | Instructor or Admin |
| Manage Session Plans | /ManageSessionPlans | Instructor or Admin |
| Rate Participants | /RateParticipants | Instructor or Admin |
| Session Plan Bank | /SessionPlanBank | Instructor or Admin |
| Instructor Calendar | /InstructorCalendar | Instructor or Admin |

✅ **Pass for each:** Page loads correctly, user-specific data appears (events, plans, etc. relevant to the logged-in user).

❌ **Fail:** Blank page or infinite loading spinner. This would indicate the `user` from `useAuth()` was null when `loadData()` ran. Check that the `useEffect` in that page file has `[user]` as its dependency and guards with `if (!user) return`.

---

## Part 5 — One-Time Post-Deploy Configuration

### Set category_type on existing EventCategories

The `EventCategory` entity now has a `category_type` field, but existing category records in your database have this field empty. Until you set it, `LowEngagementReport` and `Home` fall back to Hebrew keyword matching.

1. Go to Base44 → Entities → EventCategory
2. For each category record, set `category_type` to the appropriate value:
   - Training / physical sessions → `workout`
   - Educational lessons / workshops → `educational`
   - Hebrew lessons / Ulpan → `ulpan`
   - Everything else → `other`

Once all categories have their `category_type` set, the keyword fallback code in `LowEngagementReport.jsx` and `Home.jsx` can be removed in a future cleanup.

### Verify scheduled function triggers

Base44 should have two scheduled functions configured. Confirm both are active:

1. Go to Base44 → Functions
2. Find `processNewUserRegistration` — should be scheduled every 15 minutes
3. Find `autoUnfreezeAccounts` — should be scheduled daily
4. Find `sendEventReminders` — should be scheduled hourly

If any are not scheduled, configure them now. Without `processNewUserRegistration` running, the "Force Sync" button in the Participants panel is the only way to merge Monday profiles.

### Verify Monday webhook URLs

The Monday.com webhooks must point to the correct Base44 function URLs. In Monday:

1. Go to the Participants board → Board settings → Automations or Webhooks
2. Confirm there is one webhook for **status column changes** pointing to `mondayStatusSync`
3. Confirm there is one webhook for **item creation** (or status changes) pointing to `mondayOnboardingWebhook`
4. Both URLs should include `?token=YOUR_WEBHOOK_BEARER_TOKEN` if you set that env var
5. Confirm `mondayOnboarding` (the legacy function) is **not** registered as a webhook — it should have no active webhook pointing to it

---

## Rollback Procedure

If anything goes wrong after merge:

**Step 1 — Save the broken state**
In Base44 → Settings → GitHub Integration → **Push to GitHub**. This saves the current (broken) live state as a branch so nothing is lost.

**Step 2 — Revert on GitHub**
```bash
git checkout main
git log --oneline -5   # find the last good commit hash
git revert HEAD --no-edit   # reverts the last commit
git push origin main
```

Or on GitHub web: go to the commit → click **Revert** → merge the revert PR.

**Step 3 — Re-sync Base44**
Base44 → Settings → GitHub Integration → Sync from main.

The app returns to its pre-deploy state. All entity schemas are non-destructive (adding fields does not delete data), so a rollback is safe even if some records were created using the new schema.

---

## Quick Reference: What to Check When Something Breaks

| Symptom | Likely cause | Where to look |
|---|---|---|
| Profile tabs show infinite spinner | Missing entity schema | Base44 → Entities → check for AttendanceRecord, PerformanceRecord, MentalToughnessRating |
| Attendance marking doesn't affect Statistics | SwipeAttendance not updated | GitHub → `src/components/events/SwipeAttendance.jsx` — check for `EventRegistration.update` |
| Sending a notification throws an error | Old Notification entity reference | GitHub → `src/pages/Notifications.jsx` — check for `UserNotification.create` not `Notification.create` |
| Register button still works for frozen users | EventDetails/Events not updated | GitHub → check `canRegister()` function in both files for frozen check |
| Admin dropdown not visible in Staffing section | StaffingTiers not updated | GitHub → `src/components/events/StaffingTiers.jsx` — check for `Select` component and `handleAdminAssign` |
| Monday 'Drop Out' doesn't sync | mondayStatusSync not updated or wrong webhook | GitHub → check for `'drop out': 'dropout'` in `mondayStatusSync/entry.ts` |
| processNewUserRegistration shows no processed=true | Function file not updated | GitHub → check for `processed: true` in `processNewUserRegistration/entry.ts` |
| Statistics instructor count is 0 for non-lead instructors | Statistics not updated | GitHub → check for `ALL_SLOTS` array in `Statistics.jsx` |
| Page loads blank after useAuth migration | null user guard missing | Check `useEffect` has `[user]` dependency and `if (!user) return` guard in `loadData` |
| Sync fails with a JSON error | Malformed entity file | Open the failing `.jsonc` file in GitHub → validate at jsonlint.com |
