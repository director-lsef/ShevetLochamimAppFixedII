import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ProfileDetailsTab from '@/components/profile/ProfileDetailsTab';
import StatsOverviewTab from '@/components/profile/StatsOverviewTab';
import EventHistoryTab from '@/components/profile/EventHistoryTab';
import PerformanceLogsTab from '@/components/profile/PerformanceLogsTab';
import ParticipantDossier from '@/components/profile/ParticipantDossier';
import { Flag, Target, Dumbbell, BookOpen, Phone, CheckCircle2, X } from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
import { toast } from 'sonner';

const FITNESS_COLOR = { low: 'bg-red-100 text-red-700', moderate: 'bg-yellow-100 text-yellow-700', high: 'bg-green-100 text-green-700', elite: 'bg-purple-100 text-purple-700' };
const HEBREW_COLOR = { none: 'bg-gray-100 text-gray-600', beginner: 'bg-blue-100 text-blue-700', intermediate: 'bg-indigo-100 text-indigo-700', advanced: 'bg-violet-100 text-violet-700', fluent: 'bg-green-100 text-green-700' };

function PhoneConfirmBanner({ user, onDismiss }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!phone.trim()) { toast.error('Please enter your phone number'); return; }
    setSaving(true);
    try {
      await base44.auth.updateMe({ phone: phone.trim(), phone_confirmed: true });
      toast.success('Phone number confirmed!');
      onDismiss();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-2 border-amber-300 bg-amber-50 shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Phone className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-amber-800 text-sm">Confirm your phone number</p>
            <p className="text-amber-700 text-xs mt-1 mb-3">
              We have <strong>{user?.phone || 'no phone'}</strong> on file from your intake form. Please confirm this is correct so we can reach you in an emergency.
            </p>
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. +972 50 000 0000"
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={handleConfirm} disabled={saving} className="bg-amber-600 hover:bg-amber-700 text-white shrink-0">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Confirm
              </Button>
              <Button size="sm" variant="ghost" onClick={onDismiss} className="shrink-0 text-amber-600">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── [Fix PROFILE-2] HEADER NOTE — Profile tabs broken due to missing entities ──
// BASE44 EDITOR: DO NOT TOUCH the Profile.jsx component itself.
// The profile page logic is correct. The tabs below are broken because
// the entities they depend on don't exist yet in the schema.
//
// TABS AND THEIR DEPENDENCIES:
//   "Stats" tab  → StatsOverviewTab  → needs AttendanceRecord + PerformanceRecord
//   "History"tab → EventHistoryTab   → needs AttendanceRecord
//   "Logs" tab   → PerformanceLogsTab → needs MentalToughnessRating
//
// ALL THREE entity schema files must be created FIRST.
// See: base44/entities/AttendanceRecord.jsonc     (NEW — create this file)
//      base44/entities/PerformanceRecord.jsonc    (NEW — create this file)
//      base44/entities/MentalToughnessRating.jsonc (NEW — create this file)
//
// Once those exist, the tabs will load. No changes needed in this file.
//
// The data-fetch pattern here (auth.me + User.filter) is correct and
// should NOT be changed. auth.me returns auth fields; User.filter returns
// the full entity record with custom fields (age, fitness_level, etc.).
// ── END NOTE ──────────────────────────────────────────────────────────────────

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPhoneBanner, setShowPhoneBanner] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async u => {
      if (u?.id) {
        // Fetch full entity record to get custom fields like age, fitness_level, etc.
        // This is intentional — auth.me() only returns auth-level fields.
        const users = await base44.entities.User.filter({ id: u.id });
        const fullUser = users?.[0] ? { ...u, ...users[0] } : u;
        setUser(fullUser);
        if (!fullUser?.phone_confirmed) setShowPhoneBanner(true);
      } else {
        setUser(u);
        if (!u?.phone_confirmed) setShowPhoneBanner(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const displayName = user?.full_name || user?.email || 'Participant';
  const isParticipant = !user?.user_type || user?.user_type === 'participant';
  const monthsInProgram = user?.join_date ? differenceInMonths(new Date(), new Date(user.join_date)) : null;

  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-in fade-in duration-500">

      {/* Phone Confirm Banner */}
      {showPhoneBanner && isParticipant && (
        <PhoneConfirmBanner user={user} onDismiss={() => setShowPhoneBanner(false)} />
      )}

      {/* Hero Profile Card */}
      <div className="rounded-2xl overflow-hidden shadow-xl" style={{ background: 'linear-gradient(135deg, #001A3D 0%, #002D62 60%, #0038A8 100%)' }}>
        <div className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Avatar */}
            <div className="relative shrink-0">
              {user?.profile_image_url ? (
                <img src={user.profile_image_url} alt="Profile" className="w-24 h-24 rounded-2xl object-cover border-4 border-white/20 shadow-xl" />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center border-4 border-white/20 shadow-xl">
                  <span className="text-4xl font-bold text-white">{displayName.charAt(0).toUpperCase()}</span>
                </div>
              )}
              {user?.participant_status && (
                <span className={`absolute -bottom-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-white ${user.participant_status === 'active' ? 'bg-green-400' : 'bg-gray-400'}`} />
              )}
            </div>

            {/* Name & quick info */}
            <div className="text-center sm:text-left flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{displayName}</h1>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <Badge className="bg-white/20 text-white border-0 capitalize">{user?.user_type || 'participant'}</Badge>
                {user?.primary_branch && (
                  <Badge className={`border-0 text-white ${user.primary_branch === 'צוות לוחמים' ? 'bg-green-600/70' : 'bg-blue-600/70'}`}>
                    <Flag className="w-3 h-3 mr-1" />{user.primary_branch}
                  </Badge>
                )}
                {monthsInProgram != null && (
                  <Badge className="bg-white/10 text-gray-300 border-0">{monthsInProgram}mo in program</Badge>
                )}
              </div>

              {/* Quick stat pills */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {user?.target_unit && (
                  <span className="flex items-center gap-1.5 text-xs text-cyan-300 bg-white/10 px-2.5 py-1 rounded-full">
                    <Target className="w-3 h-3" />{user.target_unit}
                  </span>
                )}
                {user?.fitness_level && (
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${FITNESS_COLOR[user.fitness_level]}`}>
                    <Dumbbell className="w-3 h-3" />{user.fitness_level}
                  </span>
                )}
                {user?.hebrew_level && user.hebrew_level !== 'none' && (
                  <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${HEBREW_COLOR[user.hebrew_level]}`}>
                    <BookOpen className="w-3 h-3" />{user.hebrew_level} Hebrew
                  </span>
                )}
                {user?.draft_date && (
                  <span className="flex items-center gap-1.5 text-xs text-orange-300 bg-white/10 px-2.5 py-1 rounded-full">
                    Draft: {format(new Date(user.draft_date), 'MMM yyyy')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabbed Navigation */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-white/10 backdrop-blur-sm rounded-lg p-1">
          <TabsTrigger value="profile" className="text-sm data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-300 rounded-md transition-all">
            Profile
          </TabsTrigger>
          <TabsTrigger value="stats" className="text-sm data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-300 rounded-md transition-all">
            Stats
          </TabsTrigger>
          <TabsTrigger value="events" className="text-sm data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-300 rounded-md transition-all">
            History
          </TabsTrigger>
          <TabsTrigger value="performance" className="text-sm data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-300 rounded-md transition-all">
            Logs
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="profile" className="space-y-4">
            {/* Show dossier (read-only intake data) above the editable form */}
            {isParticipant && <ParticipantDossier user={user} />}
            <ProfileDetailsTab user={user} onUserUpdate={setUser} />
          </TabsContent>
          <TabsContent value="stats">
            <StatsOverviewTab user={user} viewerUser={user} />
          </TabsContent>
          <TabsContent value="events">
            <EventHistoryTab user={user} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceLogsTab user={user} viewerUser={user} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}