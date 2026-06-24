import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from
'recharts';
import {
  Trophy, TrendingUp, TrendingDown, Target, Brain,
  Timer, Flame, Medal, Star, ChevronUp, ChevronDown, Minus, Calendar, Clock } from
'lucide-react';
import { format, parseISO } from 'date-fns';
import LogEntryForm from '@/components/dashboard/LogEntryForm';

const DRILL_LABELS = {
  '1k_run': '1K Run',
  '2k_run': '2K Run',
  '3km_run': '3KM Run',
  '300m_crawl': '300M Crawl',
  'full_gan_saccer_crawl': 'Full Gan Saccer Crawl',
  'other': 'Other'
};

const DRILL_COLORS = {
  '1k_run': '#10b981',
  '2k_run': '#6366f1',
  '3km_run': '#ef4444',
  '300m_crawl': '#ec4899',
  'full_gan_saccer_crawl': '#14b8a6',
  'other': '#8b5cf6'
};

export default function WarriorDashboard() {
  const [user, setUser] = useState(null);
  const [performanceRecords, setPerformanceRecords] = useState([]);
  const [mentalRatings, setMentalRatings] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [allPerformance, setAllPerformance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [customDrills, setCustomDrills] = useState([]);
  const [sessionAssignments, setSessionAssignments] = useState([]);
  const [sessionPlans, setSessionPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attendancePeriod, setAttendancePeriod] = useState('monthly'); // 'monthly' | 'yearly'

  useEffect(() => {
    loadData();

    // Real-time: refresh leaderboard when any performance record is updated (e.g. approved)
    const unsubscribe = base44.entities.PerformanceRecord.subscribe((event) => {
      if (event.type === 'update' && event.data?.status === 'verified') {
        loadData();
      }
    });
    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const isParticipant = userData.user_type === 'participant';

      // ── [Fix PROFILE-2] NOTE — three entities required here ────────────────────────
      // BASE44 EDITOR: DO NOT CHANGE this block. WarriorDashboard is broken
      // because PerformanceRecord, MentalToughnessRating, and AttendanceRecord
      // don't exist in the schema. The fix is purely schema-level:
      //   Create: base44/entities/PerformanceRecord.jsonc    (done in this pass)
      //   Create: base44/entities/MentalToughnessRating.jsonc (done in this pass)
      //   Create: base44/entities/AttendanceRecord.jsonc      (done in this pass)
      // Once those three entities exist, this page will work as-is.
      // ── END NOTE ──────────────────────────────────────────────────────────────────

      // All roles: fetch common data in parallel
      const [myPerformance, myMental, drills, assignments, plans, allPerf, allAttend] = await Promise.all([
        base44.entities.PerformanceRecord.filter({ participant_id: userData.id }, 'record_date'),
        base44.entities.MentalToughnessRating.filter({ participant_id: userData.id }, 'rating_date'),
        base44.entities.CustomDrill.filter({ is_active: true }),
        base44.entities.SessionPlanAssignment.filter({ participant_id: userData.id, status: 'active' }),
        base44.entities.SessionPlan.list(),
        base44.entities.PerformanceRecord.filter({ status: 'verified' }),
        base44.entities.AttendanceRecord.filter({ status: 'present' }),
      ]);

      // Build user map: start with current user, then fetch all participant names
      // via a backend function that safely exposes only id + full_name
      let userMap = {};
      userMap[userData.id] = { id: userData.id, full_name: userData.full_name };

      // Also seed from performance records as fallback
      allPerf.forEach((r) => {
        if (r.participant_id && !userMap[r.participant_id]) {
          userMap[r.participant_id] = { id: r.participant_id, full_name: 'Participant' };
        }
      });

      try {
        const res = await base44.functions.invoke('getParticipantNames', {});
        (res.data?.participants || []).forEach(u => {
          userMap[u.id] = u;
        });
      } catch {
        // fallback already seeded above
      }

      setPerformanceRecords(myPerformance);
      setMentalRatings(myMental);
      setAllUsers(Object.values(userMap));
      setAllPerformance(allPerf);
      setAllAttendance(allAttend);
      setCustomDrills(drills);
      setSessionAssignments(assignments);
      setSessionPlans(plans);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };



  const formatTime = (seconds) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressIndicator = (records, drillType) => {
    const isCustomDrill = customDrills.some(d => d.id === drillType);
    const drillRecords = records.filter((r) => {
      if (isCustomDrill) return r.custom_drill_id === drillType;
      return r.drill_type === drillType;
    }).sort((a, b) =>
    new Date(a.record_date) - new Date(b.record_date)
    );
    if (drillRecords.length < 2) return null;

    const latest = drillRecords[drillRecords.length - 1].time_seconds;
    const previous = drillRecords[drillRecords.length - 2].time_seconds;
    const diff = previous - latest; // Positive = improvement (lower time)
    const percentChange = (diff / previous * 100).toFixed(1);

    if (diff > 0) return { type: 'up', value: percentChange, icon: <TrendingUp className="w-4 h-4 text-green-500" /> };
    if (diff < 0) return { type: 'down', value: Math.abs(percentChange), icon: <TrendingDown className="w-4 h-4 text-red-500" /> };
    return { type: 'same', value: 0, icon: <Minus className="w-4 h-4 text-gray-400" /> };
  };

  const getPersonalBest = (records, drillType) => {
    const isCustomDrill = customDrills.some(d => d.id === drillType);
    const drillRecords = records.filter((r) => {
      if (isCustomDrill) return r.custom_drill_id === drillType && r.time_seconds;
      return r.drill_type === drillType && r.time_seconds;
    });
    if (drillRecords.length === 0) return null;
    return Math.min(...drillRecords.map((r) => r.time_seconds));
  };

  const getLatestRecord = (records, drillType) => {
    const isCustomDrill = customDrills.some(d => d.id === drillType);
    const drillRecords = records.filter((r) => {
      if (isCustomDrill) return r.custom_drill_id === drillType;
      return r.drill_type === drillType;
    }).sort((a, b) =>
    new Date(b.record_date) - new Date(a.record_date)
    );
    return drillRecords[0];
  };

  const getDrillLabel = (drillType) => {
    if (DRILL_LABELS[drillType]) return DRILL_LABELS[drillType];
    const customDrill = customDrills.find(d => d.id === drillType);
    return customDrill?.name || drillType;
  };

  const getDrillColor = (drillType) => {
    if (DRILL_COLORS[drillType]) return DRILL_COLORS[drillType];
    const customDrill = customDrills.find(d => d.id === drillType);
    return customDrill?.color || '#6366f1';
  };

  const getAverageMentalScore = () => {
    if (mentalRatings.length === 0) return null;
    const latest = mentalRatings[mentalRatings.length - 1];
    const scores = [
    latest.persistence_under_fatigue,
    latest.teamwork_quality,
    latest.leadership,
    latest.adaptability,
    latest.mental_focus].
    filter((s) => s);
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
  };

  const getChartData = (drillType) => {
    const isCustomDrill = customDrills.some(d => d.id === drillType);
    return performanceRecords.
    filter((r) => {
      if (isCustomDrill) {
        return r.custom_drill_id === drillType && r.time_seconds;
      }
      return r.drill_type === drillType && r.time_seconds;
    }).
    sort((a, b) => new Date(a.record_date) - new Date(b.record_date)).
    map((r) => ({
      date: format(parseISO(r.record_date), 'MMM d'),
      time: r.time_seconds,
      timeFormatted: formatTime(r.time_seconds)
    }));
  };

  const getAttendanceLeaderboard = (period) => {
    const now = new Date();
    const filtered = allAttendance.filter((r) => {
      if (!r.marked_at) return false;
      const d = new Date(r.marked_at);
      if (period === 'monthly') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      } else {
        return d.getFullYear() === now.getFullYear();
      }
    });

    const byParticipant = {};
    filtered.forEach((r) => {
      const knownUser = allUsers.find(u => u.id === r.participant_id);
      // Only count participants, not admins or instructors
      if (knownUser && knownUser.user_type && knownUser.user_type !== 'participant') return;
      if (!byParticipant[r.participant_id]) {
        byParticipant[r.participant_id] = {
          user: knownUser || { id: r.participant_id, full_name: 'Participant' },
          points: 0
        };
      }
      byParticipant[r.participant_id].points += 1;
    });

    return Object.values(byParticipant).sort((a, b) => b.points - a.points);
  };

  const getLeaderboard = (drillType) => {
    const isCustomDrill = customDrills.some(d => d.id === drillType);

    // Filter relevant verified records for this drill
    const relevantRecords = allPerformance.filter((r) => {
      if (!r.time_seconds) return false;
      if (isCustomDrill) return r.custom_drill_id === drillType;
      return r.drill_type === drillType;
    });

    // Group by participant and find best time, using allUsers for names when available
    const byParticipant = {};
    relevantRecords.forEach((r) => {
      if (!byParticipant[r.participant_id] || r.time_seconds < byParticipant[r.participant_id].bestTime) {
        const knownUser = allUsers.find(u => u.id === r.participant_id);
        byParticipant[r.participant_id] = {
          user: knownUser || { id: r.participant_id, full_name: r.participant_name || 'Participant' },
          bestTime: r.time_seconds
        };
      }
    });

    return Object.values(byParticipant).sort((a, b) => a.bestTime - b.bestTime);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  const drillTypes = ['1k_run', '2k_run', '3km_run', '300m_crawl', 'full_gan_saccer_crawl'];
  const customDrillTypes = customDrills.map(d => ({
    id: d.id,
    name: d.name,
    color: d.color || '#6366f1'
  }));
  const allDrillTypes = [...drillTypes, ...customDrillTypes.map(d => d.id)];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-slate-100 text-3xl font-bold flex items-center gap-3">Warrior Dashboard


          </h1>
          <p className="text-slate-100 mt-1">Track your growth, push your limits</p>
        </div>

      </div>

      {/* Log Entry Form */}
      <LogEntryForm user={user} onSubmitted={loadData} />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {drillTypes.slice(0, 3).map((drill) => {
          const pb = getPersonalBest(performanceRecords, drill);
          const progress = getProgressIndicator(performanceRecords, drill);
          return (
            <Card key={drill} className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500 uppercase">{DRILL_LABELS[drill]}</span>
                  {progress && progress.icon}
                </div>
                <p className="text-2xl font-bold" style={{ color: getDrillColor(drill) }}>
                  {pb ? formatTime(pb) : '--:--'}
                </p>
                <p className="text-xs text-gray-500">Personal Best</p>
                {progress && progress.type !== 'same' &&
                <p className={`text-xs mt-1 ${progress.type === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {progress.type === 'up' ? '↑' : '↓'} {progress.value}% from last
                  </p>
                }
              </CardContent>
            </Card>);

        })}
        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="bg-red-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-purple-100 uppercase">Mental Index</span>
              <Brain className="w-4 h-4 text-purple-200" />
            </div>
            <p className="text-2xl font-bold">{getAverageMentalScore() || '-'}/5</p>
            <p className="text-xs text-purple-100">Latest Score</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="progress" className="space-y-4">
        <TabsList className="bg-white shadow-lg rounded-xl p-1">
          <TabsTrigger value="progress" className="rounded-lg">
            <TrendingUp className="w-4 h-4 mr-2" />
            Progress
          </TabsTrigger>
          <TabsTrigger value="mental" className="rounded-lg">
            <Brain className="w-4 h-4 mr-2" />
            Mental Toughness
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-lg">
            <Trophy className="w-4 h-4 mr-2" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        {/* Progress Tab */}
        <TabsContent value="progress" className="space-y-6">
          {allDrillTypes.map((drill) => {
            const chartData = getChartData(drill);
            const latest = getLatestRecord(performanceRecords, drill);
            const pb = getPersonalBest(performanceRecords, drill);

            return (
              <Card key={drill} className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getDrillColor(drill) }} />
                      {getDrillLabel(drill)}
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Latest: </span>
                        <span className="font-bold">{latest ? formatTime(latest.time_seconds) : '-'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">PB: </span>
                        <span className="font-bold text-green-600">{pb ? formatTime(pb) : '-'}</span>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ?
                  <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                          <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => formatTime(v)}
                          domain={['dataMin - 30', 'dataMax + 30']} />

                          <Tooltip
                          formatter={(value) => [formatTime(value), 'Time']}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />

                          <Line
                          type="monotone"
                          dataKey="time"
                          stroke={getDrillColor(drill)}
                          strokeWidth={2}
                          dot={{ r: 4, fill: getDrillColor(drill) }}
                          activeDot={{ r: 6 }} />

                        </LineChart>
                      </ResponsiveContainer>
                    </div> :

                  <div className="h-48 flex items-center justify-center text-gray-400">
                      <div className="text-center">
                        <Timer className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No records yet for this drill</p>
                      </div>
                    </div>
                  }
                </CardContent>
              </Card>);

          })}
        </TabsContent>

        {/* Mental Toughness Tab */}
        <TabsContent value="mental" className="space-y-6">
          {mentalRatings.length === 0 ?
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardContent className="py-12 text-center">
                <Brain className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No mental toughness ratings yet</p>
                <p className="text-sm text-gray-400 mt-1">Instructors will rate you after training sessions</p>
              </CardContent>
            </Card> :

          <>
              {/* Latest Rating */}
              <Card className="border-none shadow-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Latest Mental Toughness Index
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                  const latest = mentalRatings[mentalRatings.length - 1];
                  const categories = [
                  { key: 'persistence_under_fatigue', label: 'Persistence Under Fatigue' },
                  { key: 'teamwork_quality', label: 'Teamwork Quality' },
                  { key: 'leadership', label: 'Leadership' },
                  { key: 'adaptability', label: 'Adaptability' },
                  { key: 'mental_focus', label: 'Mental Focus' }];

                  return (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          {categories.map((cat) =>
                        <div key={cat.key} className="text-center">
                              <p className="text-3xl font-bold">{latest[cat.key] || '-'}</p>
                              <p className="text-xs text-purple-200">{cat.label}</p>
                            </div>
                        )}
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-white/20">
                          <span className="text-sm text-purple-200">
                            Rated on {format(parseISO(latest.rating_date), 'MMM d, yyyy')}
                          </span>
                          {latest.notes &&
                        <span className="text-sm italic text-purple-200">"{latest.notes}"</span>
                        }
                        </div>
                      </div>);

                })()}
                </CardContent>
              </Card>

              {/* Rating History Chart */}
              <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Mental Toughness Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={mentalRatings.map((r) => ({
                      date: format(parseISO(r.rating_date), 'MMM d'),
                      persistence: r.persistence_under_fatigue,
                      teamwork: r.teamwork_quality,
                      leadership: r.leadership,
                      adaptability: r.adaptability,
                      focus: r.mental_focus
                    }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                        <Legend />
                        <Line type="monotone" dataKey="persistence" name="Persistence" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="teamwork" name="Teamwork" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="leadership" name="Leadership" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="adaptability" name="Adaptability" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="focus" name="Focus" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* All Ratings */}
              <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle>Rating History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...mentalRatings].reverse().map((rating, idx) =>
                  <div key={rating.id} className="p-4 bg-gray-50 rounded-xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{format(parseISO(rating.rating_date), 'MMMM d, yyyy')}</span>
                          <Badge variant="outline">Session #{mentalRatings.length - idx}</Badge>
                        </div>
                        <div className="grid grid-cols-5 gap-2 text-center text-sm">
                          <div><p className="font-bold text-red-600">{rating.persistence_under_fatigue}</p><p className="text-xs text-gray-500">Persist.</p></div>
                          <div><p className="font-bold text-green-600">{rating.teamwork_quality}</p><p className="text-xs text-gray-500">Team</p></div>
                          <div><p className="font-bold text-blue-600">{rating.leadership || '-'}</p><p className="text-xs text-gray-500">Lead</p></div>
                          <div><p className="font-bold text-amber-600">{rating.adaptability || '-'}</p><p className="text-xs text-gray-500">Adapt</p></div>
                          <div><p className="font-bold text-purple-600">{rating.mental_focus || '-'}</p><p className="text-xs text-gray-500">Focus</p></div>
                        </div>
                        {rating.notes && <p className="text-sm text-gray-600 mt-2 italic">"{rating.notes}"</p>}
                      </div>
                  )}
                  </div>
                </CardContent>
              </Card>
            </>
          }
        </TabsContent>

        {/* Leaderboard Tab */}
        <TabsContent value="leaderboard" className="space-y-6">
          {/* Attendance Leaderboard */}
          {(() => {
            const attendanceRankings = getAttendanceLeaderboard(attendancePeriod);
            const myAttendanceRank = attendanceRankings.findIndex(r => r.user.id === user?.id) + 1;
            const now = new Date();
            const periodLabel = attendancePeriod === 'monthly'
              ? now.toLocaleString('default', { month: 'long', year: 'numeric' })
              : `Year ${now.getFullYear()}`;
            return (
              <Card className="border-none shadow-lg bg-white/80 backdrop-blur border-2 border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500" />
                      Attendance Leaderboard
                      <span className="text-sm font-normal text-gray-500">— {periodLabel}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {myAttendanceRank > 0 && (
                        <Badge className="bg-amber-100 text-amber-800">Your Rank: #{myAttendanceRank}</Badge>
                      )}
                      <div className="flex rounded-lg overflow-hidden border border-gray-200">
                        <button
                          onClick={() => setAttendancePeriod('monthly')}
                          className={`px-3 py-1 text-xs font-medium transition-colors ${attendancePeriod === 'monthly' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >Monthly</button>
                        <button
                          onClick={() => setAttendancePeriod('yearly')}
                          className={`px-3 py-1 text-xs font-medium transition-colors ${attendancePeriod === 'yearly' ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                        >Yearly</button>
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {attendanceRankings.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No attendance records for this period</p>
                  ) : (
                    <div className="space-y-2">
                      {attendanceRankings.slice(0, 10).map((entry, idx) => {
                        const isMe = entry.user.id === user?.id;
                        return (
                          <div
                            key={entry.user.id}
                            className={`flex items-center justify-between p-3 rounded-xl ${isMe ? 'bg-amber-50 border-2 border-amber-200' : 'bg-gray-50'}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                                idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                idx === 2 ? 'bg-amber-600 text-white' :
                                'bg-gray-200 text-gray-600'}`}>
                                {idx < 3 ? <Medal className="w-4 h-4" /> : idx + 1}
                              </div>
                              <p className={`font-medium ${isMe ? 'text-amber-700' : ''}`}>
                                {entry.user.full_name || 'Anonymous'}
                                {isMe && <span className="ml-2 text-xs text-amber-500">(You)</span>}
                              </p>
                            </div>
                            <div className="font-bold text-amber-600">
                              {entry.points} {entry.points === 1 ? 'pt' : 'pts'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}

          {allDrillTypes.map((drill) => {
            const rankings = getLeaderboard(drill);
            const myRank = rankings.findIndex((r) => r.user.id === user?.id) + 1;

            return (
              <Card key={drill} className="border-none shadow-lg bg-white/80 backdrop-blur">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getDrillColor(drill) }} />
                      {getDrillLabel(drill)} Leaderboard
                    </div>
                    {myRank > 0 &&
                    <Badge className="bg-indigo-100 text-indigo-800">
                        Your Rank: #{myRank}
                      </Badge>
                    }
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rankings.length === 0 ?
                  <p className="text-center text-gray-500 py-4">No rankings yet</p> :

                  <div className="space-y-2">
                      {rankings.slice(0, 10).map((entry, idx) => {
                      const isMe = entry.user.id === user?.id;
                      return (
                        <div
                          key={entry.user.id}
                          className={`flex items-center justify-between p-3 rounded-xl ${
                          isMe ? 'bg-indigo-50 border-2 border-indigo-200' : 'bg-gray-50'}`
                          }>

                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                            idx === 0 ? 'bg-yellow-400 text-yellow-900' :
                            idx === 1 ? 'bg-gray-300 text-gray-700' :
                            idx === 2 ? 'bg-amber-600 text-white' :
                            'bg-gray-200 text-gray-600'}`
                            }>
                                {idx < 3 ?
                              <Medal className="w-4 h-4" /> :

                              idx + 1
                              }
                              </div>
                              <div>
                                <p className={`font-medium ${isMe ? 'text-indigo-700' : ''}`}>
                                  {entry.user.full_name || 'Anonymous'}
                                  {isMe && <span className="ml-2 text-xs text-indigo-500">(You)</span>}
                                </p>
                              </div>
                            </div>
                            <div className="font-bold" style={{ color: getDrillColor(drill) }}>
                              {formatTime(entry.bestTime)}
                            </div>
                          </div>);

                    })}
                    </div>
                  }
                </CardContent>
              </Card>);

          })}
        </TabsContent>
      </Tabs>
    </div>);

}