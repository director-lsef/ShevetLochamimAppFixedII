# Tzevet Mikey — Codebase Guide

> **For humans and AI assistants working on this codebase.**
> This document explains what the app is, how it's structured, what every piece does, and where to find things. Read it before touching anything.

---

## What This App Is

**Tzevet Mikey** is a training management platform for two pre-IDF military preparation branches:

- **צוות מייקי** (Tzevet Mikey) — Jerusalem
- **צוות לוחמים** (Tzevet Lochamim) — Herzliya

The app manages the full lifecycle of a participant — from discovery on Monday.com through training, attendance, performance tracking, and graduation. It serves three roles: participants tracking their own progress, instructors running sessions and rating trainees, and admins managing the program end-to-end.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| UI components | shadcn/ui (Tailwind-based, all in `src/components/ui/`) |
| Routing | React Router v6 |
| Data fetching / state | `@base44/sdk` (custom client) + React Query |
| Animations | Framer Motion |
| Drag and drop | `@hello-pangea/dnd` |
| Date utilities | date-fns, moment |
| PDF export | jsPDF + html2canvas |
| Maps | react-leaflet |
| Toast notifications | Sonner |
| Backend runtime | Deno (Base44 serverless functions) |
| Database / BaaS | Base44 (entities + auth + scheduled functions) |
| External integration | Monday.com (via REST API + webhooks) |
| Version control | GitHub → Base44 sync |

---

## Repository Structure

```
/
├── base44/
│   ├── entities/          # Database schema (18 JSON files — one per table)
│   └── functions/         # Backend serverless functions (Deno/TypeScript)
├── src/
│   ├── App.jsx            # Root component: provider tree + routing
│   ├── Layout.jsx         # Re-exports AppShell (used by pages.config.js)
│   ├── pages.config.js    # Page registry — all routes registered here
│   ├── api/
│   │   └── base44Client.js  # Singleton SDK client instance
│   ├── lib/
│   │   ├── AuthContext.jsx  # Global auth state — source of truth for current user
│   │   ├── NavigationTracker.jsx
│   │   └── utils.js        # createPageUrl() and other shared helpers
│   ├── utils/
│   │   └── userHelpers.js  # filterParticipants(), isAdminUser(), isAlumniUser()
│   ├── components/
│   │   ├── admin/          # Admin-only sub-components
│   │   ├── events/         # Event display and management sub-components
│   │   ├── layout/         # App shell, navigation, notification bell
│   │   ├── participants/   # Participant management sub-components
│   │   ├── profile/        # Profile page tabs
│   │   ├── statistics/     # LowEngagementReport
│   │   └── ui/             # shadcn/ui primitives — do not modify directly
│   └── pages/             # One file per route (18 pages)
├── DEPLOYMENT_ORDER.md    # Commit and deploy instructions
└── README.md              # This file
```

---

## How Base44 Works

Base44 is the Backend-as-a-Service that powers the entire data layer. Three concepts matter:

**Entities** are the database tables, defined as JSON schema files in `base44/entities/`. When you add a field to an entity file and sync to Base44, the field becomes available instantly across all queries. The SDK is called directly from frontend components: `base44.entities.User.list()`, `base44.entities.Event.filter({ status: 'active' })`, etc.

**Functions** are Deno-based serverless handlers in `base44/functions/*/entry.ts`. They handle Monday.com webhooks, scheduled jobs, and backend logic that needs service-role access. Functions have no cold-start delay and run on Base44's infrastructure.

**Auth** is handled by `base44.auth.me()` (returns the current user from session token) and `base44.users.inviteUser()` (sends a sign-up email). The `AuthContext.jsx` file calls `auth.me()` once on app startup and stores the result globally. Individual pages should consume the user via `const { user } = useAuth()` rather than calling `auth.me()` again.

---

## Data Model

### User

The central entity. Covers both participants and staff. Key fields:

