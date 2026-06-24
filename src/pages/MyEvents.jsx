import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, MapPin, ArrowRight, CheckCircle, XCircle, AlertTriangle, Filter } from 'lucide-react';
import { format, isPast } from 'date-fns';

export default function MyEvents() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    // [Fix P.1] Re-run when user resolves from AuthContext (null on first render)
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;

      const [regsData, eventsData, catsData] = await Promise.all([
      base44.entities.EventRegistration.filter({ participant_id: userData.id }),
      base44.entities.Event.list(),
      base44.entities.EventCategory.list()]
      );

      setRegistrations(regsData);
      setEvents(eventsData);
      setCategories(catsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEvent = (eventId) => events.find((e) => e.id === eventId);
  const getCategory = (categoryId) => categories.find((c) => c.id === categoryId);

  const activeRegistrations = registrations.filter((r) => r.status === 'registered');
  const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled');
  const attendedRegistrations = registrations.filter((r) => r.status === 'attended');

  const upcomingEvents = activeRegistrations.
  map((r) => ({ ...r, event: getEvent(r.event_id) })).
  filter((r) => r.event && new Date(r.event.start_datetime) > new Date()).
  sort((a, b) => new Date(a.event.start_datetime) - new Date(b.event.start_datetime));

  const pastEvents = activeRegistrations.
  map((r) => ({ ...r, event: getEvent(r.event_id) })).
  filter((r) => {
    if (!r.event || new Date(r.event.start_datetime) > new Date()) return false;
    if (selectedCategory === 'all') return true;
    return r.event.category_id === selectedCategory;
  }).
  sort((a, b) => new Date(b.event.start_datetime) - new Date(a.event.start_datetime));

  const attendedEvents = attendedRegistrations.
  map((r) => ({ ...r, event: getEvent(r.event_id) })).
  filter((r) => {
    if (!r.event) return false;
    if (selectedCategory === 'all') return true;
    return r.event.category_id === selectedCategory;
  }).
  sort((a, b) => new Date(b.event.start_datetime) - new Date(a.event.start_datetime));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  const EventRow = ({ registration, showStatus = false }) => {
    const event = registration.event;
    if (!event) return null;
    const category = getCategory(event.category_id);
    const eventIsPast = isPast(new Date(event.start_datetime));

    return (
      <Link to={createPageUrl(`EventDetails?id=${event.id}`)}>
        <div className={`p-4 bg-white rounded-xl border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-0.5 ${eventIsPast ? 'opacity-70' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {category &&
                <Badge
                  variant="secondary"
                  className="text-xs"
                  style={{ backgroundColor: `${category.color}20`, color: category.color }}>

                    {category.name}
                  </Badge>
                }
                {showStatus && registration.status === 'cancelled' &&
                <Badge variant="outline" className="text-red-600 border-red-200">
                    <XCircle className="w-3 h-3 mr-1" />
                    Cancelled
                  </Badge>
                }
                {showStatus && registration.status === 'attended' &&
                <Badge variant="outline" className="text-green-600 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Attended
                  </Badge>
                }
                {eventIsPast && !showStatus &&
                <Badge variant="secondary" className="text-xs">Past</Badge>
                }
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{event.title}</h3>
              <div className="flex flex-wrap gap-3 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(event.start_datetime), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <Clock className="w-4 h-4" />
                  <span>{format(new Date(event.start_datetime), 'h:mm a')}</span>
                </div>
                {event.location &&
                <div className="flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                }
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400" />
          </div>
        </div>
      </Link>);

  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-slate-200 text-3xl font-bold">My Events</h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold">{upcomingEvents.length}</p>
            <p className="text-indigo-100 text-sm">Upcoming</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold">{attendedRegistrations.length}</p>
            <p className="text-green-100 text-sm">Attended</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6 text-center">
            <p className="text-3xl font-bold">{pastEvents.length + attendedRegistrations.length}</p>
            <p className="text-purple-100 text-sm">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Filter */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <Label className="text-sm mb-2 block">Filter by Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) =>
                  <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList className="bg-white shadow-lg rounded-xl p-1">
          <TabsTrigger value="upcoming" className="rounded-lg">
            Upcoming ({upcomingEvents.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg">
            Past ({pastEvents.length})
          </TabsTrigger>
          <TabsTrigger value="attended" className="rounded-lg">
            Attended ({attendedEvents.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="rounded-lg">
            Cancelled ({cancelledRegistrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {upcomingEvents.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 mb-4">No upcoming events</p>
                <Link to={createPageUrl('Events')}>
                  <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
                    Browse Events
                  </Button>
                </Link>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {upcomingEvents.map((reg) =>
            <EventRow key={reg.id} registration={reg} />
            )}
            </div>
          }
        </TabsContent>

        <TabsContent value="past">
          {pastEvents.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No past events</p>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {pastEvents.map((reg) =>
            <EventRow key={reg.id} registration={reg} />
            )}
            </div>
          }
        </TabsContent>

        <TabsContent value="attended">
          {attendedEvents.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No attended events</p>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {attendedEvents.map((reg) =>
            <EventRow key={reg.id} registration={reg} showStatus />
            )}
            </div>
          }
        </TabsContent>

        <TabsContent value="cancelled">
          {cancelledRegistrations.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <XCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No cancelled registrations</p>
              </CardContent>
            </Card> :

          <div className="space-y-3">
              {cancelledRegistrations.map((reg) => {
              const event = getEvent(reg.event_id);
              return event ?
              <EventRow key={reg.id} registration={{ ...reg, event }} showStatus /> :
              null;
            })}
            </div>
          }
        </TabsContent>
      </Tabs>
    </div>);

}