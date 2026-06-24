import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Timer, Brain, CheckCircle, Star, X } from 'lucide-react';
import { toast } from 'sonner';

const DRILL_TYPES = [
  { value: '1k_run', label: '1K Run' },
  { value: '2k_run', label: '2K Run' },
  { value: '3km_run', label: '3KM Run' },
  { value: '300m_crawl', label: '300M Crawl' },
  { value: 'full_gan_saccer_crawl', label: 'Full Gan Saccer Crawl' },
  { value: 'other', label: 'Other' }
];

const LikertScale = ({ value, onChange, label }) => (
  <div className="space-y-1">
    <Label className="text-xs">{label}</Label>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onChange(num)}
          className={`w-8 h-8 rounded text-sm font-bold transition-all ${
            value === num 
              ? 'bg-purple-600 text-white scale-110' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {num}
        </button>
      ))}
    </div>
  </div>
);

export default function ParticipantRatingCard({ 
  participant, 
  eventId, 
  currentUserId, 
  onClose,
  existingPerformance,
  existingMental
}) {
  const [saving, setSaving] = useState(false);
  const [customDrills, setCustomDrills] = useState([]);
  const [performanceForm, setPerformanceForm] = useState({
    drill_type: '',
    custom_drill_id: '',
    drill_name: '',
    time_minutes: '',
    time_seconds: '',
    notes: ''
  });

  useEffect(() => {
    loadCustomDrills();
  }, []);

  const loadCustomDrills = async () => {
    try {
      const drills = await base44.entities.CustomDrill.filter({ is_active: true });
      setCustomDrills(drills);
    } catch (error) {
      console.error('Error loading custom drills:', error);
    }
  };
  const [mentalForm, setMentalForm] = useState({
    persistence_under_fatigue: existingMental?.persistence_under_fatigue || null,
    teamwork_quality: existingMental?.teamwork_quality || null,
    leadership: existingMental?.leadership || null,
    adaptability: existingMental?.adaptability || null,
    mental_focus: existingMental?.mental_focus || null,
    notes: existingMental?.notes || ''
  });

  const handleSavePerformance = async () => {
    if (!performanceForm.drill_type && !performanceForm.custom_drill_id) {
      toast.error('Please select a drill type');
      return;
    }
    setSaving(true);
    try {
      const timeSeconds = (parseInt(performanceForm.time_minutes || 0) * 60) + parseInt(performanceForm.time_seconds || 0);
      await base44.entities.PerformanceRecord.create({
        participant_id: participant.id,
        event_id: eventId,
        recorded_by: currentUserId,
        record_date: new Date().toISOString().split('T')[0],
        drill_type: performanceForm.drill_type || 'other',
        custom_drill_id: performanceForm.custom_drill_id || null,
        drill_name: performanceForm.custom_drill_id 
          ? customDrills.find(d => d.id === performanceForm.custom_drill_id)?.name 
          : performanceForm.drill_name || null,
        time_seconds: timeSeconds > 0 ? timeSeconds : null,
        notes: performanceForm.notes || null
      });
      toast.success('Performance recorded');
      setPerformanceForm({ drill_type: '', custom_drill_id: '', drill_name: '', time_minutes: '', time_seconds: '', notes: '' });
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMental = async () => {
    if (!mentalForm.persistence_under_fatigue || !mentalForm.teamwork_quality) {
      toast.error('Please rate Persistence and Teamwork');
      return;
    }
    setSaving(true);
    try {
      if (existingMental) {
        await base44.entities.MentalToughnessRating.update(existingMental.id, mentalForm);
      } else {
        await base44.entities.MentalToughnessRating.create({
          participant_id: participant.id,
          event_id: eventId,
          rated_by: currentUserId,
          rating_date: new Date().toISOString().split('T')[0],
          ...mentalForm
        });
      }
      toast.success('Mental rating saved');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold">
              {participant.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p>{participant.full_name}</p>
              <p className="text-sm font-normal text-gray-500">{participant.email}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="performance" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="performance" className="flex-1">
              <Timer className="w-4 h-4 mr-1" /> Performance
            </TabsTrigger>
            <TabsTrigger value="mental" className="flex-1">
              <Brain className="w-4 h-4 mr-1" /> Mental
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="space-y-3 mt-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Drill Type *</Label>
                <Select 
                  value={performanceForm.drill_type || performanceForm.custom_drill_id} 
                  onValueChange={(v) => {
                    if (customDrills.some(d => d.id === v)) {
                      setPerformanceForm({ ...performanceForm, drill_type: '', custom_drill_id: v });
                    } else {
                      setPerformanceForm({ ...performanceForm, drill_type: v, custom_drill_id: '' });
                    }
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {DRILL_TYPES.map((d) => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                    {customDrills.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Custom Drills</div>
                        {customDrills.map(drill => (
                          <SelectItem key={drill.id} value={drill.id}>
                            {drill.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {performanceForm.drill_type === 'other' && !performanceForm.custom_drill_id && (
                <div className="space-y-1">
                  <Label className="text-xs">Drill Name</Label>
                  <Input
                    className="h-9"
                    value={performanceForm.drill_name}
                    onChange={(e) => setPerformanceForm({ ...performanceForm, drill_name: e.target.value })}
                    placeholder="Name"
                  />
                </div>
              )}
              {performanceForm.custom_drill_id && (() => {
                const selectedDrill = customDrills.find(d => d.id === performanceForm.custom_drill_id);
                return selectedDrill && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800 font-medium">{selectedDrill.name}</p>
                    {selectedDrill.description && (
                      <p className="text-xs text-blue-600 mt-1">{selectedDrill.description}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      {selectedDrill.metrics?.map(metric => (
                        <Badge key={metric} variant="outline" className="text-xs">
                          {metric}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Time</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  className="h-9 w-20"
                  value={performanceForm.time_minutes}
                  onChange={(e) => setPerformanceForm({ ...performanceForm, time_minutes: e.target.value })}
                  placeholder="0"
                />
                <span className="text-sm text-gray-500">min</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  className="h-9 w-20"
                  value={performanceForm.time_seconds}
                  onChange={(e) => setPerformanceForm({ ...performanceForm, time_seconds: e.target.value })}
                  placeholder="00"
                />
                <span className="text-sm text-gray-500">sec</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={performanceForm.notes}
                onChange={(e) => setPerformanceForm({ ...performanceForm, notes: e.target.value })}
                placeholder="Observations..."
                rows={2}
                className="text-sm"
              />
            </div>
            <Button onClick={handleSavePerformance} disabled={saving} className="w-full bg-orange-500 hover:bg-orange-600">
              {saving ? 'Saving...' : 'Save Performance'}
            </Button>

            {existingPerformance.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Already recorded for this event:</p>
                <div className="space-y-1">
                  {existingPerformance.map((p) => (
                    <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                      <span>{DRILL_TYPES.find(d => d.value === p.drill_type)?.label || p.drill_type}</span>
                      <Badge variant="outline">
                        {p.time_seconds ? `${Math.floor(p.time_seconds/60)}:${(p.time_seconds%60).toString().padStart(2,'0')}` : '-'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="mental" className="space-y-3 mt-3">
            {existingMental && (
              <div className="bg-green-50 text-green-700 text-xs p-2 rounded flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Already rated - editing will update
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <LikertScale
                label="Persistence *"
                value={mentalForm.persistence_under_fatigue}
                onChange={(v) => setMentalForm({ ...mentalForm, persistence_under_fatigue: v })}
              />
              <LikertScale
                label="Teamwork *"
                value={mentalForm.teamwork_quality}
                onChange={(v) => setMentalForm({ ...mentalForm, teamwork_quality: v })}
              />
              <LikertScale
                label="Leadership"
                value={mentalForm.leadership}
                onChange={(v) => setMentalForm({ ...mentalForm, leadership: v })}
              />
              <LikertScale
                label="Adaptability"
                value={mentalForm.adaptability}
                onChange={(v) => setMentalForm({ ...mentalForm, adaptability: v })}
              />
              <LikertScale
                label="Mental Focus"
                value={mentalForm.mental_focus}
                onChange={(v) => setMentalForm({ ...mentalForm, mental_focus: v })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={mentalForm.notes}
                onChange={(e) => setMentalForm({ ...mentalForm, notes: e.target.value })}
                placeholder="Observations..."
                rows={2}
                className="text-sm"
              />
            </div>
            <Button onClick={handleSaveMental} disabled={saving} className="w-full bg-purple-500 hover:bg-purple-600">
              {saving ? 'Saving...' : existingMental ? 'Update Mental Rating' : 'Save Mental Rating'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}