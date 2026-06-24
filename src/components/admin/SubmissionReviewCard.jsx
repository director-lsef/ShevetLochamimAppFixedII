/**
 * ============================================================
 * SubmissionReviewCard.jsx
 * ============================================================
 * PURPOSE:
 *   Renders a single PerformanceRecord submission for admin review.
 *   Provides Approve and Reject actions, and notifies the participant
 *   of the outcome via an in-app notification.
 *
 * PROPS:
 *   record      — PerformanceRecord entity object (pending_verification)
 *   participant — User entity object for the submitting participant
 *   onReviewed  — Callback fired after approve or reject completes
 *
 * STATE:
 *   showReject  — Toggles inline rejection form (false = show approve/reject buttons)
 *   rejectReason — Text input for the rejection reason
 *   showProof   — Controls the proof image lightbox dialog
 *   loading     — Disables action buttons while API call is in flight
 *
 * KNOWN BUGS (do not fix until Phase 2 of the fix plan):
 *   [Step 2.1] Both handleApprove and handleReject call
 *     base44.entities.Notification.create() — that entity does NOT exist.
 *     The correct entity is 'UserNotification'. These calls fail at runtime
 *     and throw an uncaught exception, meaning:
 *     a) The PerformanceRecord status IS updated (that line runs first)
 *     b) The participant notification is NEVER delivered
 *     c) The toast.success / toast.info fires only if the notify call is
 *        wrapped in try/catch (it currently is not — the whole handler throws)
 *
 *     Fix: replace entities.Notification.create() with
 *     entities.UserNotification.create({ user_id, title, message, type, read })
 * ============================================================
 */

import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, XCircle, ZoomIn, Clock, Calendar, User } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ─── Drill type → display label map ──────────────────────────────────────────
// Used in both the card display and the notification message body.
// Matches the drill_type enum values on the PerformanceRecord entity.
const DRILL_LABELS = {
  '1k_run':                '1K Run',
  '2k_run':                '2K Run',
  '3km_run':               '3K Run',
  '300m_crawl':            '300M Crawl',
  'full_gan_saccer_crawl': 'Full Gan Saccer Crawl',
  'other':                 'Other',
};

// ─── Helper: format raw seconds → M:SS display string ─────────────────────────
function formatTime(seconds) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function SubmissionReviewCard({ record, participant, onReviewed }) {
  const [showReject, setShowReject]     = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showProof, setShowProof]       = useState(false);
  const [loading, setLoading]           = useState(false);

  // ─── handleApprove ───────────────────────────────────────────────────────
  // Updates the PerformanceRecord to 'verified', then notifies the participant.
  // ⚠️ BUG [Step 2.1]: entities.Notification does not exist — throws at runtime.
  //   The status update (line 1) succeeds, but the notification (line 2) throws,
  //   crashing the handler before the toast fires.
  const handleApprove = async () => {
    setLoading(true);

    // Step 1: Update record status (this succeeds)
    await base44.entities.PerformanceRecord.update(record.id, { status: 'verified' });

    // Step 2: Notify participant — ⚠️ BUG [Step 2.1]
    // 'Notification' entity does not exist. Should be:
    //   await base44.entities.UserNotification.create({
    //     user_id: record.participant_id,
    //     title:   '✅ Result Approved!',
    //     message: `Your ${DRILL_LABELS[record.drill_type] || record.drill_type} result of ${formatTime(record.time_seconds)} on ${record.record_date} has been verified.`,
    //     type:    'submission_review',
    //     read:    false,
    //   });
    // ── [Fix 2.1] ACTIVE FIX — correct entity + payload ──
    await base44.entities.UserNotification.create({
      user_id: record.participant_id,
      title:   '✅ Result Approved!',
      message: `Your ${DRILL_LABELS[record.drill_type] || record.drill_type} result of ${formatTime(record.time_seconds)} on ${record.record_date} has been verified.`,
      type:    'submission_review',
      read:    false,
    });

    toast.success('Result approved and participant notified');
    setLoading(false);
    onReviewed();
  };

  // ─── handleReject ────────────────────────────────────────────────────────
  // Validates reason is present, marks the record 'rejected', notifies participant.
  // ⚠️ BUG [Step 2.1]: Same entity name / payload shape issue as handleApprove.
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please enter a reason for rejection');
      return;
    }
    setLoading(true);

    // Step 1: Update record status with rejection notes (this succeeds)
    await base44.entities.PerformanceRecord.update(record.id, {
      status: 'rejected',
      notes:  rejectReason,
    });

    // ── [Fix 2.1] ACTIVE FIX — replaced Notification.create with UserNotification ──
    // OLD (broken): entities.Notification.create({ recipient_type, recipient_ids, ... })
    // NEW (correct): one UserNotification record with user_id
    await base44.entities.UserNotification.create({
      user_id: record.participant_id,
      title:   '❌ Result Rejected',
      message: `Your ${DRILL_LABELS[record.drill_type] || record.drill_type} submission (${formatTime(record.time_seconds)}) was not approved. Reason: ${rejectReason}`,
      type:    'submission_review',
      read:    false,
    });

    toast.info('Result rejected and participant notified');
    setLoading(false);
    setShowReject(false);
    setRejectReason('');
    onReviewed();
  };

  return (
    <>
      <Card className="border border-amber-100 shadow-md bg-white hover:shadow-lg transition-shadow">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">

            {/* ── Proof image thumbnail ─────────────────────────────────────
                Shows a zoomable thumbnail if proof_url is set.
                Falls back to a "No proof" placeholder. */}
            <div className="shrink-0">
              {record.proof_url ? (
                <button
                  onClick={() => setShowProof(true)}
                  className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 group"
                >
                  <img src={record.proof_url} alt="Proof" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-5 h-5 text-white" />
                  </div>
                </button>
              ) : (
                <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center border border-dashed border-gray-200">
                  <span className="text-xs text-gray-400 text-center leading-tight">No proof</span>
                </div>
              )}
            </div>

            {/* ── Record details + action buttons ───────────────────────── */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-semibold text-gray-800 flex items-center gap-1">
                  <User className="w-4 h-4 text-gray-400" />
                  {participant?.full_name || 'Unknown Participant'}
                </span>
                <Badge className="bg-indigo-100 text-indigo-700">
                  {DRILL_LABELS[record.drill_type] || record.drill_type}
                </Badge>
                <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <span className="font-bold text-indigo-700 text-base">{formatTime(record.time_seconds)}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  {record.record_date ? format(new Date(record.record_date), 'MMM d, yyyy') : '—'}
                </span>
              </div>

              {/* ── Action buttons — toggle between approve/reject and rejection form */}
              {!showReject ? (
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    disabled={loading}
                    onClick={handleApprove}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    disabled={loading}
                    variant="outline"
                    onClick={() => setShowReject(true)}
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              ) : (
                // Inline rejection form — shown when admin clicks "Reject"
                <div className="mt-3 space-y-2">
                  <Textarea
                    placeholder="Reason for rejection (e.g. Image unclear, time doesn't match...)"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={loading}
                      onClick={handleReject}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Confirm Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowReject(false); setRejectReason(''); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Proof image lightbox ─────────────────────────────────────────── */}
      <Dialog open={showProof} onOpenChange={setShowProof}>
        <DialogContent className="max-w-2xl p-2">
          <img src={record.proof_url} alt="Proof" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>
    </>
  );
}
