import React from 'react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, Calendar, Globe, Phone, User, GraduationCap, Shield, Snowflake } from 'lucide-react';

const getUserTypeColor = (type) => {
  switch (type) {
    case 'admin': return 'bg-red-100 text-red-800';
    case 'instructor': return 'bg-blue-100 text-blue-800';
    case 'alumni': return 'bg-amber-100 text-amber-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getUserTypeIcon = (type) => {
  switch (type) {
    case 'admin': return <Shield className="w-4 h-4" />;
    case 'instructor': return <GraduationCap className="w-4 h-4" />;
    case 'alumni': return <GraduationCap className="w-4 h-4" />;
    default: return <User className="w-4 h-4" />;
  }
};

export default function UserProfileDetail({ user }) {
  if (!user) return null;

  const isAlumni = user.participant_status === 'alumni' || user.user_type === 'alumni';
  const displayName = user.full_name || user.email;
  const initials = displayName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-4 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg">
        {user.profile_image_url ? (
          <img
            src={user.profile_image_url}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover border-2 border-white mb-3"
          />
        ) : (
          <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 ${
            isAlumni ? 'bg-amber-400' :
            user.user_type === 'admin' ? 'bg-red-500' :
            user.user_type === 'instructor' ? 'bg-blue-500' : 'bg-indigo-500'
          }`}>
            {initials}
          </div>
        )}
        <h3 className="font-semibold text-gray-900">{displayName}</h3>
        {user.email && <p className="text-sm text-gray-500">{user.email}</p>}
        {user.user_type && (
          <div className="flex gap-2 flex-wrap mt-2">
            <Badge className={getUserTypeColor(user.user_type)}>
              {getUserTypeIcon(user.user_type)}
              <span className="ml-1 capitalize">{user.user_type}</span>
            </Badge>
            {isAlumni && <Badge className="bg-amber-100 text-amber-800">Alumni</Badge>}
            {user.account_status === 'frozen' && (
              <Badge className="bg-blue-100 text-blue-700">
                <Snowflake className="w-3 h-3 mr-1" />
                Frozen
              </Badge>
            )}
            {user.freeze_exempt && (
              <Badge className="bg-purple-100 text-purple-700">
                <span className="mr-1">⭐</span>
                Exempt
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Info Grid */}
      <div className="space-y-3 text-sm">
        {user.created_date && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Date Added</p>
              <p className="font-medium text-gray-900">{format(new Date(user.created_date), 'MMM d, yyyy')}</p>
            </div>
          </div>
        )}

        {user.primary_branch && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <Shield className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Branch</p>
              <p className="font-medium" style={{ color: user.primary_branch === 'צוות לוחמים' ? '#15803d' : '#1d4ed8' }}>
                {user.primary_branch}
              </p>
            </div>
          </div>
        )}

        {user.country_of_origin && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <Globe className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Country</p>
              <p className="font-medium text-gray-900">{user.country_of_origin}</p>
            </div>
          </div>
        )}

        {user.phone && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Phone</p>
              <p className="font-medium text-gray-900">{user.phone}</p>
            </div>
          </div>
        )}

        {user.age != null && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Age</p>
              <p className="font-medium text-gray-900">{user.age} years old</p>
            </div>
          </div>
        )}

        {user.address && (
          <div className="flex items-start gap-3 pb-3 border-b">
            <div className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Address</p>
              <p className="font-medium text-gray-900">{user.address}</p>
            </div>
          </div>
        )}

        {user.notes && (
          <div className="flex items-start gap-3 pt-3">
            <div className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-gray-500 text-xs uppercase">Notes</p>
              <p className="font-medium text-gray-900 text-xs">{user.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}