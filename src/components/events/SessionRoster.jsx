import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Dumbbell, BookOpen, Target, Zap, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const FITNESS_COLOR = {
  low: 'bg-red-100 text-red-700',
  moderate: 'bg-yellow-100 text-yellow-700',
  high: 'bg-green-100 text-green-700',
  elite: 'bg-purple-100 text-purple-700'
};
const HEBREW_COLOR = {
  none: 'bg-gray-100 text-gray-500',
  beginner: 'bg-blue-100 text-blue-700',
  intermediate: 'bg-indigo-100 text-indigo-700',
  advanced: 'bg-violet-100 text-violet-700',
  fluent: 'bg-green-100 text-green-700'
};

function StatPill({ value, label, colorMap }) {
  if (!value) return <span className="text-xs text-gray-300">—</span>;
  return <Badge className={`text-xs capitalize px-2 py-0.5 ${colorMap[value] || 'bg-gray-100 text-gray-600'}`}>{value}</Badge>;
}

// Aggregate group stats for instructor overview
function GroupStats({ participants }) {
  if (!participants.length) return null;

  const fitnessCount = {};
  const hebrewCount = {};
  participants.forEach(p => {
    if (p.fitness_level) fitnessCount[p.fitness_level] = (fitnessCount[p.fitness_level] || 0) + 1;
    if (p.hebrew_level) hebrewCount[p.hebrew_level] = (hebrewCount[p.hebrew_level] || 0) + 1;
  });

  const topFitness = Object.entries(fitnessCount).sort((a,b)=>b[1]-a[1])[0];
  const topHebrew = Object.entries(hebrewCount).sort((a,b)=>b[1]-a[1])[0];
  const hasTargetUnit = participants.filter(p => p.target_unit).length;

  return (
    <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
      <div className="text-center">
        <p className="text-xs text-blue-400 mb-1 flex items-center justify-center gap-1"><Dumbbell className="w-3 h-3" /> Top Fitness</p>
        {topFitness ? (
          <Badge className={`text-xs capitalize ${FITNESS_COLOR[topFitness[0]] || 'bg-gray-100'}`}>
            {topFitness[0]} ({topFitness[1]})
          </Badge>
        ) : <span className="text-xs text-gray-400">N/A</span>}
      </div>
      <div className="text-center">
        <p className="text-xs text-blue-400 mb-1 flex items-center justify-center gap-1"><BookOpen className="w-3 h-3" /> Hebrew Level</p>
        {topHebrew ? (
          <Badge className={`text-xs capitalize ${HEBREW_COLOR[topHebrew[0]] || 'bg-gray-100'}`}>
            {topHebrew[0]} ({topHebrew[1]})
          </Badge>
        ) : <span className="text-xs text-gray-400">N/A</span>}
      </div>
      <div className="text-center">
        <p className="text-xs text-blue-400 mb-1 flex items-center justify-center gap-1"><Target className="w-3 h-3" /> w/ Target Unit</p>
        <span className="text-sm font-bold text-blue-700">{hasTargetUnit}<span className="text-xs font-normal text-blue-400">/{participants.length}</span></span>
      </div>
    </div>
  );
}

// [NEW FEATURE — IMPLEMENTED] Staff (admin/instructor) can remove a participant
// from the session via onRemoveParticipant(participantId, fullName).
export default function SessionRoster({ eventId, registrations, onRemoveParticipant, isStaff = false }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  // [NEW FEATURE] Track which participant removal is in-flight for loading state
  const [removingId, setRemovingId] = useState(null);

  const registeredIds = registrations
    .filter(r => r.event_id === eventId && r.status === 'registered')
    .map(r => r.participant_id);

  useEffect(() => {
    if (!registeredIds.length) { setLoading(false); return; }
    const fetchParticipants = async () => {
      try {
        const allUsers = await base44.entities.User.list();
        setParticipants(allUsers.filter(u => registeredIds.includes(u.id)));
      } finally {
        setLoading(false);
      }
    };
    fetchParticipants();
  }, [eventId]);

  if (loading) return (
    <Card className="border-none shadow bg-white/80">
      <CardContent className="p-4 text-center text-sm text-gray-400">Loading roster...</CardContent>
    </Card>
  );

  if (!registeredIds.length) return (
    <Card className="border-none shadow bg-white/80">
      <CardContent className="p-4 text-center text-sm text-gray-400">
        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        No participants registered yet
      </CardContent>
    </Card>
  );

  const visible = expanded ? participants : participants.slice(0, 5);

  return (
    <Card className="border-none shadow-lg bg-white">
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          Session Roster
          <Badge variant="secondary" className="ml-auto">{participants.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <GroupStats participants={participants} />

        <div className="space-y-2">
          {visible.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              {p.profile_image_url ? (
                <img src={p.profile_image_url} alt={p.full_name} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-white">{p.full_name?.charAt(0)?.toUpperCase()}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{p.full_name}</p>
                {p.target_unit && (
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Target className="w-3 h-3" />{p.target_unit}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {p.fitness_level && <StatPill value={p.fitness_level} label="fitness" colorMap={FITNESS_COLOR} />}
                {p.fastest_3k && (
                  <span className="flex items-center gap-0.5 text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    <Zap className="w-3 h-3 text-yellow-500" />{p.fastest_3k}
                  </span>
                )}
                {isStaff && onRemoveParticipant && (
                  <button
                    onClick={async () => {
                      setRemovingId(p.id);
                      await onRemoveParticipant(p.id, p.full_name);
                      setRemovingId(null);
                    }}
                    disabled={removingId === p.id}
                    className="ml-1 p-1 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Remove from session"
                  >
                    {removingId === p.id
                      ? <span className="text-[10px]">...</span>
                      : <X className="w-3.5 h-3.5" />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {participants.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-gray-500 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <><ChevronUp className="w-3 h-3 mr-1" />Show less</> : <><ChevronDown className="w-3 h-3 mr-1" />Show all {participants.length}</>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}