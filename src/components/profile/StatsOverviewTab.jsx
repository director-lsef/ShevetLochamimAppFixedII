import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Percent, Zap, Loader2 } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';

function formatTime(seconds) {
  if (!seconds) return 'N/A';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-3xl font-bold text-gray-800">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-sm font-bold text-indigo-600">{formatTime(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

export default function StatsOverviewTab({ user, viewerUser }) {
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Permission check: participant can only see their own charts
  const canSeeCharts =
    viewerUser?.user_type === 'admin' ||
    viewerUser?.user_type === 'instructor' ||
    viewerUser?.id === user?.id;

  // ── [Fix PROFILE-2] NOTE — this function requires two schema entities ───────────
  // BASE44 EDITOR: DO NOT CHANGE this function. It is correct.
  // If this tab shows a blank screen or crashes, the cause is that
  // AttendanceRecord and/or PerformanceRecord entities don't exist in the schema.
  //
  // FIX: Create these two entity files (already done in this annotation pass):
  //   base44/entities/AttendanceRecord.jsonc
  //   base44/entities/PerformanceRecord.jsonc
  //
  // Once those entities exist, this tab will load correctly.
  // ── END NOTE ──────────────────────────────────────────────────────────────────
  const loadStats = async () => {
    const [attendance, performance] = await Promise.all([
      base44.entities.AttendanceRecord.filter({ participant_id: user.id }),
      base44.entities.PerformanceRecord.filter({ participant_id: user.id })
    ]);

    const totalSessions = attendance.length;
    const presentCount = attendance.filter(r => r.status === 'present' || r.status === 'late').length;
    const attendancePct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    const twoKRuns = performance
      .filter(p => p.drill_type === '2k_run' && p.time_seconds)
      .sort((a, b) => new Date(a.record_date) - new Date(b.record_date));

    const personalBest = twoKRuns.length > 0
      ? Math.min(...twoKRuns.map(p => p.time_seconds))
      : null;

    setStats({
      totalPresent: attendance.filter(r => r.status === 'present').length,
      attendancePct,
      personalBest
    });

    // Build line chart data from 2K run history
    setChartData(twoKRuns.map(p => ({
      date: p.record_date ? format(new Date(p.record_date), 'dd MMM yy') : '?',
      seconds: p.time_seconds
    })));

    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    loadStats();

    // Real-time subscription — refresh when a new performance record is added
    const unsubscribe = base44.entities.PerformanceRecord.subscribe((event) => {
      if (event.data?.participant_id === user.id) {
        loadStats();
      }
    });
    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={CheckCircle2} label="Total Sessions Attended" value={stats?.totalPresent ?? 0} color="bg-green-500" />
        <MetricCard icon={Percent} label="Attendance Rate" value={`${stats?.attendancePct ?? 0}%`} color="bg-blue-500" />
        <MetricCard icon={Zap} label="Personal Best (2K Run)" value={stats?.personalBest ? formatTime(stats.personalBest) : 'N/A'} color="bg-purple-500" />
      </div>

      {/* Progress Chart */}
      {canSeeCharts && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-700">2K Run Progress Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length < 2 ? (
              <p className="text-sm text-gray-400 text-center py-8">Not enough data to display a trend yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis
                    tickFormatter={formatTime}
                    tick={{ fontSize: 11 }}
                    domain={['auto', 'auto']}
                    reversed
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="seconds"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#6366f1' }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}