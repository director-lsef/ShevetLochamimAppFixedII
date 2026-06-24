import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, CheckCircle, Clock, XCircle, Users, ChevronRight } from 'lucide-react';
import ParticipantRatingCard from './ParticipantRatingCard';

export default function AttendeeRatingPanel({
  registrations,
  participants,
  attendanceRecords,
  mentalRatings,
  performanceRecords,
  eventId,
  currentUserId,
  isAssignedInstructor,
  onMarkAttendance,
  onToggleChanichToran,
  onRated,
}) {
  const [ratingParticipant, setRatingParticipant] = useState(null);

  const getParticipant = (id) => participants.find((u) => u.id === id);
  const getAttendance = (id) => attendanceRecords.find((r) => r.participant_id === id)?.status || null;
  const hasRated = (id) => mentalRatings.some((r) => r.participant_id === id);
  const getPerfCount = (id) => performanceRecords.filter((r) => r.participant_id === id).length;
  const getPerf = (id) => performanceRecords.filter((r) => r.participant_id === id);
  const getMental = (id) => mentalRatings.find((r) => r.participant_id === id);

  const totalRated = registrations.filter((r) => hasRated(r.participant_id)).length;
  const totalAttended = attendanceRecords.filter((r) => r.status === 'present' || r.status === 'late').length;

  return (
    <>
      <Card className="border-none shadow-xl bg-white overflow-hidden">
        {/* Header stripe */}
        <div className="h-1.5 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />

        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Star className="w-4 h-4 text-white" />
              </div>
              Rate Attendees
            </CardTitle>
            <div className="flex gap-2 text-xs">
              <Badge variant="outline" className="text-indigo-600 border-indigo-200 bg-indigo-50">
                <Users className="w-3 h-3 mr-1" />
                {registrations.length} registered
              </Badge>
              {totalRated > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <Star className="w-3 h-3 mr-1" />
                  {totalRated} rated
                </Badge>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Click <strong>Rate</strong> to record performance &amp; mental toughness for each participant
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {registrations.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No registered participants yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {registrations.map((reg) => {
                const p = getParticipant(reg.participant_id);
                const name = p?.full_name || 'Unknown';
                const attendance = getAttendance(reg.participant_id);
                const rated = hasRated(reg.participant_id);
                const perfCount = getPerfCount(reg.participant_id);
                const isToran = reg.is_chanich_toran;

                return (
                  <div
                    key={reg.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50 ${
                      isToran ? 'bg-yellow-50' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                      isToran ? 'bg-yellow-500' : rated ? 'bg-green-500' : 'bg-gray-300'
                    }`}>
                      {name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-sm font-semibold ${isToran ? 'text-yellow-800' : 'text-gray-900'}`}>
                          {name}
                        </span>
                        {isToran && (
                          <Badge className="text-[10px] px-1.5 py-0 h-4 bg-yellow-400 text-yellow-900 border-yellow-500 font-bold">⭐ חניך תורן</Badge>
                        )}
                      </div>
                      <div className="flex gap-1 mt-0.5 flex-wrap">
                        {attendance && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${
                            attendance === 'present' ? 'text-green-600 border-green-300 bg-green-50' :
                            attendance === 'late' ? 'text-amber-600 border-amber-300 bg-amber-50' :
                            'text-red-600 border-red-300 bg-red-50'
                          }`}>
                            {attendance === 'present' ? 'Present' : attendance === 'late' ? 'Late' : 'Absent'}
                          </Badge>
                        )}
                        {rated && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-green-600 border-green-300">
                            <CheckCircle className="w-2 h-2 mr-0.5" /> Mental rated
                          </Badge>
                        )}
                        {perfCount > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-orange-600 border-orange-300">
                            {perfCount} drill{perfCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Toran toggle */}
                      {isAssignedInstructor && (
                        <Button
                          size="sm"
                          variant={isToran ? 'default' : 'outline'}
                          className={`h-8 px-2 text-[10px] ${isToran ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-900 border-yellow-500' : 'text-yellow-700 border-yellow-200 hover:bg-yellow-50'}`}
                          onClick={() => onToggleChanichToran(reg)}
                          title="Toggle Chanich Toran"
                        >⭐</Button>
                      )}

                      {/* Attendance buttons */}
                      {isAssignedInstructor && (
                        <>
                          <Button size="sm" variant={attendance === 'present' ? 'default' : 'outline'}
                            className={`h-8 w-8 p-0 ${attendance === 'present' ? 'bg-green-600 hover:bg-green-700 border-green-600' : 'hover:bg-green-50 hover:border-green-300'}`}
                            onClick={() => onMarkAttendance(reg.participant_id, 'present')} title="Present">
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant={attendance === 'late' ? 'default' : 'outline'}
                            className={`h-8 w-8 p-0 ${attendance === 'late' ? 'bg-amber-600 hover:bg-amber-700 border-amber-600' : 'hover:bg-amber-50 hover:border-amber-300'}`}
                            onClick={() => onMarkAttendance(reg.participant_id, 'late')} title="Late">
                            <Clock className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant={attendance === 'absent' ? 'default' : 'outline'}
                            className={`h-8 w-8 p-0 ${attendance === 'absent' ? 'bg-red-600 hover:bg-red-700 border-red-600' : 'hover:bg-red-50 hover:border-red-300'}`}
                            onClick={() => onMarkAttendance(reg.participant_id, 'absent')} title="Absent">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </>
                      )}

                      {/* Rate button — prominent CTA */}
                      <Button
                        size="sm"
                        onClick={() => p && setRatingParticipant(p)}
                        className={`h-8 gap-1.5 ml-1 ${
                          rated
                            ? 'bg-green-600 hover:bg-green-700 text-white'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-sm'
                        }`}
                      >
                        <Star className="w-3 h-3" />
                        {rated ? 'Rated' : 'Rate'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {ratingParticipant && (
        <ParticipantRatingCard
          participant={ratingParticipant}
          eventId={eventId}
          currentUserId={currentUserId}
          existingPerformance={getPerf(ratingParticipant.id)}
          existingMental={getMental(ratingParticipant.id)}
          onClose={() => {
            setRatingParticipant(null);
            onRated();
          }}
        />
      )}
    </>
  );
}