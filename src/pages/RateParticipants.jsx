import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Timer, Brain, Users, CheckCircle, Search,
  Star, Flame, Target, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const DRILL_TYPES = [
  { value: '2k_run', label: '2K Run', unit: 'time' },
  { value: '300m_crawl', label: '300m Crawl', unit: 'time' },
  { value: 'stretcher_carry', label: 'Stretcher Carry', unit: 'time' },
  { value: 'obstacle_course', label: 'Obstacle Course', unit: 'time' },
  { value: 'swimming', label: 'Swimming', unit: 'time' },
  { value: 'other', label: 'Other', unit: 'custom' }
];

const LikertScale = ({ value, onChange, label, disabled }) => (
  <div className="space-y-2">
    <Label className="text-sm">{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((num) => (
        <button
          key={num}
          type="button"
          disabled={disabled}
          onClick={() => onChange(num)}
          className={`w-10 h-10 rounded-lg font-bold transition-all ${
            value === num 
              ? 'bg-indigo-600 text-white shadow-lg scale-110' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {num}
        </button>
      ))}
    </div>
  </div>
);

export default function RateParticipants() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [participants, setParticipants] = useState([]);
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Performance form
  const [performanceForm, setPerformanceForm] = useState({
    drill_type: '',
    drill_name: '',
    time_minutes: '',
    time_seconds: '',
    distance_meters: '',
    reps: '',
    notes: ''
  });

  // Mental toughness form
  const [mentalForm, setMentalForm] = useState({
    persistence_under_fatigue: null,
    teamwork_quality: null,
    leadership: null,
    adaptability: null,
    mental_focus: null,
    notes: ''
  });

  useEffect(() => {
    // [Fix P.1] Re-run when user resolves from AuthContext (null on first render)
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;

      // Check if user is instructor or admin
      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false);
        return;
      }

      const [usersData, eventsData, regsData] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Event.filter({ status: 'active' }, '-start_datetime', 50),
        base44.entities.EventRegistration.list()
      ]);

      setParticipants(usersData.filter(u => u.user_type === 'participant' && u.participant_status !== 'alumni'));
      setEvents(eventsData);
      setRegistrations(regsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventParticipants = () => {
    if (!selectedEvent) return participants;
    const eventRegs = registrations.filter(r => r.event_id === selectedEvent && r.status === 'registered');
    return participants.filter(p => eventRegs.some(r => r.participant_id === p.id));
  };

  const filteredParticipants = getEventParticipants().filter(p =>
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSavePerformance = async () => {
    if (!selectedParticipant || !performanceForm.drill_type) {
      toast.error('Please select a participant and drill type');
      return;
    }

    setSaving(true);
    try {
      const timeSeconds = (parseInt(performanceForm.time_minutes || 0) * 60) + parseInt(performanceForm.time_seconds || 0);
      
      await base44.entities.PerformanceRecord.create({
        participant_id: selectedParticipant.id,
        event_id: selectedEvent || null,
        recorded_by: user.id,
        record_date: new Date().toISOString().split('T')[0],
        drill_type: performanceForm.drill_type,
        drill_name: performanceForm.drill_name || null,
        time_seconds: timeSeconds > 0 ? timeSeconds : null,
        distance_meters: performanceForm.distance_meters ? parseFloat(performanceForm.distance_meters) : null,
        reps: performanceForm.reps ? parseInt(performanceForm.reps) : null,
        notes: performanceForm.notes || null
      });

      toast.success(`Performance recorded for ${selectedParticipant.full_name}`);
      setPerformanceForm({
        drill_type: '',
        drill_name: '',
        time_minutes: '',
        time_seconds: '',
        distance_meters: '',
        reps: '',
        notes: ''
      });
    } catch (error) {
      toast.error('Failed to save performance record');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMental = async () => {
    if (!selectedParticipant || !mentalForm.persistence_under_fatigue || !mentalForm.teamwork_quality) {
      toast.error('Please rate at least Persistence and Teamwork');
      return;
    }

    setSaving(true);
    try {
      await base44.entities.MentalToughnessRating.create({
        participant_id: selectedParticipant.id,
        event_id: selectedEvent || null,
        rated_by: user.id,
        rating_date: new Date().toISOString().split('T')[0],
        persistence_under_fatigue: mentalForm.persistence_under_fatigue,
        teamwork_quality: mentalForm.teamwork_quality,
        leadership: mentalForm.leadership,
        adaptability: mentalForm.adaptability,
        mental_focus: mentalForm.mental_focus,
        notes: mentalForm.notes || null
      });

      toast.success(`Mental toughness rated for ${selectedParticipant.full_name}`);
      setMentalForm({
        persistence_under_fatigue: null,
        teamwork_quality: null,
        leadership: null,
        adaptability: null,
        mental_focus: null,
        notes: ''
      });
    } catch (error) {
      toast.error('Failed to save mental toughness rating');
    } finally {
      setSaving(false);
    }
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
            <p className="text-gray-500">Only instructors and admins can rate participants.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Target className="w-8 h-8 text-indigo-600" />
          Rate Participants
        </h1>
        <p className="text-gray-500 mt-1">Record performance and mental toughness ratings</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Participant Selection */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600" />
              Select Participant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Filter by Event (Optional)</Label>
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger>
                  <SelectValue placeholder="All participants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Participants</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.title}{event.start_datetime && !isNaN(new Date(event.start_datetime)) ? ` - ${format(new Date(event.start_datetime), 'MMM d')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search participants..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {filteredParticipants.map((p) => (
                <div
                  key={p.id}
                  onClick={() => setSelectedParticipant(p)}
                  className={`p-3 rounded-xl cursor-pointer transition-all ${
                    selectedParticipant?.id === p.id
                      ? 'bg-indigo-100 border-2 border-indigo-300'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                      selectedParticipant?.id === p.id ? 'bg-indigo-600' : 'bg-gray-400'
                    }`}>
                      {p.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{p.full_name}</p>
                      <p className="text-xs text-gray-500">{p.email}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rating Forms */}
        <div className="lg:col-span-2">
          {selectedParticipant ? (
            <Tabs defaultValue="performance" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold">
                    {selectedParticipant.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedParticipant.full_name}</h2>
                    <p className="text-sm text-gray-500">{selectedParticipant.email}</p>
                  </div>
                </div>
                <TabsList className="bg-white shadow">
                  <TabsTrigger value="performance">
                    <Timer className="w-4 h-4 mr-2" />
                    Performance
                  </TabsTrigger>
                  <TabsTrigger value="mental">
                    <Brain className="w-4 h-4 mr-2" />
                    Mental
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="performance">
                <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Timer className="w-5 h-5 text-orange-500" />
                      Record Drill Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Drill Type *</Label>
                        <Select 
                          value={performanceForm.drill_type} 
                          onValueChange={(v) => setPerformanceForm({ ...performanceForm, drill_type: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select drill" />
                          </SelectTrigger>
                          <SelectContent>
                            {DRILL_TYPES.map((drill) => (
                              <SelectItem key={drill.value} value={drill.value}>{drill.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {performanceForm.drill_type === 'other' && (
                        <div className="space-y-2">
                          <Label>Drill Name</Label>
                          <Input
                            value={performanceForm.drill_name}
                            onChange={(e) => setPerformanceForm({ ...performanceForm, drill_name: e.target.value })}
                            placeholder="Custom drill name"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Time</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={performanceForm.time_minutes}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, time_minutes: e.target.value })}
                          placeholder="0"
                          className="w-24"
                        />
                        <span className="text-gray-500">min</span>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={performanceForm.time_seconds}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, time_seconds: e.target.value })}
                          placeholder="00"
                          className="w-24"
                        />
                        <span className="text-gray-500">sec</span>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Distance (meters)</Label>
                        <Input
                          type="number"
                          value={performanceForm.distance_meters}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, distance_meters: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Repetitions</Label>
                        <Input
                          type="number"
                          value={performanceForm.reps}
                          onChange={(e) => setPerformanceForm({ ...performanceForm, reps: e.target.value })}
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={performanceForm.notes}
                        onChange={(e) => setPerformanceForm({ ...performanceForm, notes: e.target.value })}
                        placeholder="Any observations..."
                        rows={2}
                      />
                    </div>

                    <Button 
                      onClick={handleSavePerformance} 
                      disabled={saving}
                      className="w-full bg-gradient-to-r from-orange-500 to-red-500"
                    >
                      {saving ? 'Saving...' : 'Save Performance Record'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="mental">
                <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-500" />
                      Mental Toughness Rating
                    </CardTitle>
                    <p className="text-sm text-gray-500">Rate on a scale of 1-5 (1 = Needs Work, 5 = Exceptional)</p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <LikertScale
                        label="Persistence Under Fatigue *"
                        value={mentalForm.persistence_under_fatigue}
                        onChange={(v) => setMentalForm({ ...mentalForm, persistence_under_fatigue: v })}
                      />
                      <LikertScale
                        label="Teamwork Quality *"
                        value={mentalForm.teamwork_quality}
                        onChange={(v) => setMentalForm({ ...mentalForm, teamwork_quality: v })}
                      />
                      <LikertScale
                        label="Leadership"
                        value={mentalForm.leadership}
                        onChange={(v) => setMentalForm({ ...mentalForm, leadership: v })}
                      />
                      <LikertScale
                        label="Adaptability"
                        value={mentalForm.adaptability}
                        onChange={(v) => setMentalForm({ ...mentalForm, adaptability: v })}
                      />
                      <LikertScale
                        label="Mental Focus"
                        value={mentalForm.mental_focus}
                        onChange={(v) => setMentalForm({ ...mentalForm, mental_focus: v })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Instructor Observations</Label>
                      <Textarea
                        value={mentalForm.notes}
                        onChange={(e) => setMentalForm({ ...mentalForm, notes: e.target.value })}
                        placeholder="Notes about this participant's mental performance..."
                        rows={3}
                      />
                    </div>

                    <Button 
                      onClick={handleSaveMental} 
                      disabled={saving}
                      className="w-full bg-gradient-to-r from-purple-500 to-indigo-500"
                    >
                      {saving ? 'Saving...' : 'Save Mental Toughness Rating'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur h-full">
              <CardContent className="py-20 text-center">
                <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">Select a participant to rate</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}