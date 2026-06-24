import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Plus, Trash2, Mail, BellRing } from 'lucide-react';
import { toast } from 'sonner';

const DELIVERY_LABELS = {
  in_app: { label: 'In-app only', icon: Bell },
  email: { label: 'Email only', icon: Mail },
  both: { label: 'In-app + Email', icon: BellRing },
};

export default function EventRemindersPanel({ eventId, userId }) {
  const [reminders, setReminders] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ remind_before_value: 1, remind_before_unit: 'hours', delivery: 'both' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReminders();
  }, [eventId]);

  const loadReminders = async () => {
    const data = await base44.entities.EventReminder.filter({ event_id: eventId, created_by: userId });
    setReminders(data);
  };

  const handleAdd = async () => {
    if (!form.remind_before_value || form.remind_before_value <= 0) {
      toast.error('Enter a valid time before the event');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.EventReminder.create({
        event_id: eventId,
        created_by: userId,
        remind_before_value: Number(form.remind_before_value),
        remind_before_unit: form.remind_before_unit,
        delivery: form.delivery,
        sent: false
      });
      toast.success('Reminder added');
      setAdding(false);
      setForm({ remind_before_value: 1, remind_before_unit: 'hours', delivery: 'both' });
      loadReminders();
    } catch {
      toast.error('Failed to add reminder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await base44.entities.EventReminder.delete(id);
    toast.success('Reminder removed');
    loadReminders();
  };

  return (
    <div className="space-y-3">
      {reminders.length === 0 && !adding && (
        <p className="text-sm text-gray-400">No reminders set for this event.</p>
      )}

      {reminders.map((r) => {
        const DeliveryIcon = DELIVERY_LABELS[r.delivery]?.icon || Bell;
        return (
          <div key={r.id} className="flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg">
            <div className="flex items-center gap-2">
              <DeliveryIcon className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-sm font-medium text-indigo-800">
                {r.remind_before_value} {r.remind_before_unit} before
              </span>
              <span className="text-xs text-indigo-500">· {DELIVERY_LABELS[r.delivery]?.label}</span>
              {r.sent && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Sent</span>}
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => handleDelete(r.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}

      {adding ? (
        <div className="p-3 border border-dashed border-indigo-300 rounded-lg space-y-2 bg-indigo-50/50">
          <div className="flex gap-2">
            <Input
              type="number"
              min="1"
              value={form.remind_before_value}
              onChange={(e) => setForm({ ...form, remind_before_value: e.target.value })}
              className="w-20 h-8 text-sm"
            />
            <Select value={form.remind_before_unit} onValueChange={(v) => setForm({ ...form, remind_before_unit: v })}>
              <SelectTrigger className="h-8 text-sm flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours before</SelectItem>
                <SelectItem value="days">Days before</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Select value={form.delivery} onValueChange={(v) => setForm({ ...form, delivery: v })}>
            <SelectTrigger className="h-8 text-sm w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_app">In-app notification only</SelectItem>
              <SelectItem value="email">Email only</SelectItem>
              <SelectItem value="both">In-app + Email</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleAdd} disabled={saving}>
              {saving ? 'Saving...' : 'Add'}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50"
          onClick={() => setAdding(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Reminder
        </Button>
      )}
    </div>
  );
}