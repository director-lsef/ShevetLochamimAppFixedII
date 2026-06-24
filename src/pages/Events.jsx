import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Calendar, ChevronLeft, ChevronRight, List, Grid3X3, CalendarDays,
  Clock, MapPin, Users, User, CheckCircle, Plus, Tag, Edit, Trash2 } from
'lucide-react';
import LocationSelect from '../components/events/LocationSelect';
import DenseMonthCalendar from '../components/events/DenseMonthCalendar';
import WeeklyCalendar from '../components/events/WeeklyCalendar';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  addWeeks, subWeeks, addDays, subDays, isToday, parseISO } from
'date-fns';

export default function Events() {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registeringEventId, setRegisteringEventId] = useState(null);

  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    branch: 'צוות מייקי',
    category_id: '',
    event_privacy: 'participants',
    lead_instructor_id: '',
    assistant_instructor_id: '',
    support_instructor_id: '',
    instructor_4_id: '',
    instructor_5_id: '',
    start_datetime: '',
    end_datetime: '',
    location: '',
    capacity: '',
    registration_deadline_hours: '',
    cancellation_hours_before: 24,
    recurrence_type: 'none',
    recurrence_end_date: '',
    external_signup_url: ''
  });

  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: '#6366f1',
    staff_only: false
  });

  const [viewMode, setViewMode] = useState('month'); // 'day', 'week', 'month'
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const [eventsData, categoriesData, regsData] = await Promise.all([
      base44.entities.Event.filter({ status: 'active' }, 'start_datetime'),
      base44.entities.EventCategory.list(),
      base44.entities.EventRegistration.filter({ status: 'registered' })]
      );

      setEvents(eventsData);
      setCategories(categoriesData);
      setRegistrations(regsData);

      // Only load users if admin/instructor (participants cannot list all users)
      if (userData.user_type === 'admin' || userData.user_type === 'instructor') {
        try {
          const usersData = await base44.entities.User.list();
          setInstructors(usersData.filter((u) => u.user_type === 'instructor' || u.user_type === 'admin'));
        } catch {
          // silently fail — instructors list is non-critical
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── [Fix 2.1 + Fix 3.2-toast] UNLOCK THIS FUNCTION ─────────────────────────
  // BASE44 EDITOR: Two changes needed here:
  //   1. Add frozen account guard (Fix 2.1)
  //   2. Add toast.success on success + toast.error on failure (was missing)
  //
  // OLD handleRegister (no frozen check, no user feedback):
  //   try {
  //     await EventRegistration.create({ ... });
  //     loadData();      ← silent success, no toast
  //   } catch (error) {
  //     console.error(...)  ← silent failure, no toast
  //   }
  //
  // NEW handleRegister (replace entire function):
  const handleRegister = async (event, e) => {
    e.preventDefault();
    e.stopPropagation();

    // [Fix 2.1] NEW: Block frozen accounts
    if (user?.account_status === 'frozen') {
      toast.error('Your account is frozen and cannot register for events.');
      return;
    }

    setRegisteringEventId(event.id);
    try {
      await base44.entities.EventRegistration.create({
        event_id: event.id,
        participant_id: user.id,
        status: 'registered',
        registration_date: new Date().toISOString()
      });
      toast.success('Registered!'); // [Fix] NEW: was silent
      loadData();
    } catch (error) {
      console.error('Failed to register:', error);
      toast.error('Registration failed. Please try again.'); // [Fix] NEW: was silent
    } finally {
      setRegisteringEventId(null);
    }
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────

  const handleInstructorRegister = async (event, e) => {
    e.preventDefault();
    e.stopPropagation();

    setRegisteringEventId(event.id);
    try {
      // Find the first available instructor slot
      if (!event.lead_instructor_id) {
        await base44.entities.Event.update(event.id, { lead_instructor_id: user.id });
        toast.success('Registered as lead instructor');
      } else if (!event.assistant_instructor_id) {
        await base44.entities.Event.update(event.id, { assistant_instructor_id: user.id });
        toast.success('Registered as assistant instructor');
      } else if (!event.support_instructor_id) {
        await base44.entities.Event.update(event.id, { support_instructor_id: user.id });
        toast.success('Registered as support instructor');
      } else if (!event.instructor_4_id) {
        await base44.entities.Event.update(event.id, { instructor_4_id: user.id });
        toast.success('Registered as instructor #4');
      } else if (!event.instructor_5_id) {
        await base44.entities.Event.update(event.id, { instructor_5_id: user.id });
        toast.success('Registered as instructor #5');
      } else {
        toast.error('All instructor slots are full');
        setRegisteringEventId(null);
        return;
      }
      loadData();
    } catch (error) {
      toast.error('Failed to register');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const handleInstructorCancel = async (event, e) => {
    e.preventDefault();
    e.stopPropagation();

    setRegisteringEventId(event.id);
    try {
      const updateData = {};

      // Find which slot the instructor is in and clear it
      if (event.lead_instructor_id === user.id) {
        updateData.lead_instructor_id = null;
      } else if (event.assistant_instructor_id === user.id) {
        updateData.assistant_instructor_id = null;
      } else if (event.support_instructor_id === user.id) {
        updateData.support_instructor_id = null;
      } else if (event.instructor_4_id === user.id) {
        updateData.instructor_4_id = null;
      } else if (event.instructor_5_id === user.id) {
        updateData.instructor_5_id = null;
      }

      await base44.entities.Event.update(event.id, updateData);
      toast.success('Registration cancelled');
      loadData();
    } catch (error) {
      toast.error('Failed to cancel registration');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const isInstructorRegistered = (event) => {
    return event.lead_instructor_id === user?.id ||
    event.assistant_instructor_id === user?.id ||
    event.support_instructor_id === user?.id ||
    event.instructor_4_id === user?.id ||
    event.instructor_5_id === user?.id;
  };

  const canInstructorRegister = (event) => {
    if (isInstructorRegistered(event)) return false;
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

  const isRegistered = (eventId) => {
    return registrations.some((r) => r.event_id === eventId && r.participant_id === user?.id && r.status === 'registered');
  };

  // ── [Fix 2.1] UNLOCK THIS FUNCTION — add frozen account check ────────────────
  // BASE44 EDITOR: Add the frozen guard as the SECOND check in canRegister()
  // (after the isRegistered check, before the date checks).
  // This mirrors the same fix in EventDetails.jsx.
  //
  // OLD canRegister (missing frozen check):
  //   const canRegister = (event) => {
  //     if (isRegistered(event.id)) return false;
  //     ... date/deadline checks ...
  //     return true;
  //   };
  //
  // NEW canRegister (replace entire function):
  const canRegister = (event) => {
    if (isRegistered(event.id)) return false;

    // [Fix 2.1] NEW: Block frozen accounts from registering
    if (user?.account_status === 'frozen') return false;

    const now = new Date();
    const eventStart = new Date(event.start_datetime);

    if (eventStart < now) return false;
    if (event.registration_deadline && new Date(event.registration_deadline) < now) return false;

    return true;
  };
  // ── END UNLOCK ─────────────────────────────────────────────────────────────

  const getCategory = (categoryId) => categories.find((c) => c.id === categoryId);
  const getInstructor = (instructorId) => instructors.find((i) => i.id === instructorId);
  const getRegistrationCount = (eventId) => registrations.filter((r) => r.event_id === eventId).length;

  const isAdmin = user?.user_type === 'admin';
  const isInstructor = user?.user_type === 'instructor';
  const canCreateEvent = isAdmin || isInstructor;

  const BRANCH_COLORS = {
    'צוות מייקי': '#1d4ed8',   // blue
    'צוות לוחמים': '#15803d',  // green
  };

  const getBranchColor = (event) => {
    if (event.branch && BRANCH_COLORS[event.branch]) return BRANCH_COLORS[event.branch];
    return null; // fall back to category color
  };

  const resetEventForm = () => {
    setEventForm({
      title: '',
      description: '',
      branch: 'צוות מייקי',
      category_id: '',
      event_privacy: 'participants',
      lead_instructor_id: '',
      assistant_instructor_id: '',
      support_instructor_id: '',
      instructor_4_id: '',
      instructor_5_id: '',
      start_datetime: '',
      end_datetime: '',
      location: '',
      capacity: '',
      registration_deadline_hours: '',
      cancellation_hours_before: 24,
      recurrence_type: 'none',
      recurrence_end_date: '',
      external_signup_url: ''
    });
    setEditingEvent(null);
  };

  const createRecurringEvents = async (baseEvent) => {
    if (baseEvent.recurrence_type === 'none' || !baseEvent.recurrence_end_date) {
      return [baseEvent];
    }

    const events = [];
    let currentDate = new Date(baseEvent.start_datetime);
    const endDate = new Date(baseEvent.recurrence_end_date);
    const interval = baseEvent.recurrence_type === 'weekly' ? 1 : 2;

    while (currentDate <= endDate) {
      const duration = new Date(baseEvent.end_datetime) - new Date(baseEvent.start_datetime);
      const eventEndDate = new Date(currentDate.getTime() + duration);

      events.push({
        ...baseEvent,
        start_datetime: currentDate.toISOString(),
        end_datetime: eventEndDate.toISOString(),
        registration_deadline: baseEvent.registration_deadline ?
        new Date(new Date(baseEvent.registration_deadline).getTime() + (currentDate - new Date(baseEvent.start_datetime))).toISOString() :
        null
      });

      currentDate = addWeeks(currentDate, interval);
    }

    return events;
  };

  const handleSaveEvent = async () => {
    try {
      // Set title from category name
      const selectedCategory = categories.find((c) => c.id === eventForm.category_id);

      // Compute registration_deadline from hours before start
      let registration_deadline = null;
      if (eventForm.registration_deadline_hours && eventForm.start_datetime) {
        const startMs = new Date(eventForm.start_datetime).getTime();
        const hoursMs = parseFloat(eventForm.registration_deadline_hours) * 60 * 60 * 1000;
        registration_deadline = new Date(startMs - hoursMs).toISOString();
      }

      const { registration_deadline_hours, ...restForm } = eventForm;
      const eventData = {
        ...restForm,
        title: selectedCategory?.name || 'Event',
        capacity: eventForm.capacity ? parseInt(eventForm.capacity) : null,
        cancellation_hours_before: parseInt(eventForm.cancellation_hours_before),
        registration_deadline,
        status: 'active'
      };

      if (editingEvent) {
        await base44.entities.Event.update(editingEvent.id, eventData);
        toast.success('Event updated');
        setShowEventDialog(false);
        resetEventForm();
        loadData();
      } else {
        const eventsToCreate = await createRecurringEvents(eventData);
        const created = [];
        for (const ev of eventsToCreate) {
          const saved = await base44.entities.Event.create(ev);
          created.push(saved);
        }
        // Optimistic update: add new events immediately to state
        setEvents(prev => [...prev, ...created]);
        toast.success(`${created.length} event(s) created`);
        setShowEventDialog(false);
        resetEventForm();
      }
    } catch (error) {
      toast.error('Failed to save event');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!isAdmin) {
      toast.error('Only administrators can delete events');
      return;
    }
    if (confirm('Delete this event?')) {
      try {
        await base44.entities.Event.update(eventId, { status: 'cancelled' });
        toast.success('Event deleted');
        loadData();
      } catch (error) {
        toast.error('Failed to delete event');
      }
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setEventForm({
      title: event.title || '',
      description: event.description || '',
      branch: event.branch || 'צוות מייקי',
      category_id: event.category_id || '',
      event_privacy: event.event_privacy || 'participants',
      lead_instructor_id: event.lead_instructor_id || '',
      assistant_instructor_id: event.assistant_instructor_id || '',
      support_instructor_id: event.support_instructor_id || '',
      instructor_4_id: event.instructor_4_id || '',
      instructor_5_id: event.instructor_5_id || '',
      start_datetime: event.start_datetime ? event.start_datetime.slice(0, 16) : '',
      end_datetime: event.end_datetime ? event.end_datetime.slice(0, 16) : '',
      location: event.location || '',
      capacity: event.capacity || '',
      registration_deadline_hours: '',
      cancellation_hours_before: event.cancellation_hours_before || 24,
      recurrence_type: event.recurrence_type || 'none',
      recurrence_end_date: event.recurrence_end_date || ''
    });
    setShowEventDialog(true);
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: '', color: '#6366f1', staff_only: false });
    setEditingCategory(null);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) { toast.error('Category name is required'); return; }
    try {
      // Only update if editingCategory exists AND its id is in our current categories list
      const isValidEdit = editingCategory && categories.some(c => c.id === editingCategory.id);
      if (isValidEdit) {
        await base44.entities.EventCategory.update(editingCategory.id, categoryForm);
        toast.success('Category updated');
      } else {
        await base44.entities.EventCategory.create(categoryForm);
        toast.success('Category created');
      }
      resetCategoryForm();
      loadData();
    } catch (error) {
      toast.error('Failed to save category');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (confirm('Delete this category?')) {
      try {
        await base44.entities.EventCategory.delete(catId);
        toast.success('Category deleted');
        loadData();
      } catch (error) {
        toast.error('Failed to delete category');
      }
    }
  };

  const isParticipant = !user?.user_type || user?.user_type === 'participant';

  const visibleCategories = categories.filter((cat) => {
    if (isParticipant && cat.staff_only) return false;
    return true;
  });

  const filteredEvents = events.filter((event) => {
    // Filter by category
    const categoryMatch = selectedCategory === 'all' || event.category_id === selectedCategory;

    // Filter by branch
    const branchMatch = selectedBranch === 'all' || (event.branch || 'צוות מייקי') === selectedBranch;

    // Filter by privacy: hide staff-only events from participants
    const privacyMatch = !isParticipant || event.event_privacy !== 'staff-only';

    // Filter by category visibility: hide events with staff-only categories
    const category = getCategory(event.category_id);
    const categoryVisibility = !isParticipant || !category?.staff_only;

    return categoryMatch && branchMatch && privacyMatch && categoryVisibility;
  });

  const getEventsForDay = (day) => {
    return filteredEvents.filter((event) => {
      try {
        const eventDate = new Date(event.start_datetime);
        return isSameDay(eventDate, day);
      } catch {
        return false;
      }
    });
  };

  const navigatePrevious = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));else
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));else
    setCurrentDate(subDays(currentDate, 1));
  };

  const navigateNext = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));else
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));else
    setCurrentDate(addDays(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const handleDateClick = (date) => {
    if (isParticipant) return;

    const dateStr = format(date, "yyyy-MM-dd'T'09:00");
    const endDateStr = format(date, "yyyy-MM-dd'T'10:00");

    setEventForm(prev => ({
      ...prev,
      start_datetime: dateStr,
      end_datetime: endDateStr
    }));
    setEditingEvent(null);
    setShowEventDialog(true);
  };

  const getDateRangeLabel = () => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      const end = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    }
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  // Generate calendar days
  const getCalendarDays = () => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      return [currentDate];
    }
  };

  const getLeadName = (event) => {
    if (!event.lead_instructor_id) return null;
    const inst = instructors.find(i => i.id === event.lead_instructor_id);
    return inst?.full_name?.split(' ')[0] || null; // first name only
  };

  const getSupportSlots = (event) => {
    const slots = [event.assistant_instructor_id, event.support_instructor_id, event.instructor_4_id, event.instructor_5_id];
    return slots.map(id => !!id);
  };

  const EventCard = ({ event, compact = false }) => {
    const category = getCategory(event.category_id);
    const regCount = getRegistrationCount(event.id);
    const isFull = event.capacity && regCount >= event.capacity;
    const isStaff = user?.user_type === 'instructor' || user?.user_type === 'admin';
    const leadName = isStaff ? getLeadName(event) : null;
    const supportSlots = isStaff ? getSupportSlots(event) : [];
    const branchColor = getBranchColor(event);
    const tileColor = branchColor || category?.color || '#6366f1';
    const eventBranch = event.branch || 'צוות מייקי';

    if (compact) {
      const isParticipant = !user?.user_type || user?.user_type === 'participant';
      const isInstructor = user?.user_type === 'instructor';
      const userRegistered = isRegistered(event.id);
      const canReg = canRegister(event);
      const instructorReg = isInstructorRegistered(event);
      const canInstReg = canInstructorRegister(event);

      return (
        <div className="mb-1">
            <Link to={createPageUrl(`EventDetails?id=${event.id}`)}>
              <div
              className="text-xs p-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity"
              style={{ backgroundColor: tileColor, color: 'white' }}>
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate">{format(new Date(event.start_datetime), 'h:mm')} {event.title}</span>
                  {userRegistered && <span>✓</span>}
                  {instructorReg && <span>✓</span>}
                </div>
                <div className="text-[9px] opacity-80 font-medium mt-0.5 truncate">{eventBranch}</div>
                <div className="text-[9px] opacity-80 mt-0.5">👥 {regCount}{event.capacity ? `/${event.capacity}` : ''}</div>
                {isStaff && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[9px] opacity-90 font-semibold truncate">
                      {leadName ? `👑 ${leadName}` : '👑 OPEN'}
                    </span>
                    <div className="flex gap-0.5 ml-auto shrink-0">
                      {supportSlots.slice(0, 3).map((filled, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${filled ? 'bg-white' : 'bg-white/30'}`} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Link>
            {isParticipant && !userRegistered && canReg &&
          <Button
            onClick={(e) => handleRegister(event, e)}
            disabled={registeringEventId === event.id}
            className="w-full h-5 text-[9px] px-1 py-0 mt-0.5"
            size="sm">
                {registeringEventId === event.id ? '...' : 'Register'}
              </Button>
          }
            {isInstructor && !instructorReg && canInstReg &&
          <Button
            onClick={(e) => handleInstructorRegister(event, e)}
            disabled={registeringEventId === event.id}
            className="w-full h-5 text-[9px] px-1 py-0 mt-0.5 bg-blue-600"
            size="sm">
                {registeringEventId === event.id ? '...' : 'Claim Slot'}
              </Button>
          }
            {isInstructor && instructorReg &&
          <Button
            onClick={(e) => handleInstructorCancel(event, e)}
            disabled={registeringEventId === event.id}
            variant="outline"
            className="w-full h-5 text-[9px] px-1 py-0 mt-0.5 border-red-200 text-red-600 hover:bg-red-50"
            size="sm">
                {registeringEventId === event.id ? '...' : 'Unregister'}
              </Button>
          }
          </div>);

    }

    const isParticipant = !user?.user_type || user?.user_type === 'participant';
    const isInstructor = user?.user_type === 'instructor';
    const userRegistered = isRegistered(event.id);
    const instructorReg = isInstructorRegistered(event);
    const canInstReg = canInstructorRegister(event);

    return (
      <Card className="border-none shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 bg-white/90 backdrop-blur overflow-hidden">
          <div className="h-1.5" style={{ backgroundColor: tileColor }} />
          <CardContent className="p-4">
            <Link to={createPageUrl(`EventDetails?id=${event.id}`)}>
              <div className="flex items-start gap-3">
                <div
                className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-white shrink-0"
                style={{ backgroundColor: tileColor }}>

                  <span className="text-xs font-medium">{format(new Date(event.start_datetime), 'MMM')}</span>
                  <span className="text-lg font-bold leading-none">{format(new Date(event.start_datetime), 'd')}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                      className="text-xs text-white"
                      style={{ backgroundColor: tileColor }}>
                      {eventBranch}
                    </Badge>
                    {category &&
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${category.color}20`, color: category.color }}>

                        {category.name}
                      </Badge>
                  }
                    {isFull && <Badge variant="destructive" className="text-xs">Full</Badge>}
                    {userRegistered &&
                  <Badge className="text-xs bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Registered
                      </Badge>
                  }
                    {instructorReg &&
                  <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Leading
                      </Badge>
                  }
                  </div>
                  <h3 className="font-bold text-gray-900 mb-1 truncate">{event.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {format(new Date(event.start_datetime), 'h:mm a')}
                    </span>
                    {event.location &&
                  <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span className="truncate max-w-[100px]">{event.location}</span>
                      </span>
                  }
                    <span className="flex items-center">
                      <Users className="w-3 h-3 mr-1" />
                      {regCount}{event.capacity ? `/${event.capacity}` : ''}
                    </span>
                  </div>
                  {isStaff && (
                    <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gray-100">
                      <span className="text-xs font-semibold text-gray-700">
                        👑 {leadName || <span className="text-red-500">OPEN</span>}
                      </span>
                      <div className="flex gap-1 ml-auto">
                        {supportSlots.map((filled, i) => (
                          <div key={i} title={filled ? 'Filled' : 'Open'} className={`w-2 h-2 rounded-full border ${filled ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'}`} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
            {isParticipant && !userRegistered && canRegister(event) &&
          <Button
            onClick={(e) => handleRegister(event, e)}
            disabled={registeringEventId === event.id}
            className="w-full mt-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            size="sm">

                {registeringEventId === event.id ?
            <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Registering...
                  </> :

            <>
                    <CheckCircle className="w-3 h-3 mr-2" />
                    Register Now
                  </>
            }
              </Button>
          }
            {isInstructor && !instructorReg && canInstReg &&
          <Button
            onClick={(e) => handleInstructorRegister(event, e)}
            disabled={registeringEventId === event.id}
            className="w-full mt-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            size="sm">

                {registeringEventId === event.id ?
            <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                    Registering...
                  </> :

            <>
                    <CheckCircle className="w-3 h-3 mr-2" />
                    Register to Lead
                  </>
            }
              </Button>
          }
            {isInstructor && instructorReg &&
          <Button
            onClick={(e) => handleInstructorCancel(event, e)}
            disabled={registeringEventId === event.id}
            variant="outline"
            className="w-full mt-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            size="sm">

                {registeringEventId === event.id ?
            <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-2"></div>
                    Cancelling...
                  </> :

            <>
                    <Trash2 className="w-3 h-3 mr-2" />
                    Cancel Registration
                  </>
            }
              </Button>
          }
          </CardContent>
        </Card>);

  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  const calendarDays = getCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header Controls */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Navigation */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="icon" onClick={navigatePrevious}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext}>
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button variant="outline" onClick={goToToday} className="ml-2">
                Today
              </Button>
              <h2 className="text-xl font-bold text-gray-900 ml-4">{getDateRangeLabel()}</h2>
            </div>

            {/* View Mode & Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {canCreateEvent &&
              <>
                  <Dialog open={showCategoryDialog} onOpenChange={(open) => {
                    setShowCategoryDialog(open);
                    if (!open) resetCategoryForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Tag className="w-4 h-4 mr-1" />
                        Categories
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Manage Categories</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-700">
                            {editingCategory ? `Editing: ${editingCategory.name}` : 'New Category'}
                          </p>
                          {editingCategory && (
                            <Button variant="outline" size="sm" onClick={resetCategoryForm}>
                              + New Category
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                          value={categoryForm.name}
                          onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                          placeholder="e.g. אימון גופני" />

                          </div>
                          <div className="space-y-2">
                            <Label>Color</Label>
                            <div className="flex gap-2">
                              <Input
                            type="color"
                            value={categoryForm.color}
                            onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                            className="w-16 h-10" />

                              <Input
                            value={categoryForm.color}
                            onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                            className="flex-1" />

                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                          type="checkbox"
                          id="staff_only"
                          checked={categoryForm.staff_only || false}
                          onChange={(e) => setCategoryForm({ ...categoryForm, staff_only: e.target.checked })}
                          className="w-4 h-4" />

                            <Label htmlFor="staff_only" className="cursor-pointer">Staff Only (Instructors/Admins only)</Label>
                          </div>
                        <Button onClick={handleSaveCategory} className="w-full">
                          {editingCategory && categories.some(c => c.id === editingCategory.id) ? 'Update' : 'Add'} Category
                        </Button>
                        <div className="border-t pt-4">
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {categories.map((cat) =>
                          <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                                <div className="flex items-center gap-2">
                                  <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color }} />
                                  <span>{cat.name}</span>
                                  {cat.staff_only &&
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">Staff Only</Badge>
                              }
                                </div>
                                <div className="flex gap-1">
                                  <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => {
                                  setEditingCategory(cat);
                                  setCategoryForm({ name: cat.name, description: cat.description || '', color: cat.color, staff_only: cat.staff_only || false });
                                }}>

                                    <Edit className="w-3 h-3" />
                                  </Button>
                                  <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-red-600"
                                onClick={() => handleDeleteCategory(cat.id)}>

                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                          )}
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={showEventDialog} onOpenChange={(open) => {
                  setShowEventDialog(open);
                  if (!open) resetEventForm();
                }}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="bg-gradient-to-r from-indigo-600 to-purple-600">
                        <Plus className="w-4 h-4 mr-1" />
                        Create Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{editingEvent ? 'Edit Event' : 'Create Event'}</DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 space-y-2">
                            <Label>Category (Event Title) *</Label>
                            <div className="flex gap-2">
                              <Select value={eventForm.category_id} onValueChange={(v) => setEventForm({ ...eventForm, category_id: v })}>
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                                <SelectContent>
                                  {categories.map((cat) =>
                                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                )}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="shrink-0"
                                onClick={async () => {
                                  const name = window.prompt('New category name:');
                                  if (!name?.trim()) return;
                                  const newCat = await base44.entities.EventCategory.create({ name: name.trim(), color: '#6366f1', staff_only: false });
                                  await loadData();
                                  setEventForm(f => ({ ...f, category_id: newCat.id }));
                                  toast.success('Category created');
                                }}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label>Branch *</Label>
                            <Select value={eventForm.branch} onValueChange={(v) => setEventForm({ ...eventForm, branch: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="צוות מייקי">צוות מייקי</SelectItem>
                                <SelectItem value="צוות לוחמים">צוות לוחמים</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-2">
                             <Label>Description</Label>
                             <Textarea
                             value={eventForm.description}
                             onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                             rows={3} />

                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label>Event Privacy</Label>
                            <Select value={eventForm.event_privacy} onValueChange={(v) => setEventForm({ ...eventForm, event_privacy: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="participants">Participants (Visible to all)</SelectItem>
                                <SelectItem value="staff-only">Staff-Only (Instructors/Admins only)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2 space-y-2">
                            <Label>Lead Instructor (#1)</Label>
                            <Select value={eventForm.lead_instructor_id} onValueChange={(v) => setEventForm({ ...eventForm, lead_instructor_id: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select lead instructor" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {instructors.map((inst) =>
                              <SelectItem key={inst.id} value={inst.id}>{inst.full_name}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Instructor #2</Label>
                            <Select value={eventForm.assistant_instructor_id} onValueChange={(v) => setEventForm({ ...eventForm, assistant_instructor_id: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {instructors.map((inst) =>
                              <SelectItem key={inst.id} value={inst.id}>{inst.full_name}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Instructor #3</Label>
                            <Select value={eventForm.support_instructor_id} onValueChange={(v) => setEventForm({ ...eventForm, support_instructor_id: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {instructors.map((inst) =>
                              <SelectItem key={inst.id} value={inst.id}>{inst.full_name}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Instructor #4</Label>
                            <Select value={eventForm.instructor_4_id} onValueChange={(v) => setEventForm({ ...eventForm, instructor_4_id: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {instructors.map((inst) =>
                              <SelectItem key={inst.id} value={inst.id}>{inst.full_name}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Instructor #5</Label>
                            <Select value={eventForm.instructor_5_id} onValueChange={(v) => setEventForm({ ...eventForm, instructor_5_id: v })}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={null}>None</SelectItem>
                                {instructors.map((inst) =>
                              <SelectItem key={inst.id} value={inst.id}>{inst.full_name}</SelectItem>
                              )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Start *</Label>
                            <Input
                            type="datetime-local"
                            value={eventForm.start_datetime}
                            onChange={(e) => setEventForm({ ...eventForm, start_datetime: e.target.value })} />

                          </div>
                          <div className="space-y-2">
                            <Label>End *</Label>
                            <Input
                            type="datetime-local"
                            value={eventForm.end_datetime}
                            onChange={(e) => setEventForm({ ...eventForm, end_datetime: e.target.value })} />

                          </div>
                          <div className="col-span-2 space-y-2">
                              <Label>Location</Label>
                              <LocationSelect
                                value={eventForm.location}
                                onChange={(v) => setEventForm({ ...eventForm, location: v })}
                              />
                            </div>
                          <div className="space-y-2">
                            <Label>Capacity</Label>
                            <Input
                            type="number"
                            value={eventForm.capacity}
                            onChange={(e) => setEventForm({ ...eventForm, capacity: e.target.value })} />

                          </div>
                          <div className="space-y-2">
                            <Label>Registration Deadline (hours before event)</Label>
                            <Input
                            type="number"
                            min="0"
                            step="0.5"
                            value={eventForm.registration_deadline_hours}
                            onChange={(e) => setEventForm({ ...eventForm, registration_deadline_hours: e.target.value })}
                            placeholder="e.g. 24" />
                          </div>
                          <div className="space-y-2">
                            <Label>Cancellation Policy (hours before)</Label>
                            <Input
                            type="number"
                            value={eventForm.cancellation_hours_before}
                            onChange={(e) => setEventForm({ ...eventForm, cancellation_hours_before: e.target.value })}
                            placeholder="24" />

                          </div>
                          <div className="space-y-2">
                            <Label>Recurrence</Label>
                            <Select value={eventForm.recurrence_type} onValueChange={(v) => setEventForm({ ...eventForm, recurrence_type: v })}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No repeat</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {eventForm.recurrence_type !== 'none' &&
                        <div className="space-y-2">
                              <Label>Repeat Until</Label>
                              <Input
                            type="date"
                            value={eventForm.recurrence_end_date}
                            onChange={(e) => setEventForm({ ...eventForm, recurrence_end_date: e.target.value })} />
                            </div>
                        }
                          <div className="col-span-2 space-y-2">
                            <Label>External Signup URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                            <Input
                              type="url"
                              placeholder="https://forms.monday.com/... or https://forms.gle/..."
                              value={eventForm.external_signup_url}
                              onChange={(e) => setEventForm({ ...eventForm, external_signup_url: e.target.value })}
                            />
                            <p className="text-xs text-gray-400">Link to a Monday.com or Google Form for external registrations</p>
                          </div>
                        </div>
                        <Button onClick={handleSaveEvent}>
                          {editingEvent ? 'Update' : 'Create'} Event
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              }
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Filter by Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  <SelectItem value="צוות מייקי">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#1d4ed8' }} />
                      צוות מייקי
                    </div>
                  </SelectItem>
                  <SelectItem value="צוות לוחמים">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#15803d' }} />
                      צוות לוחמים
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {visibleCategories.map((cat) =>
                  <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center">
                        <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <div className="flex bg-gray-100 rounded-lg p-1">
                <Button
                  variant={viewMode === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                  className={viewMode === 'day' ? 'bg-white shadow-sm' : ''}>

                  <List className="w-4 h-4 mr-1" />
                  Day
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  className={viewMode === 'week' ? 'bg-white shadow-sm' : ''}>

                  <CalendarDays className="w-4 h-4 mr-1" />
                  Week
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('month')} className="bg-white text-slate-900 px-3 text-xs font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-primary/90 h-8 shadow-sm">


                  <Grid3X3 className="w-4 h-4 mr-1" />
                  Month
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar View */}
      {viewMode === 'month' &&
        <DenseMonthCalendar
          calendarDays={calendarDays}
          currentDate={currentDate}
          filteredEvents={filteredEvents}
          categories={categories}
          registrations={registrations}
          userId={user?.id}
          isStaff={!isParticipant}
          instructors={instructors}
          isAdmin={isAdmin}
          canCreateEvent={canCreateEvent}
          onCreateEvent={handleDateClick}
          handleDateClick={handleDateClick}
          handleRegister={handleRegister}
          handleInstructorRegister={handleInstructorRegister}
          handleInstructorCancel={handleInstructorCancel}
          registeringEventId={registeringEventId}
          isRegistered={isRegistered}
          isInstructorRegistered={isInstructorRegistered}
          canRegister={canRegister}
          canInstructorRegister={canInstructorRegister}
        />
      }

      {/* Week View */}
      {viewMode === 'week' &&
        <WeeklyCalendar
          calendarDays={calendarDays}
          filteredEvents={filteredEvents}
          categories={categories}
          registrations={registrations}
          userId={user?.id}
          isStaff={!isParticipant}
          instructors={instructors}
          isAdmin={isAdmin}
          canCreateEvent={canCreateEvent}
          onCreateEvent={handleDateClick}
          handleRegister={handleRegister}
          handleInstructorRegister={handleInstructorRegister}
          handleInstructorCancel={handleInstructorCancel}
          registeringEventId={registeringEventId}
          isRegistered={isRegistered}
          isInstructorRegistered={isInstructorRegistered}
          canRegister={canRegister}
          canInstructorRegister={canInstructorRegister}
          getBranchColor={getBranchColor}
          getCategory={getCategory}
          getRegistrationCount={getRegistrationCount}
          getLeadName={getLeadName}
          getSupportSlots={getSupportSlots}
          createPageUrl={createPageUrl}
        />
      }

                          {/* Day View */}
      {viewMode === 'day' &&
      <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div
            className={`text-center p-4 rounded-xl ${isToday(currentDate) ? 'bg-indigo-600 text-white' : 'bg-white shadow-lg'} ${canCreateEvent ? 'cursor-pointer hover:ring-2 hover:ring-blue-300' : ''}`}
            onClick={() => canCreateEvent && handleDateClick(currentDate)}>

              <div className="text-sm">{format(currentDate, 'EEEE')}</div>
              <div className="text-3xl font-bold">{format(currentDate, 'd')}</div>
              <div className="text-sm">{format(currentDate, 'MMMM yyyy')}</div>
            </div>
          </div>

          {getEventsForDay(currentDate).length === 0 ?
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No events scheduled for this day</p>
              </CardContent>
            </Card> :

        <div className="grid gap-4">
              {getEventsForDay(currentDate).
          sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)).
          map((event) =>
          <EventCard key={event.id} event={event} />
          )
          }
            </div>
        }
        </div>
      }

      {/* Legend */}
      







    </div>);

}