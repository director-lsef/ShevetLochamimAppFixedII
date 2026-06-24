import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Check, X, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

// Swipe threshold in px
const SWIPE_THRESHOLD = 80;

function ParticipantSwipeCard({ participant, registration, attendanceStatus, onMark, isMarking }) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startX = useRef(null);
  const cardRef = useRef(null);

  const startDrag = (clientX) => {
    startX.current = clientX;
    setIsDragging(true);
  };

  const moveDrag = (clientX) => {
    if (startX.current === null) return;
    const delta = clientX - startX.current;
    setDragX(delta);
  };

  const endDrag = () => {
    if (dragX > SWIPE_THRESHOLD) {
      onMark('present');
    } else if (dragX < -SWIPE_THRESHOLD) {
      onMark('absent');
    }
    setDragX(0);
    setIsDragging(false);
    startX.current = null;
  };

  const bgColor = dragX > 40 ? 'bg-green-50' : dragX < -40 ? 'bg-red-50' : 'bg-white';
  const initials = participant?.full_name
    ? participant.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const fitnessColors = {
    'elite': 'bg-purple-100 text-purple-800',
    'advanced': 'bg-blue-100 text-blue-800',
    'intermediate': 'bg-green-100 text-green-800',
    'beginner': 'bg-yellow-100 text-yellow-800',
    'needs_assessment': 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg select-none">
      {/* Background swipe indicators */}
      <div className="absolute inset-0 flex items-center justify-between px-6 pointer-events-none">
        <div className={`flex items-center gap-2 text-green-600 font-bold text-lg transition-opacity ${dragX > 40 ? 'opacity-100' : 'opacity-0'}`}>
          <CheckCircle className="w-8 h-8" />
          Present
        </div>
        <div className={`flex items-center gap-2 text-red-600 font-bold text-lg transition-opacity ${dragX < -40 ? 'opacity-100' : 'opacity-0'}`}>
          Absent
          <XCircle className="w-8 h-8" />
        </div>
      </div>

      {/* Card */}
      <div
        ref={cardRef}
        className={`relative ${bgColor} p-5 transition-colors`}
        style={{ transform: `translateX(${dragX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease' }}
        onMouseDown={(e) => startDrag(e.clientX)}
        onMouseMove={(e) => isDragging && moveDrag(e.clientX)}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        onTouchStart={(e) => startDrag(e.touches[0].clientX)}
        onTouchMove={(e) => moveDrag(e.touches[0].clientX)}
        onTouchEnd={endDrag}
      >
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            {participant?.profile_picture ? (
              <img src={participant.profile_picture} alt={participant.full_name} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                {initials}
              </div>
            )}
            {attendanceStatus === 'present' && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            {attendanceStatus === 'absent' && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center">
                <X className="w-3 h-3 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg truncate">{participant?.full_name || 'Unknown'}</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {participant?.fitness_level && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${fitnessColors[participant.fitness_level] || 'bg-gray-100 text-gray-600'}`}>
                  {participant.fitness_level}
                </span>
              )}
              {registration?.is_chanich_toran && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 font-medium">⭐ תורן</span>
              )}
            </div>
          </div>

          {/* Status indicator */}
          <div className="shrink-0">
            {attendanceStatus === 'present' ? (
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            ) : attendanceStatus === 'absent' ? (
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                <div className="w-4 h-4 rounded-full bg-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Tap buttons below */}
        {isMarking ? (
          <div className="mt-3 flex justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          </div>
        ) : attendanceStatus === null || attendanceStatus === undefined ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="border-green-300 text-green-700 hover:bg-green-50" onClick={() => onMark('present')}>
              <CheckCircle className="w-4 h-4 mr-1" /> Present
            </Button>
            <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => onMark('absent')}>
              <XCircle className="w-4 h-4 mr-1" /> Absent
            </Button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" className="flex-1 text-xs text-gray-500" onClick={() => onMark(attendanceStatus === 'present' ? 'absent' : 'present')}>
              Change to {attendanceStatus === 'present' ? 'Absent' : 'Present'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SwipeAttendance({ eventId, registrations, participants, attendanceRecords, currentUserId, onUpdate }) {
  const [markingId, setMarkingId] = useState(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState('swipe'); // 'swipe' | 'list'

  const getParticipant = (id) => participants.find(p => p.id === id);
  const getAttendanceStatus = (participantId) => {
    const rec = attendanceRecords.find(r => r.participant_id === participantId);
    return rec?.status || null;
  };

  // ── [Fix PROFILE-1] UNLOCK THIS FUNCTION — sync EventRegistration.status ────────
  // BASE44 EDITOR: After writing to AttendanceRecord, also update
  // EventRegistration.status so statistics pages get correct data.
  //
  // ROOT CAUSE: This function writes to AttendanceRecord (present/absent/late)
  // but Statistics.jsx, Home.jsx, LowEngagementReport.jsx, and MyEvents.jsx ALL
  // read attendance from EventRegistration.status === 'attended'. Because
  // EventRegistration.status is never updated here, every attendance marking
  // is invisible to all stats — attendance always shows 0 no matter how many
  // sessions are marked.
  //
  // STATUS MAPPING:
  //   AttendanceRecord 'present' or 'late'  → EventRegistration 'attended'
  //   AttendanceRecord 'absent'             → EventRegistration 'no_show'
  //
  // OLD handleMark (no EventRegistration sync — DELETE this version):
  //   [existing code without the EventRegistration.update block]
  //
  // NEW handleMark (add sync — REPLACE the entire function with this):
  const handleMark = async (participantId, status) => {
    setMarkingId(participantId);
    try {
      // Step 1: Write to AttendanceRecord (fine-grained per-event record)
      const existing = attendanceRecords.find(r => r.participant_id === participantId);
      if (existing) {
        await base44.entities.AttendanceRecord.update(existing.id, {
          status, marked_by: currentUserId, marked_at: new Date().toISOString()
        });
      } else {
        await base44.entities.AttendanceRecord.create({
          event_id: eventId, participant_id: participantId,
          status, marked_by: currentUserId, marked_at: new Date().toISOString()
        });
      }

      // ── [Fix PROFILE-1] NEW: Step 2 — sync EventRegistration.status ───────────
      // Map attendance status → registration status so stats pages work correctly.
      // Without this, attendance is invisible to Statistics, Home, LowEngagementReport.
      const regStatus = (status === 'present' || status === 'late') ? 'attended' : 'no_show';
      const reg = registrations.find(r => r.participant_id === participantId);
      if (reg) {
        await base44.entities.EventRegistration.update(reg.id, { status: regStatus });
      }
      // ── END FIX ──────────────────────────────────────────────────────────────────

      if (mode === 'swipe' && currentIndex < registrations.length - 1) {
        setCurrentIndex(i => i + 1);
      }
      onUpdate();
    } catch {
      toast.error('Failed to mark attendance');
    } finally {
      setMarkingId(null);
    }
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────

  // ── [Fix PROFILE-1] UNLOCK THIS FUNCTION — add EventRegistration sync ──────────
  // Same fix as handleMark above — mark-all-present must also update
  // EventRegistration.status to 'attended' for each participant so stats work.
  //
  // OLD handleMarkAllPresent (no EventRegistration sync — DELETE):
  //   [existing code without the EventRegistration.update line]
  //
  // NEW handleMarkAllPresent (add reg.status sync inside the for-loop):
  const handleMarkAllPresent = async () => {
    setMarkingAll(true);
    try {
      for (const reg of registrations) {
        const existing = attendanceRecords.find(r => r.participant_id === reg.participant_id);
        if (existing) {
          await base44.entities.AttendanceRecord.update(existing.id, {
            status: 'present', marked_by: currentUserId, marked_at: new Date().toISOString()
          });
        } else {
          await base44.entities.AttendanceRecord.create({
            event_id: eventId, participant_id: reg.participant_id,
            status: 'present', marked_by: currentUserId, marked_at: new Date().toISOString()
          });
        }
        // ── [Fix PROFILE-1] NEW: sync EventRegistration.status ─────────────────
        await base44.entities.EventRegistration.update(reg.id, { status: 'attended' });
        // ── END FIX ────────────────────────────────────────────────────────────
      }
      toast.success(`✓ All ${registrations.length} participants marked present`);
      onUpdate();
    } catch {
      toast.error('Failed to mark all present');
    } finally {
      setMarkingAll(false);
    }
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────

  const presentCount = registrations.filter(r => getAttendanceStatus(r.participant_id) === 'present').length;
  const absentCount = registrations.filter(r => getAttendanceStatus(r.participant_id) === 'absent').length;
  const unmarkedCount = registrations.length - presentCount - absentCount;

  if (registrations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Users className="w-12 h-12 mx-auto mb-2 text-gray-300" />
        <p>No registered participants</p>
      </div>
    );
  }

  const currentReg = registrations[currentIndex];
  const currentParticipant = currentReg ? getParticipant(currentReg.participant_id) : null;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <Badge className="bg-green-100 text-green-800">{presentCount} present</Badge>
          <Badge className="bg-red-100 text-red-800">{absentCount} absent</Badge>
          {unmarkedCount > 0 && <Badge variant="outline">{unmarkedCount} unmarked</Badge>}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === 'swipe' ? 'default' : 'outline'}
            onClick={() => setMode('swipe')}
            className="text-xs"
          >Swipe</Button>
          <Button
            size="sm"
            variant={mode === 'list' ? 'default' : 'outline'}
            onClick={() => setMode('list')}
            className="text-xs"
          >List</Button>
        </div>
      </div>

      {/* Mark all present */}
      <Button
        onClick={handleMarkAllPresent}
        disabled={markingAll}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        {markingAll ? (
          <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Marking all...</>
        ) : (
          <><CheckCircle className="w-5 h-5 mr-2" />All Present</>
        )}
      </Button>

      {/* Swipe mode */}
      {mode === 'swipe' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>{currentIndex + 1} / {registrations.length}</span>
            <span className="text-xs">← swipe or tap buttons →</span>
          </div>
          {currentReg && (
            <ParticipantSwipeCard
              participant={currentParticipant}
              registration={currentReg}
              attendanceStatus={getAttendanceStatus(currentReg.participant_id)}
              onMark={(status) => handleMark(currentReg.participant_id, status)}
              isMarking={markingId === currentReg.participant_id}
            />
          )}
          <div className="flex gap-2 justify-center">
            <Button variant="outline" size="sm" disabled={currentIndex === 0} onClick={() => setCurrentIndex(i => i - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="flex items-center text-xs text-gray-500 px-2">
              {registrations.map((r, i) => (
                <div
                  key={r.participant_id}
                  onClick={() => setCurrentIndex(i)}
                  className={`w-2 h-2 rounded-full mx-0.5 cursor-pointer ${
                    i === currentIndex ? 'bg-blue-600' :
                    getAttendanceStatus(r.participant_id) === 'present' ? 'bg-green-400' :
                    getAttendanceStatus(r.participant_id) === 'absent' ? 'bg-red-400' : 'bg-gray-300'
                  }`}
                />
              ))}
            </span>
            <Button variant="outline" size="sm" disabled={currentIndex === registrations.length - 1} onClick={() => setCurrentIndex(i => i + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* List mode */}
      {mode === 'list' && (
        <div className="space-y-2">
          {registrations.map((reg) => {
            const participant = getParticipant(reg.participant_id);
            const status = getAttendanceStatus(reg.participant_id);
            const initials = participant?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
            return (
              <div key={reg.participant_id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                status === 'present' ? 'bg-green-50 border-green-200' :
                status === 'absent' ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100'
              }`}>
                {participant?.profile_picture ? (
                  <img src={participant.profile_picture} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {initials}
                  </div>
                )}
                <span className="flex-1 font-medium text-sm text-gray-900">{participant?.full_name || 'Unknown'}</span>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant={status === 'present' ? 'default' : 'outline'}
                    className={status === 'present' ? 'bg-green-600 hover:bg-green-700 h-8 w-8 p-0' : 'border-green-300 text-green-700 h-8 w-8 p-0'}
                    onClick={() => handleMark(reg.participant_id, 'present')}
                    disabled={markingId === reg.participant_id}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={status === 'absent' ? 'default' : 'outline'}
                    className={status === 'absent' ? 'bg-red-600 hover:bg-red-700 h-8 w-8 p-0' : 'border-red-300 text-red-700 h-8 w-8 p-0'}
                    onClick={() => handleMark(reg.participant_id, 'absent')}
                    disabled={markingId === reg.participant_id}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}