import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { format, isSameMonth, isSameDay, isToday } from 'date-fns';
import { ChevronRight, ChevronLeft, CheckCircle, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BRANCH_COLORS = {
  'צוות מייקי': '#1565c0',
  'צוות לוחמים': '#2e7d32',
};

const MAX_PILLS = 3; // pills visible before "+X more"

function getBranchColor(event) {
  return BRANCH_COLORS[event.branch] || null;
}

function EventPill({ event, categories, registrations, userId, isStaff, instructors }) {
  const category = categories.find(c => c.id === event.category_id);
  const branchColor = getBranchColor(event);
  const bg = branchColor || category?.color || '#6366f1';

  const isRegistered = registrations.some(
    r => r.event_id === event.id && r.participant_id === userId && r.status === 'registered'
  );
  const isLeading = isStaff && (
    event.lead_instructor_id === userId ||
    event.assistant_instructor_id === userId ||
    event.support_instructor_id === userId ||
    event.instructor_4_id === userId ||
    event.instructor_5_id === userId
  );
  const hasLead = !!event.lead_instructor_id;
  const leadName = isStaff && instructors
    ? instructors.find(i => i.id === event.lead_instructor_id)?.full_name?.split(' ')[0]
    : null;

  return (
    <Link
      to={createPageUrl(`EventDetails?id=${event.id}`)}
      onClick={e => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-0.5 rounded px-1 py-0.5 mb-0.5 w-full overflow-hidden"
        style={{ backgroundColor: bg }}
      >
        <span className="text-white leading-none truncate" style={{ fontSize: '10px', fontWeight: 500 }}>
          {event.title}
        </span>
        {isRegistered && <CheckCircle className="w-2.5 h-2.5 text-white/90 shrink-0" />}
        {isLeading && <Crown className="w-2.5 h-2.5 text-yellow-300 shrink-0" />}
        {isStaff && !hasLead && (
          <span className="text-yellow-300 shrink-0 leading-none" style={{ fontSize: '8px' }}>●</span>
        )}
      </div>
    </Link>
  );
}

function DayDrawer({ day, events, categories, registrations, userId, isStaff, instructors, onClose,
  handleRegister, handleInstructorRegister, handleInstructorCancel, registeringEventId, isRegistered: isReg, isInstructorRegistered, canRegister, canInstructorRegister }) {

  return (
    <div className="border-t border-gray-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <span className="font-semibold text-sm text-gray-800">
          {format(day, 'EEEE, d MMMM')}
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
      </div>
      <div className="divide-y max-h-80 overflow-y-auto">
        {events.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">אין אירועים ביום זה</p>
        )}
        {events.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime)).map(event => {
          const category = categories.find(c => c.id === event.category_id);
          const branchColor = getBranchColor(event);
          const bg = branchColor || category?.color || '#6366f1';
          const userRegistered = isReg(event.id);
          const instructorReg = isInstructorRegistered(event);
          const canReg = canRegister(event);
          const canInstReg = canInstructorRegister(event);
          const isParticipantUser = !isStaff;
          const isInstructor = userId && !isParticipantUser;
          const hasLead = !!event.lead_instructor_id;
          const leadName = isStaff && instructors
            ? (instructors.find(i => i.id === event.lead_instructor_id)?.full_name || null)
            : null;

          return (
            <div key={event.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: bg, minHeight: 36 }} />
                <div className="flex-1 min-w-0">
                  <Link to={createPageUrl(`EventDetails?id=${event.id}`)}>
                    <p className="font-semibold text-sm text-gray-900 truncate">{event.title}</p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(event.start_datetime), 'HH:mm')}
                      {event.end_datetime ? ` – ${format(new Date(event.end_datetime), 'HH:mm')}` : ''}
                      {event.location ? ` · ${event.location}` : ''}
                    </p>
                    {isStaff && (
                      <p className="text-xs mt-0.5" style={{ color: bg }}>
                        {hasLead ? `👑 ${leadName}` : <span className="text-orange-500">👑 מחנך נדרש</span>}
                      </p>
                    )}
                  </Link>
                </div>
                <div className="shrink-0 flex flex-col gap-1">
                  {isParticipantUser && !userRegistered && canReg && (
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2"
                      style={{ backgroundColor: bg }}
                      onClick={e => handleRegister(event, e)}
                      disabled={registeringEventId === event.id}
                    >
                      {registeringEventId === event.id ? '...' : 'הרשמה'}
                    </Button>
                  )}
                  {isParticipantUser && userRegistered && (
                    <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> רשום
                    </span>
                  )}
                  {!isParticipantUser && !instructorReg && canInstReg && (
                    <Button
                      size="sm"
                      className="h-7 text-xs px-2 bg-blue-600"
                      onClick={e => handleInstructorRegister(event, e)}
                      disabled={registeringEventId === event.id}
                    >
                      {registeringEventId === event.id ? '...' : 'קח תפקיד'}
                    </Button>
                  )}
                  {!isParticipantUser && instructorReg && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2 border-red-300 text-red-600"
                      onClick={e => handleInstructorCancel(event, e)}
                      disabled={registeringEventId === event.id}
                    >
                      {registeringEventId === event.id ? '...' : 'בטל'}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DenseMonthCalendar({
  calendarDays,
  currentDate,
  filteredEvents,
  categories,
  registrations,
  userId,
  isStaff,
  instructors,
  isAdmin,
  canCreateEvent, // true for admin + instructor
  onCreateEvent,  // (date) => void — opens create modal with pre-filled date
  handleDateClick,
  handleRegister,
  handleInstructorRegister,
  handleInstructorCancel,
  registeringEventId,
  isRegistered,
  isInstructorRegistered,
  canRegister,
  canInstructorRegister,
}) {
  const [selectedDay, setSelectedDay] = useState(null);
  const weekDays = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  const getEventsForDay = (day) =>
    filteredEvents.filter(event => {
      try { return isSameDay(new Date(event.start_datetime), day); }
      catch { return false; }
    }).sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

  const handleCellClick = (day) => {
    // For staff (admin/instructor): open create modal on click
    if (canCreateEvent && onCreateEvent) {
      onCreateEvent(day);
      return;
    }
    // For participants: toggle day detail drawer
    if (selectedDay && isSameDay(selectedDay, day)) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
    }
  };

  // Build rows of 7
  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  return (
    <div className="bg-white rounded-xl shadow overflow-hidden">
      {/* Week day headers */}
      <div className="grid grid-cols-7 bg-gray-50 border-b">
        {weekDays.map(d => (
          <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        // Check if selected day is in this week
        const selectedInThisWeek = selectedDay && week.some(d => isSameDay(d, selectedDay));
        const selectedDayEvents = selectedDay && selectedInThisWeek ? getEventsForDay(selectedDay) : [];

        return (
          <React.Fragment key={wi}>
            {/* Week row */}
            <div className="grid grid-cols-7 border-b last:border-b-0">
              {week.map((day, di) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const shown = dayEvents.slice(0, MAX_PILLS);
                const overflow = dayEvents.length - MAX_PILLS;

                return (
                  <div
                    key={di}
                    className={`border-r last:border-r-0 p-0.5 transition-colors ${
                      !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                    } ${isSelected ? 'bg-blue-50' : ''} ${canCreateEvent ? 'cursor-pointer hover:bg-indigo-50/60' : 'cursor-pointer'}`}
                    style={{ minHeight: 72 }}
                    onClick={() => handleCellClick(day)}
                  >
                    {/* Date number */}
                    <div className="flex items-center justify-center mb-0.5" style={{ height: 22 }}>
                      <span
                        className={`text-xs font-semibold flex items-center justify-center rounded-full ${
                          isCurrentDay
                            ? 'w-6 h-6 bg-blue-600 text-white'
                            : !isCurrentMonth
                            ? 'text-gray-300'
                            : isSelected
                            ? 'text-blue-600'
                            : 'text-gray-700'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {/* Event pills */}
                    <div className="px-0.5">
                      {shown.map(event => (
                        <EventPill
                          key={event.id}
                          event={event}
                          categories={categories}
                          registrations={registrations}
                          userId={userId}
                          isStaff={isStaff}
                          instructors={instructors}
                        />
                      ))}
                      {overflow > 0 && (
                        <div
                          className="text-gray-500 px-1 leading-none"
                          style={{ fontSize: '9px', marginTop: 1 }}
                        >
                          +{overflow} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Inline day drawer — appears below the row containing the selected day */}
            {selectedInThisWeek && selectedDay && (
              <DayDrawer
                day={selectedDay}
                events={selectedDayEvents}
                categories={categories}
                registrations={registrations}
                userId={userId}
                isStaff={isStaff}
                instructors={instructors}
                onClose={() => setSelectedDay(null)}
                handleRegister={handleRegister}
                handleInstructorRegister={handleInstructorRegister}
                handleInstructorCancel={handleInstructorCancel}
                registeringEventId={registeringEventId}
                isRegistered={isRegistered}
                isInstructorRegistered={isInstructorRegistered}
                canRegister={canRegister}
                canInstructorRegister={canInstructorRegister}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}