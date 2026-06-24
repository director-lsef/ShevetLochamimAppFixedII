import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Shield, BookOpen, Search } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = ['Physical', 'Mental', 'Tactical', 'Crawls', 'Strength', 'Endurance', 'Other'];
const METRICS = ['time', 'distance', 'reps'];

const CATEGORY_COLORS = {
  Physical: 'bg-orange-100 text-orange-700',
  Mental: 'bg-purple-100 text-purple-700',
  Tactical: 'bg-blue-100 text-blue-700',
  Crawls: 'bg-amber-100 text-amber-700',
  Strength: 'bg-red-100 text-red-700',
  Endurance: 'bg-green-100 text-green-700',
  Other: 'bg-gray-100 text-gray-700',
};

const DEFAULT_FORM = {
  name: '',
  description: '',
  category: 'Physical',
  metrics: [],
  unit: '',
  color: '#6366f1',
  is_active: true,
};

export default function ManageCustomDrills() {
  const { user } = useAuth(); // [Fix P.1] user from AuthContext — no per-page auth.me()
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDrill, setEditingDrill] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => { if (user) loadData(); }, [user]); // [Fix P.1] wait for AuthContext

  const loadData = async () => {
    try {
      if (!user) return; // [Fix P.1] AuthContext still loading
      const userData = user;
      if (userData.user_type !== 'instructor' && userData.user_type !== 'admin') {
        setLoading(false); return;
      }
      const data = await base44.entities.CustomDrill.list('-created_date');
      setDrills(data);
    } catch (error) {
      console.error('Error loading drills:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error('Please enter a drill name'); return; }
    if (form.metrics.length === 0) { toast.error('Please select at least one metric'); return; }
    try {
      if (editingDrill) {
        await base44.entities.CustomDrill.update(editingDrill.id, form);
        toast.success('Drill updated');
      } else {
        await base44.entities.CustomDrill.create(form);
        toast.success('Drill created');
      }
      setShowDialog(false);
      setEditingDrill(null);
      setForm(DEFAULT_FORM);
      loadData();
    } catch (error) { toast.error('Failed to save drill'); }
  };

  const handleEdit = (drill) => {
    setEditingDrill(drill);
    setForm({
      name: drill.name || '',
      description: drill.description || '',
      category: drill.category || 'Physical',
      metrics: drill.metrics || [],
      unit: drill.unit || '',
      color: drill.color || '#6366f1',
      is_active: drill.is_active !== false,
    });
    setShowDialog(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this drill? It may be used in session plans.')) return;
    try {
      await base44.entities.CustomDrill.delete(id);
      toast.success('Drill deleted');
      loadData();
    } catch (error) { toast.error('Failed to delete drill'); }
  };

  const toggleMetric = (metric) => {
    setForm(prev => ({
      ...prev,
      metrics: prev.metrics.includes(metric)
        ? prev.metrics.filter(m => m !== metric)
        : [...prev.metrics, metric]
    }));
  };

  const filtered = drills.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      (d.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCat = filterCategory === 'All' || d.category === filterCategory;
    return matchesSearch && matchesCat;
  });

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
          <p className="text-gray-500">Only instructors and admins can manage the Drill Bank.</p>
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
            <BookOpen className="w-7 h-7" /> Drill Bank
          </h1>
          <p className="text-gray-400 mt-1">Shared drill library for all instructors</p>
        </div>
        <Button onClick={() => { setEditingDrill(null); setForm(DEFAULT_FORM); setShowDialog(true); }} className="bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-2" />New Drill
        </Button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search drills..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['All', ...CATEGORIES].map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? 'default' : 'outline'}
              onClick={() => setFilterCategory(cat)}
              className={`text-xs h-9 ${filterCategory === cat ? 'bg-indigo-600 text-white' : 'bg-white'}`}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      {/* Drills Grid */}
      {filtered.length === 0 ? (
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardContent className="py-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500">{drills.length === 0 ? 'No drills yet. Create the first one!' : 'No drills match your search.'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(drill => (
            <Card key={drill.id} className={`border-none shadow-lg bg-white/90 backdrop-blur overflow-hidden ${!drill.is_active ? 'opacity-60' : ''}`}>
              <div className="h-1.5" style={{ backgroundColor: drill.color || '#6366f1' }} />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{drill.name}</CardTitle>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(drill)} className="h-7 w-7 p-0">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(drill.id)} className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mt-1">
                  {drill.category && (
                    <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[drill.category] || CATEGORY_COLORS.Other}`}>
                      {drill.category}
                    </Badge>
                  )}
                  {!drill.is_active && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Inactive</Badge>}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {drill.description && <p className="text-sm text-gray-600 mb-2">{drill.description}</p>}
                <div className="flex gap-1 flex-wrap">
                  {drill.metrics?.map(m => (
                    <Badge key={m} variant="outline" className="text-[10px] px-1.5 py-0">{m}</Badge>
                  ))}
                  {drill.unit && <span className="text-xs text-gray-400">· {drill.unit}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { setEditingDrill(null); setForm(DEFAULT_FORM); } }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDrill ? 'Edit Drill' : 'New Drill'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g., Burpee Sprint" required />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows={2} placeholder="Brief description of the drill" />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metrics * <span className="text-xs text-gray-400">(select all that apply)</span></Label>
              <div className="flex gap-2 mt-1">
                {METRICS.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleMetric(m)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      form.metrics.includes(m)
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} placeholder="e.g., meters, kg, reps" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                <Input type="color" value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="w-16 h-10 p-1" />
                <Input value={form.color} onChange={e => setForm({...form, color: e.target.value})} className="flex-1" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_active" checked={form.is_active} onChange={e => setForm({...form, is_active: e.target.checked})} className="w-4 h-4" />
              <Label htmlFor="is_active" className="cursor-pointer">Active (visible in drill bank)</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">{editingDrill ? 'Update' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}