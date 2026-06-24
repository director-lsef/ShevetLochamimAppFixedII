import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../../utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, Users, User } from 'lucide-react';
import { format } from 'date-fns';

export default function EventCard({ event, category, instructor, registrationCount }) {
  const isFull = event.capacity && registrationCount >= event.capacity;
  const isPast = new Date(event.start_datetime) < new Date();

  return (
    <Link to={createPageUrl(`EventDetails?id=${event.id}`)}>
      <Card className={`border-none shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 bg-white/80 backdrop-blur cursor-pointer overflow-hidden ${isPast ? 'opacity-60' : ''}`}>
        <div 
          className="h-2" 
          style={{ backgroundColor: category?.color || '#6366f1' }}
        />
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {category && (
                  <Badge 
                    variant="secondary" 
                    className="text-xs"
                    style={{ 
                      backgroundColor: `${category.color}20`, 
                      color: category.color 
                    }}
                  >
                    {category.name}
                  </Badge>
                )}
                {event.recurrence_type !== 'none' && (
                  <Badge variant="outline" className="text-xs">
                    {event.recurrence_type === 'weekly' ? 'Weekly' : 'Bi-weekly'}
                  </Badge>
                )}
                {isFull && (
                  <Badge variant="destructive" className="text-xs">Full</Badge>
                )}
                {isPast && (
                  <Badge variant="secondary" className="text-xs">Past</Badge>
                )}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{event.title}</h3>
            </div>
          </div>

          {event.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{event.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1.5">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>{format(new Date(event.start_datetime), 'MMM d, yyyy')}</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-purple-500" />
              <span>{format(new Date(event.start_datetime), 'h:mm a')}</span>
            </div>
            {event.location && (
              <div className="flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-pink-500" />
                <span className="truncate max-w-[150px]">{event.location}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            {instructor && (
              <div className="flex items-center space-x-2 text-sm">
                <User className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">{instructor.full_name}</span>
              </div>
            )}
            <div className="flex items-center space-x-1.5 text-sm">
              <Users className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {registrationCount}{event.capacity ? `/${event.capacity}` : ''} registered
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}