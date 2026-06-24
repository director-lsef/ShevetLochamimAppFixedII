import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Target, Plus, Edit, Trash2, Clock, BookOpen, GripVertical, X, Save } from 'lucide-react';
import { toast } from 'sonner';
import DrillBankPicker from '@/components/session/DrillBankPicker';

// Add minutes to a HH:MM string, returns HH:MM
function addMinutes(timeStr, mins) {
  if (!timeStr || !mins) return null;
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + Math.round(parseFloat(mins));
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Compute chained start/end times from an array of drills with start_time + duration_minutes
function computeTimeline(drills) {
  const result = [];
  for (let i = 0; i < drills.length; i++) {
    const drill = drills[i];
    // start_time: use own start_time if set, else chain from previous end
    const start = drill.start_time || (i > 0 ? result[i - 1].end : null);
    const end = start && drill.duration_minutes ? addMinutes(start, drill.duration_minutes) : null;
    result.push({ ...drill, _start: start, _end: end });
  }
  return result;
}

export default function EventSessionPlan({ event, user, onUpdate }) {
  const [templates, setTemplates] = useState([]);
  const [eventDrills, setEventDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showDrillPicker, setShowDrillPicker] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [editingDrillId, setEditingDrillId] = useState(null);
  const [editingStartTime, setEditingStartTime] = useState('');
  const [editingDuration, setEditingDuration] = useState('');
  const [editingNotes, setEditingNotes] = useState('');

  const isStaff = user?.user_type === 'admin' || user?.user_type === 'instructor';

  useEffect(() => {
    loadEventDrills();
    if (isStaff) loadTemplates();
  }, [event?.id]);

  const loadTemplates = async () => {
    const data = await base44.entities.SessionPlanTemplate.list('-created_date');
    setTemplates(data);
  };

  const loadEventDrills = async () => {
    setLoading(true);
    try {
      if (event?.session_plan_id) {
        const drills = await base44.entities.SessionPlanDrill.filter(
          { session_plan_id: event.session_plan_id }, 'order_index'
        );
        setEventDrills(drills);
      } else {
        setEventDrills([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const ensureEventPlan = async () => {
    if (event.session_plan_id) return event.session_plan_id;
    const plan = await base44.entities.SessionPlan.create({
      name: `${event.title} Plan`,
      created_by: user.id,
      is_active: true
    });
    await base44.entities.Event.update(event.id, { session_plan_id: plan.id });
    onUpdate();
    return plan.id;
  };

  const handleLoadFromTemplate = async () => {
    if (!selectedTemplateId) { toast.error('Select a template first'); return; }
    setLoadingTemplate(true);
    try {
      const templateDrills = await base44.entities.SessionPlanTemplateDrill.filter(
        { template_id: selectedTemplateId }, 'order_index'
      );
      const planId = await ensureEventPlan();

      const existing = await base44.entities.SessionPlanDrill.filter({ session_plan_id: planId });
      await Promise.all(existing.map(d => base44.entities.SessionPlanDrill.delete(d.id)));

      // Use event start time as the base for chaining
      const eventStartTime = event.start_datetime
        ? new Date(event.start_datetime).toTimeString().slice(0, 5)
        : null;

      let currentTime = eventStartTime;
      for (let i = 0; i < templateDrills.length; i++) {
        const td = templateDrills[i];
        const start = i === 0 ? currentTime : currentTime;
        const end = start && td.duration_minutes ? addMinutes(start, td.duration_minutes) : null;
        await base44.entities.SessionPlanDrill.create({
          session_plan_id: planId,
          drill_type: 'other',
          custom_drill_id: td.custom_drill_id || null,
          drill_name: td.drill_name,
          duration_minutes: td.duration_minutes || null,
          start_time: start || null,
          end_time: end || null,
          notes: td.notes || null,
          order_index: i
        });
        if (end) currentTime = end;
      }

      toast.success(`Loaded template with ${templateDrills.length} drills`);
      setShowPlanDialog(false);
      loadEventDrills();
    } catch (error) {
      toast.error('Failed to load template');
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleAddFromBank = async (selectedDrills) => {
    try {
      const planId = await ensureEventPlan();
      const existing = await base44.entities.SessionPlanDrill.filter({ session_plan_id: planId });
      for (let i = 0; i < selectedDrills.length; i++) {
        const drill = selectedDrills[i];
        await base44.entities.SessionPlanDrill.create({
          session_plan_id: planId,
          drill_type: 'other',
          custom_drill_id: drill.id,
          drill_name: drill.name,
          duration_minutes: null,
          start_time: null,
          end_time: null,
          notes: drill.description || null,
          order_index: existing.length + i
        });
      }
      toast.success(`${selectedDrills.length} drill(s) added`);
      loadEventDrills();
    } catch (error) {
      toast.error('Failed to add drills');
    }
  };

  const handleDeleteDrill = async (drillId) => {
    try {
      await base44.entities.SessionPlanDrill.delete(drillId);
      toast.success('Drill removed');
      loadEventDrills();
    } catch (error) { toast.error('Failed to remove'); }
  };

  const handleSaveEditDrill = async (drillId) => {
    try {
      const duration = editingDuration ? parseFloat(editingDuration) : null;
      const start = editingStartTime || null;
      const end = start && duration ? addMinutes(start, duration) : null;
      await base44.entities.SessionPlanDrill.update(drillId, {
        start_time: start,
        end_time: end,
        duration_minutes: duration,
        notes: editingNotes || null
      });
      setEditingDrillId(null);
      loadEventDrills();
    } catch (error) { toast.error('Failed to update drill'); }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(eventDrills);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const updated = items.map((d, i) => ({ ...d, order_index: i }));
    setEventDrills(updated);
    await Promise.all(updated.map(d => base44.entities.SessionPlanDrill.update(d.id, { order_index: d.order_index })));
  };

  const handleClearPlan = async () => {
    if (!confirm('Remove all drills from this event\'s plan?')) return;
    try {
      await Promise.all(eventDrills.map(d => base44.entities.SessionPlanDrill.delete(d.id)));
      toast.success('Plan cleared');
      loadEventDrills();
    } catch (error) { toast.error('Failed to clear plan'); }
  };

  const timeline = computeTimeline(eventDrills);
  const totalMinutes = eventDrills.reduce((sum, d) => sum + (parseFloat(d.duration_minutes) || 0), 0);

  if (loading) return (
    <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
      <CardContent className="py-6 flex justify-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600" />
      </CardContent>
    </Card>
  );

  return (
    <>
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Session Plan
            </span>
            {isStaff && (
              <div className="flex gap-2">
                {eventDrills.length > 0 && (
                  <Button size="sm" variant="ghost" onClick={() => setShowDrillPicker(true)} className="h-8 text-xs text-indigo-600">
                    <Plus className="w-3 h-3 mr-1" />Add Drills
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setShowPlanDialog(true)} className="h-8 text-xs">
                  {eventDrills.length > 0 ? 'Manage Plan' : 'Build Plan'}
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {eventDrills.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-3">No session plan for this event yet.</p>
              {isStaff && (
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setShowPlanDialog(true)}>
                  <Target className="w-4 h-4 mr-1" />Build / Load Session Plan
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {totalMinutes > 0 && (
                <div className="flex items-center gap-2 text-sm bg-indigo-50 rounded-lg px-3 py-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-700 font-medium">{totalMinutes} min total planned</span>
                </div>
              )}

              {isStaff ? (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="event-drills">
                    {(provided) => (
                      <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                        {timeline.map((drill, index) => (
                          <Draggable key={drill.id} draggableId={drill.id} index={index}>
                            {(prov, snap) => (
                              <div
                                ref={prov.innerRef}
                                {...prov.draggableProps}
                                className={`border rounded-lg p-3 bg-white ${snap.isDragging ? 'shadow-lg' : 'shadow-sm'}`}
                              >
                                {editingDrillId === drill.id ? (
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold text-gray-600">{drill.drill_name}</p>
                                    <div className="flex gap-2">
                                      <div className="flex-1">
                                        <Label className="text-xs">Start Time</Label>
                                        <Input type="time" value={editingStartTime} onChange={e => setEditingStartTime(e.target.value)} className="h-7 text-sm" />
                                      </div>
                                      <div className="flex-1">
                                        <Label className="text-xs">Duration (min)</Label>
                                        <Input type="number" value={editingDuration} onChange={e => setEditingDuration(e.target.value)} className="h-7 text-sm" placeholder="e.g., 15" />
                                      </div>
                                    </div>
                                    {editingStartTime && editingDuration && (
                                      <p className="text-xs text-indigo-600 font-medium">
                                        {editingStartTime} – {addMinutes(editingStartTime, editingDuration)}
                                      </p>
                                    )}
                                    <div className="flex-1">
                                      <Label className="text-xs">Notes</Label>
                                      <Input value={editingNotes} onChange={e => setEditingNotes(e.target.value)} className="h-7 text-sm" placeholder="Instructions..." />
                                    </div>
                                    <div className="flex gap-2">
                                      <Button size="sm" onClick={() => handleSaveEditDrill(drill.id)} className="h-7 text-xs bg-green-600 hover:bg-green-700">
                                        <Save className="w-3 h-3 mr-1" />Save
                                      </Button>
                                      <Button size="sm" variant="outline" onClick={() => setEditingDrillId(null)} className="h-7 text-xs">
                                        <X className="w-3 h-3 mr-1" />Cancel
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <div {...prov.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0">
                                      <GripVertical className="w-4 h-4" />
                                    </div>
                                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
                                      {index + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-medium text-sm text-gray-900 block truncate">{drill.drill_name}</span>
                                      <div className="flex gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                                        {drill._start && drill._end && (
                                          <span className="font-medium text-indigo-600">
                                            <Clock className="w-3 h-3 inline mr-0.5" />{drill._start} – {drill._end}
                                          </span>
                                        )}
                                        {drill.duration_minutes && !drill._start && (
                                          <span><Clock className="w-3 h-3 inline mr-0.5" />{drill.duration_minutes}m</span>
                                        )}
                                        {drill.notes && <span className="italic truncate max-w-[150px]">{drill.notes}</span>}
                                      </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                      <Button size="sm" variant="ghost" onClick={() => {
                                        setEditingDrillId(drill.id);
                                        setEditingStartTime(drill.start_time || drill._start || '');
                                        setEditingDuration(drill.duration_minutes || '');
                                        setEditingNotes(drill.notes || '');
                                      }} className="h-7 w-7 p-0">
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => handleDeleteDrill(drill.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              ) : (
                // Read-only view for participants
                <div className="space-y-2">
                  {timeline.map((drill, index) => (
                    <div key={drill.id} className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <div className="w-6 h-6 rounded-full bg-purple-200 text-purple-800 text-xs font-bold flex items-center justify-center shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm text-gray-900 block">{drill.drill_name}</span>
                        <div className="flex gap-2 text-xs text-gray-500 flex-wrap mt-0.5">
                          {drill._start && drill._end && (
                            <span className="font-medium text-indigo-600">
                              <Clock className="w-3 h-3 inline mr-0.5" />{drill._start} – {drill._end}
                            </span>
                          )}
                          {drill.duration_minutes && !drill._start && (
                            <span><Clock className="w-3 h-3 inline mr-0.5" />{drill.duration_minutes} min</span>
                          )}
                          {drill.notes && <span className="italic">{drill.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isStaff && eventDrills.length > 0 && (
                <Button size="sm" variant="ghost" onClick={handleClearPlan} className="text-red-500 hover:text-red-700 text-xs w-full mt-1">
                  Clear All Drills
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Builder Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Build / Load Session Plan
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="load">
            <TabsList className="w-full">
              <TabsTrigger value="load" className="flex-1">
                <BookOpen className="w-4 h-4 mr-1" />Option A: Load from Bank
              </TabsTrigger>
              <TabsTrigger value="custom" className="flex-1">
                <Plus className="w-4 h-4 mr-1" />Option B: Build Custom
              </TabsTrigger>
            </TabsList>

            <TabsContent value="load" className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">Select a pre-made template. Drills will be chained starting from the event's start time.</p>
              <div className="space-y-2">
                <Label>Session Plan Template</Label>
                <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}{t.total_duration_minutes ? ` (${t.total_duration_minutes}m)` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedTemplateId && (() => {
                const t = templates.find(x => x.id === selectedTemplateId);
                return t?.description ? (
                  <div className="p-3 bg-purple-50 rounded-lg text-sm text-purple-800">{t.description}</div>
                ) : null;
              })()}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowPlanDialog(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleLoadFromTemplate} disabled={!selectedTemplateId || loadingTemplate} className="flex-1 bg-purple-600 hover:bg-purple-700">
                  {loadingTemplate ? 'Loading...' : 'Load Template'}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="custom" className="space-y-4 mt-4">
              <p className="text-sm text-gray-600">Search the Drill Bank and add individual drills. Set start time and duration per drill.</p>
              <Button onClick={() => { setShowPlanDialog(false); setTimeout(() => setShowDrillPicker(true), 100); }} className="w-full bg-indigo-600 hover:bg-indigo-700">
                <BookOpen className="w-4 h-4 mr-2" />Browse & Add Drills from Bank
              </Button>
              <Button variant="outline" onClick={() => setShowPlanDialog(false)} className="w-full">Done</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Drill Bank Picker */}
      <DrillBankPicker
        open={showDrillPicker}
        onClose={() => setShowDrillPicker(false)}
        onSelect={handleAddFromBank}
      />
    </>
  );
}