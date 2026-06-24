import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Target, Globe, Calendar, MapPin, Phone, Heart,
  Dumbbell, BookOpen, Clock, Zap, Flag, Shield
} from 'lucide-react';
import { format, differenceInMonths } from 'date-fns';
// Note: 'format' is still used for join_date and draft_date below

const FITNESS_COLOR = { low: 'bg-red-100 text-red-700', moderate: 'bg-yellow-100 text-yellow-700', high: 'bg-green-100 text-green-700', elite: 'bg-purple-100 text-purple-700' };
const HEBREW_COLOR = { none: 'bg-gray-100 text-gray-600', beginner: 'bg-blue-100 text-blue-700', intermediate: 'bg-indigo-100 text-indigo-700', advanced: 'bg-violet-100 text-violet-700', fluent: 'bg-green-100 text-green-700' };

function InfoRow({ icon: Icon, label, value, iconColor = 'text-gray-400' }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

export default function ParticipantDossier({ user }) {
  if (!user) return null;

  const monthsInProgram = user.join_date
    ? differenceInMonths(new Date(), new Date(user.join_date))
    : null;

  const hasServiceInfo = user.target_unit || user.draft_date || user.draft_method || user.planned_service_length;
  const hasFrameworkInfo = user.israel_framework || user.stay_framework || user.reference_org;
  const hasEmergencyInfo = user.emergency_contact_name || user.emergency_contact_phone;
  const hasAssessment = user.fitness_level || user.hebrew_level || user.fastest_3k;

  return (
    <Card className="border-none shadow-lg bg-white">
      <CardContent className="p-5 space-y-1">

        {/* Assessment */}
        {hasAssessment && (
          <>
            <SectionHeader>Assessment</SectionHeader>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {user.fitness_level && (
                <div className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-xl">
                  <Dumbbell className="w-5 h-5 text-orange-500" />
                  <span className="text-xs text-gray-500">Fitness</span>
                  <Badge className={`text-xs capitalize ${FITNESS_COLOR[user.fitness_level] || 'bg-gray-100 text-gray-600'}`}>
                    {user.fitness_level}
                  </Badge>
                </div>
              )}
              {user.hebrew_level && (
                <div className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-xl">
                  <BookOpen className="w-5 h-5 text-blue-500" />
                  <span className="text-xs text-gray-500">Hebrew</span>
                  <Badge className={`text-xs capitalize ${HEBREW_COLOR[user.hebrew_level] || 'bg-gray-100 text-gray-600'}`}>
                    {user.hebrew_level}
                  </Badge>
                </div>
              )}
              {user.fastest_3k && (
                <div className="flex flex-col items-center gap-1.5 p-3 bg-gray-50 rounded-xl">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  <span className="text-xs text-gray-500">3K Time</span>
                  <span className="text-sm font-bold text-gray-800">{user.fastest_3k}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Program Info */}
        <SectionHeader>Program</SectionHeader>
        <div className="divide-y divide-gray-50">
          {user.primary_branch && (
            <InfoRow
              icon={Flag}
              label="Branch"
              value={user.primary_branch}
              iconColor={user.primary_branch === 'צוות לוחמים' ? 'text-green-500' : 'text-blue-500'}
            />
          )}
          {user.join_date && (
            <InfoRow
              icon={Calendar}
              label="In Program"
              value={`Since ${format(new Date(user.join_date), 'MMM yyyy')}${monthsInProgram != null ? ` (${monthsInProgram} months)` : ''}`}
              iconColor="text-indigo-400"
            />
          )}
        </div>

        {/* Military Service */}
        {hasServiceInfo && (
          <>
            <SectionHeader>Military Service</SectionHeader>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={Target} label="Target Unit" value={user.target_unit} iconColor="text-red-500" />
              <InfoRow icon={Calendar} label="Draft Date" value={user.draft_date ? format(new Date(user.draft_date), 'MMMM yyyy') : null} iconColor="text-orange-400" />
              <InfoRow icon={Shield} label="Draft Method" value={user.draft_method} iconColor="text-blue-400" />
              <InfoRow icon={Clock} label="Planned Service" value={user.planned_service_length} iconColor="text-gray-400" />
            </div>
          </>
        )}

        {/* Framework */}
        {hasFrameworkInfo && (
          <>
            <SectionHeader>Framework & Origin</SectionHeader>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={Globe} label="Came via" value={user.israel_framework} iconColor="text-teal-400" />
              <InfoRow icon={Globe} label="Staying under" value={user.stay_framework} iconColor="text-teal-400" />
              <InfoRow icon={Globe} label="Referred by" value={user.reference_org} iconColor="text-purple-400" />
            </div>
          </>
        )}

        {/* Personal */}
        {(user.address || user.age != null) && (
          <>
            <SectionHeader>Personal</SectionHeader>
            <div className="divide-y divide-gray-50">
              {user.age != null && (
                <InfoRow icon={Calendar} label="Age" value={String(user.age) + ' years old'} iconColor="text-indigo-400" />
              )}
              <InfoRow icon={MapPin} label="City" value={user.address} />
            </div>
          </>
        )}

        {/* Emergency Contact */}
        {hasEmergencyInfo && (
          <>
            <SectionHeader>Emergency Contact</SectionHeader>
            <div className="divide-y divide-gray-50">
              <InfoRow icon={Heart} label="Name" value={user.emergency_contact_name ? `${user.emergency_contact_name}${user.emergency_contact_relationship ? ` (${user.emergency_contact_relationship})` : ''}` : null} iconColor="text-red-400" />
              <InfoRow icon={Phone} label="Phone" value={user.emergency_contact_phone} iconColor="text-red-400" />
            </div>
          </>
        )}

      </CardContent>
    </Card>
  );
}