import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, ClipboardCheck, CheckCircle2, XCircle, Clock } from 'lucide-react';
import SubmissionReviewCard from '@/components/admin/SubmissionReviewCard';

export default function SubmissionReview() {
  const [currentUser, setCurrentUser] = useState(null);
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // ── [Fix P.1] UNLOCK: Remove base44.auth.me() from Promise.all ──────────────
    // BASE44 EDITOR: Replace auth.me() with useAuth().
    // STEP 1: Add: const { user: userData } = useAuth(); at top of component
    // STEP 2: Remove base44.auth.me() from Promise.all, and adjust destructuring:
    //   OLD: const [userData, records, usersData] = await Promise.all([auth.me(), ...])
    //   NEW: const [records, usersData] = await Promise.all([...]) (no auth.me())
    // ── END UNLOCK ─────────────────────────────────────────────────────────────
    const [userData, records, usersData] = await Promise.all([
      base44.auth.me(),
      base44.entities.PerformanceRecord.filter({ status: 'pending_verification' }, '-created_date'),
      base44.entities.User.list(),
    ]);
    setCurrentUser(userData);
    setPending(records);
    setUsers(usersData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (currentUser?.user_type !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only administrators can access the submission review queue.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getParticipant = (id) => users.find(u => u.id === id);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100 text-3xl font-bold flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-amber-400" />
            Submission Review
          </h1>
          <p className="text-slate-400 mt-1">Review and verify participant-submitted performance results</p>
        </div>
        {pending.length > 0 && (
          <Badge className="bg-amber-500 text-white text-sm px-3 py-1">
            {pending.length} Pending
          </Badge>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-none shadow bg-white/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pending.length}</p>
              <p className="text-xs text-gray-500">Awaiting Review</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow bg-white/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">—</p>
              <p className="text-xs text-gray-500">Approved Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow bg-white/80">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">—</p>
              <p className="text-xs text-gray-500">Rejected Today</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Queue */}
      <Card className="border-none shadow-lg bg-white/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-800">
            <Clock className="w-5 h-5 text-amber-500" />
            Pending Queue
            {pending.length > 0 && (
              <Badge className="ml-2 bg-amber-100 text-amber-800">{pending.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <div className="text-center py-16">
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-300" />
              <p className="text-lg font-semibold text-gray-600">All caught up!</p>
              <p className="text-sm text-gray-400 mt-1">No submissions are pending review.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map(record => (
                <SubmissionReviewCard
                  key={record.id}
                  record={record}
                  participant={getParticipant(record.participant_id)}
                  onReviewed={loadData}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}