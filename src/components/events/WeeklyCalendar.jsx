import React, { useRef, useEffect, useState } from 'react';
import { format, addHours, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const WeeklyCalendar = ({
  calendarDays,
  filteredEvents,
  categories,
  registrations,
  userId,
  isStaff,
  instructors,
  isAdmin,
  canCreateEvent,
  onCreateEvent,
  handleRegister,
  handleInstructorRegister,
  handleInstructorCancel,
  registeringEventId,
  isRegistered,
  isInstructorRegistered,
  canRegister,
  canInstructorRegister,
  getBranchColor,
  getCategory,
  getRegistrationCount,
  getLeadName,
  getSupportSlots,
  createPageUrl,
}) => {
  const scrollContainerRef = useRef(null);
  const timelineRef = useRef(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Time slots: 6 AM to 8 PM
  const timeSlots = Array.from({ length: 15 }, (_, i) => addHours(new Date().setHours(6, 0, 0, 0), i));

  const getEventsForDay = (day) => {
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.start_datetime);
      return (
        eventDate.getDate() === day.getDate() &&
        eventDate.getMonth() === day.getMonth() &&
        eventDate.getFullYear() === day.getFullYear()
      );
    });
  };

  const getEventPosition = (event) => {
    const eventTime = new Date(event.start_datetime);
    const startHour = 6;
    const pixelsPerMinute = 1; // ~60px per hour
    const minutesFromStart = (eventTime.getHours() - startHour) * 60 + eventTime.getMinutes();
    return Math.max(0, minutesFromStart * pixelsPerMinute);
  };

  const getEventHeight = (event) => {
    const start = new Date(event.start_datetime);
    const end = new Date(event.end_datetime);
    const durationMinutes = (end - start) / (1000 * 60);
    return Math.max(50, durationMinutes * 1); // min 50px for visibility
  };

  const handleDateHeaderClick = (day) => {
    if (canCreateEvent && scrollContainerRef.current) {
      onCreateEvent(day);
      // Scroll to that day column
      const dayIndex = calendarDays.indexOf(day);
      const columnWidth = 100; // ~100px per day column
      scrollContainerRef.current.scrollLeft = dayIndex * columnWidth;
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      setScrollPosition(scrollContainerRef.current.scrollLeft);
    }
  };

  return (
    <TooltipProvider>
      <div className="border-none shadow-lg bg-white/80 backdrop-blur rounded-lg overflow-hidden">
        {/* Sticky Date Header */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b">
          <div className="flex">
            {/* Empty corner for timeline */}
            <div className="w-14 flex-shrink-0 border-r bg-gray-50" />
            
            {/* Date headers - horizontal scroll */}
            <div className="flex-1 overflow-x-auto" ref={scrollContainerRef} onScroll={handleScroll}>
              <div className="flex min-w-min">
                {calendarDays.map((day, index) => {
                  const isCurrentDay = isToday(day);
                  return (
                    <div
                      key={index}
                      className={`w-24 flex-shrink-0 p-3 text-center border-r cursor-pointer hover:bg-blue-50/50 transition-colors ${
                        isCurrentDay ? 'bg-indigo-50' : 'bg-gray-50'
                      }`}
                      onClick={() => handleDateHeaderClick(day)}
                    >
                      <div className="text-[11px] font-semibold text-gray-500 uppercase">
                        {format(day, 'EEE')}
                      </div>
                      <div
                        className={`text-lg font-bold ${
                          isCurrentDay
                            ? 'w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center mx-auto'
                            : 'text-gray-900'
                        }`}
                      >
                        {format(day, 'd')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline + Events Grid */}
        <div className="flex overflow-hidden">
          {/* Left Timeline (fixed) */}
          <div
            className="w-14 flex-shrink-0 bg-gray-50 border-r overflow-hidden"
            ref={timelineRef}
          >
            <div className="relative pt-2">
              {timeSlots.map((time, index) => (
                <div
                  key={index}
                  className="h-16 flex items-start justify-center border-b border-gray-200 text-[10px] font-semibold text-gray-500"
                  style={{ paddingTop: '2px' }}
                >
                  {format(time, 'HH:mm')}
                </div>
              ))}
            </div>
          </div>

          {/* Scrollable Events Grid */}
          <div
            className="flex-1 overflow-x-auto"
            ref={scrollContainerRef}
            onScroll={handleScroll}
          >
            <div className="flex min-w-min">
              {calendarDays.map((day, dayIndex) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={dayIndex}
                    className={`w-24 flex-shrink-0 relative border-r min-h-screen ${
                      isCurrentDay ? 'bg-indigo-50/30' : 'bg-white'
                    }`}
                    style={{ minHeight: '960px' }} // 15 hours * 64px
                  >
                    {/* Time grid background */}
                    {timeSlots.map((_, index) => (
                      <div
                        key={index}
                        className="h-16 border-b border-gray-100"
                      />
                    ))}

                    {/* Events overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      {dayEvents.map((event) => {
                        const category = getCategory(event.category_id);
                        const isParticipant = !userId?.user_type || userId?.user_type === 'participant';
                        const isInstructor = userId?.user_type === 'instructor';
                        const userRegistered = isRegistered(event.id);
                        const canReg = canRegister(event);
                        const instructorReg = isInstructorRegistered(event);
                        const canInstReg = canInstructorRegister(event);

                        const eventColor = getBranchColor(event) || category?.color || '#6366f1';
                        const topPosition = getEventPosition(event);
                        const height = getEventHeight(event);

                        return (
                          <div
                            key={event.id}
                            className="absolute left-0.5 right-0.5 pointer-events-auto rounded-md overflow-hidden group"
                            style={{
                              top: `${topPosition}px`,
                              height: `${height}px`,
                              backgroundColor: eventColor,
                              minHeight: '50px',
                            }}
                          >
                            <Link
                              to={createPageUrl(`EventDetails?id=${event.id}`)}
                              className="block h-full p-1.5 text-white text-[10px] line-clamp-3 hover:opacity-90 transition-opacity"
                            >
                              <div className="font-semibold leading-tight">
                                {format(new Date(event.start_datetime), 'H:mm')}
                              </div>
                              <div className="font-medium leading-tight truncate">
                                {event.title}
                              </div>
                              <div className="text-[8px] opacity-90 leading-tight">
                                {event.branch || 'צוות מייקי'}
                              </div>

                              {/* Lead Instructor (compact) */}
                              {(isStaff || isAdmin) && (
                                <div className="text-[8px] opacity-80 mt-0.5 truncate leading-tight">
                                  {getLeadName(event) ? `👑 ${getLeadName(event)}` : '👑 OPEN'}
                                </div>
                              )}
                            </Link>

                            {/* Registration button overlay - shown on hover on mobile */}
                            {isParticipant && !userRegistered && canReg && (
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hidden md:flex">
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleRegister(event, e);
                                  }}
                                  disabled={registeringEventId === event.id}
                                  className="h-5 text-[8px] px-1 py-0 bg-white text-gray-900"
                                  size="sm"
                                >
                                  {registeringEventId === event.id ? '...' : 'Register'}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile Help Text */}
        <div className="md:hidden text-[11px] text-gray-500 p-2 bg-gray-50 border-t text-center">
          Scroll horizontally to view all days • Tap event for details
        </div>
      </div>
    </TooltipProvider>
  );
};

export default WeeklyCalendar;