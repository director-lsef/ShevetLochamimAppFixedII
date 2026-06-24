import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, ChevronLeft, ChevronRight, User, Users, Shield,
  UserCheck, UserPlus, Clock, MapPin
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns';
import { toast } from 'sonner';

export default function InstructorCalendar() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [events, setEvents] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    // [Fix P.1] Re-run when user resolves from AuthContext (null on first render)
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;

      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false);
        return;
      }

      const [eventsData, usersData] = await Promise.all([
        base44.entities.Event.filter({ status: 'active' }),
        base44.entities.User.list()
      ]);

      setEvents(eventsData);
      setAllUsers(usersData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaimSlot = async (event, slotType) => {
    try {
      const updates = {};
      updates[slotType] = user.id;
      await base44.entities.Event.update(event.id, updates);
      toast.success(`You claimed the ${slotType.replace('_instructor_id', '')} slot`);
      loadData();
    } catch (error) {
      toast.error('Failed to claim slot');
    }
  };

  const handleUnclaimSlot = async (event, slotType) => {
    try {
      const updates = {};
      updates[slotType] = null;
      await base44.entities.Event.update(event.id, updates);
      toast.success('Slot released');
      loadData();
    } catch (error) {
      toast.error('Failed to release slot');
    }
  };

  const getInstructorName = (userId) => {
    if (!userId) return null;
    const instructor = allUsers.find(u => u.id === userId);
    return instructor?.full_name || 'Unknown';
  };

  const canClaimSlot = (event, slotType) => {
    return !event[slotType];
  };

  const isMySlot = (event, slotType) => {
    return event[slotType] === user?.id;
  };

  const getMonthDays = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getEventsForDay = (day) => {
    return events.filter(event => {
      const eventDate = parseISO(event.start_datetime);
      return isSameDay(eventDate, day);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (user?.user_type !== 'instructor' && user?.user_type !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only instructors and admins can access this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthDays = getMonthDays();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Users className="w-8 h-8 text-indigo-600" />
          Instructor Calendar
        </h1>
        <p className="text-gray-500 mt-1">Claim instructor slots for upcoming training sessions</p>
      </div>

      {/* Calendar Header */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-2xl font-bold">
              {format(currentDate, 'MMMM yyyy')}
            </h2>
            <Button variant="ghost" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-500 py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-2">
            {monthDays.map((day, idx) => {
              const dayEvents = getEventsForDay(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <div
                  key={idx}
                  className={`min-h-24 p-2 rounded-lg border transition-all ${
                    isToday ? 'bg-indigo-50 border-indigo-300' : 'bg-gray-50 border-gray-200'
                  } ${!isSameMonth(day, currentDate) ? 'opacity-40' : ''}`}
                >
                  <div className={`text-sm font-semibold mb-1 ${isToday ? 'text-indigo-600' : 'text-gray-600'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.map(event => {
                      const hasLead = !!event.lead_instructor_id;
                      const hasAssistant = !!event.assistant_instructor_id;
                      const hasSupport = !!event.support_instructor_id;
                      const myEvent = isMySlot(event, 'lead_instructor_id') || 
                                     isMySlot(event, 'assistant_instructor_id') || 
                                     isMySlot(event, 'support_instructor_id');

                      return (
                        <div
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`text-xs p-1 rounded cursor-pointer transition-all ${
                            myEvent ? 'bg-green-100 hover:bg-green-200 border border-green-300' : 
                            'bg-white hover:bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <p className="font-medium truncate">{event.title}</p>
                          <div className="flex gap-0.5 mt-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${hasLead ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div className={`w-1.5 h-1.5 rounded-full ${hasAssistant ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div className={`w-1.5 h-1.5 rounded-full ${hasSupport ? 'bg-green-500' : 'bg-gray-300'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedEvent(null)}>
          <Card className="max-w-2xl w-full border-none shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>{selectedEvent.title}</CardTitle>
              <div className="flex gap-2 text-sm text-gray-500">
                <span className="flex items-center">
                  <Calendar className="w-4 h-4 mr-1" />
                  {format(parseISO(selectedEvent.start_datetime), 'MMM d, yyyy h:mm a')}
                </span>
                {selectedEvent.location && (
                  <span className="flex items-center">
                    <MapPin className="w-4 h-4 mr-1" />
                    {selectedEvent.location}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedEvent.description && (
                <p className="text-gray-600">{selectedEvent.description}</p>
              )}

              {/* Instructor Slots */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Instructor Assignments</h3>
                
                {/* Lead Instructor */}
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-indigo-600">
                          <User className="w-3 h-3 mr-1" />
                          Lead (#1)
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {getInstructorName(selectedEvent.lead_instructor_id) || (
                          <span className="text-gray-400">Available</span>
                        )}
                      </p>
                    </div>
                    {isMySlot(selectedEvent, 'lead_instructor_id') ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnclaimSlot(selectedEvent, 'lead_instructor_id')}>
                        Release
                      </Button>
                    ) : canClaimSlot(selectedEvent, 'lead_instructor_id') ? (
                      <Button size="sm" onClick={() => handleClaimSlot(selectedEvent, 'lead_instructor_id')} className="bg-indigo-600">
                        <UserPlus className="w-4 h-4 mr-1" />
                        Claim
                      </Button>
                    ) : (
                      <Badge variant="outline">Claimed</Badge>
                    )}
                  </div>
                </div>

                {/* Assistant Instructor */}
                <div className="p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-blue-600">
                          <UserCheck className="w-3 h-3 mr-1" />
                          Assistant (#2)
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {getInstructorName(selectedEvent.assistant_instructor_id) || (
                          <span className="text-gray-400">Available</span>
                        )}
                      </p>
                    </div>
                    {isMySlot(selectedEvent, 'assistant_instructor_id') ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnclaimSlot(selectedEvent, 'assistant_instructor_id')}>
                        Release
                      </Button>
                    ) : canClaimSlot(selectedEvent, 'assistant_instructor_id') ? (
                      <Button size="sm" onClick={() => handleClaimSlot(selectedEvent, 'assistant_instructor_id')} className="bg-blue-600">
                        <UserPlus className="w-4 h-4 mr-1" />
                        Claim
                      </Button>
                    ) : (
                      <Badge variant="outline">Claimed</Badge>
                    )}
                  </div>
                </div>

                {/* Support Instructor */}
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="bg-green-600">
                          <Users className="w-3 h-3 mr-1" />
                          Support (#3)
                        </Badge>
                      </div>
                      <p className="text-sm font-medium">
                        {getInstructorName(selectedEvent.support_instructor_id) || (
                          <span className="text-gray-400">Available</span>
                        )}
                      </p>
                    </div>
                    {isMySlot(selectedEvent, 'support_instructor_id') ? (
                      <Button variant="outline" size="sm" onClick={() => handleUnclaimSlot(selectedEvent, 'support_instructor_id')}>
                        Release
                      </Button>
                    ) : canClaimSlot(selectedEvent, 'support_instructor_id') ? (
                      <Button size="sm" onClick={() => handleClaimSlot(selectedEvent, 'support_instructor_id')} className="bg-green-600">
                        <UserPlus className="w-4 h-4 mr-1" />
                        Claim
                      </Button>
                    ) : (
                      <Badge variant="outline">Claimed</Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button variant="outline" onClick={() => setSelectedEvent(null)} className="w-full">
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}