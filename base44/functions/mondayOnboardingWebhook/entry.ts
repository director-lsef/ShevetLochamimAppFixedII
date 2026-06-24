/**
 * ============================================================
 * FUNCTION: mondayOnboardingWebhook
 * ============================================================
 * PURPOSE:
 *   Primary onboarding entry point. Receives a Monday.com webhook
 *   when a new participant is added to the "Current Participants
 *   Database" board, extracts their profile data, and stores it
 *   in a PendingInvitation record for later use when the admin
 *   sends the actual invite.
 *
 *   This function does NOT create a User or send an invite email.
 *   That happens in inviteUserWithType/entry.ts (admin-triggered).
 *   processNewUserRegistration/entry.ts merges the profile into
 *   the User record once the participant actually signs up.
 *
 * DIRECTION:  Monday.com  →  App (inbound)
 *
 * TRIGGER:
 *   Monday.com webhook automation — fires when a new item (row)
 *   is created OR a status column changes on the participants board.
 *
 * LEGACY COUNTERPART:
 *   mondayOnboarding/entry.ts is an older version of this function
 *   that auto-invited users immediately. This webhook version defers
 *   the invite to admin action, which is the current workflow.
 *
 * AUTHENTICATION:
 *   Supports both Bearer token (Authorization header) and query
 *   parameter (?token=xxx). Set WEBHOOK_BEARER_TOKEN env var to
 *   enable. If unset, the endpoint is open (useful for development).
 *
 * ENV VARS REQUIRED:
 *   - Monday                       : Monday.com API key
 *   - MONDAY_PARTICIPANTS_BOARD_ID : ⚠️ BUG [Step 1.2] — hardcoded
 *                                    as "2092723258" string literal here;
 *                                    should use env var.
 *   - WEBHOOK_BEARER_TOKEN         : Optional shared secret for auth
 *
 * BLOCKED FIELDS (privacy — never stored):
 *   Israeli ID/Passport, Country of Origin, Medical Issues,
 *   Medical Condition Description
 *
 * KNOWN BUGS (do not fix until Phase 1 of the fix plan):
 *   [Step 1.2] MONDAY_BOARD_ID is hardcoded as "2092723258" instead
 *     of reading from MONDAY_PARTICIPANTS_BOARD_ID env var.
 *   [Step 1.3] Step 9 (coordinator notification) calls
 *     entities.Notification.create() — that entity doesn't exist.
 *     The schema entity is UserNotification. The call fails and is
 *     silently caught, so coordinators never receive alerts.
 *     Also, the payload shape is wrong (uses broadcast-style fields
 *     instead of the required user_id field).
 * ============================================================
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── Monday.com Board ID ───────────────────────────────────────────────────────
// ⚠️ BUG [Step 1.2]: This should be Deno.env.get('MONDAY_PARTICIPANTS_BOARD_ID').
//   Hardcoding the board ID makes environment-specific deployments impossible
//   and requires a code change (not a config change) if the board ID ever changes.
const MONDAY_BOARD_ID = "2092723258";

// ─── Column ID Map ─────────────────────────────────────────────────────────────
// These are the Monday column IDs for the "Current Participants Database" board.
// They are stable once the board is created — Monday does not auto-change them.
// BLOCKED columns are listed as comments; they must NEVER be mapped or stored.
const COL = {
  FIRST_NAME:          "short_text9l5wnb1w",
  LAST_NAME:           "short_textnbd5j9xq",
  // full name comes from item name (item_name)
  EMAIL:               "emailqz5ikwrq",
  PHONE:               "phone1dj79snn",
  SECONDARY_PHONE:     "phone1thmjlfv",
  EMERGENCY_NAME:      "short_textov7u0iij",
  EMERGENCY_PHONE:     "phonenaz1tsmk",
  EMERGENCY_REL:       "short_textwqarvqfm",
  DATE_OF_BIRTH:       "datezfoer7cw",      // used for age calc only — DOB is not stored
  SEX:                 "single_selectxarzz70",
  CITY:                "locationk6alyt3l",
  DRAFT_DATE:          "date21gtyho3",
  DATE_ADDED:          "date_mktxxrb2",
  DATE_SIGNUP:         "datext7hw8cf",
  INTERVIEW_NOTES:     "text_mktzpkd3",
  ABOUT_PARTICIPANT:   "long_textzgi7j0ug",
  FITNESS_LEVEL:       "single_selectf77gny6",
  HEBREW_LEVEL:        "single_select5dchkln",
  THREE_K_TIME:        "single_selectpvhfjpv",
  HOW_DRAFTING:        "single_selects36m02w",
  TARGET_UNIT:         "short_texta9r04hb3",
  SERVICE_LENGTH:      "single_selectmjjx7w9",
  ISRAEL_FRAMEWORK:    "single_selecty1g89lt",
  STAY_FRAMEWORK:      "single_selectmguanad",
  BRANCH:              "color_mm252k2n",
  REFERENCE_ORG:       "single_selectzq69fdd",
  READY_FOR_SERVICE:   "single_select1l5gred",
  // ── BLOCKED — explicitly never read or stored ──────────────────────────────
  // ISRAELI_ID:       "short_textpi5w0osl",
  // COUNTRY_ORIGIN:   "countrykxelho0y",
  // MEDICAL_ISSUES:   "multi_selectu0y18hj5",
  // MEDICAL_DESC:     "long_textgc7eaujx",
};

// ─── Branch label → app enum ───────────────────────────────────────────────────
// Handles both English and Hebrew variants from Monday.
const BRANCH_MAP: Record<string, string> = {
  "tzevet mikey":    "צוות מייקי",
  "tzevet lochamim": "צוות לוחמים",
  "צוות מייקי":      "צוות מייקי",
  "צוות לוחמים":     "צוות לוחמים",
};

// ─── Helper: extract a column's text value from Monday column_values array ────
// Monday returns column_values as an array of { id, text, value } objects.
// The 'text' field is the human-readable version; 'value' is the raw JSON.
// We prefer 'text' and fall back to parsing 'value' for complex column types.
function col(columnValues: any[], id: string): string | null {
  if (!Array.isArray(columnValues)) return null;
  const c = columnValues.find((v) => v.id === id);
  if (!c) return null;
  if (c.text !== undefined && c.text !== null && String(c.text).trim() !== "") {
    return String(c.text).trim();
  }
  if (c.value) {
    try {
      const parsed = JSON.parse(c.value);
      const val = parsed.text || parsed.name || parsed.label || parsed.phone || null;
      return val ? String(val).trim() : null;
    } catch {
      return String(c.value).trim() || null;
    }
  }
  return null;
}

// ─── Helper: normalize Monday fitness level text → app enum ──────────────────
// Monday fitness column is a free-text dropdown — values may vary in wording.
function normalizeFitness(val: string | null): string | null {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v.includes("low") || v.includes("poor") || v.includes("weak")) return "low";
  if (v.includes("mod") || v.includes("average") || v.includes("okay")) return "moderate";
  if (v.includes("high") || v.includes("good") || v.includes("great")) return "high";
  if (v.includes("elite") || v.includes("excellent") || v.includes("athlete")) return "elite";
  return "moderate"; // default when value is present but unrecognized
}

// ─── Helper: normalize Monday Hebrew level text → app enum ───────────────────
function normalizeHebrew(val: string | null): string | null {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v.includes("none") || v.includes("no ")) return "none";
  if (v.includes("begin") || v.includes("basic") || v.includes("little") || v.includes("aleph")) return "beginner";
  if (v.includes("inter") || v.includes("some") || v.includes("bet")) return "intermediate";
  if (v.includes("advanc") || v.includes("gimel")) return "advanced";
  if (v.includes("fluent") || v.includes("native")) return "fluent";
  return "beginner"; // default when value is present but unrecognized
}

// ─── Main request handler ─────────────────────────────────────────────────────
Deno.serve(async (req) => {

  // Health check — Monday occasionally pings with GET
  if (req.method === "GET") {
    return Response.json({ status: "ok" }, { status: 200 });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  let bodyText = "";
  try {
    bodyText = await req.text();
    const body = JSON.parse(bodyText);

    // ── 1. Monday.com JSON Challenge ──────────────────────────────────────────
    // Must be responded to within 5 seconds. No auth required on this path.
    if (body.challenge) {
      return new Response(JSON.stringify({ challenge: body.challenge }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // ── 2. Bearer Token Authentication ────────────────────────────────────────
    // Supports: ?token=xxx query param OR Authorization: Bearer xxx header.
    // If WEBHOOK_BEARER_TOKEN is unset, the endpoint is open (dev mode).
    const expectedToken = Deno.env.get("WEBHOOK_BEARER_TOKEN");
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");
    const authHeader = req.headers.get("Authorization") || "";
    const isAuthorized = !expectedToken || queryToken === expectedToken || authHeader === `Bearer ${expectedToken}`;
    if (!isAuthorized) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 3. Parse Monday.com webhook payload ───────────────────────────────────
    // Monday sends different payload shapes depending on automation version.
    const event = body.event || body;
    const itemId = event.pulseId || event.itemId;
    const itemName = event.pulseName || event.name || "";

    // ── 4. Fetch full item from Monday API ────────────────────────────────────
    // Monday webhooks only include the changed column, not the full row.
    // We must fetch the complete item to get all profile fields.
    const mondayApiKey = Deno.env.get("Monday");
    if (!mondayApiKey) {
      return Response.json({ error: "Monday API key not configured" }, { status: 500 });
    }

    console.log("Fetching full item from Monday API for itemId:", itemId);
    const mondayRes = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": mondayApiKey,
      },
      body: JSON.stringify({
        query: `{ items(ids: [${itemId}]) { id name column_values { id text value } } }`,
      }),
    });
    const mondayData = await mondayRes.json();

    const item = mondayData?.data?.items?.[0];
    if (!item) {
      return Response.json({ error: "Item not found in Monday" }, { status: 404 });
    }

    const columnValues = item.column_values || [];
    const mondayItemId = String(item.id);
    const fullName = item.name || itemName || "";

    // ── 5. Extract profile fields ─────────────────────────────────────────────
    const email          = col(columnValues, COL.EMAIL)?.toLowerCase() || null;
    const phone          = col(columnValues, COL.PHONE);
    const secondaryPhone = col(columnValues, COL.SECONDARY_PHONE);
    const emergencyName  = col(columnValues, COL.EMERGENCY_NAME);
    const emergencyPhone = col(columnValues, COL.EMERGENCY_PHONE);
    const emergencyRel   = col(columnValues, COL.EMERGENCY_REL);
    const dobRaw         = col(columnValues, COL.DATE_OF_BIRTH); // used for age only — NOT stored
    const sex            = col(columnValues, COL.SEX);
    const city           = col(columnValues, COL.CITY);
    const draftDate      = col(columnValues, COL.DRAFT_DATE);
    const dateAdded      = col(columnValues, COL.DATE_ADDED);
    const dateSignup     = col(columnValues, COL.DATE_SIGNUP);
    const interviewNotes = col(columnValues, COL.INTERVIEW_NOTES);
    const aboutParticipant = col(columnValues, COL.ABOUT_PARTICIPANT);
    const fitnessRaw     = col(columnValues, COL.FITNESS_LEVEL);
    const hebrewRaw      = col(columnValues, COL.HEBREW_LEVEL);
    const threeK         = col(columnValues, COL.THREE_K_TIME);
    const howDrafting    = col(columnValues, COL.HOW_DRAFTING);
    const targetUnit     = col(columnValues, COL.TARGET_UNIT);
    const serviceLength  = col(columnValues, COL.SERVICE_LENGTH);
    const israelFramework = col(columnValues, COL.ISRAEL_FRAMEWORK);
    const stayFramework  = col(columnValues, COL.STAY_FRAMEWORK);
    const referenceOrg   = col(columnValues, COL.REFERENCE_ORG);
    const readyForService = col(columnValues, COL.READY_FOR_SERVICE);

    // Resolve branch using both English and Hebrew variants
    const rawBranch    = col(columnValues, COL.BRANCH) || "";
    const primaryBranch = BRANCH_MAP[rawBranch.toLowerCase()] || BRANCH_MAP[rawBranch] || "צוות מייקי";

    // Combine interview notes and about section into a single notes field
    const combinedNotes = [interviewNotes, aboutParticipant].filter(Boolean).join("\n\n").trim() || null;

    // ── 6. Compute age from DOB (DOB itself is never stored) ──────────────────
    let age: number | null = null;
    if (dobRaw) {
      const dob = new Date(dobRaw);
      const today = new Date();
      age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    }

    // ── 7. Validate required fields ───────────────────────────────────────────
    console.log("PARSED_FIELDS:", JSON.stringify({
      fullName, email, phone, secondaryPhone,
      emergencyName, emergencyPhone, emergencyRel,
      age, sex, city, draftDate, dateAdded, dateSignup,
      fitnessRaw, hebrewRaw, threeK, howDrafting, targetUnit,
      serviceLength, israelFramework, stayFramework,
      referenceOrg, readyForService, rawBranch, primaryBranch,
      combinedNotes: combinedNotes?.substring(0, 100)
    }));
    console.log("Parsed fields — email:", email, "| fullName:", fullName, "| columnValues count:", columnValues.length);

    if (!email) {
      console.warn("Missing email — columnValues:", JSON.stringify(columnValues).substring(0, 300));
      return Response.json({ error: "Missing required field: email", columnValuesReceived: columnValues.length }, { status: 400 });
    }
    if (!fullName) {
      return Response.json({ error: "Missing required field: full name" }, { status: 400 });
    }
    console.log("Validation passed, building user record...");

    // ── 8. Build user profile payload ─────────────────────────────────────────
    // Only allowed (non-blocked) fields are included.
    // Fields that are null/undefined are omitted to avoid overwriting existing data.
    const userData: Record<string, any> = {
      full_name:          fullName,
      email:              email,
      role:               "participant",
      user_type:          "participant",
      participant_status: "active",
      account_status:     "active",
      primary_branch:     primaryBranch,
      monday_item_id:     mondayItemId,
    };

    if (phone)             userData.phone = phone;
    if (secondaryPhone)    userData.secondary_phone = secondaryPhone;
    if (emergencyName)     userData.emergency_contact_name = emergencyName;
    if (emergencyPhone)    userData.emergency_contact_phone = emergencyPhone;
    if (emergencyRel)      userData.emergency_contact_relationship = emergencyRel;
    if (age !== null)      userData.age = age;
    if (sex)               userData.sex = sex.toLowerCase();
    if (city)              userData.address = city;
    if (draftDate)         userData.draft_date = draftDate;
    if (referenceOrg)      userData.reference_org = referenceOrg;
    if (readyForService)   userData.ready_for_service = readyForService;
    if (combinedNotes)     userData.notes = combinedNotes;
    if (targetUnit)        userData.target_unit = targetUnit;
    if (threeK)            userData.fastest_3k = threeK;
    if (howDrafting)       userData.draft_method = howDrafting;
    if (serviceLength)     userData.planned_service_length = serviceLength;
    if (israelFramework)   userData.israel_framework = israelFramework;
    if (stayFramework)     userData.stay_framework = stayFramework;

    const fitnessNorm = normalizeFitness(fitnessRaw);
    const hebrewNorm  = normalizeHebrew(hebrewRaw);
    if (fitnessNorm) userData.fitness_level = fitnessNorm;
    if (hebrewNorm)  userData.hebrew_level  = hebrewNorm;

    // Join date priority: dateAdded (admin-entered) > dateSignup (form-entered) > today
    const joinDate = (dateAdded || dateSignup || new Date().toISOString().split("T")[0]).split("T")[0];
    userData.join_date = joinDate;

    // ── 9. Initialize base44 client ───────────────────────────────────────────
    // We must reconstruct the request with the original body text since req.text()
    // consumes the stream and cannot be re-read.
    const syntheticReq = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: bodyText,
    });
    const base44 = createClientFromRequest(syntheticReq);
    console.log("USER_DATA_TO_CREATE:", JSON.stringify(userData));

    // ── 10. Upsert PendingInvitation ──────────────────────────────────────────
    // The profile data is stored here so inviteUserWithType can apply it to the
    // real auth User record the moment the admin sends the invite.
    // If a record already exists for this email (re-webhook), update it.
    try {
      const existingInvites = await base44.asServiceRole.entities.PendingInvitation.filter({ email: email.toLowerCase() });
      const invitePayload = {
        email:        email.toLowerCase(),
        user_type:    "participant",
        invited_by:   "monday_webhook",
        invited_at:   new Date().toISOString(),
        processed:    false,
        profile_data: userData,
      };
      if (existingInvites && existingInvites.length > 0) {
        await base44.asServiceRole.entities.PendingInvitation.update(existingInvites[0].id, invitePayload);
      } else {
        await base44.asServiceRole.entities.PendingInvitation.create(invitePayload);
      }
      console.log("Pending invitation recorded for:", email);
    } catch (pendingErr) {
      console.warn("Could not record pending invitation:", pendingErr.message);
    }

    // ── 11. Notify branch Coordinator ─────────────────────────────────────────
    // [Fix 1.3 — IMPLEMENTED] Creates one UserNotification per coordinator of
    // the participant's branch, using the correct entity name and payload shape.
    try {
      const coordinators = await base44.asServiceRole.entities.User.filter({
        primary_branch: primaryBranch,
        title: "Coordinator",
      });

      if (coordinators && coordinators.length > 0) {
        for (const coordinator of coordinators) {
          await base44.asServiceRole.entities.UserNotification.create({
            user_id: coordinator.id,
            title:   "New Participant Assigned",
            message: `New participant ${fullName} has been assigned to your branch.`,
            type:    "general",
            read:    false,
          });
        }
        console.log(`Notified ${coordinators.length} coordinator(s) for branch ${primaryBranch}`);
      }
    } catch (notifErr) {
      // Non-fatal: onboarding should still succeed even if notification fails.
      console.warn("Coordinator notification failed:", notifErr.message);
    }

    // ── 12. Success ───────────────────────────────────────────────────────────
    return Response.json({
      success:   true,
      message:   `Participant ${fullName} onboarded successfully. Profile data saved — will be applied when admin sends invite.`,
      branch:    primaryBranch,
      join_date: joinDate,
    });

  } catch (err) {
    console.error("Webhook error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});
