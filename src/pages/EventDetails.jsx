import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, Clock, MapPin, Users, User, ArrowLeft,
  CheckCircle, XCircle, AlertCircle, Repeat, Star, Target,
  FileText, Upload, Download, X, Edit, Trash2, Bell
} from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
"@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import LocationSelect from '../components/events/LocationSelect';
import { toast } from 'sonner';
import ParticipantRatingCard from '../components/events/ParticipantRatingCard';
import AttendeeRatingPanel from '../components/events/AttendeeRatingPanel';
import EventSessionPlan from '../components/events/EventSessionPlan';
import StaffingTiers from '../components/events/StaffingTiers';
import SwipeAttendance from '../components/events/SwipeAttendance';
import { ExternalLink } from 'lucide-react';
import EventRemindersPanel from '../components/events/EventRemindersPanel';

export default function EventDetails() {
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [category, setCategory] = useState(null);
  const [categories, setCategories] = useState([]);
  const [instructor, setInstructor] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [user, setUser] = useState(null);
  const [myRegistration, setMyRegistration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteScope, setDeleteScope] = useState('single'); // 'single' | 'series'
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [selectedParticipantForRating, setSelectedParticipantForRating] = useState(null);
  const [performanceRecords, setPerformanceRecords] = useState([]);
  const [mentalRatings, setMentalRatings] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [uploadingMaterial, setUploadingMaterial] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  useEffect(() => {
    if (eventId) {
      loadData();
    }
  }, [eventId]);

  const loadData = async () => {
    try {
      const [eventData, userData, regsData, perfData, mentalData, attendanceData] = await Promise.all([
        base44.entities.Event.filter({ id: eventId }),
        base44.auth.me(),
        base44.entities.EventRegistration.filter({ event_id: eventId }),
        base44.entities.PerformanceRecord.filter({ event_id: eventId }),
        base44.entities.MentalToughnessRating.filter({ event_id: eventId }),
        base44.entities.AttendanceRecord.filter({ event_id: eventId })
      ]);

      const ev = eventData[0];
      
      // Check if participant is trying to access staff-only event
      const isParticipant = !userData.user_type || userData.user_type === 'participant';
      if (isParticipant && ev?.event_privacy === 'staff-only') {
        setEvent(null);
        setLoading(false);
        return;
      }
      
      setEvent(ev);
      setUser(userData);
      setRegistrations(regsData.filter((r) => r.status === 'registered'));
      setPerformanceRecords(perfData);
      setMentalRatings(mentalData);
      setAttendanceRecords(attendanceData);

      // Load participant names for everyone (via safe backend function)
      try {
        const res = await base44.functions.invoke('getParticipantNames', {});
        const allUsers = res.data?.participants || [];
        setParticipants(allUsers);
        if (ev.instructor_id) {
          const inst = allUsers.find((u) => u.id === ev.instructor_id);
          setInstructor(inst);
        }
      } catch {
        // If admin, fallback to direct list
        if (userData.user_type === 'admin' || userData.user_type === 'instructor') {
          try {
            const allUsers = await base44.entities.User.list();
            setParticipants(allUsers);
          } catch { /* silent */ }
        }
      }

      const allCats = await base44.entities.EventCategory.list();
      setCategories(allCats);
      if (ev.category_id) {
        setCategory(allCats.find(c => c.id === ev.category_id) || null);
      }

      const myReg = regsData.find((r) => r.participant_id === userData.id && r.status === 'registered');
      setMyRegistration(myReg);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── [Fix 2.1] UNLOCK THIS FUNCTION — add frozen account check ────────────────
  // BASE44 EDITOR: Add the frozen check as the FIRST guard inside canRegister().
  // REASON: A participant with account_status === 'frozen' can currently register
  // for any event. The freeze has no effect on event registration.
  // Add this check BEFORE all other guards so frozen users are blocked immediately.
  //
  // OLD canRegister (missing frozen check):
  //   const canRegister = () => {
  //     if (!event) return false;
  //     ... capacity/deadline checks ...
  //     return true;
  //   };
  //
  // NEW canRegister (add frozen guard as first check — replace this entire function):
  const canRegister = () => {
    if (!event) return false;

    // [Fix 2.1] NEW: Block frozen accounts from registering
    // user comes from useAuth() or the local user state in this component
    if (user?.account_status === 'frozen') return false;

    const now = new Date();
    const eventStart = new Date(event.start_datetime);

    if (eventStart < now) return false;
    if (event.registration_deadline && new Date(event.registration_deadline) < now) return false;
    if (event.capacity && registrations.length >= event.capacity) return false;

    return true;
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────
  
  const canSeeEvent = () => {
    if (!event) return false;
    const isParticipant = !user?.user_type || user?.user_type === 'participant';
    if (isParticipant && event.event_privacy === 'staff-only') {
      return false;
    }
    return true;
  };

  const canCancel = () => {
    if (!event || !myRegistration) return false;
    const now = new Date();
    const eventStart = new Date(event.start_datetime);
    const hoursBeforeEvent = differenceInHours(eventStart, now);

    return hoursBeforeEvent >= (event.cancellation_hours_before || 0);
  };

  // ── [Fix 2.1] UNLOCK THIS FUNCTION — add frozen server-side guard ─────────────
  // BASE44 EDITOR: The canRegister() check above prevents the button from
  // appearing, but handleRegister should ALSO guard against frozen accounts
  // as a second line of defense (in case the button is triggered programmatically
  // or the UI state is stale).
  // ADD the frozen check as the first line inside the try block.
  //
  // OLD handleRegister (no frozen check):
  //   const handleRegister = async () => {
  //     setActionLoading(true);
  //     try {
  //       await base44.entities.EventRegistration.create({ ... });
  //
  // NEW handleRegister (add guard — REPLACE the try block opening):
  const handleRegister = async () => {
    setActionLoading(true);
    try {
      // [Fix 2.1] NEW: Defensive re-check — block frozen accounts
      if (user?.account_status === 'frozen') {
        toast.error('Your account is frozen. You cannot register for events.');
        setActionLoading(false);
        return;
      }
      await base44.entities.EventRegistration.create({
        event_id: eventId,
        participant_id: user.id,
        status: 'registered',
        registration_date: new Date().toISOString()
      });
      toast.success('Successfully registered for the event!');
      loadData();
    } catch (error) {
      toast.error('Failed to register. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelRegistration = async () => {
    setActionLoading(true);
    try {
      await base44.entities.EventRegistration.update(myRegistration.id, {
        status: 'cancelled',
        cancellation_date: new Date().toISOString()
      });
      toast.success('Registration cancelled successfully.');
      setShowCancelDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to cancel registration. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInstructorRegister = async () => {
    setActionLoading(true);
    try {
      // Find the first available instructor slot
      if (!event.lead_instructor_id) {
        await base44.entities.Event.update(eventId, { lead_instructor_id: user.id });
        toast.success('Registered as lead instructor');
      } else if (!event.assistant_instructor_id) {
        await base44.entities.Event.update(eventId, { assistant_instructor_id: user.id });
        toast.success('Registered as assistant instructor');
      } else if (!event.support_instructor_id) {
        await base44.entities.Event.update(eventId, { support_instructor_id: user.id });
        toast.success('Registered as support instructor');
      } else if (!event.instructor_4_id) {
        await base44.entities.Event.update(eventId, { instructor_4_id: user.id });
        toast.success('Registered as instructor #4');
      } else if (!event.instructor_5_id) {
        await base44.entities.Event.update(eventId, { instructor_5_id: user.id });
        toast.success('Registered as instructor #5');
      } else {
        toast.error('All instructor slots are full');
        setActionLoading(false);
        return;
      }
      loadData();
    } catch (error) {
      toast.error('Failed to register as instructor');
    } finally {
      setActionLoading(false);
    }
  };

  const isInstructorRegistered = () => {
    return event?.lead_instructor_id === user?.id ||
           event?.assistant_instructor_id === user?.id ||
           event?.support_instructor_id === user?.id ||
           event?.instructor_4_id === user?.id ||
           event?.instructor_5_id === user?.id;
  };

  const canInstructorRegister = () => {
    if (!event || isInstructorRegistered()) return false;
    const now = new Date();
    const eventStart = new Date(event.start_datetime);
    if (eventStart < now) return false;
    
    // Check if there's any available instructor slot
    return !event.lead_instructor_id || 
           !event.assistant_instructor_id || 
           !event.support_instructor_id || 
           !event.instructor_4_id || 
           !event.instructor_5_id;
  };

  const handleEditEvent = () => {
    setEditForm({
      category_id: event.category_id || '',
      description: event.description || '',
      start_datetime: event.start_datetime ? event.start_datetime.slice(0, 16) : '',
      end_datetime: event.end_datetime ? event.end_datetime.slice(0, 16) : '',
      location: event.location || '',
      capacity: event.capacity || '',
      registration_deadline: event.registration_deadline ? event.registration_deadline.slice(0, 16) : '',
      cancellation_hours_before: event.cancellation_hours_before || 24,
    });
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    setActionLoading(true);
    try {
      const selectedCat = categories.find(c => c.id === editForm.category_id);
      await base44.entities.Event.update(eventId, {
        ...editForm,
        title: selectedCat?.name || event.title,
        capacity: editForm.capacity ? parseInt(editForm.capacity) : null,
        cancellation_hours_before: parseInt(editForm.cancellation_hours_before),
      });
      toast.success('Event updated successfully');
      setShowEditDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to update event');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    setActionLoading(true);
    try {
      if (deleteScope === 'series') {
        // Find all future events in the series (same title + category + recurrence + created_by, on or after this event's date)
        const allEvents = await base44.entities.Event.filter({ status: 'active' });
        const thisStart = new Date(event.start_datetime);
        const seriesEvents = allEvents.filter(e =>
          e.title === event.title &&
          e.category_id === event.category_id &&
          e.recurrence_type === event.recurrence_type &&
          e.created_by === event.created_by &&
          new Date(e.start_datetime) >= thisStart
        );

        for (const ev of seriesEvents) {
          const regs = await base44.entities.EventRegistration.filter({ event_id: ev.id });
          for (const reg of regs) {
            await base44.entities.EventRegistration.update(reg.id, { status: 'cancelled' });
          }
          await base44.entities.Event.update(ev.id, { status: 'cancelled' });
        }
        toast.success(`${seriesEvents.length} event(s) in series deleted`);
      } else {
        // Cancel all registrations first
        const allRegs = await base44.entities.EventRegistration.filter({ event_id: eventId });
        for (const reg of allRegs) {
          await base44.entities.EventRegistration.update(reg.id, { status: 'cancelled' });
        }
        await base44.entities.Event.update(eventId, { status: 'cancelled' });
        toast.success('Event deleted and all registrations removed');
      }
      navigate(createPageUrl('Events'));
    } catch (error) {
      toast.error('Failed to delete event');
    } finally {
      setActionLoading(false);
      setShowDeleteDialog(false);
    }
  };

  const getParticipantName = (participantId) => {
    const p = participants.find((u) => u.id === participantId);
    return p?.full_name || 'Unknown';
  };

  const getParticipant = (participantId) => {
    return participants.find((u) => u.id === participantId);
  };

  const getParticipantPerformance = (participantId) => {
    return performanceRecords.filter((r) => r.participant_id === participantId);
  };

  const getParticipantMental = (participantId) => {
    return mentalRatings.find((r) => r.participant_id === participantId);
  };

  const hasBeenRated = (participantId) => {
    return mentalRatings.some((r) => r.participant_id === participantId);
  };

  const isAssignedInstructor = () => {
    const isAdmin = user?.user_type === 'admin';
    return event?.lead_instructor_id === user?.id ||
    event?.assistant_instructor_id === user?.id ||
    event?.support_instructor_id === user?.id ||
    isAdmin;
  };

  const getAttendanceStatus = (participantId) => {
    const record = attendanceRecords.find((r) => r.participant_id === participantId);
    return record?.status || null;
  };

  const getChanichnToran = () => {
    return registrations.find((r) => r.is_chanich_toran);
  };

  const handleToggleChanichToran = async (reg) => {
    if (!isAssignedInstructor()) return;

    const isCurrentlySelected = reg.is_chanich_toran;

    // Deselect previous if any
    const currentToran = getChanichnToran();
    if (currentToran && currentToran.id !== reg.id) {
      await base44.entities.EventRegistration.update(currentToran.id, { is_chanich_toran: false });
    }

    // Toggle current
    await base44.entities.EventRegistration.update(reg.id, {
      is_chanich_toran: !isCurrentlySelected
    });

    loadData();
  };

  const handleUploadMaterial = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMaterial(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      const materials = event.session_materials || [];
      materials.push({
        name: file.name,
        url: file_url,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString()
      });

      await base44.entities.Event.update(eventId, { session_materials: materials });
      toast.success('Material uploaded');
      loadData();
    } catch (error) {
      toast.error('Failed to upload material');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (index) => {
    if (!confirm('Delete this material?')) return;
    
    try {
      const materials = [...(event.session_materials || [])];
      materials.splice(index, 1);
      await base44.entities.Event.update(eventId, { session_materials: materials });
      toast.success('Material deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete material');
    }
  };

  // ── [Fix PROFILE-1] UNLOCK THIS FUNCTION — sync EventRegistration.status ────────
  // BASE44 EDITOR: Same fix as in SwipeAttendance.jsx. This is the attendance
  // marking handler used by AttendeeRatingPanel's mark-present/absent buttons.
  // It writes to AttendanceRecord but never updates EventRegistration.status,
  // making all statistics read 0 for attendance.
  //
  // ADD the EventRegistration.update call after the AttendanceRecord write.
  // STATUS MAPPING: 'present'/'late' → 'attended' | 'absent' → 'no_show'
  //
  // NEW handleMarkAttendance (REPLACE the entire function):
  const handleMarkAttendance = async (participantId, status) => {
    if (!isAssignedInstructor()) {
      toast.error('Only assigned instructors can mark attendance');
      return;
    }

    try {
      // Step 1: Write fine-grained AttendanceRecord
      const existing = attendanceRecords.find((r) => r.participant_id === participantId);
      if (existing) {
        await base44.entities.AttendanceRecord.update(existing.id, {
          status,
          marked_by: user.id,
          marked_at: new Date().toISOString()
        });
      } else {
        await base44.entities.AttendanceRecord.create({
          event_id: eventId,
          participant_id: participantId,
          status,
          marked_by: user.id,
          marked_at: new Date().toISOString()
        });
      }

      // ── [Fix PROFILE-1] NEW: Step 2 — sync EventRegistration.status ───────────
      // Statistics pages read EventRegistration.status, not AttendanceRecord.
      // This sync ensures both systems stay consistent.
      const regStatus = (status === 'present' || status === 'late') ? 'attended' : 'no_show';
      const reg = registrations.find(r => r.participant_id === participantId);
      if (reg) {
        await base44.entities.EventRegistration.update(reg.id, { status: regStatus });
      }
      // ── END FIX ──────────────────────────────────────────────────────────────────

      toast.success('Attendance marked');
      loadData();
    } catch (error) {
      toast.error('Failed to mark attendance');
    }
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────

  // [NEW FEATURE — IMPLEMENTED] Admin/instructor removes a participant from this session.
  // Sets registration to 'cancelled' (audit trail preserved) and notifies the participant.
  const handleAdminRemoveParticipant = async (participantId, participantName) => {
    if (!isAdmin && !isInstructor) {
      toast.error('Only admins and instructors can remove participants');
      return;
    }
    try {
      const reg = registrations.find(r => r.participant_id === participantId && r.status === 'registered');
      if (!reg) { toast.error('No active registration found'); return; }

      await base44.entities.EventRegistration.update(reg.id, {
        status: 'cancelled',
        cancellation_date: new Date().toISOString()
      });

      await base44.entities.UserNotification.create({
        user_id: participantId,
        title: 'Removed from event',
        message: `You have been removed from "${event?.title}" by an instructor.`,
        type: 'general',
        read: false,
      });

      toast.success(`${participantName || 'Participant'} removed from session`);
      loadData();
    } catch (error) {
      toast.error('Failed to remove participant');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  if (!event || !canSeeEvent()) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Event not found or you don't have permission to view it</p>
        <Link to={createPageUrl('Events')}>
          <Button className="mt-4">Back to Events</Button>
        </Link>
      </div>);

  }

  const isAdmin = user?.user_type === 'admin';
  const isInstructor = user?.user_type === 'instructor';
  const isPast = new Date(event.start_datetime) < new Date();
  const isFull = event.capacity && registrations.length >= event.capacity;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <Link to={createPageUrl('Events')}>
          <Button variant="ghost" className="text-slate-200 mb-4 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Events
          </Button>
        </Link>
        {isAdmin && (
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleEditEvent} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)} className="bg-white/10 border-red-400/50 text-red-300 hover:bg-red-900/30">
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur overflow-hidden">
            <div
              className="h-3"
              style={{ backgroundColor: category?.color || '#6366f1' }} />

            <CardHeader>
              <div className="flex flex-wrap gap-2 mb-2">
                {category &&
                <Badge
                  style={{ backgroundColor: `${category.color}20`, color: category.color }}>

                    {category.name}
                  </Badge>
                }
                {event.recurrence_type !== 'none' &&
                <Badge variant="outline">
                    <Repeat className="w-3 h-3 mr-1" />
                    {event.recurrence_type === 'weekly' ? 'Weekly' : 'Bi-weekly'}
                  </Badge>
                }
                {isPast && <Badge variant="secondary">Past Event</Badge>}
                {isFull && !isPast && <Badge variant="destructive">Full</Badge>}
              </div>
              <CardTitle className="text-3xl">{event.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {event.description &&
              <p className="text-gray-600 text-lg">{event.description}</p>
              }

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3 p-4 bg-indigo-50 rounded-xl">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-semibold">{format(new Date(event.start_datetime), 'EEEE, MMMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-xl">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-500">Time</p>
                    <p className="font-semibold">
                      {format(new Date(event.start_datetime), 'h:mm a')} - {format(new Date(event.end_datetime), 'h:mm a')}
                    </p>
                  </div>
                </div>
                {event.location &&
                <div className="flex items-center space-x-3 p-4 bg-pink-50 rounded-xl">
                    <MapPin className="w-6 h-6 text-pink-600" />
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-semibold">{event.location}</p>
                    </div>
                  </div>
                }
                {instructor &&
                <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-xl">
                    <User className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="text-sm text-gray-500">Instructor</p>
                      <p className="font-semibold">{instructor.full_name}</p>
                    </div>
                  </div>
                }
              </div>

              {/* Chanich Toran display for all users */}
              {(() => {
                const toranReg = registrations.find(r => r.is_chanich_toran);
                if (!toranReg) return null;
                const toranUser = participants.find(p => p.id === toranReg.participant_id);
                // If current user is the toran, show their own name
                const toranName = toranUser?.full_name || 
                  (toranReg.participant_id === user?.id ? user?.full_name : null);
                return (
                  <div className="p-4 bg-yellow-50 border-2 border-yellow-300 rounded-xl flex items-center gap-3">
                    <span className="text-2xl">⭐</span>
                    <div>
                      <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide">חניך תורן</p>
                      <p className="font-bold text-yellow-900">{toranName || 'Participant'}</p>
                    </div>
                  </div>
                );
              })()}

              {/* External Signup Link */}
              {event.external_signup_url && (
                <a
                  href={event.external_signup_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  <ExternalLink className="w-5 h-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-blue-800 text-sm">External Signup Form</p>
                    <p className="text-xs text-blue-600 truncate">{event.external_signup_url}</p>
                  </div>
                </a>
              )}

              {/* Registration Info */}
              <div className="p-4 bg-gray-50 rounded-xl space-y-2">
                {event.registration_deadline &&
                <div className="flex items-center text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                    Registration deadline: {format(new Date(event.registration_deadline), 'MMM d, yyyy h:mm a')}
                  </div>
                }
                {event.cancellation_hours_before &&
                <div className="flex items-center text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                    Cancellation allowed up to {event.cancellation_hours_before} hours before event
                  </div>
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Registration Card */}
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Registration</span>
                <div className="flex items-center text-lg">
                  <Users className="w-5 h-5 mr-2 text-indigo-600" />
                  {registrations.length}{event.capacity ? `/${event.capacity}` : ''}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Participant Registration */}
              {!isPast && (user?.user_type === 'participant' || (event.event_privacy === 'staff-only' && (user?.user_type === 'instructor' || user?.user_type === 'admin'))) &&
              <>
                  {myRegistration ?
                <div className="space-y-3">
                      <div className="flex items-center text-green-600 bg-green-50 p-3 rounded-lg">
                        <CheckCircle className="w-5 h-5 mr-2" />
                        <span className="font-medium">You're registered!</span>
                      </div>
                      {canCancel() ?
                  <Button
                    variant="outline"
                    className="w-full text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setShowCancelDialog(true)}
                    disabled={actionLoading}>

                          <XCircle className="w-4 h-4 mr-2" />
                          Cancel Registration
                        </Button> :

                  <p className="text-sm text-gray-500 text-center">
                          Cancellation deadline has passed
                        </p>
                  }
                    </div> :
                canRegister() ?
                <Button
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  onClick={handleRegister}
                  disabled={actionLoading}>
                  {actionLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Register Now
                </Button> :

                <div className="text-center text-gray-500">
                      {isFull ? 'Event is full' : 'Registration is closed'}
                    </div>
                }
                </>
              }

              {/* Instructor Staffing Tiers */}
              {(isInstructor || isAdmin) && (
                <StaffingTiers event={event} user={user} participants={participants} onUpdate={loadData} isPast={isPast} />
              )}

              {isPast &&
              <div className="text-center text-gray-500">
                  This event has already taken place
                </div>
              }
            </CardContent>
          </Card>

          {/* Session Materials */}
          {(isAdmin || isInstructor) && (
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Session Materials
                  </span>
                  {isAssignedInstructor() && (
                    <>
                      <input
                        id="upload-material"
                        type="file"
                        onChange={handleUploadMaterial}
                        className="hidden"
                        disabled={uploadingMaterial}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => document.getElementById('upload-material').click()}
                        disabled={uploadingMaterial}
                      >
                        {uploadingMaterial ? (
                          <>
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-1" />
                            Upload
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {event.session_materials && event.session_materials.length > 0 ? (
                  <div className="space-y-2">
                    {event.session_materials.map((material, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{material.name}</p>
                            <p className="text-xs text-gray-500">
                              {material.uploaded_at && format(new Date(material.uploaded_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <a href={material.url} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <Download className="w-4 h-4" />
                            </Button>
                          </a>
                          {isAssignedInstructor() && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteMaterial(index)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No materials uploaded yet</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Session Plan — staff only */}
          {(isAdmin || isInstructor) && (
            <EventSessionPlan event={event} user={user} onUpdate={loadData} />
          )}

          {/* Reminders — staff only */}
          {(isAdmin || isInstructor) && !isPast && (
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bell className="w-5 h-5 text-indigo-500" />
                  Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <EventRemindersPanel eventId={eventId} userId={user?.id} />
              </CardContent>
            </Card>
          )}

        </div>
      </div>

      {/* Mobile Swipe Attendance — full width, admin/instructor only */}
      {(isAdmin || isInstructor) && isAssignedInstructor() && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-indigo-600" />
              Take Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SwipeAttendance
              eventId={eventId}
              registrations={registrations}
              participants={participants}
              attendanceRecords={attendanceRecords}
              currentUserId={user?.id}
              onUpdate={loadData}
            />
          </CardContent>
        </Card>
      )}

      {/* Attendee Rating Panel — full width below both columns, admin/instructor only */}
      {(isAdmin || isInstructor) && (
        <AttendeeRatingPanel
          registrations={registrations}
          participants={participants}
          attendanceRecords={attendanceRecords}
          mentalRatings={mentalRatings}
          performanceRecords={performanceRecords}
          eventId={eventId}
          currentUserId={user?.id}
          isAssignedInstructor={isAssignedInstructor()}
          onMarkAttendance={handleMarkAttendance}
          onToggleChanichToran={handleToggleChanichToran}
          onRated={loadData}
        />
      )}

      {/* Registered Participants — participants see read-only list; staff see remove controls */}

      {/* Read-only view for non-staff */}
      {!(isAdmin || isInstructor) && registrations.length > 0 && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Registered Participants ({registrations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
              {registrations.map((reg) => {
                const p = participants.find(u => u.id === reg.participant_id);
                const name = p?.full_name || (reg.participant_id === user?.id ? user?.full_name : 'Participant');
                const isToran = reg.is_chanich_toran;
                const isMe = reg.participant_id === user?.id;
                return (
                  <div key={reg.id} className={`flex items-center gap-3 p-2 rounded-lg ${isToran ? 'bg-yellow-50 border border-yellow-300' : 'bg-gray-50'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${isToran ? 'bg-yellow-500' : 'bg-indigo-400'}`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-sm font-medium flex-1 ${isToran ? 'text-yellow-800 font-bold' : ''}`}>
                      {name}{isMe ? ' (You)' : ''}
                    </span>
                    {isToran && <Badge className="text-[10px] px-1.5 py-0 bg-yellow-400 text-yellow-900 border-yellow-500 font-bold">⭐ חניך תורן</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* [NEW FEATURE — IMPLEMENTED] Staff roster with per-row Remove controls */}
      {(isAdmin || isInstructor) && registrations.length > 0 && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Registered Participants ({registrations.length})
              <Badge className="ml-auto bg-indigo-100 text-indigo-700 text-xs">Staff View</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {registrations.map((reg) => {
                const p = participants.find(u => u.id === reg.participant_id);
                const name = p?.full_name || 'Participant';
                const isToran = reg.is_chanich_toran;
                return (
                  <div key={reg.id} className={`flex items-center gap-3 p-2.5 rounded-lg ${isToran ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${isToran ? 'bg-yellow-500' : 'bg-indigo-400'}`}>
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium flex-1 truncate">
                      {name}
                      {isToran && <span className="ml-1 text-yellow-700 text-xs font-bold">⭐ חניך תורן</span>}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-xs shrink-0"
                      onClick={() => handleAdminRemoveParticipant(reg.participant_id, name)}
                      disabled={isPast}
                      title={isPast ? 'Cannot remove from past events' : 'Remove from session'}
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>
            {isPast && (
              <p className="text-xs text-gray-400 mt-3 text-center">
                Event has passed — roster is read-only
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Registration?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your registration for "{event.title}"? 
              You can register again if spots are available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Registration</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelRegistration}
              className="bg-red-600 hover:bg-red-700">

              Yes, Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete "{event.title}" and cancel all associated registrations. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {event.recurrence_type && event.recurrence_type !== 'none' && (
            <div className="px-1 py-2 space-y-2">
              <p className="text-sm font-medium text-gray-700">What would you like to delete?</p>
              <div className="space-y-2">
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderColor: deleteScope === 'single' ? '#6366f1' : '#e5e7eb', backgroundColor: deleteScope === 'single' ? '#eef2ff' : '' }}>
                  <input
                    type="radio"
                    name="deleteScope"
                    value="single"
                    checked={deleteScope === 'single'}
                    onChange={() => setDeleteScope('single')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium">This event only</div>
                    <div className="text-xs text-gray-500">Only delete this single occurrence</div>
                  </div>
                </label>
                <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{ borderColor: deleteScope === 'series' ? '#dc2626' : '#e5e7eb', backgroundColor: deleteScope === 'series' ? '#fef2f2' : '' }}>
                  <input
                    type="radio"
                    name="deleteScope"
                    value="series"
                    checked={deleteScope === 'series'}
                    onChange={() => setDeleteScope('series')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-red-700">This and all following events</div>
                    <div className="text-xs text-gray-500">Delete this occurrence and all future ones in the series</div>
                  </div>
                </label>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteScope('single')}>Keep Event</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEvent}
              disabled={actionLoading}
              className="bg-red-600 hover:bg-red-700">
              {actionLoading ? 'Deleting...' : deleteScope === 'series' ? 'Delete Series' : 'Yes, Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Event Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Category (Event Title)</Label>
              <Select value={editForm.category_id} onValueChange={(v) => setEditForm({ ...editForm, category_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start *</Label>
                <Input
                  type="datetime-local"
                  value={editForm.start_datetime}
                  onChange={(e) => setEditForm({ ...editForm, start_datetime: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End *</Label>
                <Input
                  type="datetime-local"
                  value={editForm.end_datetime}
                  onChange={(e) => setEditForm({ ...editForm, end_datetime: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <LocationSelect
                value={editForm.location}
                onChange={(v) => setEditForm({ ...editForm, location: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Capacity</Label>
                <Input
                  type="number"
                  value={editForm.capacity}
                  onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cancel Policy (hours)</Label>
                <Input
                  type="number"
                  value={editForm.cancellation_hours_before}
                  onChange={(e) => setEditForm({ ...editForm, cancellation_hours_before: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Registration Deadline</Label>
              <Input
                type="datetime-local"
                value={editForm.registration_deadline}
                onChange={(e) => setEditForm({ ...editForm, registration_deadline: e.target.value })}
              />
            </div>
            <Button onClick={handleSaveEdit} disabled={actionLoading} className="w-full">
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);

}