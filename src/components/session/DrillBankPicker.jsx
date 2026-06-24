import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, BookOpen, Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['All', 'Physical', 'Mental', 'Tactical', 'Crawls', 'Strength', 'Endurance', 'Other'];

const CATEGORY_COLORS = {
  Physical: 'bg-orange-100 text-orange-700',
  Mental: 'bg-purple-100 text-purple-700',
  Tactical: 'bg-blue-100 text-blue-700',
  Crawls: 'bg-amber-100 text-amber-700',
  Strength: 'bg-red-100 text-red-700',
  Endurance: 'bg-green-100 text-green-700',
  Other: 'bg-gray-100 text-gray-700',
};

const METRICS = ['time', 'distance', 'reps'];

export default function DrillBankPicker({ open, onClose, onSelect }) {
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState([]);
  const [showNewDrillForm, setShowNewDrillForm] = useState(false);
  const [newDrill, setNewDrill] = useState({ name: '', category: 'Physical', metrics: ['time'], description: '' });
  const [saving, setSaving] = useState(false);

  const loadDrills = () => {
    base44.entities.CustomDrill.filter({ is_active: true }).then(data => {
      setDrills(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (open) {
      setSelected([]);
      setSearch('');
      setCategory('All');
      setShowNewDrillForm(false);
      setNewDrill({ name: '', category: 'Physical', metrics: ['time'], description: '' });
      loadDrills();
    }
  }, [open]);

  const handleCreateDrill = async () => {
    if (!newDrill.name.trim()) { toast.error('Drill name is required'); return; }
    if (newDrill.metrics.length === 0) { toast.error('Select at least one metric'); return; }
    setSaving(true);
    try {
      const created = await base44.entities.CustomDrill.create({ ...newDrill, is_active: true });
      toast.success('Drill created and added to bank!');
      setShowNewDrillForm(false);
      setNewDrill({ name: '', category: 'Physical', metrics: ['time'], description: '' });
      loadDrills();
      // Auto-select the new drill
      setSelected(prev => [...prev, created]);
    } catch (e) {
      toast.error('Failed to create drill');
    } finally {
      setSaving(false);
    }
  };

  const toggleMetric = (metric) => {
    setNewDrill(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const filtered = drills.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || d.category === category;
    return matchesSearch && matchesCategory;
  });

  const toggle = (drill) => {
    setSelected(prev =>
      prev.some(s => s.id === drill.id)
        ? prev.filter(s => s.id !== drill.id)
        : [...prev, drill]
    );
  };

  const handleAdd = () => {
    onSelect(selected);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-600" />
            Add Drills from Bank
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* Create new drill inline form */}
          {showNewDrillForm ? (
            <div className="border-2 border-indigo-200 rounded-lg p-3 bg-indigo-50 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-indigo-700">New Drill</span>
                <button onClick={() => setShowNewDrillForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
              <Input
                placeholder="Drill name *"
                value={newDrill.name}
                onChange={e => setNewDrill(p => ({ ...p, name: e.target.value }))}
                className="h-8 text-sm bg-white"
                autoFocus
              />
              <div className="flex gap-2">
                <Select value={newDrill.category} onValueChange={v => setNewDrill(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="h-8 text-xs bg-white flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.slice(1).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-gray-600">Metrics</Label>
                <div className="flex gap-1.5 mt-1">
                  {METRICS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMetric(m)}
                      className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${newDrill.metrics.includes(m) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <Input
                placeholder="Description (optional)"
                value={newDrill.description}
                onChange={e => setNewDrill(p => ({ ...p, description: e.target.value }))}
                className="h-8 text-sm bg-white"
              />
              <Button size="sm" onClick={handleCreateDrill} disabled={saving} className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 text-xs">
                {saving ? 'Creating...' : 'Create & Add to Plan'}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setShowNewDrillForm(true)} className="text-indigo-600 border-indigo-200 h-8 text-xs w-full">
              <Plus className="w-3 h-3 mr-1" />Create New Drill
            </Button>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search drills..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Category filter */}
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map(cat => (
              <Button
                key={cat}
                size="sm"
                variant={category === cat ? 'default' : 'outline'}
                onClick={() => setCategory(cat)}
                className={`text-xs h-7 ${category === cat ? 'bg-indigo-600 text-white' : ''}`}
              >
                {cat}
              </Button>
            ))}
          </div>

          {/* Drill list */}
          <div className="overflow-y-auto flex-1 space-y-2 pr-1">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No drills found</p>
            ) : (
              filtered.map(drill => {
                const isSelected = selected.some(s => s.id === drill.id);
                return (
                  <div
                    key={drill.id}
                    onClick={() => toggle(drill)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="w-1 self-stretch rounded-full shrink-0" style={{ backgroundColor: drill.color || '#6366f1' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900">{drill.name}</span>
                        {drill.category && (
                          <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[drill.category] || CATEGORY_COLORS.Other}`}>
                            {drill.category}
                          </Badge>
                        )}
                        {drill.metrics?.map(m => (
                          <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">{m}</Badge>
                        ))}
                      </div>
                      {drill.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{drill.description}</p>
                      )}
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-gray-500">
              {selected.length} drill{selected.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleAdd}
                disabled={selected.length === 0}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Add {selected.length > 0 ? selected.length : ''} to Plan
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}