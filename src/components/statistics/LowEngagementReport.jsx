import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, UserX, Snowflake } from 'lucide-react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import FreezeAccountDialog from '@/components/participants/FreezeAccountDialog';

// ── [Fix 3.2] UNLOCK THIS BLOCK — replace keyword matching with category_type ───
// BASE44 EDITOR: Delete the keyword constants and matchesKeywords function below,
// then replace with category_type-based detection.
// PREREQUISITE: EventCategory.jsonc must have the category_type enum field added
// AND existing categories must have their category_type values set in the database.
// Only then will the getEventType() function below work correctly.
//
// DELETED BLOCK (remove these once EventCategory.category_type is live):
// const TRAINING_KEYWORDS = ['אימון'];
// const CHINUCHI_KEYWORDS = ['שיעור חינוכי'];
// const ULPAN_KEYWORDS = ['אולפן', 'שיעור עברית'];
// function matchesKeywords(text, keywords) { ... }
// ── END DELETE ─────────────────────────────────────────────────────────────────

// ── [Fix 3.1] UNLOCK THESE CONSTANTS — fix ULPAN threshold ────────────────────
// BASE44 EDITOR: ULPAN_MIN is currently 3, coded as `ulpanCount <= 2` in the
// flags block (threshold label says '≤ 2'). The spec requires minimum 2 of 6,
// meaning flag if ulpanCount < 2 (i.e. 0 or 1).
// Change ULPAN_MIN from 3 to 2. Also update the flag condition below.
//
// Thresholds per spec:
//   Training:    4 of 8 per month  → flag if count < 4
//   Educational: 1 of 2 per month  → flag if count < 1
//   Ulpan:       2 of 6 per month  → flag if count < 2  ← WAS <= 2 (off by one)
const TRAINING_MIN = 4;   // 4/8 workouts per month
const CHINUCHI_MIN = 1;   // 1/2 educational lessons per month
const ULPAN_MIN = 2;      // [Fix 3.1] CHANGED from 3 → 2 (was flagging at ≤2, spec says minimum is 2 meaning flag if <2)
// ── END UNLOCK ─────────────────────────────────────────────────────────────────