| Field | What it means |
|---|---|
| `user_type` | `participant`, `instructor`, or `admin` — controls app permissions |
| `role` | Same values — redundant field inherited from auth layer; check both when testing admin access |
| `participant_status` | `active`, `break`, `dropout`, `alumni` — synced bidirectionally with Monday.com |
| `account_status` | `active`, `frozen`, `pending`, `invited`, `archived` — `frozen` blocks event registration |
| `freeze_end_date` | ISO datetime; `autoUnfreezeAccounts` checks this daily and restores accounts |
| `freeze_exempt` | Boolean; if true, skips attendance requirements entirely (never appears in Low Engagement Report) |
| `primary_branch` | `צוות מייקי` or `צוות לוחמים` — default is `צוות מייקי` |
| `monday_item_id` | The Monday.com row ID — required for status sync to work |
| `instructor_notes` | RLS-protected: only admins and instructors can read/write |

### Event

A single training session, lesson, or activity. Key fields:

| Field | What it means |
|---|---|
| `category_id` | Foreign key → EventCategory. Determines whether it counts as workout/educational/ulpan |
| `lead_instructor_id` … `instructor_5_id` | Five separate instructor slots — all 5 count toward an instructor's monthly total |
| `session_plan_id` | Optional link to a SessionPlan |
| `external_signup_url` | External URL shown as a registration option alongside in-app registration |
| `capacity` | Max registrations; `canRegister()` checks this |
| `registration_deadline` | ISO datetime; `canRegister()` checks this |
| `status` | `active`, `cancelled`, `completed` |

### EventCategory

Labels used to classify events. The `category_type` field drives attendance tracking:

| `category_type` | Hebrew label | Attendance threshold (per month) |
|---|---|---|
| `workout` | אימון | 4 of 8 |
| `educational` | שיעור חינוכי | 1 of 2 |
| `ulpan` | אולפן / שיעור עברית | 2 of 6 |
| `other` | — | not tracked |

> **Important:** `category_type` values must be set on existing EventCategory records in the Base44 admin after deploying the updated entity schema. Until they are set, `LowEngagementReport` falls back to Hebrew keyword matching.

### EventRegistration

One record per participant per event sign-up.

| Field | What it means |
|---|---|
| `status` | `registered` → `attended` or `no_show` (set by attendance marking) or `cancelled` (set by removal) |
| `email_reminder` | Participant's preference: `none`, `1_day`, `1_hour`, `both` |
| `is_chanich_toran` | "Duty participant" flag — highlighted in gold in the roster |

> **Dual attendance system:** `AttendanceRecord` stores per-event fine-grained presence data (present/absent/late). `EventRegistration.status` stores the same fact but as a summary (`attended`/`no_show`). Both must be kept in sync — the attendance marking functions (`SwipeAttendance`, `handleMarkAttendance` in EventDetails) write to both. Statistics pages read from `EventRegistration.status`.

### AttendanceRecord

Created when an instructor marks a participant's attendance. Fields: `event_id`, `participant_id`, `status` (present/absent/late), `marked_by`, `marked_at`. **Must exist in the schema before attendance marking works.**

### PerformanceRecord

A timed drill result submitted by a participant or logged by an instructor. Goes through an approval flow: `pending_verification` → `verified` or `rejected`. Admins review via `SubmissionReview` page. **Must exist before WarriorDashboard and Profile Stats tab work.**

### MentalToughnessRating

An instructor's qualitative rating of a participant at a specific session. Five numeric dimensions (1–5): persistence, teamwork, leadership, adaptability, mental focus. Displayed as a radar chart in the Profile Logs tab. **Must exist before Profile Logs tab and WarriorDashboard work.**

### PendingInvitation

Created by `mondayOnboardingWebhook` when a new participant is added to Monday. Stores `profile_data` (the full Monday profile) until the participant signs up. `processNewUserRegistration` merges this into the User record. Fields `processed` and `signed_in_at` are set after merge (so the "Signed In" badge appears before the record is cleaned up).

