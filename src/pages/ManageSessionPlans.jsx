import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Clock, Users, Calendar, Save, X, Shield, GripVertical, BookOpen, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import DrillBankPicker from '@/components/session/DrillBankPicker';

const DRILL_TYPES = [
  { value: '1k_run', label: '1K Run' },
  { value: '2k_run', label: '2K Run' },
  { value: '3km_run', label: '3KM Run' },
  { value: '300m_crawl', label: '300M Crawl' },
  { value: 'full_gan_saccer_crawl', label: 'Full Gan Saccer Crawl' },
  { value: 'other', label: 'Other' }
];

export default function ManageSessionPlans() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [plans, setPlans] = useState([]);
  const [customDrills, setCustomDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [showDrillDialog, setShowDrillDialog] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [planDrills, setPlanDrills] = useState([]);
  const [editingDrillId, setEditingDrillId] = useState(null);
  const [editingDrillData, setEditingDrillData] = useState(null);

  const [planForm, setPlanForm] = useState({ name: '', description: '', total_duration_minutes: '' });
  const [drillForm, setDrillForm] = useState({
    drill_type: '', custom_drill_id: '', drill_name: '',
    distance_meters: '', start_time: '', end_time: '',
    duration_minutes: '', notes: ''
  });

  useEffect(() => { if (user) loadData(); }, [user]); // [Fix P.1] wait for AuthContext

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;
      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false); return;
      }
      const [plansData, drillsData] = await Promise.all([
        base44.entities.SessionPlan.list('-created_date'),
        base44.entities.CustomDrill.filter({ is_active: true })
      ]);
      setPlans(plansData);
      setCustomDrills(drillsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDrills = async (planId) => {
    try {
      const drills = await base44.entities.SessionPlanDrill.filter({ session_plan_id: planId }, 'order_index');
      setPlanDrills(drills);
    } catch (error) {
      console.error('Error loading drills:', error);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    if (!planForm.name) { toast.error('Please enter a plan name'); return; }
    try {
      if (editingPlan) {
        await base44.entities.SessionPlan.update(editingPlan.id, planForm);
        toast.success('Plan updated');
        setShowPlanDialog(false);
        resetPlanForm();
        loadData();
      } else {
        const newPlan = await base44.entities.SessionPlan.create({ ...planForm, created_by: user.id });
        toast.success('Plan created — now add drills!');
        setShowPlanDialog(false);
        resetPlanForm();
        loadData();
        // Auto-open the drill editor with bank picker immediately
        setSelectedPlan(newPlan);
        setPlanDrills([]);
        setTimeout(() => setShowBankPicker(true), 300);
      }
    } catch (error) { toast.error('Failed to save plan'); }
  };

  const handleAddDrill = async (e) => {
    e.preventDefault();
    if (!drillForm.drill_type && !drillForm.custom_drill_id) {
      toast.error('Please select a drill'); return;
    }
    try {
      await base44.entities.SessionPlanDrill.create({
        session_plan_id: selectedPlan.id,
        drill_type: drillForm.drill_type || 'other',
        custom_drill_id: drillForm.custom_drill_id || null,
        drill_name: drillForm.custom_drill_id
          ? customDrills.find(d => d.id === drillForm.custom_drill_id)?.name
          : drillForm.drill_name,
        distance_meters: drillForm.distance_meters ? parseFloat(drillForm.distance_meters) : null,
        start_time: drillForm.start_time || null,
        end_time: drillForm.end_time || null,
        duration_minutes: drillForm.duration_minutes ? parseFloat(drillForm.duration_minutes) : null,
        notes: drillForm.notes || null,
        order_index: planDrills.length
      });
      toast.success('Drill added');
      setShowDrillDialog(false);
      resetDrillForm();
      loadPlanDrills(selectedPlan.id);
    } catch (error) { toast.error('Failed to add drill'); }
  };

  const handleAddFromBank = async (selectedDrills) => {
    try {
      for (let i = 0; i < selectedDrills.length; i++) {
        const drill = selectedDrills[i];
        await base44.entities.SessionPlanDrill.create({
          session_plan_id: selectedPlan.id,
          drill_type: 'other',
          custom_drill_id: drill.id,
          drill_name: drill.name,
          distance_meters: null,
          start_time: null,
          end_time: null,
          duration_minutes: null,
          notes: drill.description || null,
          order_index: planDrills.length + i
        });
      }
      toast.success(`${selectedDrills.length} drill(s) added from bank`);
      loadPlanDrills(selectedPlan.id);
    } catch (error) { toast.error('Failed to add drills'); }
  };

  const handleSyncFromBank = async (planDrill) => {
    const bankDrill = customDrills.find(d => d.id === planDrill.custom_drill_id);
    if (!bankDrill) { toast.error('Original drill not found in bank'); return; }
    try {
      await base44.entities.SessionPlanDrill.update(planDrill.id, { drill_name: bankDrill.name });
      toast.success('Synced with bank');
      loadPlanDrills(selectedPlan.id);
    } catch (error) { toast.error('Failed to sync'); }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const items = Array.from(planDrills);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const updated = items.map((d, i) => ({ ...d, order_index: i }));
    setPlanDrills(updated);
    await Promise.all(updated.map(d => base44.entities.SessionPlanDrill.update(d.id, { order_index: d.order_index })));
  };

  const handleDeletePlan = async (planId) => {
    if (!confirm('Delete this plan?')) return;
    try {
      await base44.entities.SessionPlan.delete(planId);
      toast.success('Plan deleted');
      loadData();
    } catch (error) { toast.error('Failed to delete plan'); }
  };

  const handleDeleteDrill = async (drillId) => {
    if (!confirm('Remove this drill from the plan?')) return;
    try {
      await base44.entities.SessionPlanDrill.delete(drillId);
      toast.success('Drill removed');
      loadPlanDrills(selectedPlan.id);
    } catch (error) { toast.error('Failed to remove drill'); }
  };

  const handleStartEditDrill = (drill) => {
    setEditingDrillId(drill.id);
    setEditingDrillData({
      drill_type: drill.drill_type, custom_drill_id: drill.custom_drill_id || '',
      drill_name: drill.drill_name || '', distance_meters: drill.distance_meters || '',
      start_time: drill.start_time || '', end_time: drill.end_time || '',
      duration_minutes: drill.duration_minutes || '', notes: drill.notes || ''
    });
  };

  const handleSaveEditDrill = async (drillId) => {
    try {
      await base44.entities.SessionPlanDrill.update(drillId, {
        drill_type: editingDrillData.drill_type || 'other',
        custom_drill_id: editingDrillData.custom_drill_id || null,
        drill_name: editingDrillData.custom_drill_id
          ? customDrills.find(d => d.id === editingDrillData.custom_drill_id)?.name
          : editingDrillData.drill_name,
        distance_meters: editingDrillData.distance_meters ? parseFloat(editingDrillData.distance_meters) : null,
        start_time: editingDrillData.start_time || null,
        end_time: editingDrillData.end_time || null,
        duration_minutes: editingDrillData.duration_minutes ? parseFloat(editingDrillData.duration_minutes) : null,
        notes: editingDrillData.notes || null
      });
      toast.success('Drill updated');
      setEditingDrillId(null);
      setEditingDrillData(null);
      loadPlanDrills(selectedPlan.id);
    } catch (error) { toast.error('Failed to update drill'); }
  };

  const resetPlanForm = () => { setPlanForm({ name: '', description: '', total_duration_minutes: '' }); setEditingPlan(null); };
  const resetDrillForm = () => {
    setDrillForm({ drill_type: '', custom_drill_id: '', drill_name: '', distance_meters: '', start_time: '', end_time: '', duration_minutes: '', notes: '' });
  };

  const getDrillLabel = (drill) => {
    if (drill.custom_drill_id) return drill.drill_name;
    return DRILL_TYPES.find(d => d.value === drill.drill_type)?.label || drill.drill_name || drill.drill_type;
  };

  const getTotalPlannedMinutes = () =>
    planDrills.reduce((sum, d) => sum + (parseFloat(d.duration_minutes) || 0), 0);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
    </div>
  );

  if (user?.user_type !== 'instructor' && user?.user_type !== 'admin') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur max-w-md">
        <CardContent className="py-12 text-center">
          <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500">Only instructors and admins can manage session plans.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Session Plans</h1>
          <p className="text-gray-400 mt-1">Create structured workout plans with timed drills</p>
        </div>
        <Button onClick={() => { resetPlanForm(); setShowPlanDialog(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />New Plan
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {!plan.is_active && <Badge variant="secondary">Inactive</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              {plan.description && <p className="text-sm text-gray-600 mb-3">{plan.description}</p>}
              {plan.total_duration_minutes && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <Clock className="w-4 h-4" />{plan.total_duration_minutes} minutes
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setSelectedPlan(plan); loadPlanDrills(plan.id); }} className="flex-1">
                  View / Edit Drills
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setEditingPlan(plan);
                  setPlanForm({ name: plan.name, description: plan.description || '', total_duration_minutes: plan.total_duration_minutes || '' });
                  setShowPlanDialog(true);
                }}>
                  <Edit className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDeletePlan(plan.id)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <Link to={createPageUrl('AssignSessionPlan') + '?planId=' + plan.id}>
                <Button size="sm" variant="ghost" className="w-full mt-2 text-indigo-600">
                  <Users className="w-3 h-3 mr-1" />Assign to Participants
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      {plans.length === 0 && (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardContent className="py-12 text-center">
            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">No session plans yet</p>
          </CardContent>
        </Card>
      )}

      {/* Plan Create/Edit Dialog */}
      <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingPlan ? 'Edit' : 'Create'} Session Plan</DialogTitle></DialogHeader>
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div><Label>Plan Name *</Label><Input value={planForm.name} onChange={(e) => setPlanForm({...planForm, name: e.target.value})} placeholder="e.g., Advanced Endurance Training" required /></div>
            <div><Label>Description</Label><Textarea value={planForm.description} onChange={(e) => setPlanForm({...planForm, description: e.target.value})} rows={2} /></div>
            <div><Label>Total Duration (minutes)</Label><Input type="number" value={planForm.total_duration_minutes} onChange={(e) => setPlanForm({...planForm, total_duration_minutes: e.target.value})} placeholder="e.g., 120" /></div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowPlanDialog(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">{editingPlan ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Session Plan Editor (Drills) */}
      <Dialog open={selectedPlan !== null} onOpenChange={() => { setSelectedPlan(null); setEditingDrillId(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>{selectedPlan?.name}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowBankPicker(true)} className="text-indigo-600 border-indigo-200">
                  <BookOpen className="w-3 h-3 mr-1" />+ Add from Bank
                </Button>
                <Button size="sm" onClick={() => setShowDrillDialog(true)} className="bg-indigo-600">
                  <Plus className="w-3 h-3 mr-1" />Add Drill
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {planDrills.length > 0 && (
            <div className="flex items-center gap-3 text-sm bg-indigo-50 rounded-lg px-4 py-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span className="text-indigo-700 font-medium">
                Planned: {getTotalPlannedMinutes()} min
                {selectedPlan?.total_duration_minutes && ` / ${selectedPlan.total_duration_minutes} min target`}
              </span>
              {selectedPlan?.total_duration_minutes && getTotalPlannedMinutes() >= parseFloat(selectedPlan.total_duration_minutes) && (
                <Badge className="bg-green-100 text-green-700 text-[10px]">Full session planned ✓</Badge>
              )}
            </div>
          )}

          {planDrills.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="w-14 h-14 mx-auto mb-3 text-indigo-200" />
              <p className="text-gray-700 font-semibold text-lg mb-1">Start building your session</p>
              <p className="text-gray-500 text-sm mb-5">Browse and select drills directly from the shared Drill Bank to build a full training sequence.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => setShowBankPicker(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <BookOpen className="w-4 h-4 mr-2" />Browse Drill Bank
                </Button>
                <Button variant="outline" onClick={() => setShowDrillDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />Add Custom Drill
                </Button>
              </div>
            </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="plan-drills">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                    {planDrills.map((drill, index) => {
                      const isEditing = editingDrillId === drill.id;
                      const bankDrill = drill.custom_drill_id ? customDrills.find(d => d.id === drill.custom_drill_id) : null;
                      const nameChanged = bankDrill && bankDrill.name !== drill.drill_name;

                      return (
                        <Draggable key={drill.id} draggableId={drill.id} index={index}>
                          {(prov, snapshot) => (
                            <div
                              ref={prov.innerRef}
                              {...prov.draggableProps}
                              className={`border rounded-xl p-3 bg-white transition-shadow ${snapshot.isDragging ? 'shadow-lg' : 'shadow-sm'}`}
                            >
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">Drill</Label>
                                      <Select value={editingDrillData.drill_type || editingDrillData.custom_drill_id}
                                        onValueChange={(v) => {
                                          if (customDrills.some(d => d.id === v)) {
                                            setEditingDrillData({ ...editingDrillData, drill_type: '', custom_drill_id: v });
                                          } else {
                                            setEditingDrillData({ ...editingDrillData, drill_type: v, custom_drill_id: '' });
                                          }
                                        }}>
                                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {DRILL_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                                          {customDrills.length > 0 && <>
                                            <div className="px-2 py-1 text-xs font-semibold text-gray-500">Drill Bank</div>
                                            {customDrills.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                          </>}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label className="text-xs">Duration (min)</Label>
                                      <Input type="number" value={editingDrillData.duration_minutes} onChange={e => setEditingDrillData({...editingDrillData, duration_minutes: e.target.value})} className="h-8 text-sm" placeholder="e.g., 15" />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Start Time</Label>
                                      <Input type="time" value={editingDrillData.start_time} onChange={e => setEditingDrillData({...editingDrillData, start_time: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div>
                                      <Label className="text-xs">End Time</Label>
                                      <Input type="time" value={editingDrillData.end_time} onChange={e => setEditingDrillData({...editingDrillData, end_time: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Distance (m)</Label>
                                      <Input type="number" value={editingDrillData.distance_meters} onChange={e => setEditingDrillData({...editingDrillData, distance_meters: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Notes</Label>
                                      <Input value={editingDrillData.notes} onChange={e => setEditingDrillData({...editingDrillData, notes: e.target.value})} className="h-8 text-sm" />
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={() => handleSaveEditDrill(drill.id)} className="bg-green-600 hover:bg-green-700 h-7 text-xs">
                                      <Save className="w-3 h-3 mr-1" />Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingDrillId(null)} className="h-7 text-xs">
                                      <X className="w-3 h-3 mr-1" />Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div {...prov.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500">
                                    <GripVertical className="w-4 h-4" />
                                  </div>
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                                    {index + 1}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium text-gray-900">{getDrillLabel(drill)}</span>
                                      {drill.custom_drill_id && (
                                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-indigo-600 border-indigo-200">Bank</Badge>
                                      )}
                                      {nameChanged && (
                                        <button
                                          onClick={() => handleSyncFromBank(drill)}
                                          className="flex items-center gap-0.5 text-[10px] text-amber-600 hover:text-amber-700 border border-amber-200 rounded px-1.5 py-0.5"
                                        >
                                          <RefreshCw className="w-2.5 h-2.5 mr-0.5" />Sync
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                      {drill.duration_minutes && <span><Clock className="w-3 h-3 inline mr-0.5" />{drill.duration_minutes} min</span>}
                                      {drill.start_time && <span>{drill.start_time}{drill.end_time ? ` – ${drill.end_time}` : ''}</span>}
                                      {drill.distance_meters && <span>{drill.distance_meters}m</span>}
                                      {drill.notes && <span className="text-gray-400 truncate max-w-[200px]">{drill.notes}</span>}
                                    </div>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <Button size="sm" variant="ghost" onClick={() => handleStartEditDrill(drill)} className="h-7 w-7 p-0">
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
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Drill Manually Dialog */}
      <Dialog open={showDrillDialog} onOpenChange={setShowDrillDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Drill to Plan</DialogTitle></DialogHeader>
          <form onSubmit={handleAddDrill} className="space-y-4">
            <div>
              <Label>Drill *</Label>
              <Select value={drillForm.drill_type || drillForm.custom_drill_id}
                onValueChange={(v) => {
                  if (customDrills.some(d => d.id === v)) {
                    setDrillForm({ ...drillForm, drill_type: '', custom_drill_id: v });
                  } else {
                    setDrillForm({ ...drillForm, drill_type: v, custom_drill_id: '' });
                  }
                }}>
                <SelectTrigger><SelectValue placeholder="Select drill" /></SelectTrigger>
                <SelectContent>
                  {DRILL_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  {customDrills.length > 0 && <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Drill Bank</div>
                    {customDrills.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </>}
                </SelectContent>
              </Select>
            </div>
            {drillForm.drill_type === 'other' && !drillForm.custom_drill_id && (
              <div><Label>Drill Name</Label><Input value={drillForm.drill_name} onChange={e => setDrillForm({...drillForm, drill_name: e.target.value})} /></div>
            )}
            <div><Label>Duration (minutes)</Label><Input type="number" value={drillForm.duration_minutes} onChange={e => setDrillForm({...drillForm, duration_minutes: e.target.value})} placeholder="e.g., 20" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start Time</Label><Input type="time" value={drillForm.start_time} onChange={e => setDrillForm({...drillForm, start_time: e.target.value})} /></div>
              <div><Label>End Time</Label><Input type="time" value={drillForm.end_time} onChange={e => setDrillForm({...drillForm, end_time: e.target.value})} /></div>
            </div>
            <div><Label>Distance (meters)</Label><Input type="number" value={drillForm.distance_meters} onChange={e => setDrillForm({...drillForm, distance_meters: e.target.value})} /></div>
            <div><Label>Instructions</Label><Textarea value={drillForm.notes} onChange={e => setDrillForm({...drillForm, notes: e.target.value})} rows={2} /></div>
            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDrillDialog(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">Add Drill</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drill Bank Picker */}
      <DrillBankPicker
        open={showBankPicker}
        onClose={() => setShowBankPicker(false)}
        onSelect={handleAddFromBank}
      />
    </div>
  );
}