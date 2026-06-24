import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function EventHistoryTab({ user }) {
  const [records, setRecords] = useState([]);
  const [events, setEvents] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadHistory();
  }, [user]);

  // ── [Fix PROFILE-2] NOTE — requires AttendanceRecord entity ─────────────────────
  // BASE44 EDITOR: DO NOT CHANGE this function. The "History" tab shows blank
  // because AttendanceRecord entity doesn't exist in the schema yet.
  // FIX: Create base44/entities/AttendanceRecord.jsonc (done in this pass).
  // Once that entity exists, this tab loads correctly.
  // ── END NOTE ──────────────────────────────────────────────────────────────────
  const loadHistory = async () => {
    try {
      // Get all attendance records for this participant
      const attendance = await base44.entities.AttendanceRecord.filter({ participant_id: user.id });

      // Get unique event IDs
      const eventIds = [...new Set(attendance.map(r => r.event_id))];

      // Fetch all relevant events
      let eventMap = {};
      if (eventIds.length > 0) {
        const allEvents = await base44.entities.Event.list('-start_datetime', 500);
        allEvents.forEach(e => { eventMap[e.id] = e; });
      }

      // Sort attendance by event date descending
      const sorted = attendance.sort((a, b) => {
        const dateA = new Date(eventMap[a.event_id]?.start_datetime || 0);
        const dateB = new Date(eventMap[b.event_id]?.start_datetime || 0);
        return dateB - dateA;
      });

      setRecords(sorted);
      setEvents(eventMap);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p>No attendance records found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => {
        const event = events[record.event_id];
        if (!event) return null;
        const isPresent = record.status === 'present';
        const isLate = record.status === 'late';

        return (
          <Link
            key={record.id}
            to={createPageUrl(`EventDetails?id=${event.id}`)}
            className="block"
          >
            <Card className="border border-white/10 bg-white/80 backdrop-blur hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    isPresent ? 'bg-green-100' : isLate ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <Calendar className={`w-5 h-5 ${
                      isPresent ? 'text-green-600' : isLate ? 'text-yellow-600' : 'text-red-500'
                    }`} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">{event.title}</p>
                    <p className="text-sm text-gray-500">
                      {event.start_datetime ? format(new Date(event.start_datetime), 'dd MMM yyyy, HH:mm') : 'Unknown date'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={
                    isPresent ? 'bg-green-100 text-green-700 border-green-200' :
                    isLate ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                    'bg-red-100 text-red-600 border-red-200'
                  } variant="outline">
                    {isPresent ? 'Present' : isLate ? 'Late' : 'Absent'}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}