### SessionPlan / SessionPlanDrill

A `SessionPlan` is a named training plan with an ordered list of `SessionPlanDrill` entries. Plans can be attached to events or assigned to individual participants. `SessionPlanTemplate` and `SessionPlanTemplateDrill` are the reusable bank equivalents (saved once, stamped onto multiple events).

### CustomDrill

Instructor-defined drill that extends the standard drill types. Referenced by `SessionPlanDrill` and `SessionPlanTemplateDrill`. Managed on the `ManageCustomDrills` page.

### Location

Named training venues selectable in the event creation form.

### UserNotification

In-app notifications. One record per user per notification (never broadcast records). Fields: `user_id`, `title`, `message`, `type` (`event_reminder`, `status_update`, `submission_review`, `general`), `read`, `link`. Polled every 30 seconds by `NotificationBell`.

---

## Role System

Three roles control what users see and can do:

| Role | `user_type` value | What they can do |
|---|---|---|
| **Participant** | `participant` | Register for events, submit performance records, view own profile and stats, see My Events |
| **Instructor** | `instructor` | Everything a participant can + claim/unregister from staffing slots, mark attendance, rate participants, view session rosters, remove participants from sessions |
| **Admin** | `admin` | Everything an instructor can + manage participants, invite users, freeze/unfreeze accounts, assign any instructor to any slot, send bulk notifications, review submissions, view statistics, manage categories and locations |

Role is stored on both `User.user_type` and `User.role`. When checking admin access, always check both:
```js
const isAdmin = user?.user_type === 'admin' || user?.role === 'admin';
```

**Navigation is role-gated in `AppShell.jsx`:**
- All roles see: Home, Dashboard (WarriorDashboard), Events
- Participants add: My Events, Profile
- Instructors add: Instructor Portal, Profile, and sidebar access to Drill Bank + Session Plans
- Admins add: Instructor Portal + admin hamburger menu (Participants, User Directory, Submission Review, Statistics, Notifications)

**Frozen accounts** (`account_status === 'frozen'`) have one restriction applied: the Register button is hidden/disabled on all events. They can still log in, see their profile, and view events. Freeze is temporary — `autoUnfreezeAccounts` runs daily and restores accounts whose `freeze_end_date` has passed.

---

## Monday.com Integration

The Monday.com integration handles participant onboarding and bidirectional status sync. There are **four functions** involved and two distinct flows:

### Onboarding Flow (Monday → App)

```
Admin adds participant to Monday.com "Current Participants Database" board
        ↓
mondayOnboardingWebhook fires (triggered by Monday column-change webhook)
        ↓
Fetches full Monday item, extracts profile fields, stores PendingInvitation
        ↓
Admin reviews in Participants → Pending tab → clicks "Send Invite"
        ↓
inviteUserWithType sends Base44 sign-up email; updates PendingInvitation
        ↓
Participant signs up via email link → Base44 creates User record
        ↓
processNewUserRegistration (scheduled) detects new User + matching PendingInvitation
        ↓
Merges Monday profile data into User, sets processed=true + signed_in_at
        ↓
PendingInvitationsPanel shows "✓ Signed In" badge
        ↓
Next scheduled run deletes the PendingInvitation (after 1-hour grace period)
```

> **Legacy warning:** `mondayOnboarding/entry.ts` is an older version of this flow that auto-invites on "Onboarded" status change. It should **not** be registered as an active webhook in Monday — doing so causes duplicate invites. Keep the file but leave the Monday webhook pointing only to `mondayOnboardingWebhook`.

### Status Sync Flow (bidirectional)

```
App changes participant_status
        ↓
syncStatusToMonday fires (triggered by User entity update)
        ↓
Updates Monday status column via GraphQL mutation
        (uses MONDAY_PARTICIPANTS_BOARD_ID env var)

Monday changes status column
        ↓
mondayStatusSync webhook fires
        ↓
Maps Monday label → app status value
        ↓
Updates User.participant_status
```

