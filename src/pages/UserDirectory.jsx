import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function UserDirectory() {
  const [users, setUsers] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedPending, setSelectedPending] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // ── [Fix P.1] UNLOCK: Replace auth.me() with useAuth() ──────────────────────
      // BASE44 EDITOR: Add const { user } = useAuth(); at top of component,
      // then rename references from currentUser to user, and remove these two lines.
      // ── END UNLOCK ─────────────────────────────────────────────────────────────
      const user = await base44.auth.me();
      setCurrentUser(user);

      // Check if admin
      if (user?.user_type !== 'admin' && user?.role !== 'admin') {
        setLoading(false);
        return;
      }

      const [allUsers, pendingList] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.PendingInvitation.list()]
      );
      setUsers(allUsers);
      setPendingInvites(pendingList);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setSelectedPending(null);
    setEditData(user);
    setShowDetailDialog(true);
  };

  const handleViewPending = (pending) => {
    setSelectedPending(pending);
    setSelectedUser(null);
    setEditData(pending);
    setShowDetailDialog(true);
  };

  const handleSaveUser = async () => {
    try {
      setIsSaving(true);
      if (selectedUser) {
        await base44.entities.User.update(selectedUser.id, editData);
        toast.success('User updated');
      } else if (selectedPending) {
        await base44.entities.PendingInvitation.update(selectedPending.id, editData);
        toast.success('Pending invitation updated');
      }
      setShowDetailDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((user) =>
  user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
  user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPending = pendingInvites.filter((pending) =>
  pending.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  if (!currentUser || currentUser?.user_type !== 'admin' && currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only administrators can access the user directory.</p>
          </CardContent>
        </Card>
      </div>);

  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[hsl(var(--background))] mb-2 text-3xl font-bold">User Directory</h1>
        <p className="text-slate-50">Active users: {users.length} | Pending: {pendingInvites.length}</p>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-md" />
        
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.map((user) =>
            <div
              key={user.id}
              className="p-3 bg-gray-50 rounded border border-gray-200 flex items-center justify-between hover:bg-gray-100 cursor-pointer"
              onClick={() => handleViewUser(user)}>
              
                <div>
                  <p className="font-semibold text-gray-900">{user.full_name}</p>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  {user.user_type && <p className="text-xs text-gray-500">{user.user_type}</p>}
                </div>
                <Button variant="outline" size="sm">
                  View/Edit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Invitations ({filteredPending.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredPending.map((pending) =>
            <div
              key={pending.id}
              className="p-3 bg-amber-50 rounded border border-amber-200 flex items-center justify-between hover:bg-amber-100 cursor-pointer"
              onClick={() => handleViewPending(pending)}>
              
                <div>
                  <p className="font-semibold text-gray-900">{pending.email}</p>
                  <p className="text-sm text-gray-600">Type: {pending.user_type}</p>
                  <p className="text-xs text-gray-500">Invited: {pending.last_invited_at}</p>
                  <p className={`text-xs font-semibold ${pending.processed ? 'text-green-600' : 'text-amber-600'}`}>
                    {pending.processed ? 'Activated' : 'Pending'}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  View/Edit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedUser ? `${selectedUser?.full_name} (${selectedUser?.id})` : `Pending: ${selectedPending?.email}`}
            </DialogTitle>
          </DialogHeader>

          {selectedPending &&
          <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded border border-amber-200">
                <h3 className="font-semibold mb-3 text-gray-900">Pending Invitation Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">ID:</span>
                    <p className="text-gray-600 break-all">{selectedPending.id}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <p className="text-gray-600">{selectedPending.email}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">User Type:</span>
                    <p className="text-gray-600">{selectedPending.user_type}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Processed:</span>
                    <p className="text-gray-600">{selectedPending.processed ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Invited At:</span>
                    <p className="text-gray-600">{selectedPending.invited_at}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Last Invited At:</span>
                    <p className="text-gray-600">{selectedPending.last_invited_at}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Signed In At:</span>
                    <p className="text-gray-600">{selectedPending.signed_in_at || 'Not signed in'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Editable Fields</h3>
                <div>
                  <Label>Email</Label>
                  <Input
                  value={editData.email || ''}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })} />
                
                </div>
                <div>
                  <Label>User Type</Label>
                  <Input
                  value={editData.user_type || ''}
                  onChange={(e) => setEditData({ ...editData, user_type: e.target.value })} />
                
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t pt-4">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                <Button onClick={handleSaveUser} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          }

          {selectedUser &&
          <div className="space-y-4">
              {/* Built-in fields */}
              <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h3 className="font-semibold mb-3 text-gray-900">Built-in Fields</h3>
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-medium text-gray-700">ID:</span>
                      <p className="text-gray-600 break-all">{selectedUser.id}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Email:</span>
                      <p className="text-gray-600">{selectedUser.email}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Full Name:</span>
                      <p className="text-gray-600">{selectedUser.full_name}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Created Date:</span>
                      <p className="text-gray-600">{selectedUser.created_date}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Updated Date:</span>
                      <p className="text-gray-600">{selectedUser.updated_date}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Created By:</span>
                      <p className="text-gray-600">{selectedUser.created_by}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Editable Fields</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Full Name</Label>
                    <Input
                    value={editData.full_name || ''}
                    onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>User Type</Label>
                    <Input
                    value={editData.user_type || ''}
                    onChange={(e) => setEditData({ ...editData, user_type: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Role</Label>
                    <Input
                    value={editData.role || ''}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Participant Status</Label>
                    <Input
                    value={editData.participant_status || ''}
                    onChange={(e) => setEditData({ ...editData, participant_status: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Account Status</Label>
                    <Input
                    value={editData.account_status || ''}
                    onChange={(e) => setEditData({ ...editData, account_status: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Title</Label>
                    <Input
                    value={editData.title || ''}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                    value={editData.phone || ''}
                    onChange={(e) => setEditData({ ...editData, phone: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Secondary Phone</Label>
                    <Input
                    value={editData.secondary_phone || ''}
                    onChange={(e) => setEditData({ ...editData, secondary_phone: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Primary Branch</Label>
                    <Input
                    value={editData.primary_branch || ''}
                    onChange={(e) => setEditData({ ...editData, primary_branch: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Sex</Label>
                    <Input
                    value={editData.sex || ''}
                    onChange={(e) => setEditData({ ...editData, sex: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Age</Label>
                    <Input
                    type="number"
                    value={editData.age ?? ''}
                    onChange={(e) => setEditData({ ...editData, age: e.target.value ? Number(e.target.value) : null })} />
                  
                  </div>
                  <div>
                    <Label>Join Date</Label>
                    <Input
                    type="date"
                    value={editData.join_date || ''}
                    onChange={(e) => setEditData({ ...editData, join_date: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Draft Date</Label>
                    <Input
                    type="date"
                    value={editData.draft_date || ''}
                    onChange={(e) => setEditData({ ...editData, draft_date: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Graduation Date</Label>
                    <Input
                    type="date"
                    value={editData.graduation_date || ''}
                    onChange={(e) => setEditData({ ...editData, graduation_date: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Freeze End Date</Label>
                    <Input
                    type="datetime-local"
                    value={editData.freeze_end_date ? editData.freeze_end_date.replace('Z', '') : ''}
                    onChange={(e) => setEditData({ ...editData, freeze_end_date: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Address</Label>
                    <Input
                    value={editData.address || ''}
                    onChange={(e) => setEditData({ ...editData, address: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Monday Item ID</Label>
                    <Input
                    value={editData.monday_item_id || ''}
                    onChange={(e) => setEditData({ ...editData, monday_item_id: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Hebrew Level</Label>
                    <Input
                    value={editData.hebrew_level || ''}
                    onChange={(e) => setEditData({ ...editData, hebrew_level: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Fitness Level</Label>
                    <Input
                    value={editData.fitness_level || ''}
                    onChange={(e) => setEditData({ ...editData, fitness_level: e.target.value })} />
                  
                  </div>
                  <div>
                    <Label>Fastest 3K</Label>
                    <Input
                    value={editData.fastest_3k || ''}
                    onChange={(e) => setEditData({ ...editData, fastest_3k: e.target.value })} />
                  
                  </div>
                </div>

                <div>
                  <Label>About</Label>
                  <Textarea
                  value={editData.about || ''}
                  onChange={(e) => setEditData({ ...editData, about: e.target.value })}
                  rows={3} />
                
                </div>

                <div>
                  <Label>Emergency Contact Name</Label>
                  <Input
                  value={editData.emergency_contact_name || ''}
                  onChange={(e) => setEditData({ ...editData, emergency_contact_name: e.target.value })} />
                
                </div>

                <div>
                  <Label>Emergency Contact Relationship</Label>
                  <Input
                  value={editData.emergency_contact_relationship || ''}
                  onChange={(e) => setEditData({ ...editData, emergency_contact_relationship: e.target.value })} />
                
                </div>

                <div>
                  <Label>Emergency Contact Phone</Label>
                  <Input
                  value={editData.emergency_contact_phone || ''}
                  onChange={(e) => setEditData({ ...editData, emergency_contact_phone: e.target.value })} />
                
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                  value={editData.notes || ''}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={3} />
                
                </div>

                <div>
                  <Label>Instructor Notes</Label>
                  <Textarea
                  value={editData.instructor_notes || ''}
                  onChange={(e) => setEditData({ ...editData, instructor_notes: e.target.value })}
                  rows={3} />
                
                </div>

                <div>
                  <Label>Target Unit</Label>
                  <Input
                  value={editData.target_unit || ''}
                  onChange={(e) => setEditData({ ...editData, target_unit: e.target.value })} />
                
                </div>

                <div>
                  <Label>Draft Method</Label>
                  <Input
                  value={editData.draft_method || ''}
                  onChange={(e) => setEditData({ ...editData, draft_method: e.target.value })} />
                
                </div>

                <div>
                  <Label>Planned Service Length</Label>
                  <Input
                  value={editData.planned_service_length || ''}
                  onChange={(e) => setEditData({ ...editData, planned_service_length: e.target.value })} />
                
                </div>

                <div>
                  <Label>Israel Framework</Label>
                  <Input
                  value={editData.israel_framework || ''}
                  onChange={(e) => setEditData({ ...editData, israel_framework: e.target.value })} />
                
                </div>

                <div>
                  <Label>Stay Framework</Label>
                  <Input
                  value={editData.stay_framework || ''}
                  onChange={(e) => setEditData({ ...editData, stay_framework: e.target.value })} />
                
                </div>

                <div>
                  <Label>Reference Org</Label>
                  <Input
                  value={editData.reference_org || ''}
                  onChange={(e) => setEditData({ ...editData, reference_org: e.target.value })} />
                
                </div>

                <div>
                  <Label>Ready for Service</Label>
                  <Input
                  value={editData.ready_for_service || ''}
                  onChange={(e) => setEditData({ ...editData, ready_for_service: e.target.value })} />
                
                </div>

                <div>
                  <Label>Profile Image URL</Label>
                  <Input
                  value={editData.profile_image_url || ''}
                  onChange={(e) => setEditData({ ...editData, profile_image_url: e.target.value })} />
                
                </div>
              </div>

              <div className="flex gap-2 justify-end border-t pt-4">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                <Button onClick={handleSaveUser} disabled={isSaving}>
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          }
        </DialogContent>
      </Dialog>
    </div>);

}