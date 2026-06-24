import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar, Clock, MapPin, Users, Plus, Edit,
  CheckCircle, Target, ListChecks, TrendingUp, FileText } from
'lucide-react';
import SessionRoster from '@/components/events/SessionRoster';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from
'@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';

export default function InstructorPortal() {
  const [user, setUser] = useState(null);
  const [myEvents, setMyEvents] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [sessionPlans, setSessionPlans] = useState([]);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sessions');
  const [claimingEventId, setClaimingEventId] = useState(null);
  const [attachingPlanEventId, setAttachingPlanEventId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // ── [Fix P.1] UNLOCK THIS FUNCTION — remove auth.me() call ─────────────────────
  // BASE44 EDITOR: Replace base44.auth.me() with useAuth() from AuthContext.
  // STEP 1: Add at top of component: const { user } = useAuth();
  //         (import useAuth from '@/lib/AuthContext')
  // STEP 2: Remove the setUser(userData) line and auth.me() call below.
  // STEP 3: Replace all references to userData below with user (already declared above).
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const userData = await base44.auth.me(); // ⚠️ [Fix P.1] replace with useAuth()
      setUser(userData);

      const [allEvents, categoriesData, regsData, plansData] = await Promise.all([
      base44.entities.Event.filter({ status: 'active' }, 'start_datetime'),
      base44.entities.EventCategory.list(),
      base44.entities.EventRegistration.list(),
      base44.entities.SessionPlan.list()]
      );

      // Events where I'm the instructor
      const instructorEvents = allEvents.filter((e) =>
      e.lead_instructor_id === userData.id ||
      e.assistant_instructor_id === userData.id ||
      e.support_instructor_id === userData.id ||
      e.instructor_id === userData.id
      );

      // Future events only
      const now = new Date();
      const futureInstructorEvents = instructorEvents.filter((e) => new Date(e.start_datetime) > now);
      setMyEvents(futureInstructorEvents);

      // Available slots (no lead instructor assigned yet)
      const unassignedEvents = allEvents.filter((e) =>
      !e.lead_instructor_id &&
      !e.instructor_id &&
      new Date(e.start_datetime) > now
      );
      setAvailableSlots(unassignedEvents);

      setCategories(categoriesData);
      setRegistrations(regsData);
      setSessionPlans(plansData.filter((p) => p.created_by === userData.id));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // [NEW FEATURE — IMPLEMENTED] Remove a participant from a session in the portal.
  // Registration set to 'cancelled' (audit trail kept) and the participant is notified.
  const handleAdminRemoveParticipant = async (participantId, participantName, eventId) => {
    try {
      const reg = registrations.find(
        r => r.participant_id === participantId &&
             r.event_id === eventId &&
             r.status === 'registered'
      );
      if (!reg) { toast.error('No active registration found'); return; }
      await base44.entities.EventRegistration.update(reg.id, {
        status: 'cancelled',
        cancellation_date: new Date().toISOString()
      });
      await base44.entities.UserNotification.create({
        user_id: participantId,
        title: 'Removed from event',
        message: `You have been removed from a session by an instructor.`,
        type: 'general',
        read: false,
      });
      toast.success(`${participantName || 'Participant'} removed`);
      loadData();
    } catch (error) {
      toast.error('Failed to remove participant');
    }
  };

  const handleClaimSlot = async (eventId) => {
    setClaimingEventId(eventId);
    try {
      await base44.entities.Event.update(eventId, {
        lead_instructor_id: user.id
      });
      toast.success('✓ Session claimed successfully!');
      loadData();
    } catch (error) {
      toast.error('Failed to claim session');
    } finally {
      setClaimingEventId(null);
    }
  };

  const getCategory = (categoryId) => categories.find((c) => c.id === categoryId);
  const getRegistrationCount = (eventId) => registrations.filter((r) => r.event_id === eventId && r.status === 'registered').length;
  const getSessionPlan = (planId) => sessionPlans.find((p) => p.id === planId);

  const handleAttachPlan = async () => {
    if (!selectedPlanId || !attachingPlanEventId) return;

    try {
      await base44.entities.Event.update(attachingPlanEventId, {
        session_plan_id: selectedPlanId
      });
      toast.success('✓ Session plan attached!');
      setAttachingPlanEventId(null);
      setSelectedPlanId('');
      loadData();
    } catch (error) {
      toast.error('Failed to attach plan');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#0038A8' }}></div>
      </div>);

  }

  const upcomingEvents = myEvents.slice(0, 5);
  const thisMonthSlots = availableSlots.filter((e) => {
    const eventDate = new Date(e.start_datetime);
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    return isWithinInterval(eventDate, { start: monthStart, end: monthEnd });
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Instructor Portal</h1>
          <p className="text-gray-400 mt-1">Manage your sessions and plans</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">My Sessions</p>
                <p className="text-3xl font-bold">{myEvents.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Available Slots</p>
                <p className="text-3xl font-bold">{thisMonthSlots.length}</p>
              </div>
              <Plus className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Session Plans</p>
                <p className="text-3xl font-bold">{sessionPlans.length}</p>
              </div>
              <Target className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-lg bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Total Participants</p>
                <p className="text-3xl font-bold">
                  {registrations.filter((r) =>
                  myEvents.some((e) => e.id === r.event_id) && r.status === 'registered'
                  ).length}
                </p>
              </div>
              <Users className="w-8 h-8 text-orange-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-white shadow-lg rounded-xl p-1">
          <TabsTrigger value="sessions" className="rounded-lg">My Sessions</TabsTrigger>
          <TabsTrigger value="available" className="rounded-lg">Available Slots</TabsTrigger>
          <TabsTrigger value="plans" className="rounded-lg">Session Plans</TabsTrigger>
        </TabsList>

        {/* My Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">My Upcoming Sessions</h2>
            <Link to={createPageUrl('Events')}>
              <Button variant="outline" className="bg-slate-50 text-slate-800 px-4 py-2 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-9 border-gray-600 hover:bg-white/10">
                <Calendar className="w-4 h-4 mr-2" />
                View Calendar
              </Button>
            </Link>
          </div>

          {upcomingEvents.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">No sessions assigned yet</p>
                <Button onClick={() => setActiveTab('available')}>
                  Browse Available Slots
                </Button>
              </CardContent>
            </Card> :

          <div className="space-y-6">
              {upcomingEvents.map((event) => {
              const category = getCategory(event.category_id);
              const regCount = getRegistrationCount(event.id);
              const attachedPlan = getSessionPlan(event.session_plan_id);

              return (
                <div key={event.id} className="space-y-2">
                <Card className="border-none shadow-lg bg-white overflow-hidden hover:shadow-xl transition-all">
                    <div className="h-1.5" style={{ backgroundColor: category?.color || '#0038A8' }} />
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#0038A8' }}>

                          <span className="text-xs font-medium">
                            {format(new Date(event.start_datetime), 'MMM')}
                          </span>
                          <span className="text-2xl font-bold leading-none">
                            {format(new Date(event.start_datetime), 'd')}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1">
                              <h3 className="font-bold text-gray-900 text-lg">{event.title}</h3>
                              <div className="flex gap-1 mt-1">
                                {category &&
                              <Badge
                                variant="secondary"
                                className="text-xs"
                                style={{ backgroundColor: `${category.color}15`, color: category.color }}>

                                    {category.name}
                                  </Badge>
                              }
                                {attachedPlan &&
                              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    <Target className="w-3 h-3 mr-1" />
                                    {attachedPlan.name}
                                  </Badge>
                              }
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">
                                {format(new Date(event.start_datetime), 'EEEE, h:mm a')}
                              </span>
                            </div>
                            {event.location &&
                          <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{event.location}</span>
                              </div>
                          }
                            <div className="flex items-center gap-2">
                              <Users className="w-4 h-4" />
                              <span>{regCount} participants registered</span>
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAttachingPlanEventId(event.id)}
                            className="flex-1">

                              <FileText className="w-4 h-4 mr-2" />
                              {attachedPlan ? 'Change' : 'Add'} Plan
                            </Button>
                            <Link to={createPageUrl(`EventDetails?id=${event.id}`)} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">
                                View Details
                              </Button>
                            </Link>

                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <SessionRoster
                    eventId={event.id}
                    registrations={registrations}
                    isStaff={true}
                    onRemoveParticipant={(pid, name) =>
                      handleAdminRemoveParticipant(pid, name, event.id)
                    }
                  />
                </div>
              );

            })}
            </div>
          }
        </TabsContent>

        {/* Available Slots Tab */}
        <TabsContent value="available" className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Available Slots This Month</h2>
            <p className="text-gray-400 text-sm">Claim sessions to lead</p>
          </div>

          {thisMonthSlots.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                <p className="text-gray-500">All slots for this month are assigned</p>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {thisMonthSlots.map((event) => {
              const category = getCategory(event.category_id);

              return (
                <Card key={event.id} className="border-none shadow-lg bg-white overflow-hidden hover:shadow-xl transition-all">
                    <div className="h-1.5" style={{ backgroundColor: category?.color || '#6366f1' }} />
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#6366f1' }}>

                          <span className="text-xs font-medium">
                            {format(new Date(event.start_datetime), 'MMM')}
                          </span>
                          <span className="text-2xl font-bold leading-none">
                            {format(new Date(event.start_datetime), 'd')}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="mb-2">
                            <h3 className="font-bold text-gray-900 text-lg">{event.title}</h3>
                            {category &&
                          <Badge
                            variant="secondary"
                            className="text-xs mt-1"
                            style={{ backgroundColor: `${category.color}15`, color: category.color }}>

                                {category.name}
                              </Badge>
                          }
                          </div>

                          <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">
                                {format(new Date(event.start_datetime), 'EEEE, h:mm a')}
                              </span>
                            </div>
                            {event.location &&
                          <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4" />
                                <span>{event.location}</span>
                              </div>
                          }
                          </div>

                          <Button
                          onClick={() => handleClaimSlot(event.id)}
                          disabled={claimingEventId === event.id}
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm">

                            {claimingEventId === event.id ?
                          <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Claiming...
                              </> :

                          <>
                                <Plus className="w-4 h-4 mr-2" />
                                Claim This Session
                              </>
                          }
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>);

            })}
            </div>
          }
        </TabsContent>

        {/* Session Plans Tab */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">My Session Plans</h2>
              <p className="text-gray-400 text-sm mt-1">Build and manage training plans</p>
            </div>
            <Link to={createPageUrl('ManageSessionPlans')}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create New Plan
              </Button>
            </Link>
          </div>

          {sessionPlans.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Target className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">No session plans created yet</p>
                <Link to={createPageUrl('ManageSessionPlans')}>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Plan
                  </Button>
                </Link>
              </CardContent>
            </Card> :

          <div className="grid md:grid-cols-2 gap-4">
              {sessionPlans.map((plan) =>
            <Card key={plan.id} className="border-none shadow-lg bg-white hover:shadow-xl transition-all">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between">
                      <span className="text-lg">{plan.name}</span>
                      <Badge variant="secondary">
                        {plan.total_duration_minutes || 0} min
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {plan.description || 'No description'}
                    </p>
                    <Link to={createPageUrl('ManageSessionPlans')}>
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Plan
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
            )}
            </div>
          }
        </TabsContent>
      </Tabs>

      {/* Attach Plan Dialog */}
      <Dialog open={!!attachingPlanEventId} onOpenChange={(open) => !open && setAttachingPlanEventId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach Session Plan</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Session Plan</label>
              <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {sessionPlans.map((plan) =>
                  <SelectItem key={plan.id} value={plan.id}>
                      {plan.name}
                      {plan.total_duration_minutes && ` (${plan.total_duration_minutes} min)`}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            {sessionPlans.length === 0 &&
            <p className="text-sm text-gray-500">
                No session plans available. Create one first.
              </p>
            }
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttachingPlanEventId(null)}>
              Cancel
            </Button>
            <Button onClick={handleAttachPlan} disabled={!selectedPlanId}>
              Attach Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);

}