**Status label mapping (both directions must match):**

| App value | Monday label |
|---|---|
| `active` | `Active Participant` |
| `break` | `Break` |
| `dropout` | `Drop Out` |
| `alumni` | `Alumni` |

> The inbound map also accepts `active` and `dropout` (lowercase, legacy) for safety.

### Required Environment Variables

| Variable | Used by | Value |
|---|---|---|
| `Monday` | All Monday functions | Monday.com API key (from Monday developer settings) |
| `MONDAY_PARTICIPANTS_BOARD_ID` | mondayStatusSync, mondayOnboardingWebhook, syncStatusToMonday | Numeric board ID (e.g. `2092723258`) |
| `MONDAY_STATUS_COLUMN_ID` | syncStatusToMonday | Column ID for the status field (default: `status`) |
| `MONDAY_BRANCH_COLUMN_ID` | syncStatusToMonday | Column ID for the branch field (default: `branch`) |
| `WEBHOOK_BEARER_TOKEN` | mondayOnboardingWebhook | Shared secret — set the same value in Monday's webhook URL as a `?token=` query parameter |

---

## Backend Functions Reference

| Function | Trigger | Direction | What it does |
|---|---|---|---|
| `mondayOnboardingWebhook` | Monday.com webhook (column change) | Monday → App | Primary onboarding handler. Fetches the full Monday item, extracts profile fields (blocks medical data), stores a `PendingInvitation` |
| `mondayStatusSync` | Monday.com webhook (status column change) | Monday → App | Maps Monday status label → app `participant_status`, updates User record with idempotency check |
| `syncStatusToMonday` | Base44 entity automation (User update) | App → Monday | Pushes `participant_status` and `primary_branch` changes to Monday via GraphQL |
| `inviteUserWithType` | Frontend admin action | App internal | Sends Base44 sign-up email via `base44.users.inviteUser()`, upserts PendingInvitation with invite timestamps |
| `processNewUserRegistration` | Scheduled (every ~15 min) + admin "Force Sync" button | App internal | Finds new Users matching PendingInvitations, merges profile_data, sets `processed=true` + `signed_in_at`, then cleans up after 1-hour grace period |
| `autoUnfreezeAccounts` | Scheduled (daily) | App internal | Scans all Users with `account_status === 'frozen'`, restores those whose `freeze_end_date` has passed |
| `sendEventReminders` | Scheduled (hourly) | App internal | Fires in-app and email reminders for events whose trigger window falls in the next 60 minutes; respects each participant's `email_reminder` preference on their EventRegistration |
| `notifyInstructorsSubmission` | Base44 entity automation (PerformanceRecord create) | App internal | Sends a `UserNotification` to configured staff when a new `pending_verification` record is created |
| `getParticipantNames` | Frontend API call | App internal | Returns minimal `{ id, full_name, user_type }` for all users — used for participant pickers without exposing sensitive fields |
| `mondayPing` | Manual / health check | — | Returns `{ status: "ok", ts }` — used to verify function runtime is reachable |
| `mondayOnboarding` | *(legacy — do not activate)* | Monday → App | Older auto-invite flow; superseded by `mondayOnboardingWebhook`. Leave registered in codebase but do not configure as an active webhook in Monday |

---

## Pages Reference

### Participant-facing pages

**`Home`** — The participant's monthly dashboard. Shows attendance stats (workouts, educational lessons, ulpan), upcoming events, and alerts for attendance requirements. Attendance counts come from EventRegistration filtered by the current month. Category matching uses `EventCategory.category_type` (falls back to Hebrew keyword matching until categories are migrated).

**`WarriorDashboard`** — Combined drill tracking and personal stats hub. Shows performance records, personal bests, mental toughness radar chart, leaderboard, and any assigned session plans. Requires `PerformanceRecord`, `MentalToughnessRating`, `CustomDrill`, `SessionPlan`, and `AttendanceRecord` entities to exist.

