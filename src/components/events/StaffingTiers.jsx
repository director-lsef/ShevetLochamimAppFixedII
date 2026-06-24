// ============================================================
// StaffingTiers.jsx — IMPLEMENTED (Fix 2.2 active)
// Instructors self-claim/unregister slots. Admins can assign any
// instructor to any slot and remove any instructor from any slot.
// ============================================================
import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TIERS = [
  { key: 'lead_instructor_id', label: 'Lead Instructor', tier: 1, color: 'bg-amber-50 border-amber-300', badgeColor: 'bg-amber-100 text-amber-800', icon: '👑' },
  { key: 'assistant_instructor_id', label: 'Supporting Instructor', tier: 2, color: 'bg-blue-50 border-blue-200', badgeColor: 'bg-blue-100 text-blue-800', icon: '🛡️' },
  { key: 'support_instructor_id', label: 'Extra Instructor', tier: 3, color: 'bg-gray-50 border-gray-200', badgeColor: 'bg-gray-100 text-gray-700', icon: '➕' },
  { key: 'instructor_4_id', label: 'Extra Instructor', tier: 3, color: 'bg-gray-50 border-gray-200', badgeColor: 'bg-gray-100 text-gray-700', icon: '➕' },
  { key: 'instructor_5_id', label: 'Extra Instructor', tier: 3, color: 'bg-gray-50 border-gray-200', badgeColor: 'bg-gray-100 text-gray-700', icon: '➕' },
];

