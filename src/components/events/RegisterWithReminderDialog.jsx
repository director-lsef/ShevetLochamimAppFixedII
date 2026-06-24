import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, Clock, Calendar } from 'lucide-react';

const REMINDER_OPTIONS = [
  {
    value: 'none',
    label: 'No email reminders',
    description: 'In-app notifications only',
    icon: BellOff,
    color: 'text-gray-400'
  },
  {
    value: '1_day',
    label: '1 day before',
    description: 'Email reminder 24h before the event',
    icon: Calendar,
    color: 'text-blue-600'
  },
  {
    value: '1_hour',
    label: '1 hour before',
    description: 'Email reminder 1 hour before the event',
    icon: Clock,
    color: 'text-purple-600'
  },
  {
    value: 'both',
    label: 'Both (1 day + 1 hour)',
    description: 'Two email reminders before the event',
    icon: Bell,
    color: 'text-green-600'
  }
];

export default function RegisterWithReminderDialog({ open, onOpenChange, onConfirm, loading, eventTitle }) {
  const [selected, setSelected] = useState('1_day');

  const handleConfirm = () => {
    onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Register for {eventTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-gray-500">How would you like to be reminded about this event?</p>
          <div className="space-y-2">
            {REMINDER_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selected === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelected(opt.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-indigo-600' : opt.color}`} />
                  <div>
                    <p className={`text-sm font-medium ${isSelected ? 'text-indigo-800' : 'text-gray-800'}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.description}</p>
                  </div>
                  {isSelected && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 mt-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : null}
            Confirm Registration
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}