**`Events`** — Calendar/list view of all events. Participants register here. Frozen accounts see the Register button disabled. Instructors can self-claim staffing slots. Supports filtering by category, branch, and date.

**`EventDetails`** — Full event detail page. Shows staffing tiers, registered participants, attendance marking (instructors only), participant rating (instructors only), session plan viewer, and reminders panel. Staff see a "Staff View" roster with per-row Remove buttons.

**`MyEvents`** — Participant's personal event history: upcoming registrations, past attended events, cancelled events.

**`Profile`** — Four tabs: Profile Details (editable personal info), Stats (attendance counts + performance records chart), History (past events with attendance status), Logs (mental toughness ratings radar chart). All four tabs require their respective entities to exist.

### Instructor-facing pages

**`InstructorPortal`** — Instructor's operational view. Shows upcoming events where they're assigned to a slot, with session rosters, a session plan viewer, and attend/rate controls. Staff can remove participants from sessions here.

**`InstructorCalendar`** — Full month calendar showing all events the instructor is involved in. Used for scheduling awareness.

**`RateParticipants`** — Dedicated rating interface. Select an event → rate each registered participant with a PerformanceRecord (timed result + proof photo) and a MentalToughnessRating.

**`ManageSessionPlans`** — Build and edit session plans. Plans are ordered lists of drills (from the CustomDrill bank) with time slots. Plans can be attached to events or assigned to participants.

**`ManageCustomDrills`** — CRUD interface for the drill bank. Instructors create named drills with categories, metrics, and color coding. These appear in session plan builders.

**`SessionPlanBank`** — Template library. Drag-and-drop templates are saved here and can be loaded into any event's session plan.

**`AssignSessionPlan`** — Assign a session plan to one or more participants. Creates `SessionPlanAssignment` records visible on the participant's WarriorDashboard.

### Admin-only pages

**`Participants`** — Full participant management. Tabs: All, Active, Alumni, Archived, Pending (onboarding). Per-participant actions: view/edit profile, freeze (with duration), archive, restore, mark exempt from attendance requirements. Force Sync button runs `processNewUserRegistration` on demand.

**`UserDirectory`** — Read-only directory of all users (participants and staff). Searchable by name, branch, status. Useful for coordinators.

**`Statistics`** — Analytics dashboard. Participant monthly attendance trends, category breakdowns, instructor performance table (all 5 slots counted; rows below 2 events/month shown with a red "Below min" badge), and the Low Engagement Report.

**`SubmissionReview`** — Queue of `PerformanceRecord` entries with `status: 'pending_verification'`. Admins approve or reject with a reason. Approval/rejection sends a `UserNotification` to the participant.

**`Notifications`** — Two panels. (1) Configure which staff receive in-app alerts for new performance submissions (saved in AppSettings). (2) Compose and broadcast a notification to a user segment: all users, participants only, instructors only, specific users, or event registrants. Notifications create individual `UserNotification` records — no broadcast entity exists.

---

## Key Components Reference

### Layout

**`AppShell`** — Persistent shell. Handles its own `auth.me()` call (intentional — it bootstraps the session), renders the bottom navigation bar (mobile) and sidebar (desktop), and passes `userId` to `NotificationBell`. Role-gated navigation is defined here.

**`NotificationBell`** — Polls `UserNotification.filter({ user_id })` every 30 seconds. Shows unread count badge. Marks all as read on dropdown open. Uses the correct `UserNotification` entity (not the defunct `Notification`).

### Events

**`StaffingTiers`** — Five instructor slots displayed as tier cards (Lead, Supporting, 3× Extra). Instructors can self-claim/unregister their own slot. Admins see a dropdown to assign any available instructor and a Remove button on filled slots. Receives an `instructors` prop (list of User objects) from the parent page.