export default function StaffingTiers({ event, user, participants, instructors = [], onUpdate, isPast }) {
  const [loading, setLoading] = React.useState(null);

  const getName = (id) => {
    if (!id) return null;
    const p = participants.find(u => u.id === id);
    return p?.full_name || 'Instructor';
  };

  const mySlot = TIERS.find(t => event[t.key] === user?.id);
  const isAdmin = user?.user_type === 'admin' || user?.role === 'admin';

  // Instructors not already assigned to any slot on this event
  const availableInstructors = instructors.filter(
    i => !TIERS.some(t => event[t.key] === i.id)
  );

  const handleClaim = async (tierKey) => {
    setLoading(tierKey);
    try {
      await base44.entities.Event.update(event.id, { [tierKey]: user.id });
      toast.success('Slot claimed!');
      onUpdate();
    } catch {
      toast.error('Failed to claim slot');
    } finally {
      setLoading(null);
    }
  };

  const handleUnregister = async () => {
    if (!mySlot) return;
    setLoading(mySlot.key);
    try {
      await base44.entities.Event.update(event.id, { [mySlot.key]: null });
      toast.success('Unregistered from slot');
      onUpdate();
    } catch {
      toast.error('Failed to unregister');
    } finally {
      setLoading(null);
    }
  };

  // [Fix 2.2] Admin: assign a specific instructor to a slot
  const handleAdminAssign = async (tierKey, instructorId) => {
    setLoading(tierKey);
    try {
      await base44.entities.Event.update(event.id, { [tierKey]: instructorId });
      toast.success('Instructor assigned');
      onUpdate();
    } catch {
      toast.error('Failed to assign instructor');
    } finally {
      setLoading(null);
    }
  };

  // [Fix 2.2] Admin: remove any instructor from any slot
  const handleAdminRemove = async (tierKey) => {
    setLoading(tierKey);
    try {
      await base44.entities.Event.update(event.id, { [tierKey]: null });
      toast.success('Instructor removed from slot');
      onUpdate();
    } catch {
      toast.error('Failed to remove instructor');
    } finally {
      setLoading(null);
    }
  };

  // Renders the admin controls (assign dropdown + remove button) for a slot
  const AdminControls = ({ tierKey, assignedId }) => {
    if (!isAdmin || isPast) return null;
    return (
      <div className="flex items-center gap-1">
        {assignedId && (
          <Button size="sm" variant="outline"
            onClick={() => handleAdminRemove(tierKey)}
            disabled={loading === tierKey}
            className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50">
            Remove
          </Button>
        )}
        {availableInstructors.length > 0 && (
          <Select onValueChange={(id) => handleAdminAssign(tierKey, id)}>
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue placeholder={assignedId ? 'Reassign' : 'Assign'} />
            </SelectTrigger>
            <SelectContent>
              {availableInstructors.map(i => (
                <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    );
  };

  const extraTiers = TIERS.filter(t => t.tier === 3);
  const filledExtras = extraTiers.filter(t => event[t.key]);
  const openExtra = extraTiers.find(t => !event[t.key]);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Staffing</p>

      {/* Tier 1: Lead */}
      {(() => {
        const t = TIERS[0];
        const assignedId = event[t.key];
        const assignedName = getName(assignedId);
        const isMe = assignedId === user?.id;
        const canClaim = !assignedId && !mySlot && !isPast && !isAdmin;

        return (
          <div className={`border rounded-lg p-3 ${t.color}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>{t.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-600">{t.label}</p>
                  {assignedId ? (
                    <p className={`text-sm font-bold ${isMe ? 'text-amber-700' : 'text-gray-800'}`}>
                      {assignedName}{isMe && ' (You)'}
                    </p>
                  ) : (
                    <p className="text-sm text-red-500 font-semibold">OPEN</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {isMe && !isPast && (
                  <Button size="sm" variant="outline" onClick={handleUnregister} disabled={loading === t.key}
                    className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50">
                    {loading === t.key ? '...' : 'Unregister'}
                  </Button>
                )}
                {canClaim && (
                  <Button size="sm" onClick={() => handleClaim(t.key)} disabled={!!loading}
                    className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white">
                    {loading === t.key ? '...' : 'Claim'}
                  </Button>
                )}
                <AdminControls tierKey={t.key} assignedId={assignedId} />
                {!isAdmin && assignedId && !isMe && (
                  <Badge className={`text-[10px] ${t.badgeColor}`}>
                    <CheckCircle className="w-2.5 h-2.5 mr-0.5" />Filled
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tier 2: Supporting */}
      {(() => {
        const t = TIERS[1];
        const assignedId = event[t.key];
        const assignedName = getName(assignedId);
        const isMe = assignedId === user?.id;
        const canClaim = !assignedId && !mySlot && !isPast && !isAdmin;

        return (
          <div className={`border rounded-lg p-3 ${t.color}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span>{t.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-600">{t.label}</p>
                  {assignedId ? (
                    <p className={`text-sm font-bold ${isMe ? 'text-blue-700' : 'text-gray-800'}`}>
                      {assignedName}{isMe && ' (You)'}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">OPEN</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {isMe && !isPast && (
                  <Button size="sm" variant="outline" onClick={handleUnregister} disabled={loading === t.key}
                    className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50">
                    {loading === t.key ? '...' : 'Unregister'}
                  </Button>
                )}
                {canClaim && (
                  <Button size="sm" onClick={() => handleClaim(t.key)} disabled={!!loading}
                    className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                    {loading === t.key ? '...' : 'Claim'}
                  </Button>
                )}
                <AdminControls tierKey={t.key} assignedId={assignedId} />
                {!isAdmin && assignedId && !isMe && (
                  <Badge className={`text-[10px] ${t.badgeColor}`}>
                    <CheckCircle className="w-2.5 h-2.5 mr-0.5" />Filled
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Tier 3: Extras */}
      <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>➕</span>
            <div>
              <p className="text-xs font-semibold text-gray-600">Extra Instructors</p>
              {filledExtras.length === 0 ? (
                <p className="text-sm text-gray-400">None yet</p>
              ) : (
                <div className="space-y-1 mt-0.5">
                  {filledExtras.map(t => {
                    const name = getName(event[t.key]);
                    const isMe = event[t.key] === user?.id;
                    return (
                      <div key={t.key} className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isMe ? 'text-indigo-700' : 'text-gray-800'}`}>
                          {name}{isMe && ' (You)'}
                        </p>
                        {isAdmin && !isPast && (
                          <Button size="sm" variant="ghost"
                            onClick={() => handleAdminRemove(t.key)}
                            disabled={loading === t.key}
                            className="h-5 px-1.5 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50">
                            Remove
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1">
            {mySlot && extraTiers.some(t => t.key === mySlot.key) && !isPast && (
              <Button size="sm" variant="outline" onClick={handleUnregister} disabled={!!loading}
                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50">
                Unregister
              </Button>
            )}
            {!mySlot && openExtra && !isPast && !isAdmin && (
              <Button size="sm" onClick={() => handleClaim(openExtra.key)} disabled={!!loading}
                className="h-7 text-xs bg-gray-600 hover:bg-gray-700 text-white">
                {loading === openExtra.key ? '...' : 'Join'}
              </Button>
            )}
            {isAdmin && openExtra && !isPast && availableInstructors.length > 0 && (
              <Select onValueChange={(id) => handleAdminAssign(openExtra.key, id)}>
                <SelectTrigger className="h-7 w-28 text-xs">
                  <SelectValue placeholder="Add" />
                </SelectTrigger>
                <SelectContent>
                  {availableInstructors.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {!openExtra && !mySlot && !isAdmin && (
              <Badge className="text-[10px] bg-gray-200 text-gray-600">Full</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
