import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts';

const MENTAL_FIELDS = [
  { key: 'persistence_under_fatigue', label: 'Persistence' },
  { key: 'teamwork_quality', label: 'Teamwork' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'adaptability', label: 'Adaptability' },
  { key: 'mental_focus', label: 'Focus' },
];

export default function PerformanceLogsTab({ user, viewerUser }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Permission check: participant can only see their own chart
  const canSeeChart =
    viewerUser?.user_type === 'admin' ||
    viewerUser?.user_type === 'instructor' ||
    viewerUser?.id === user?.id;

  // ── [Fix PROFILE-2] NOTE — requires MentalToughnessRating entity ────────────────
  // BASE44 EDITOR: DO NOT CHANGE this function. The "Logs" tab shows blank
  // because MentalToughnessRating entity doesn't exist in the schema yet.
  // FIX: Create base44/entities/MentalToughnessRating.jsonc (done in this pass).
  // Once that entity exists, this tab loads and renders the radar chart correctly.
  // ── END NOTE ──────────────────────────────────────────────────────────────────
  const loadRatings = async () => {
    const data = await base44.entities.MentalToughnessRating.filter({ participant_id: user.id });
    setRatings(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    loadRatings();

    // Real-time: refresh when a new rating is added for this participant
    const unsubscribe = base44.entities.MentalToughnessRating.subscribe((event) => {
      if (event.data?.participant_id === user.id) {
        loadRatings();
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Average each mental field across all ratings
  const radarData = MENTAL_FIELDS.map(({ key, label }) => {
    const values = ratings.map(r => r[key]).filter(v => v != null);
    const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length) : 0;
    return { subject: label, score: parseFloat(avg.toFixed(2)), fullMark: 5 };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {canSeeChart && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-700">Mental & Technical Skill Radar</CardTitle>
            <p className="text-xs text-gray-400 mt-1">Average scores across {ratings.length} instructor rating{ratings.length !== 1 ? 's' : ''}</p>
          </CardHeader>
          <CardContent>
            {ratings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No instructor ratings recorded yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fontSize: 10 }} tickCount={6} />
                  <Radar
                    name={user?.full_name || 'Participant'}
                    dataKey="score"
                    stroke="#6366f1"
                    fill="#6366f1"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                  <Tooltip
                    formatter={(value) => [`${value} / 5`, 'Avg Score']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Score breakdown table */}
      {ratings.length > 0 && canSeeChart && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-700">Score Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {radarData.map(({ subject, score }) => (
                <div key={subject} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-24 shrink-0">{subject}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                      style={{ width: `${(score / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-10 text-right">{score}/5</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}