**`SwipeAttendance`** — Card-swipe or list interface for marking attendance. Writes to both `AttendanceRecord` AND `EventRegistration.status` on every mark — this dual write is what keeps statistics accurate. Supports "Mark All Present" in one tap.

**`SessionRoster`** — Shows registered participants with fitness/Hebrew level pills and 3K time. Staff see a remove button (X icon, triggers `onRemoveParticipant` prop callback). GroupStats component shows aggregate fitness/Hebrew/target-unit breakdown at the top.

**`EventSessionPlan`** — Displays or edits the session plan attached to an event. Shows drill cards with time slots and allows instructors to re-order via drag and drop.

**`RegisterWithReminderDialog`** — Registration dialog that also lets the participant set their `email_reminder` preference (no reminder, 1 day before, 1 hour before, both). Writes both the EventRegistration and the preference in one action.

**`EventRemindersPanel`** — Admin/instructor panel to configure `EventReminder` records (how far in advance, in-app vs email vs both). `sendEventReminders` function processes these hourly.

### Participants

**`PendingInvitationsPanel`** — Shows the onboarding queue. Three tag states per row: amber "Not Yet Invited", blue "Invite Sent", green "✓ Signed In — Syncing Profile". The third state appears after `processNewUserRegistration` sets `processed=true`. Records vanish after the 1-hour grace period cleanup.

**`FreezeAccountDialog`** — Modal for freezing an account with a date picker. Sets `account_status: 'frozen'` and `freeze_end_date`. `autoUnfreezeAccounts` handles the automated unfreeze.

**`UserProfileDetail`** — Compact profile card shown in the Participants detail panel. Shows status badge, exempt badge (purple ⭐), branch, and emergency contact.

### Profile

**`StatsOverviewTab`** — Attendance chart (bar chart by month), personal best table, and performance trend. Reads from `AttendanceRecord` and `PerformanceRecord`. Requires both entities to exist.

**`EventHistoryTab`** — Timeline of past events with attendance status icons. Reads from `AttendanceRecord`.

**`PerformanceLogsTab`** — Radar chart of averaged `MentalToughnessRating` dimensions over time. Requires entity to exist.

**`ProfileDetailsTab`** — Editable form for personal info, contact details, fitness levels, military service goals. Participants can edit their own data.

**`ParticipantDossier`** — Admin/instructor-only view of a participant's full profile including instructor notes (RLS-protected), Monday data, and internal tracking fields.

### Statistics

**`LowEngagementReport`** — Scans current month's registrations per participant and flags anyone below the attendance thresholds (workout < 4, educational < 1, ulpan < 2). Freeze-exempt participants are filtered out entirely. Provides per-participant freeze buttons inline. Category matching uses `EventCategory.category_type` (with keyword fallback).

---

## Attendance Data Flow (Critical to Understand)

This is the most important data flow in the app. Two separate systems must stay synchronized:

```
Instructor marks attendance (SwipeAttendance or EventDetails)
        ↓
Step 1: AttendanceRecord.create/update
        { event_id, participant_id, status: 'present'|'absent'|'late' }
        ↓
Step 2: EventRegistration.update (same participant, same event)
        { status: 'attended'|'no_show' }
        ↓
Statistics pages read EventRegistration.status
Home.jsx reads EventRegistration.status
LowEngagementReport reads EventRegistration.status
MyEvents reads EventRegistration.status
```

If Step 2 is skipped (as it was before the fix), all attendance statistics show zero regardless of how many sessions are marked. Both writes happen in `SwipeAttendance.handleMark`, `SwipeAttendance.handleMarkAllPresent`, and `EventDetails.handleMarkAttendance`.

---

## Authentication Pattern

`AuthContext.jsx` is the single source of truth. It calls `auth.me()` once on app startup and exposes the result via `useAuth()`:

```jsx
// Correct — no extra network call
const { user } = useAuth();

// Incorrect — adds a redundant round-trip before page data loads
const userData = await base44.auth.me();
```

