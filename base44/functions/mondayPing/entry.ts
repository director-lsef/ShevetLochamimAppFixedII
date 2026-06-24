/**
 * ============================================================
 * FUNCTION: mondayPing
 * ============================================================
 * PURPOSE:
 *   Lightweight health-check endpoint for the Monday.com integration.
 *   Returns a 200 OK with a timestamp. Used to verify the function
 *   runtime is active and reachable before configuring webhooks.
 *
 * TRIGGER:
 *   Manual — called from the admin panel or via curl during setup.
 *   Not part of any automation or scheduled job.
 *
 * NO BUSINESS LOGIC. NO ENTITIES ACCESSED. NO AUTH REQUIRED.
 * ============================================================
 */

Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ status: "ok", method: req.method, ts: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
