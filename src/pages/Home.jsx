import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Users, TrendingUp, Clock, ArrowRight, Sparkles, CheckCircle, MapPin, X, Plus, Target, FileText, Edit } from 'lucide-react';
import { filterParticipants } from '@/utils/userHelpers';
import { format as dateFnsFormat } from 'date-fns';
import { format, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Home() {
  const [user, setUser] = useState(null);
  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [stats, setStats] = useState({ totalEvents: 0, myRegistrations: 0, totalParticipants: 0 });
  const [loading, setLoading] = useState(true);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [registeringEventId, setRegisteringEventId] = useState(null);
  const [cancellingEventId, setCancellingEventId] = useState(null);
  const [sessionPlans, setSessionPlans] = useState([]);
  const [myInstructorEvents, setMyInstructorEvents] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [attachingPlanEventId, setAttachingPlanEventId] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [claimingEventId, setClaimingEventId] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();

      // Auto-unfreeze if freeze period has expired
      if (userData.account_status === 'frozen' && userData.freeze_end_date) {
        if (new Date(userData.freeze_end_date) <= new Date()) {
          await base44.auth.updateMe({ account_status: 'active', freeze_end_date: null });
          userData.account_status = 'active';
          userData.freeze_end_date = null;
        }
      }

      setUser(userData);

      const now = new Date();

      const [allEvents, categoriesData] = await Promise.all([
        base44.entities.Event.filter({ status: 'active' }, 'start_datetime'),
        base44.entities.EventCategory.list()
      ]);

      // Get the 3 closest upcoming events for participants
      const isAdminUser = userData.user_type === 'admin' || userData.role === 'admin';
      const isInstructorUser = userData.user_type === 'instructor';
      const isParticipant = !isAdminUser && !isInstructorUser && (!userData.user_type || userData.user_type === 'participant');
      const upcomingEvents = allEvents
        .filter((e) => {
          const eventDate = new Date(e.start_datetime);
          const canView = !isParticipant || e.event_privacy !== 'staff-only';
          return eventDate > now && canView;
        })
        .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime))
        .slice(0, 3);
      setWeeklyEvents(upcomingEvents);
      setCategories(categoriesData);

      if (isParticipant) {
        const regsData = await base44.entities.EventRegistration.filter({
          participant_id: userData.id,
          status: 'registered'
        });
        setRegistrations(regsData);
        setStats((prev) => ({ ...prev, myRegistrations: regsData.length }));

        // Compute attendance stats
        const attendedRegs = await base44.entities.EventRegistration.filter({
          participant_id: userData.id,
          status: 'attended'
        });

        const allMyRegs = [...regsData, ...attendedRegs];
        const now = new Date();
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);

        // Map event IDs to categories
        const eventMap = {};
        allEvents.forEach(e => { eventMap[e.id] = e; });

        // ── [Fix 4.2] UNLOCK THIS BLOCK — replace hardcoded names with category_type ──
        // BASE44 EDITOR: Delete the three *_NAMES arrays and the matchesCategory
        // function, then replace with a category_type lookup function.
        // PREREQUISITE: EventCategory.jsonc must have category_type field AND
        // existing category records must have their category_type values set.
        //
        // DELETED BLOCK (remove once category_type is live):
        // const TRAINING_NAMES = ['צוות מייקי אימון'];     ← misses any non-matching titles
        // const EDUCATIONAL_NAMES = ['Educational Lesson', 'Educational lesson'];
        // const ULPAN_NAMES = ['אולפן יהשוע - שיעור עברית']; ← exact string — very fragile
        // const matchesCategory = (reg, names) => { ... title/name substring check ... };
        //
        // NEW REPLACEMENT (use after category_type is live):
        // const matchesCategoryType = (reg, type) => {
        //   const event = eventMap[reg.event_id];
        //   if (!event) return false;
        //   const cat = categoriesData.find(c => c.id === event.category_id);
        //   return cat?.category_type === type;
        // };
        //
        // Then replace the three TRAINING_NAMES/EDUCATIONAL_NAMES/ULPAN_NAMES usages
        // in setAttendanceStats below with:
        //   trainingAllTime:     allMyRegs.filter(r => matchesCategoryType(r, 'workout')).length,
        //   trainingMonthly:     allMyRegs.filter(r => isThisMonth(r) && matchesCategoryType(r, 'workout')).length,
        //   educationalAllTime:  allMyRegs.filter(r => matchesCategoryType(r, 'educational')).length,
        //   educationalMonthly:  allMyRegs.filter(r => isThisMonth(r) && matchesCategoryType(r, 'educational')).length,
        //   ulpanAllTime:        allMyRegs.filter(r => matchesCategoryType(r, 'ulpan')).length,
        //   ulpanMonthly:        allMyRegs.filter(r => isThisMonth(r) && matchesCategoryType(r, 'ulpan')).length,
        //
        // KEEP THE OLD VERSION until EventCategory.category_type is confirmed live.
        // ── END UNLOCK ─────────────────────────────────────────────────────────────────
        const TRAINING_NAMES = ['צוות מייקי אימון'];
        const EDUCATIONAL_NAMES = ['Educational Lesson', 'Educational lesson'];
        const ULPAN_NAMES = ['אולפן יהשוע - שיעור עברית'];

        const matchesCategory = (reg, names) => {
          const event = eventMap[reg.event_id];
          if (!event) return false;
          const cat = categoriesData.find(c => c.id === event.category_id);
          return names.some(n => event.title?.includes(n) || cat?.name?.includes(n));
        };

        const isThisMonth = (reg) => {
          const event = eventMap[reg.event_id];
          if (!event) return false;
          const d = new Date(event.start_datetime);
          return isWithinInterval(d, { start: monthStart, end: monthEnd });
        };

        setAttendanceStats({
          totalAllTime: allMyRegs.length,
          totalMonthly: allMyRegs.filter(isThisMonth).length,
          trainingAllTime: allMyRegs.filter(r => matchesCategory(r, TRAINING_NAMES)).length,
          trainingMonthly: allMyRegs.filter(r => isThisMonth(r) && matchesCategory(r, TRAINING_NAMES)).length,
          educationalAllTime: allMyRegs.filter(r => matchesCategory(r, EDUCATIONAL_NAMES)).length,
          educationalMonthly: allMyRegs.filter(r => isThisMonth(r) && matchesCategory(r, EDUCATIONAL_NAMES)).length,
          ulpanAllTime: allMyRegs.filter(r => matchesCategory(r, ULPAN_NAMES)).length,
          ulpanMonthly: allMyRegs.filter(r => isThisMonth(r) && matchesCategory(r, ULPAN_NAMES)).length,
        });
      }

      setStats((prev) => ({ ...prev, totalEvents: allEvents.length }));

      // Load instructor-specific data
      if (isInstructorUser || isAdminUser) {
        const futureEvents = allEvents.filter(e => new Date(e.start_datetime) > now);
        
        const instructorEvents = futureEvents.filter(e => 
          e.lead_instructor_id === userData.id || 
          e.assistant_instructor_id === userData.id ||
          e.support_instructor_id === userData.id ||
          e.instructor_4_id === userData.id ||
          e.instructor_5_id === userData.id
        );
        setMyInstructorEvents(instructorEvents);

        const unassignedEvents = futureEvents.filter(e => 
          !e.lead_instructor_id && 
          !e.instructor_id
        );
        const monthStart = startOfMonth(now);
        const monthEnd = endOfMonth(now);
        const thisMonthSlots = unassignedEvents.filter(e => 
          isWithinInterval(new Date(e.start_datetime), { start: monthStart, end: monthEnd })
        );
        setAvailableSlots(thisMonthSlots);

        const plansData = await base44.entities.SessionPlan.list();
        setSessionPlans(plansData.filter(p => p.created_by === userData.id));

        if (isInstructorUser) {
          const regsData = await base44.entities.EventRegistration.list();
          setRegistrations(regsData);
        }
      }

      if (isAdminUser) {
        const allUsers = await base44.entities.User.list();
        const participants = filterParticipants(allUsers);
        setStats((prev) => ({ ...prev, totalParticipants: participants.length }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (event, e) => {
    e.preventDefault();
    e.stopPropagation();

    setRegisteringEventId(event.id);
    try {
      await base44.entities.EventRegistration.create({
        event_id: event.id,
        participant_id: user.id,
        status: 'registered',
        registration_date: new Date().toISOString()
      });
      toast.success('✓ Registered successfully!');
      loadData();
    } catch (error) {
      toast.error('Failed to register');
    } finally {
      setRegisteringEventId(null);
    }
  };

  const handleCancel = async (event, e) => {
    e.preventDefault();
    e.stopPropagation();

    setCancellingEventId(event.id);
    try {
      const registration = registrations.find((r) => r.event_id === event.id && r.participant_id === user.id);
      if (registration) {
        await base44.entities.EventRegistration.update(registration.id, { status: 'cancelled' });
        toast.success('Registration cancelled');
        loadData();
      }
    } catch (error) {
      toast.error('Failed to cancel');
    } finally {
      setCancellingEventId(null);
    }
  };

  const isRegistered = (eventId) => {
    return registrations.some((r) => r.event_id === eventId && r.status === 'registered');
  };

  const canRegister = (event) => {
    if (isRegistered(event.id)) return false;
    if (user?.account_status === 'frozen' && user?.freeze_end_date && new Date(user.freeze_end_date) > new Date()) return false;

    const now = new Date();
    const eventStart = new Date(event.start_datetime);

    if (eventStart < now) return false;
    if (event.registration_deadline && new Date(event.registration_deadline) < now) return false;

    return true;
  };

  const getCategory = (categoryId) => categories.find((c) => c.id === categoryId);
  const getRegistrationCount = (eventId) => registrations.filter((r) => r.event_id === eventId && r.status === 'registered').length;
  const getSessionPlan = (planId) => sessionPlans.find(p => p.id === planId);

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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const isInstructor = user?.user_type === 'instructor';
  const isAdmin = user?.user_type === 'admin' || user?.role === 'admin';
  const isParticipant = !isAdmin && !isInstructor && (!user?.user_type || user?.user_type === 'participant');
  const upcomingInstructorEvents = myInstructorEvents.slice(0, 5);

  // Instructor Home View
  if (isInstructor && !isAdmin) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold text-white">Welcome, {user?.full_name?.split(' ')[0]}</h1>
          <p className="text-gray-400 mt-1">Instructor Portal</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">My Sessions</p>
                  <p className="text-3xl font-bold">{myInstructorEvents.length}</p>
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
                  <p className="text-3xl font-bold">{availableSlots.length}</p>
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
                    {registrations.filter(r => 
                      myInstructorEvents.some(e => e.id === r.event_id) && r.status === 'registered'
                    ).length}
                  </p>
                </div>
                <Users className="w-8 h-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="sessions" className="space-y-4">
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
                <Button variant="outline" className="text-white border-gray-600 hover:bg-white/10">
                  <Calendar className="w-4 h-4 mr-2" />
                  View Calendar
                </Button>
              </Link>
            </div>

            {upcomingInstructorEvents.length === 0 ? (
              <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardContent className="py-12 text-center">
                  <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-gray-500 mb-4">No sessions assigned yet</p>
                  <Button onClick={() => document.querySelector('[value="available"]').click()}>
                    Browse Available Slots
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcomingInstructorEvents.map((event) => {
                  const category = getCategory(event.category_id);
                  const regCount = getRegistrationCount(event.id);
                  const attachedPlan = getSessionPlan(event.session_plan_id);

                  return (
                    <Card key={event.id} className="border-none shadow-lg bg-white overflow-hidden hover:shadow-xl transition-all">
                      <div className="h-1.5" style={{ backgroundColor: category?.color || '#0038A8' }} />
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div 
                            className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                            style={{ backgroundColor: category?.color || '#0038A8' }}
                          >
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
                                  {category && (
                                    <Badge 
                                      variant="secondary" 
                                      className="text-xs"
                                      style={{ backgroundColor: `${category.color}15`, color: category.color }}
                                    >
                                      {category.name}
                                    </Badge>
                                  )}
                                  {attachedPlan && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                      <Target className="w-3 h-3 mr-1" />
                                      {attachedPlan.name}
                                    </Badge>
                                  )}
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
                              {event.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                <span>{regCount} participants registered</span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setAttachingPlanEventId(event.id)}
                                className="flex-1"
                              >
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
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Available Slots Tab */}
          <TabsContent value="available" className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Available Slots This Month</h2>
              <p className="text-gray-400 text-sm">Claim sessions to lead</p>
            </div>

            {availableSlots.length === 0 ? (
              <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <p className="text-gray-500">All slots for this month are assigned</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {availableSlots.map((event) => {
                  const category = getCategory(event.category_id);

                  return (
                    <Card key={event.id} className="border-none shadow-lg bg-white overflow-hidden hover:shadow-xl transition-all">
                      <div className="h-1.5" style={{ backgroundColor: category?.color || '#6366f1' }} />
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div 
                            className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                            style={{ backgroundColor: category?.color || '#6366f1' }}
                          >
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
                              {category && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs mt-1"
                                  style={{ backgroundColor: `${category.color}15`, color: category.color }}
                                >
                                  {category.name}
                                </Badge>
                              )}
                            </div>

                            <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span className="font-medium">
                                  {format(new Date(event.start_datetime), 'EEEE, h:mm a')}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>{event.location}</span>
                                </div>
                              )}
                            </div>

                            <Button
                              onClick={() => handleClaimSlot(event.id)}
                              disabled={claimingEventId === event.id}
                              className="w-full bg-green-600 hover:bg-green-700"
                              size="sm"
                            >
                              {claimingEventId === event.id ? (
                                <>
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                  Claiming...
                                </>
                              ) : (
                                <>
                                  <Plus className="w-4 h-4 mr-2" />
                                  Claim This Session
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
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

            {sessionPlans.length === 0 ? (
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
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {sessionPlans.map((plan) => (
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
                ))}
              </div>
            )}
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
                    {sessionPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                        {plan.total_duration_minutes && ` (${plan.total_duration_minutes} min)`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {sessionPlans.length === 0 && (
                <p className="text-sm text-gray-500">
                  No session plans available. Create one first.
                </p>
              )}
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
      </div>
    );
  }

  const isFrozen = user?.account_status === 'frozen' && user?.freeze_end_date && new Date(user.freeze_end_date) > new Date();

  // Participant/Admin Home View
  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Frozen Account Banner */}
      {isFrozen && (
        <div className="rounded-xl border-2 border-blue-400 bg-blue-900/80 p-5 flex items-start gap-4">
          <div className="text-4xl">❄️</div>
          <div>
            <h2 className="text-xl font-bold text-blue-100 mb-1">Your account is frozen</h2>
            <p className="text-blue-200">
              You cannot register for new events until{' '}
              <strong>{dateFnsFormat(new Date(user.freeze_end_date), 'MMMM d, yyyy')}</strong>.
              Please contact an instructor for details.
            </p>
          </div>
        </div>
      )}

      {/* Upcoming Events - Top Priority Section */}
      <div className="min-h-[50vh]">
        <div className="mb-4">
          <h1 className="text-3xl font-bold text-white mb-1">Upcoming Events</h1>
          <p className="text-gray-400">Quick book your training</p>
        </div>

        {weeklyEvents.length === 0 ? (
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardContent className="py-16 text-center">
              <Calendar className="w-20 h-20 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 text-lg">No upcoming sessions scheduled</p>
              <Link to={createPageUrl('Events')}>
                <Button variant="outline" className="mt-4">
                  View Full Calendar
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {weeklyEvents.map((event) => {
              const category = getCategory(event.category_id);
              const regCount = getRegistrationCount(event.id);
              const registered = isRegistered(event.id);

              return (
                <Card
                  key={event.id}
                  className="border-none shadow-lg hover:shadow-xl transition-all bg-white overflow-hidden"
                >
                  <div
                    className="h-1.5"
                    style={{ backgroundColor: category?.color || '#0038A8' }}
                  />
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Date Badge */}
                      <div
                        className="flex flex-col items-center justify-center w-16 h-16 rounded-xl text-white shrink-0"
                        style={{ backgroundColor: category?.color || '#0038A8' }}
                      >
                        <span className="text-xs font-medium">
                          {format(new Date(event.start_datetime), 'MMM')}
                        </span>
                        <span className="text-2xl font-bold leading-none">
                          {format(new Date(event.start_datetime), 'd')}
                        </span>
                      </div>

                      {/* Event Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 text-lg truncate">
                              {event.title}
                            </h3>
                            {category && (
                              <Badge
                                variant="secondary"
                                className="text-xs mt-1"
                                style={{
                                  backgroundColor: `${category.color}15`,
                                  color: category.color
                                }}
                              >
                                {category.name}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span className="font-medium">
                              {format(new Date(event.start_datetime), 'h:mm a')}
                              {event.end_datetime && ` - ${format(new Date(event.end_datetime), 'h:mm a')}`}
                            </span>
                          </div>
                          {event.location && (
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 shrink-0" />
                            <span>{regCount} registered</span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {isParticipant && (
                          <div className="flex gap-2">
                            {registered ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="flex-1 border-green-300 text-green-700 bg-green-50 hover:bg-green-100"
                                  disabled
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Registered
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => handleCancel(event, e)}
                                  disabled={cancellingEventId === event.id}
                                  className="border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  {cancellingEventId === event.id ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                                  ) : (
                                    <X className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            ) : canRegister(event) ? (
                              <Button
                                size="sm"
                                onClick={(e) => handleRegister(event, e)}
                                disabled={registeringEventId === event.id}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                              >
                                {registeringEventId === event.id ? (
                                  <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Registering...
                                  </>
                                ) : (
                                  'Register'
                                )}
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                disabled
                              >
                                Registration Closed
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Attendance Stats - Participants only */}
        {isParticipant && attendanceStats && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">My Attendance Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

              {/* Total */}
              <Card className="border-none shadow-lg bg-white/90">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Attended</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{attendanceStats.totalAllTime}</p>
                      <p className="text-xs text-gray-500">all time</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-blue-600">{attendanceStats.totalMonthly}</p>
                      <p className="text-xs text-gray-500">this month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Training */}
              <Card className="border-none shadow-lg bg-white/90">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">צוות מייקי אימון</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{attendanceStats.trainingAllTime}</p>
                      <p className="text-xs text-gray-500">all time</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-green-600">{attendanceStats.trainingMonthly}</p>
                      <p className="text-xs text-gray-500">this month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Educational */}
              <Card className="border-none shadow-lg bg-white/90">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Educational Lessons</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{attendanceStats.educationalAllTime}</p>
                      <p className="text-xs text-gray-500">all time</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">{attendanceStats.educationalMonthly}</p>
                      <p className="text-xs text-gray-500">this month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Ulpan */}
              <Card className="border-none shadow-lg bg-white/90">
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">אולפן יהשוע - שיעור עברית</p>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold text-gray-900">{attendanceStats.ulpanAllTime}</p>
                      <p className="text-xs text-gray-500">all time</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-orange-500">{attendanceStats.ulpanMonthly}</p>
                      <p className="text-xs text-gray-500">this month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
        )}

        {/* View All Link */}
        <div className="text-center mt-6">
          <Link to={createPageUrl('Events')}>
            <Button variant="outline" size="lg" className="bg-[#1040a8] text-slate-200 px-8 text-sm font-medium rounded-md inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border shadow-sm hover:text-accent-foreground h-10 border-gray-600 hover:bg-white/10">
              View Full Calendar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards - Lower Priority */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-gray-700">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Events</CardTitle>
              <Calendar className="w-5 h-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalEvents}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Participants</CardTitle>
              <Users className="w-5 h-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stats.totalParticipants}</div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Engagement</CardTitle>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalEvents > 0 ? Math.round(stats.myRegistrations / stats.totalEvents * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}