Pages that have been migrated to `useAuth()`: MyEvents, AssignSessionPlan, ManageCustomDrills, ManageSessionPlans, RateParticipants, SessionPlanBank, InstructorCalendar.

Pages still using `auth.me()` (functional but unoptimized — safe to migrate individually): Home, Events, Participants, InstructorPortal, Notifications, SubmissionReview, UserDirectory. These use complex `Promise.all` destructuring or role-guard patterns — migrate one at a time and test each thoroughly.

> When migrating: (1) add `const { user } = useAuth()` at component top, (2) remove `const [user, setUser] = useState(null)`, (3) change `useEffect` dependency from `[]` to `[user]` and guard with `if (!user) return`, (4) replace `const userData = await base44.auth.me()` with `const userData = user`.

---

## Pending Work (Annotated in Code)

These items are noted inline in the relevant files but have not yet been implemented:

**Category_type migration (Fix 3.2/4.2):** `LowEngagementReport` and `Home` both have working `category_type`-based matching code commented in, with fallback to keyword matching. To activate: go to Base44 → Entities → EventCategory → set `category_type` on all existing category records. Then remove the keyword fallback in both files.

**Statistics confirmedAttendance split (Fix 4.1):** `Statistics.jsx` uses a combined `activeRegistrations` memo for both future sign-ups and past attendance. For historical attendance accuracy, this should be split into `confirmedAttendance` (status = 'attended') vs `activeRegistrations` (status = 'registered' or 'attended'). The annotation and replacement code is in the file.

**auth.me() migration (Fix P.1):** Seven pages noted above.

---

## Adding a New Feature: Checklist

1. **New entity?** Add a `.jsonc` file in `base44/entities/`. Define all fields with `type` and `description`. Sync to Base44. Test in the Entities panel before writing any code against it.

2. **New page?** Create `src/pages/YourPage.jsx`, add it to `src/pages.config.js` (import + add to PAGES object). The route `/YourPage` is automatically registered.

3. **Role-gated UI?** Use `const isAdmin = user?.user_type === 'admin' || user?.role === 'admin'` and `const isInstructor = user?.user_type === 'instructor'`. For nav items, add to the appropriate array in `AppShell.jsx`.

4. **Notification to a user?** Always use:
   ```js
   await base44.entities.UserNotification.create({
     user_id: targetUserId,
     title: 'Your title',
     message: 'Your message',
     type: 'general', // or 'event_reminder' | 'status_update' | 'submission_review'
     read: false,
   });
   ```
   Never use `entities.Notification` — that entity does not exist.

5. **New backend function?** Create `base44/functions/yourFunction/entry.ts`. Use `createClientFromRequest(req)` for user-context calls and `base44.asServiceRole.*` for admin-level operations. Scheduled functions run without a user context — always use service role.

---

## Environment Variables (Base44 → Settings → Environment Variables)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `Monday` | Yes | — | Monday.com API key |
| `MONDAY_PARTICIPANTS_BOARD_ID` | Yes | — | Numeric board ID for participant data |
| `MONDAY_STATUS_COLUMN_ID` | No | `status` | Column ID for participant status |
| `MONDAY_BRANCH_COLUMN_ID` | No | `branch` | Column ID for branch assignment |
| `WEBHOOK_BEARER_TOKEN` | Recommended | (open) | Shared secret for onboarding webhook authentication |

---

## GitHub → Base44 Deploy Process

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature

# 2. Make changes, commit
git add -A
git commit -m "Description of change"
git push -u origin feature/your-feature

# 3. Open PR → review → merge to main

# 4. Trigger Base44 sync
# Base44 → Settings → GitHub Integration → Sync from main
```

Changes take effect immediately after sync. Entity schema changes (new fields, new entities) are non-destructive — existing data is preserved.

> **Rollback:** In Base44 → Settings → GitHub Integration → Push to GitHub (saves current live state as a branch), then revert the bad commit on `main` and re-sync.
