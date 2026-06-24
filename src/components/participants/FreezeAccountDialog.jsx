import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SnowflakeIcon, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

export default function FreezeAccountDialog({ user, open, onClose, onSuccess }) {
  const [days, setDays] = useState('7');
  const [loading, setLoading] = useState(false);

  const freezeEndDate = days && parseInt(days) > 0
    ? addDays(new Date(), parseInt(days))
    : null;

  const handleFreeze = async () => {
    const numDays = parseInt(days);
    if (!numDays || numDays < 1) {
      toast.error('Please enter a valid number of days');
      return;
    }

    setLoading(true);
    try {
      await base44.entities.User.update(user.id, {
        account_status: 'frozen',
        freeze_end_date: addDays(new Date(), numDays).toISOString()
      });
      toast.success(`${user.full_name}'s account frozen for ${numDays} days`);
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to freeze account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-700">
            <SnowflakeIcon className="w-5 h-5" />
            Freeze Account
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>{user?.full_name}</strong> will be unable to register for events during the freeze period.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Freeze Duration (days)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              placeholder="Number of days"
            />
          </div>

          {freezeEndDate && (
            <p className="text-sm text-gray-600">
              Account will be frozen until:{' '}
              <strong>{format(freezeEndDate, 'MMM d, yyyy')}</strong>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleFreeze}
            disabled={loading || !days || parseInt(days) < 1}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? 'Freezing...' : 'Freeze Account'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}