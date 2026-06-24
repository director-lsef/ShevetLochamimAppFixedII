import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Check } from 'lucide-react';

export default function LocationSelect({ value, onChange, placeholder = "Select location" }) {
  const [locations, setLocations] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const data = await base44.entities.Location.list();
    setLocations(data);
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) return;
    setSaving(true);
    const created = await base44.entities.Location.create({ name: newLocation.trim() });
    await loadLocations();
    onChange(created.name);
    setNewLocation('');
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {locations.map((loc) => (
            <SelectItem key={loc.id} value={loc.name}>{loc.name}</SelectItem>
          ))}
          <div className="px-2 py-1 border-t mt-1">
            {!showAdd ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-8 text-xs"
                onClick={(e) => { e.preventDefault(); setShowAdd(true); }}
              >
                <Plus className="w-3 h-3 mr-1" />
                Add new location
              </Button>
            ) : (
              <div className="flex gap-1 pt-1">
                <Input
                  autoFocus
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddLocation()}
                  placeholder="Location name"
                  className="h-7 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 px-2"
                  disabled={saving || !newLocation.trim()}
                  onClick={handleAddLocation}
                >
                  <Check className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}