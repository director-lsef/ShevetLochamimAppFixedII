import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend, Area, AreaChart
} from 'recharts';
import { 
  Calendar, Users, TrendingUp, Award, Download,
  ChevronDown, Filter, BarChart3, PieChartIcon, FileDown, FileText
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, getYear, getMonth, parseISO, isWithinInterval } from 'date-fns';
import { filterParticipants } from '@/utils/userHelpers';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import LowEngagementReport from '@/components/statistics/LowEngagementReport';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

export default function Statistics() {
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [eventsData, regsData, usersData, catsData, attendanceData] = await Promise.all([
        base44.entities.Event.filter({ status: 'active' }, '-start_datetime', 500),
        base44.entities.EventRegistration.list('-created_date', 500),
        base44.entities.User.list(),
        base44.entities.EventCategory.list(),
        // ── [Fix PROFILE-2] NOTE — AttendanceRecord entity must exist ───────────────
        // BASE44 EDITOR: This call will fail until AttendanceRecord.jsonc is created.
        // FIX: Create base44/entities/AttendanceRecord.jsonc (done in this pass).
        // DO NOT change the query — it is correct.
        base44.entities.AttendanceRecord.list('-marked_at', 500)
      ]);

      setEvents(eventsData);
      setRegistrations(regsData);
      setUsers(usersData);
      setCategories(catsData);
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const participants = useMemo(() => 
    filterParticipants(users),
    [users]
  );

  const instructors = useMemo(() => 
    users.filter(u => u.user_type === 'instructor' || u.user_type === 'admin'),
    [users]
  );

  // ── [Fix 4.1] UNLOCK THIS LINE — clarify registered vs attended distinction ─────
  // BASE44 EDITOR: This filter includes BOTH 'registered' (future/unconfirmed) and
  // 'attended' (confirmed present) records. For ATTENDANCE metrics (who actually
  // showed up), only 'attended' should count. For REGISTRATION metrics (who signed up),
  // 'registered' is correct. Mixing them inflates all attendance stats.
  //
  // The current useMemo name 'activeRegistrations' is used in participantMonthlyStats
  // and attendanceTrends to count event participation. Those callers want ACTUAL
  // attendance, not just sign-ups.
  //
  // FIX: Split into two separate memos — one for each purpose.
  // OLD (single mixed set — replace this entire block):
  //   const activeRegistrations = registrations.filter(r => r.status === 'registered' || r.status === 'attended');
  //
  // NEW (two separate sets — use these going forward):
  //   const confirmedAttendance = useMemo(() =>
  //     registrations.filter(r => r.status === 'attended'),
  //     [registrations]
  //   );
  //   const activeRegistrations = useMemo(() =>
  //     registrations.filter(r => r.status === 'registered' || r.status === 'attended'),
  //     [registrations]
  //   );
  //
  // Then update participantMonthlyStats and attendanceTrends to use confirmedAttendance
  // instead of activeRegistrations where the goal is counting actual attendance.
  //
  // KEEP THE EXISTING CODE BELOW until the downstream callers are also updated,
  // to avoid breaking anything mid-edit.
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────
  const activeRegistrations = useMemo(() => 
    registrations.filter(r => r.status === 'registered' || r.status === 'attended'),
    [registrations]
  );

  // Filtered data based on date range and category
  const filteredEvents = useMemo(() => {
    let filtered = events;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter(e => {
        const eventDate = new Date(e.start_datetime);
        return isWithinInterval(eventDate, { start, end });
      });
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category_id === selectedCategory);
    }
    
    return filtered;
  }, [events, startDate, endDate, selectedCategory]);

  const availableYears = useMemo(() => {
    const years = new Set();
    events.forEach(e => {
      if (e.start_datetime) {
        years.add(getYear(new Date(e.start_datetime)).toString());
      }
    });
    registrations.forEach(r => {
      if (r.created_date) {
        years.add(getYear(new Date(r.created_date)).toString());
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [events, registrations]);

  // Monthly breakdown for the program
  const monthlyProgramStats = useMemo(() => {
    const months = [];
    const year = parseInt(selectedYear);
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = endOfMonth(startDate);
      
      const monthEvents = events.filter(e => {
        const eventDate = new Date(e.start_datetime);
        return eventDate >= startDate && eventDate <= endDate;
      });

      const monthRegs = activeRegistrations.filter(r => {
        const event = events.find(e => e.id === r.event_id);
        if (!event) return false;
        const eventDate = new Date(event.start_datetime);
        return eventDate >= startDate && eventDate <= endDate;
      });

      const uniqueParticipants = new Set(monthRegs.map(r => r.participant_id)).size;

      months.push({
        month: format(startDate, 'MMM'),
        events: monthEvents.length,
        registrations: monthRegs.length,
        uniqueParticipants,
        attended: monthRegs.filter(r => r.status === 'attended').length
      });
    }
    
    return months;
  }, [events, activeRegistrations, selectedYear]);

  // Participant monthly breakdown
  const participantMonthlyStats = useMemo(() => {
    const stats = {};
    const year = parseInt(selectedYear);
    
    participants.forEach(p => {
      stats[p.id] = {
        name: p.full_name || p.email,
        total: 0,
        months: {}
      };
      
      for (let month = 0; month < 12; month++) {
        stats[p.id].months[month] = 0;
      }
    });

    // ── [Fix 4.1] UNLOCK THIS forEach — change to confirmedAttendance ────────────
    // BASE44 EDITOR: Once confirmedAttendance is defined (see annotation above),
    // replace 'activeRegistrations' with 'confirmedAttendance' in this loop.
    // This makes the participant stats reflect actual attendance, not just sign-ups.
    // Also add confirmedAttendance to the useMemo dependency array.
    //
    // OLD: activeRegistrations.forEach(r => { ... })
    // NEW: confirmedAttendance.forEach(r => { ... })
    // ── END UNLOCK ─────────────────────────────────────────────────────────────────
    activeRegistrations.forEach(r => {
      const event = events.find(e => e.id === r.event_id);
      if (!event) return;
      
      const eventDate = new Date(event.start_datetime);
      if (getYear(eventDate) !== year) return;
      
      if (stats[r.participant_id]) {
        stats[r.participant_id].months[getMonth(eventDate)]++;
        stats[r.participant_id].total++;
      }
    });

    return Object.entries(stats)
      .map(([id, data]) => ({
        id,
        ...data,
        monthlyData: Object.entries(data.months).map(([m, count]) => ({
          month: format(new Date(year, parseInt(m), 1), 'MMM'),
          count
        }))
      }))
      .sort((a, b) => b.total - a.total);
  }, [participants, activeRegistrations, events, selectedYear]);

  // Category breakdown
  const categoryStats = useMemo(() => {
    const stats = {};
    
    categories.forEach(c => {
      stats[c.id] = {
        name: c.name,
        color: c.color,
        events: 0,
        registrations: 0
      };
    });

    events.forEach(e => {
      if (e.category_id && stats[e.category_id]) {
        stats[e.category_id].events++;
      }
    });

    activeRegistrations.forEach(r => {
      const event = events.find(e => e.id === r.event_id);
      if (event?.category_id && stats[event.category_id]) {
        stats[event.category_id].registrations++;
      }
    });

    return Object.values(stats).filter(s => s.events > 0);
  }, [categories, events, activeRegistrations]);

  // Yearly comparison
  const yearlyStats = useMemo(() => {
    const stats = {};
    
    availableYears.forEach(year => {
      stats[year] = {
        year,
        events: 0,
        registrations: 0,
        uniqueParticipants: new Set()
      };
    });

    events.forEach(e => {
      if (e.start_datetime) {
        const year = getYear(new Date(e.start_datetime)).toString();
        if (stats[year]) {
          stats[year].events++;
        }
      }
    });

    activeRegistrations.forEach(r => {
      const event = events.find(e => e.id === r.event_id);
      if (event?.start_datetime) {
        const year = getYear(new Date(event.start_datetime)).toString();
        if (stats[year]) {
          stats[year].registrations++;
          stats[year].uniqueParticipants.add(r.participant_id);
        }
      }
    });

    return Object.values(stats).map(s => ({
      ...s,
      uniqueParticipants: s.uniqueParticipants.size
    }));
  }, [availableYears, events, activeRegistrations]);

  // Total events for current calendar year (active only, matches calendar)
  const totalEventsThisYear = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return events.filter(e => {
      const eventDate = new Date(e.start_datetime);
      return getYear(eventDate) === currentYear;
    }).length;
  }, [events]);

  // Top participants
  const topParticipants = useMemo(() => {
    return participantMonthlyStats.slice(0, 10);
  }, [participantMonthlyStats]);

  // Attendance rate
  const attendanceRate = useMemo(() => {
    const attended = registrations.filter(r => r.status === 'attended').length;
    const total = activeRegistrations.length;
    return total > 0 ? Math.round((attended / total) * 100) : 0;
  }, [registrations, activeRegistrations]);

  // Attendance trends over time
  const attendanceTrends = useMemo(() => {
    const trends = [];
    const year = parseInt(selectedYear);
    
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = endOfMonth(startDate);
      
      const monthEvents = events.filter(e => {
        const eventDate = new Date(e.start_datetime);
        return eventDate >= startDate && eventDate <= endDate;
      });

      const eventIds = monthEvents.map(e => e.id);
      const monthAttendance = attendance.filter(a => eventIds.includes(a.event_id));
      
      const present = monthAttendance.filter(a => a.status === 'present').length;
      const late = monthAttendance.filter(a => a.status === 'late').length;
      const absent = monthAttendance.filter(a => a.status === 'absent').length;
      const total = present + late + absent;
      
      trends.push({
        month: format(startDate, 'MMM'),
        present,
        late,
        absent,
        total,
        rate: total > 0 ? Math.round((present / total) * 100) : 0
      });
    }
    
    return trends;
  }, [events, attendance, selectedYear]);

  // ── [Fix 3.3] UNLOCK THIS ENTIRE useMemo — fix instructor slot counting ────────
  // BASE44 EDITOR: Two changes needed inside this useMemo:
  //
  //   CHANGE 1 — Replace single-slot lookup with all-5-slots loop.
  //   An instructor assigned to slot 2, 3, 4, or 5 currently counts as 0 events.
  //   Only lead_instructor_id is checked. All 5 slots must be checked.
  //
  //   OLD (only counts lead slot):
  //     const instructorId = e.lead_instructor_id || e.instructor_id;
  //     if (instructorId && metrics[instructorId]) {
  //       metrics[instructorId].eventsLed++;
  //
  //   NEW (count across all 5 slots — replace the filteredEvents.forEach entirely):
  //     const ALL_SLOTS = ['lead_instructor_id','assistant_instructor_id',
  //                        'support_instructor_id','instructor_4_id','instructor_5_id'];
  //     filteredEvents.forEach(e => {
  //       ALL_SLOTS.forEach(slot => {
  //         const instructorId = e[slot];
  //         if (instructorId && metrics[instructorId]) {
  //           metrics[instructorId].eventsLed++;
  //           ... rest of per-event metrics ...
  //         }
  //       });
  //     });
  //
  //   CHANGE 2 — Add belowMinimum flag to the final .map().
  //   Instructors with eventsLed < 2 in a month should be flagged.
  //   Add: belowMinimum: m.eventsLed < 2
  //   The table row JSX can then highlight those rows (see annotation below).
  //
  //   CHANGE 3 — Remove the .filter(m => m.eventsLed > 0) guard, OR change it
  //   to include ALL instructors so the table shows those with 0 events too
  //   (they should be flagged as belowMinimum).
  //   NEW: .filter(m => true)  OR just remove the .filter() entirely.
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────

  // Instructor performance metrics
  const INSTRUCTOR_MONTHLY_MIN = 2; // [Fix 3.3] Minimum events per month requirement
  const instructorMetrics = useMemo(() => {
    const metrics = {};
    
    instructors.forEach(inst => {
      metrics[inst.id] = {
        id: inst.id,
        name: inst.full_name || inst.email,
        eventsLed: 0,
        totalRegistrations: 0,
        avgAttendance: 0,
        totalAttendance: 0,
        eventsWithAttendance: 0
      };
    });

    // [Fix 3.3 — IMPLEMENTED] Count across ALL 5 instructor slots, not just lead.
    // An instructor in any slot (lead, assistant, support, 4, 5) gets event credit.
    const ALL_SLOTS = ['lead_instructor_id', 'assistant_instructor_id',
                       'support_instructor_id', 'instructor_4_id', 'instructor_5_id'];
    filteredEvents.forEach(e => {
      ALL_SLOTS.forEach(slot => {
        const instructorId = e[slot];
        if (instructorId && metrics[instructorId]) {
          metrics[instructorId].eventsLed++;

          const eventRegs = registrations.filter(r => r.event_id === e.id);
          metrics[instructorId].totalRegistrations += eventRegs.length;

          const eventAttendance = attendance.filter(a => a.event_id === e.id);
          const present = eventAttendance.filter(a => a.status === 'present').length;
          const total = eventAttendance.length;

          if (total > 0) {
            metrics[instructorId].totalAttendance += (present / total) * 100;
            metrics[instructorId].eventsWithAttendance++;
          }
        }
      });
    });

    return Object.values(metrics)
      .filter(m => m.eventsLed > 0)
      .map(m => ({
        ...m,
        avgAttendance: m.eventsWithAttendance > 0 
          ? Math.round(m.totalAttendance / m.eventsWithAttendance) 
          : 0,
        avgRegistrations: m.eventsLed > 0 
          ? (m.totalRegistrations / m.eventsLed).toFixed(1) 
          : 0,
        // [Fix 3.3] NEW field — flag instructors below monthly minimum
        // Requires the filteredEvents loop to count all slots first (see above)
        belowMinimum: m.eventsLed < INSTRUCTOR_MONTHLY_MIN,
      }))
      .sort((a, b) => b.eventsLed - a.eventsLed);
  }, [instructors, filteredEvents, registrations, attendance]);

  // Export to CSV
  const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) {
      toast.error('No data to export');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('CSV exported successfully');
  };

  // Export to PDF
  const exportToPDF = (title, data) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Title
      doc.setFontSize(18);
      doc.text(title, pageWidth / 2, 20, { align: 'center' });
      
      // Date
      doc.setFontSize(10);
      doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy h:mm a')}`, pageWidth / 2, 30, { align: 'center' });
      
      let yPos = 45;
      
      // Content
      doc.setFontSize(12);
      data.forEach((item, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`${item}`, 20, yPos);
        yPos += 10;
      });
      
      doc.save(`${title.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
        </div>

        {/* Filters */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger>
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Export</Label>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => exportToCSV(monthlyProgramStats, 'monthly_stats')}
                    className="flex-1"
                  >
                    <FileText className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const data = monthlyProgramStats.map(m => 
                        `${m.month}: ${m.events} events, ${m.registrations} registrations`
                      );
                      exportToPDF('Monthly Statistics', data);
                    }}
                    className="flex-1"
                  >
                    <FileDown className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-sm">Total Events ({new Date().getFullYear()})</p>
                <p className="text-3xl font-bold">{totalEventsThisYear}</p>
              </div>
              <Calendar className="w-8 h-8 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Total Registrations</p>
                <p className="text-3xl font-bold">{activeRegistrations.length}</p>
              </div>
              <Users className="w-8 h-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-sm">Active Participants</p>
                <p className="text-3xl font-bold">{participants.length}</p>
              </div>
              <Award className="w-8 h-8 text-pink-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Attendance Rate</p>
                <p className="text-3xl font-bold">{attendanceRate}%</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList className="bg-white shadow-lg rounded-xl p-1">
          <TabsTrigger value="monthly" className="rounded-lg">Monthly Program</TabsTrigger>
          <TabsTrigger value="attendance" className="rounded-lg">Attendance Trends</TabsTrigger>
          <TabsTrigger value="instructors" className="rounded-lg">Instructors</TabsTrigger>
          <TabsTrigger value="participants" className="rounded-lg">Participants</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg">Categories</TabsTrigger>
          <TabsTrigger value="yearly" className="rounded-lg">Yearly</TabsTrigger>
          <TabsTrigger value="engagement" className="rounded-lg text-amber-600 font-semibold">⚠ Engagement</TabsTrigger>
        </TabsList>

        {/* Attendance Trends */}
        <TabsContent value="attendance">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance Trends - {selectedYear}</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToCSV(attendanceTrends, 'attendance_trends')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrends}>
                    <defs>
                      <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                      }} 
                    />
                    <Legend />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#22c55e" fillOpacity={1} fill="url(#colorPresent)" />
                    <Area type="monotone" dataKey="late" name="Late" stroke="#eab308" fillOpacity={1} fill="url(#colorLate)" />
                    <Area type="monotone" dataKey="absent" name="Absent" stroke="#ef4444" fillOpacity={1} fill="url(#colorAbsent)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Attendance Rate by Month</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={attendanceTrends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" />
                      <YAxis domain={[0, 100]} label={{ value: 'Rate (%)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="rate" name="Attendance Rate" stroke="#6366f1" strokeWidth={3} dot={{ r: 6, fill: '#6366f1' }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Present</TableHead>
                      <TableHead className="text-right">Late</TableHead>
                      <TableHead className="text-right">Absent</TableHead>
                      <TableHead className="text-right">Total Marked</TableHead>
                      <TableHead className="text-right">Rate (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendanceTrends.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-green-100 text-green-800">{row.present}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-yellow-100 text-yellow-800">{row.late}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-red-100 text-red-800">{row.absent}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{row.total}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.rate >= 80 ? 'default' : row.rate >= 60 ? 'secondary' : 'destructive'}>
                            {row.rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Instructor Performance */}
        <TabsContent value="instructors">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Instructor Performance Metrics</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportToCSV(instructorMetrics, 'instructor_performance')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4">Events Led</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={instructorMetrics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="eventsLed" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">Average Attendance Rate</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={instructorMetrics} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis type="number" domain={[0, 100]} />
                        <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="avgAttendance" fill="#22c55e" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instructor</TableHead>
                    <TableHead className="text-right">Events Led</TableHead>
                    <TableHead className="text-right">Total Registrations</TableHead>
                    <TableHead className="text-right">Avg per Event</TableHead>
                    <TableHead className="text-right">Avg Attendance Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {instructorMetrics.map((inst) => (
                    // [Fix 3.3 — IMPLEMENTED] Instructors below 2 events/month are highlighted
                    <TableRow key={inst.id} className={inst.belowMinimum ? 'bg-red-50' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {inst.name}
                          {inst.belowMinimum && (
                            <Badge className="bg-red-100 text-red-700 text-xs">Below min</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{inst.eventsLed}</TableCell>
                      <TableCell className="text-right">{inst.totalRegistrations}</TableCell>
                      <TableCell className="text-right">{inst.avgRegistrations}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={inst.avgAttendance >= 80 ? 'default' : inst.avgAttendance >= 60 ? 'secondary' : 'destructive'}>
                          {inst.avgAttendance}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Program Stats */}
        <TabsContent value="monthly">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Monthly Program Statistics - {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyProgramStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        borderRadius: '12px', 
                        border: 'none', 
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' 
                      }} 
                    />
                    <Legend />
                    <Bar dataKey="events" name="Events" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="registrations" name="Registrations" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="uniqueParticipants" name="Unique Participants" fill="#a855f7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Registrations</TableHead>
                      <TableHead className="text-right">Unique Participants</TableHead>
                      <TableHead className="text-right">Attended</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyProgramStats.map((row) => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{row.month}</TableCell>
                        <TableCell className="text-right">{row.events}</TableCell>
                        <TableCell className="text-right">{row.registrations}</TableCell>
                        <TableCell className="text-right">{row.uniqueParticipants}</TableCell>
                        <TableCell className="text-right">{row.attended}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {monthlyProgramStats.reduce((sum, m) => sum + m.events, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {monthlyProgramStats.reduce((sum, m) => sum + m.registrations, 0)}
                      </TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {monthlyProgramStats.reduce((sum, m) => sum + m.attended, 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participant Stats */}
        <TabsContent value="participants">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Participant Monthly Breakdown - {selectedYear}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-white">Participant</TableHead>
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map(m => (
                        <TableHead key={m} className="text-center min-w-[60px]">{m}</TableHead>
                      ))}
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participantMonthlyStats.slice(0, 20).map((participant) => (
                      <TableRow key={participant.id}>
                        <TableCell className="sticky left-0 bg-white font-medium">
                          {participant.name}
                        </TableCell>
                        {participant.monthlyData.map((md, idx) => (
                          <TableCell key={idx} className="text-center">
                            {md.count > 0 ? (
                              <Badge variant={md.count >= 3 ? 'default' : 'secondary'} className="min-w-[24px]">
                                {md.count}
                              </Badge>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-bold">{participant.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Top Participants Chart */}
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-4">Top 10 Most Active Participants</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topParticipants} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="total" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Category Stats */}
        <TabsContent value="categories">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Events by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryStats}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="events"
                        nameKey="name"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Registrations by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="registrations" radius={[4, 4, 0, 0]}>
                        {categoryStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white/80 backdrop-blur md:col-span-2">
              <CardHeader>
                <CardTitle>Category Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Registrations</TableHead>
                      <TableHead className="text-right">Avg per Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryStats.map((cat) => (
                      <TableRow key={cat.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: cat.color }} />
                            <span className="font-medium">{cat.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{cat.events}</TableCell>
                        <TableCell className="text-right">{cat.registrations}</TableCell>
                        <TableCell className="text-right">
                          {cat.events > 0 ? (cat.registrations / cat.events).toFixed(1) : 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Yearly Comparison */}
        <TabsContent value="yearly">
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader>
              <CardTitle>Year-over-Year Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={yearlyStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="year" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="events" name="Events" stroke="#6366f1" strokeWidth={2} dot={{ r: 6 }} />
                    <Line type="monotone" dataKey="registrations" name="Registrations" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 6 }} />
                    <Line type="monotone" dataKey="uniqueParticipants" name="Unique Participants" stroke="#a855f7" strokeWidth={2} dot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Year</TableHead>
                      <TableHead className="text-right">Events</TableHead>
                      <TableHead className="text-right">Registrations</TableHead>
                      <TableHead className="text-right">Unique Participants</TableHead>
                      <TableHead className="text-right">Avg Registrations/Event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yearlyStats.map((row) => (
                      <TableRow key={row.year}>
                        <TableCell className="font-medium">{row.year}</TableCell>
                        <TableCell className="text-right">{row.events}</TableCell>
                        <TableCell className="text-right">{row.registrations}</TableCell>
                        <TableCell className="text-right">{row.uniqueParticipants}</TableCell>
                        <TableCell className="text-right">
                          {row.events > 0 ? (row.registrations / row.events).toFixed(1) : 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        {/* Low Engagement Report */}
        <TabsContent value="engagement">
          <LowEngagementReport
            participants={participants}
            events={events}
            registrations={registrations}
            categories={categories}
            selectedYear={selectedYear}
            onDataChange={loadData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}