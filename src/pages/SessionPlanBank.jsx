import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Clock, Shield, BookOpen, GripVertical, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import DrillBankPicker from '@/components/session/DrillBankPicker';

export default function SessionPlanBank() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', total_duration_minutes: '' });

  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [templateDrills, setTemplateDrills] = useState({}); // { templateId: [drills] }
  const [showDrillPicker, setShowDrillPicker] = useState(false);
  const [activePicker, setActivePicker] = useState(null); // templateId
  const [search, setSearch] = useState('');

  useEffect(() => { if (user) loadData(); }, [user]); // [Fix P.1] wait for AuthContext

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;
      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false); return;
      }
      const data = await base44.entities.SessionPlanTemplate.list('-created_date');
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateDrills = async (templateId) => {
    try {
      const drills = await base44.entities.SessionPlanTemplateDrill.filter(
        { template_id: templateId }, 'order_index'
      );
      setTemplateDrills(prev => ({ ...prev, [templateId]: drills }));
    } catch (error) {
      console.error('Error loading drills:', error);
    }
  };

  const handleToggleExpand = (templateId) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
    } else {
      setExpandedTemplate(templateId);
      if (!templateDrills[templateId]) {
        loadTemplateDrills(templateId);
      }
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    if (!templateForm.name) { toast.error('Please enter a template name'); return; }
    try {
      if (editingTemplate) {
        await base44.entities.SessionPlanTemplate.update(editingTemplate.id, templateForm);
        toast.success('Template updated');
      } else {
        const created = await base44.entities.SessionPlanTemplate.create({ ...templateForm, created_by: user.id });
        toast.success('Template created — add drills now!');
        setShowTemplateDialog(false);
        resetTemplateForm();
        await loadData();
        setExpandedTemplate(created.id);
        setTemplateDrills(prev => ({ ...prev, [created.id]: [] }));
        setTimeout(() => { setActivePicker(created.id); setShowDrillPicker(true); }, 300);
        return;
      }
      setShowTemplateDialog(false);
      resetTemplateForm();
      loadData();
    } catch (error) { toast.error('Failed to save template'); }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete this template? This cannot be undone.')) return;
    try {
      // Delete all drills first
      const drills = templateDrills[id] || [];
      await Promise.all(drills.map(d => base44.entities.SessionPlanTemplateDrill.delete(d.id)));
      await base44.entities.SessionPlanTemplate.delete(id);
      toast.success('Template deleted');
      loadData();
    } catch (error) { toast.error('Failed to delete template'); }
  };

  const handleAddDrillsFromBank = async (selectedDrills) => {
    const templateId = activePicker;
    const existing = templateDrills[templateId] || [];
    try {
      for (let i = 0; i < selectedDrills.length; i++) {
        const drill = selectedDrills[i];
        await base44.entities.SessionPlanTemplateDrill.create({
          template_id: templateId,
          custom_drill_id: drill.id,
          drill_name: drill.name,
          duration_minutes: null,
          notes: drill.description || null,
          order_index: existing.length + i
        });
      }
      toast.success(`${selectedDrills.length} drill(s) added`);
      loadTemplateDrills(templateId);
    } catch (error) { toast.error('Failed to add drills'); }
  };

  const handleDeleteDrill = async (templateId, drillId) => {
    try {
      await base44.entities.SessionPlanTemplateDrill.delete(drillId);
      toast.success('Drill removed');
      loadTemplateDrills(templateId);
    } catch (error) { toast.error('Failed to remove drill'); }
  };

  const handleUpdateDrillDuration = async (templateId, drillId, duration) => {
    try {
      await base44.entities.SessionPlanTemplateDrill.update(drillId, { duration_minutes: duration ? parseFloat(duration) : null });
      loadTemplateDrills(templateId);
    } catch (error) { toast.error('Failed to update'); }
  };

  const handleDragEnd = async (result, templateId) => {
    if (!result.destination) return;
    const items = Array.from(templateDrills[templateId] || []);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    const updated = items.map((d, i) => ({ ...d, order_index: i }));
    setTemplateDrills(prev => ({ ...prev, [templateId]: updated }));
    await Promise.all(updated.map(d => base44.entities.SessionPlanTemplateDrill.update(d.id, { order_index: d.order_index })));
  };

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', description: '', total_duration_minutes: '' });
    setEditingTemplate(null);
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const getTotalMinutes = (templateId) => {
    return (templateDrills[templateId] || []).reduce((sum, d) => sum + (parseFloat(d.duration_minutes) || 0), 0);
  };

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
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-500">Only instructors and admins can access the Session Plan Bank.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-7 h-7" /> Session Plan Bank
          </h1>
          <p className="text-gray-400 mt-1">Create reusable training routines to attach to events</p>
        </div>
        <Button onClick={() => { resetTemplateForm(); setShowTemplateDialog(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />New Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search templates..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-white"
        />
      </div>

      {/* Templates */}
      {filtered.length === 0 ? (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardContent className="py-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{templates.length === 0 ? 'No templates yet. Create your first one!' : 'No templates match your search.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map(template => {
            const isExpanded = expandedTemplate === template.id;
            const drills = templateDrills[template.id] || [];
            const totalMin = getTotalMinutes(template.id);

            return (
              <Card key={template.id} className="border-none shadow-lg bg-white/90 backdrop-blur overflow-hidden">
                <div className="h-1" style={{ background: 'linear-gradient(to right, #6366f1, #a855f7)' }} />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      onClick={() => handleToggleExpand(template.id)}
                      className="flex items-start gap-3 flex-1 text-left hover:opacity-80 transition-opacity"
                    >
                      {isExpanded ? <ChevronDown className="w-5 h-5 mt-0.5 text-gray-500 shrink-0" /> : <ChevronRight className="w-5 h-5 mt-0.5 text-gray-500 shrink-0" />}
                      <div>
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        {template.description && <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {template.total_duration_minutes && (
                            <Badge variant="secondary" className="text-[10px]">
                              <Clock className="w-3 h-3 mr-1" />{template.total_duration_minutes} min target
                            </Badge>
                          )}
                          {isExpanded && drills.length > 0 && totalMin > 0 && (
                            <Badge className="text-[10px] bg-indigo-100 text-indigo-700">
                              {totalMin} min planned
                            </Badge>
                          )}
                          {isExpanded && <Badge variant="outline" className="text-[10px]">{drills.length} drills</Badge>}
                        </div>
                      </div>
                    </button>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => {
                        setEditingTemplate(template);
                        setTemplateForm({ name: template.name, description: template.description || '', total_duration_minutes: template.total_duration_minutes || '' });
                        setShowTemplateDialog(true);
                      }} className="h-7 w-7 p-0">
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(template.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" onClick={() => { setActivePicker(template.id); setShowDrillPicker(true); }} className="text-indigo-600 border-indigo-200 h-8">
                          <Plus className="w-3 h-3 mr-1" />Add Drills from Bank
                        </Button>
                      </div>

                      {drills.length === 0 ? (
                        <div className="text-center py-6">
                          <p className="text-gray-400 text-sm">No drills yet.</p>
                          <Button size="sm" onClick={() => { setActivePicker(template.id); setShowDrillPicker(true); }} className="mt-2 bg-indigo-600 hover:bg-indigo-700 h-8 text-xs">
                            <BookOpen className="w-3 h-3 mr-1" />Browse Drill Bank
                          </Button>
                        </div>
                      ) : (
                        <DragDropContext onDragEnd={(r) => handleDragEnd(r, template.id)}>
                          <Droppable droppableId={`template-${template.id}`}>
                            {(provided) => (
                              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {drills.map((drill, index) => (
                                  <Draggable key={drill.id} draggableId={drill.id} index={index}>
                                    {(prov, snap) => (
                                      <div
                                        ref={prov.innerRef}
                                        {...prov.draggableProps}
                                        className={`flex items-center gap-2 p-2.5 rounded-lg border bg-white ${snap.isDragging ? 'shadow-lg' : 'shadow-sm'}`}
                                      >
                                        <div {...prov.dragHandleProps} className="cursor-grab text-gray-300 hover:text-gray-500 shrink-0">
                                          <GripVertical className="w-4 h-4" />
                                        </div>
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                                          {index + 1}
                                        </div>
                                        <span className="flex-1 text-sm font-medium text-gray-900 truncate">{drill.drill_name}</span>
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Input
                                            type="number"
                                            placeholder="min"
                                            value={drill.duration_minutes || ''}
                                            onChange={e => {
                                              const updated = drills.map(d => d.id === drill.id ? { ...d, duration_minutes: e.target.value } : d);
                                              setTemplateDrills(prev => ({ ...prev, [template.id]: updated }));
                                            }}
                                            onBlur={e => handleUpdateDrillDuration(template.id, drill.id, e.target.value)}
                                            className="w-16 h-7 text-xs text-center"
                                          />
                                          <span className="text-xs text-gray-400">min</span>
                                          <Button size="sm" variant="ghost" onClick={() => handleDeleteDrill(template.id, drill.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3 h-3" />
                                          </Button>
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </DragDropContext>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={(open) => { setShowTemplateDialog(open); if (!open) resetTemplateForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Session Plan Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
            <div>
              <Label>Template Name *</Label>
              <Input value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder="e.g., Hell Day Level 1" required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })} rows={2} placeholder="What does this training routine focus on?" />
            </div>
            <div>
              <Label>Target Duration (minutes)</Label>
              <Input type="number" value={templateForm.total_duration_minutes} onChange={e => setTemplateForm({ ...templateForm, total_duration_minutes: e.target.value })} placeholder="e.g., 120" />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowTemplateDialog(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">{editingTemplate ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drill Bank Picker */}
      <DrillBankPicker
        open={showDrillPicker}
        onClose={() => setShowDrillPicker(false)}
        onSelect={handleAddDrillsFromBank}
      />
    </div>
  );
}