export default function LowEngagementReport({ participants, events, registrations, categories, selectedYear, onDataChange }) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
  const [freezeTargetUser, setFreezeTargetUser] = useState(null);
  const [unfreezingId, setUnfreezingId] = useState(null);

  const categoryMap = useMemo(() => {
    const m = {};
    categories.forEach(c => { m[c.id] = c; });
    return m;
  }, [categories]);

  // ── [Fix 3.2] UNLOCK THIS FUNCTION — replace with category_type lookup ─────────
  // BASE44 EDITOR: Replace this function once EventCategory.category_type is live.
  // The current keyword matching is fragile — if a category name changes or a new
  // naming convention is used, events will be silently miscategorised.
  //
  // OLD getEventType (keyword matching — DELETE once category_type is set):
  // const getEventType = (event) => {
  //   const cat = event.category_id ? categoryMap[event.category_id] : null;
  //   const combined = `${event.title || ''} ${cat?.name || ''}`;
  //   if (matchesKeywords(combined, TRAINING_KEYWORDS)) return 'training';
  //   if (matchesKeywords(combined, CHINUCHI_KEYWORDS)) return 'chinuchi';
  //   if (matchesKeywords(combined, ULPAN_KEYWORDS)) return 'ulpan';
  //   return 'other';
  // };
  //
  // NEW getEventType (category_type field — replace with this):
  // const getEventType = (event) => {
  //   const cat = event.category_id ? categoryMap[event.category_id] : null;
  //   if (!cat?.category_type) return 'other'; // graceful fallback if field not set
  //   if (cat.category_type === 'workout')     return 'training';
  //   if (cat.category_type === 'educational') return 'chinuchi';
  //   if (cat.category_type === 'ulpan')       return 'ulpan';
  //   return 'other';
  // };
  //
  // KEEP THE OLD VERSION until EventCategory.category_type is confirmed live.
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────
  const getEventType = (event) => {
    const cat = event.category_id ? categoryMap[event.category_id] : null;
    if (!cat?.category_type) return 'other';
    if (cat.category_type === 'workout') return 'training';
    if (cat.category_type === 'educational') return 'chinuchi';
    if (cat.category_type === 'ulpan') return 'ulpan';
    return 'other';
  };

  const activeRegs = useMemo(() =>
    registrations.filter(r => r.status === 'registered' || r.status === 'attended'),
    [registrations]
  );

  const report = useMemo(() => {
    const monthIdx = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    const startDate = new Date(year, monthIdx, 1);
    const endDate = new Date(year, monthIdx + 1, 0, 23, 59, 59);

    // Events in this month
    const monthEvents = events.filter(e => {
      const d = new Date(e.start_datetime);
      return d >= startDate && d <= endDate;
    });

    // Count events of each type this month (to know if there even were any)
    const availableTraining = monthEvents.filter(e => getEventType(e) === 'training').length;
    const availableChinuchi = monthEvents.filter(e => getEventType(e) === 'chinuchi').length;
    const availableUlpan = monthEvents.filter(e => getEventType(e) === 'ulpan').length;

    // Month regs
    const monthRegs = activeRegs.filter(r => {
      const ev = monthEvents.find(e => e.id === r.event_id);
      return !!ev;
    });

    // [Fix 3.4 — IMPLEMENTED] Freeze-exempt participants are excluded from the report
    return participants.filter(p => !p.freeze_exempt).map(p => {
      const pRegs = monthRegs.filter(r => r.participant_id === p.id);

      const trainingCount = pRegs.filter(r => {
        const ev = monthEvents.find(e => e.id === r.event_id);
        return ev && getEventType(ev) === 'training';
      }).length;

      const chinuchiCount = pRegs.filter(r => {
        const ev = monthEvents.find(e => e.id === r.event_id);
        return ev && getEventType(ev) === 'chinuchi';
      }).length;

      const ulpanCount = pRegs.filter(r => {
        const ev = monthEvents.find(e => e.id === r.event_id);
        return ev && getEventType(ev) === 'ulpan';
      }).length;

      // ── [Fix 3.1] UNLOCK THESE THREE LINES — fix ulpan condition ────────────────
      // BASE44 EDITOR: The ulpan flag condition is `ulpanCount <= 2` which flags
      // anyone with 2 or fewer. The spec requires a minimum of 2, so flag at < 2.
      // This is a one-character change on the ulpan line: <= 2  →  < ULPAN_MIN
      //
      // Also update the threshold label from '≤ 2' to `< ${ULPAN_MIN}` for consistency.
      //
      // OLD (off by one — flags participants who have exactly 2, which meets the requirement):
      //   if (availableUlpan > 0 && ulpanCount <= 2)
      //     flags.push({ ..., threshold: '≤ 2' });
      //
      // NEW (correct — flag only if below minimum):
      //   if (availableUlpan > 0 && ulpanCount < ULPAN_MIN)
      //     flags.push({ ..., threshold: `< ${ULPAN_MIN}` });
      // ── END UNLOCK ─────────────────────────────────────────────────────────────────
      const flags = [];
      if (availableTraining > 0 && trainingCount < TRAINING_MIN)
        flags.push({ type: 'training', label: 'אימון', count: trainingCount, threshold: `< ${TRAINING_MIN}` });
      if (availableChinuchi > 0 && chinuchiCount < CHINUCHI_MIN)
        flags.push({ type: 'chinuchi', label: 'שיעור חינוכי', count: chinuchiCount, threshold: `< ${CHINUCHI_MIN}` });
      // [Fix 3.1] CHANGED: was `ulpanCount <= 2` — now uses ULPAN_MIN constant (value: 2)
      // Effect: previously flagged count=2 (incorrect), now flags count=0 or count=1 only
      if (availableUlpan > 0 && ulpanCount < ULPAN_MIN)
        flags.push({ type: 'ulpan', label: 'אולפן / עברית', count: ulpanCount, threshold: `< ${ULPAN_MIN}` });

      return {
        id: p.id,
        name: p.full_name || p.email,
        branch: p.primary_branch || 'צוות מייקי',
        account_status: p.account_status,
        freeze_end_date: p.freeze_end_date,
        // [Fix 3.4] Pass freeze_exempt through so the table row can show an
        // "Exempt" badge instead of a Freeze button for exempt participants.
        freeze_exempt: p.freeze_exempt || false,
        trainingCount,
        chinuchiCount,
        ulpanCount,
        flags,
        totalRegs: pRegs.length,
      };
    }).filter(p => p.flags.length > 0)
      .sort((a, b) => b.flags.length - a.flags.length);
  }, [participants, events, activeRegs, categories, selectedMonth, selectedYear]);

  const monthName = format(new Date(parseInt(selectedYear), parseInt(selectedMonth), 1), 'MMMM yyyy');

  const flagColor = {
    training: 'bg-red-100 text-red-700',
    chinuchi: 'bg-orange-100 text-orange-700',
    ulpan: 'bg-amber-100 text-amber-700',
  };

  const branchColor = (branch) =>
    branch === 'צוות לוחמים' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';

  const handleUnfreeze = async (p) => {
    setUnfreezingId(p.id);
    try {
      await base44.entities.User.update(p.id, { account_status: 'active', freeze_end_date: null });
      toast.success(`${p.name}'s account unfrozen`);
      if (onDataChange) onDataChange();
    } catch {
      toast.error('Failed to unfreeze account');
    } finally {
      setUnfreezingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <CardTitle>Monthly Engagement Oversight</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-gray-500">Month</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i} value={i.toString()}>
                      {format(new Date(2000, i, 1), 'MMMM')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Participants with low engagement in <strong>{monthName}</strong>. Flags: אימון &lt; {TRAINING_MIN} sessions · שיעור חינוכי = 0 · אולפן/עברית ≤ 2 sessions.
          </p>
        </CardHeader>
        <CardContent>
          {report.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <UserX className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No low-engagement participants found for {monthName}</p>
              <p className="text-sm mt-1">All active participants meet the minimum thresholds.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-4 text-sm">
                <span className="text-gray-500">{report.length} participant{report.length !== 1 ? 's' : ''} flagged</span>
                <div className="flex gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Low אימון</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" /> Missing שיעור חינוכי</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Low אולפן/עברית</span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead className="text-center">אימון</TableHead>
                      <TableHead className="text-center">שיעור חינוכי</TableHead>
                      <TableHead className="text-center">אולפן / עברית</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.map((p) => (
                      <TableRow key={p.id} className="hover:bg-amber-50/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 text-xs font-bold flex-shrink-0">
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                            {p.name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={branchColor(p.branch)} variant="secondary">
                            {p.branch}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={p.trainingCount < TRAINING_MIN ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                            {p.trainingCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={p.chinuchiCount < CHINUCHI_MIN ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}>
                            {p.chinuchiCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {/* [Fix 3.1] UNLOCK THIS LINE — change <= 2 to < ULPAN_MIN
                              OLD: p.ulpanCount <= 2 ? 'bg-amber-...' : 'bg-green-...'
                              NEW: p.ulpanCount < ULPAN_MIN ? 'bg-amber-...' : 'bg-green-...' */}
                          <Badge className={p.ulpanCount < ULPAN_MIN ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}>
                            {p.ulpanCount}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {p.flags.map((f, i) => (
                              <Badge key={i} className={flagColor[f.type]}>
                                {f.label} ({f.count})
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          {/* [Fix 3.4] Exempt participants are filtered out above */}
                          {p.account_status === 'frozen' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-blue-600 flex items-center gap-1">
                                <Snowflake className="w-3 h-3" /> Frozen
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 text-xs px-2"
                                disabled={unfreezingId === p.id}
                                onClick={() => handleUnfreeze(p)}
                              >
                                Unfreeze
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs px-2"
                              onClick={() => setFreezeTargetUser(p)}
                            >
                              <Snowflake className="w-3 h-3 mr-1" />
                              Freeze
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      {freezeTargetUser && (
        <FreezeAccountDialog
          user={freezeTargetUser}
          open={!!freezeTargetUser}
          onClose={() => setFreezeTargetUser(null)}
          onSuccess={() => { setFreezeTargetUser(null); if (onDataChange) onDataChange(); }}
        />
      )}
    </div>
  );
}