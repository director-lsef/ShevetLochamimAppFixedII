import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search, Users, UserPlus, Mail, Phone, Calendar,
  Edit, Shield, User, GraduationCap, Globe,
  AlertCircle, Clock, X, ChevronRight, Save, Camera, Snowflake, Archive, RotateCcw } from
'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { isAdminUser, filterParticipants, isAlumniUser } from '@/utils/userHelpers';
import FreezeAccountDialog from '@/components/participants/FreezeAccountDialog';
import { Switch } from '@/components/ui/switch';
import PendingInvitationsPanel from '@/components/participants/PendingInvitationsPanel';
import UserProfileDetail from '@/components/participants/UserProfileDetail';
import StatsOverviewTab from '@/components/profile/StatsOverviewTab';
import PerformanceLogsTab from '@/components/profile/PerformanceLogsTab';
import ParticipantDossier from '@/components/profile/ParticipantDossier';

const COUNTRIES = [
"Afghanistan", "Albania", "Algeria", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
"Bangladesh", "Belarus", "Belgium", "Bolivia", "Bosnia and Herzegovina", "Brazil", "Bulgaria",
"Cambodia", "Cameroon", "Canada", "Chile", "China", "Colombia", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
"Denmark", "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Estonia", "Ethiopia",
"Finland", "France", "Georgia", "Germany", "Ghana", "Greece", "Guatemala",
"Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy",
"Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kosovo", "Kuwait",
"Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg", "Malaysia", "Mexico", "Moldova", "Montenegro", "Morocco", "Myanmar",
"Nepal", "Netherlands", "New Zealand", "Nicaragua", "Nigeria", "North Korea", "North Macedonia", "Norway",
"Pakistan", "Panama", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Puerto Rico",
"Qatar", "Romania", "Russia", "Saudi Arabia", "Senegal", "Serbia", "Singapore", "Slovakia", "Slovenia", "Somalia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sudan", "Sweden", "Switzerland", "Syria",
"Taiwan", "Tanzania", "Thailand", "Tunisia", "Turkey", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
"Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"];


export default function Participants() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingTabCount, setPendingTabCount] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [freezeTargetUser, setFreezeTargetUser] = useState(null);
  const [userToArchive, setUserToArchive] = useState(null);
  const [userToRestore, setUserToRestore] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'user'
  });

  useEffect(() => {
    loadData();
  }, []);

  // ── [Fix P.1] UNLOCK THIS FUNCTION — remove auth.me() call ─────────────────────
  // BASE44 EDITOR: Remove the base44.auth.me() from the Promise.all below.
  // AuthContext already provides the current user. Using auth.me() here adds a
  // redundant network round-trip before any page data loads.
  //
  // STEP 1: At the top of this component, replace the useState:
  //   OLD: const [currentUser, setCurrentUser] = useState(null);
  //   NEW: const { user: currentUser } = useAuth();  (import useAuth from '@/lib/AuthContext')
  //
  // STEP 2: In loadData, remove auth.me() from Promise.all and remove setCurrentUser call.
  //   OLD Promise.all: [base44.auth.me(), User.list(), ...]
  //   NEW Promise.all: [User.list(), EventRegistration.list(), Event.list(), PendingInvitation.list()]
  // ── END UNLOCK ─────────────────────────────────────────────────────────────────
  const loadData = async () => {
    try {
      const [userData, usersData, regsData, eventsData, pendingInvites] = await Promise.all([
      base44.auth.me(),
      base44.entities.User.list(),
      base44.entities.EventRegistration.list(),
      base44.entities.Event.list(),
      base44.entities.PendingInvitation.list()]
      );

      setCurrentUser(userData);
      setUsers(usersData);
      setRegistrations(regsData);
      setEvents(eventsData);
      
      // Calculate pending count (match PendingInvitationsPanel logic exactly)
      // Only include users who haven't activated yet (account_status !== 'active')
      const pendingUsers = usersData.filter(u => u.account_status !== 'active');
      const seenEmails = new Set();
      let count = 0;
      
      // Count pending users
      for (const u of pendingUsers) {
        const lowerEmail = u.email?.toLowerCase();
        seenEmails.add(lowerEmail);
        count++;
      }
      
      // Add orphaned PendingInvitations
      for (const inv of pendingInvites) {
        const lowerEmail = inv.email?.toLowerCase();
        if (!seenEmails.has(lowerEmail)) {
          seenEmails.add(lowerEmail);
          count++;
        }
      }
      
      setPendingTabCount(count);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if current user is admin (support both user_type and platform role)
  if (!loading && !isAdminUser(currentUser)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only administrators can access participant management.</p>
          </CardContent>
        </Card>
      </div>);

  }

  const handleInviteUser = async () => {
    try {
      const response = await base44.functions.invoke('inviteUserWithType', {
        email: inviteForm.email,
        user_type: inviteForm.role === 'user' ? 'participant' : inviteForm.role
      });
      
      toast.success(response.data.message);
      setShowInviteDialog(false);
      setInviteForm({ email: '', role: 'user' });
    } catch (error) {
      toast.error('Failed to send invitation');
      console.error('Invitation error:', error);
    }
  };

  const handleViewUser = (user) => {
    // Ensure user has required fields (pending users might be partial objects)
    const completeUser = {
      id: user.id,
      email: user.email || '',
      full_name: user.full_name || user.email || '',
      user_type: user.user_type || 'participant',
      participant_status: user.participant_status || 'active',
      account_status: user.account_status || 'active',
      ...user
    };
    
    setSelectedUser(completeUser);
    setEditForm({
      id: completeUser.id,
      full_name: completeUser.full_name || '',
      user_type: completeUser.user_type || 'participant',
      participant_status: completeUser.participant_status || 'active',
      account_status: completeUser.account_status || 'active',
      primary_branch: completeUser.primary_branch || 'צוות מייקי',
      phone: completeUser.phone || '',
      secondary_phone: completeUser.secondary_phone || '',
      sex: completeUser.sex || '',
      about: completeUser.about || '',
      address: completeUser.address || '',
      country_of_origin: completeUser.country_of_origin || '',
      emergency_contact_name: completeUser.emergency_contact_name || '',
      emergency_contact_relationship: completeUser.emergency_contact_relationship || '',
      emergency_contact_phone: completeUser.emergency_contact_phone || '',
      join_date: completeUser.join_date || '',
      draft_date: completeUser.draft_date || '',
      graduation_date: completeUser.graduation_date || '',
      notes: completeUser.notes || '',
      profile_image_url: completeUser.profile_image_url || '',
      freeze_end_date: completeUser.freeze_end_date || '',
      instructor_notes: completeUser.instructor_notes || '',
      target_unit: completeUser.target_unit || '',
      hebrew_level: completeUser.hebrew_level || '',
      fitness_level: completeUser.fitness_level || '',
      fastest_3k: completeUser.fastest_3k || '',
      draft_method: completeUser.draft_method || '',
      planned_service_length: completeUser.planned_service_length || '',
      israel_framework: completeUser.israel_framework || '',
      stay_framework: completeUser.stay_framework || '',
      reference_org: completeUser.reference_org || '',
      age: completeUser.age ?? '',
      ready_for_service: completeUser.ready_for_service || ''
    });
    setIsEditing(false);
    setShowDetailDialog(true);
  };

  const handleSaveUser = async () => {
    try {
      await base44.entities.User.update(selectedUser.id, editForm);
      toast.success('Participant updated successfully');
      setIsEditing(false);
      loadData();

      // Update selected user with new data
      setSelectedUser({ ...selectedUser, ...editForm });
    } catch (error) {
      toast.error('Failed to update participant');
    }
  };

  const handleMarkAsAlumni = async (user) => {
    try {
      await base44.entities.User.update(user.id, {
        participant_status: 'alumni',
        graduation_date: new Date().toISOString().split('T')[0]
      });
      toast.success(`${user.full_name} marked as alumni`);
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleUnfreeze = async (user) => {
    try {
      await base44.entities.User.update(user.id, {
        account_status: 'active',
        freeze_end_date: null
      });
      toast.success(`${user.full_name}'s account unfrozen`);
      loadData();
      if (selectedUser?.id === user.id) {
        setSelectedUser({ ...selectedUser, account_status: 'active', freeze_end_date: null });
        setEditForm({ ...editForm, account_status: 'active', freeze_end_date: null });
      }
    } catch (error) {
      toast.error('Failed to unfreeze account');
    }
  };

  const handleReactivate = async (user) => {
    try {
      await base44.entities.User.update(user.id, {
        participant_status: 'active',
        graduation_date: null
      });
      toast.success(`${user.full_name} reactivated`);
      loadData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleArchiveUser = async (user) => {
    try {
      await base44.entities.User.update(user.id, {
        account_status: 'archived',
        archived_at: new Date().toISOString(),
      });
      toast.success(`${user.full_name} archived`);
      if (selectedUser?.id === user.id) setShowDetailDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to archive user');
    } finally {
      setUserToArchive(null);
    }
  };

  const handleRestoreUser = async (user) => {
    try {
      await base44.entities.User.update(user.id, {
        account_status: 'active',
        archived_at: null,
      });
      toast.success(`${user.full_name} restored`);
      loadData();
    } catch (error) {
      toast.error('Failed to restore user');
    } finally {
      setUserToRestore(null);
    }
  };

  const getAttendanceStats = (userId) => {
    const userRegs = registrations.filter((r) => r.participant_id === userId);
    const attended = userRegs.filter((r) => r.status === 'attended').length;
    const registered = userRegs.filter((r) => r.status === 'registered' || r.status === 'attended').length;
    return { attended, registered, total: userRegs.length };
  };

  const getUserEvents = (userId) => {
    const userRegs = registrations.filter((r) => r.participant_id === userId);
    return userRegs.map((reg) => {
      const event = events.find((e) => e.id === reg.event_id);
      return { ...reg, event };
    }).filter((r) => r.event).sort((a, b) =>
    new Date(b.event.start_datetime) - new Date(a.event.start_datetime)
    );
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.country_of_origin?.toLowerCase().includes(searchTerm.toLowerCase());

    const effectiveType = user.user_type || 'participant';
    const matchesType = filterType === 'all' || effectiveType === filterType;
    const isAlumniUser = user.user_type === 'alumni' || user.participant_status === 'alumni';
    const isArchived = user.account_status === 'archived';
    const matchesStatus = filterStatus === 'all' ? !isArchived :
    (filterStatus === 'active' && !isAlumniUser && !isArchived) ||
    (filterStatus === 'alumni' && isAlumniUser && !isArchived) ||
    (filterStatus === 'archived' && isArchived);

    return matchesSearch && matchesType && matchesStatus;
  });

  const activeParticipants = filterParticipants(users);
  const alumniParticipants = users.filter((u) => isAlumniUser(u));
  const instructorsList = users.filter((u) => u.user_type === 'instructor');
  const admins = users.filter((u) => u.user_type === 'admin' || u.role === 'admin');

  const getUserTypeIcon = (type) => {
    switch (type) {
      case 'admin':return <Shield className="w-4 h-4" />;
      case 'instructor':return <GraduationCap className="w-4 h-4" />;
      case 'alumni':return <GraduationCap className="w-4 h-4" />;
      default:return <User className="w-4 h-4" />;
    }
  };

  const getUserTypeColor = (type) => {
    switch (type) {
      case 'admin':return 'bg-red-100 text-red-800';
      case 'instructor':return 'bg-blue-100 text-blue-800';
      case 'alumni':return 'bg-amber-100 text-amber-800';
      default:return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>);

  }

  const pendingCount = users.filter(u => u.account_status !== 'active').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-slate-200 text-3xl font-bold">Participant Management</h1>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-sm px-2 py-1">
              {pendingCount} pending
            </Badge>
          )}
        </div>
        <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="user@example.com" />

              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(v) => setInviteForm({ ...inviteForm, role: v })}>

                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Participant</SelectItem>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInviteUser} className="w-full">
                Send Invitation
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-indigo-100 text-xs">Total</p>
                <p className="text-2xl font-bold">{users.length}</p>
              </div>
              <Users className="w-6 h-6 text-indigo-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-xs">Active</p>
                <p className="text-2xl font-bold">{activeParticipants.length}</p>
              </div>
              <User className="w-6 h-6 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-xs">Alumni</p>
                <p className="text-2xl font-bold">{alumniParticipants.length}</p>
              </div>
              <GraduationCap className="w-6 h-6 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-xs">Instructors</p>
                <p className="text-2xl font-bold">{instructorsList.length}</p>
              </div>
              <GraduationCap className="w-6 h-6 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-lg bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-pink-100 text-xs">Admins</p>
                <p className="text-2xl font-bold">{admins.length}</p>
              </div>
              <Shield className="w-6 h-6 text-pink-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Branch Comparison */}
      {(() => {
        const mikeyActive = activeParticipants.filter(u => (u.primary_branch || 'צוות מייקי') === 'צוות מייקי');
        const lochamimActive = activeParticipants.filter(u => u.primary_branch === 'צוות לוחמים');
        const total = mikeyActive.length + lochamimActive.length;
        const mikeyPct = total > 0 ? Math.round((mikeyActive.length / total) * 100) : 50;
        const lochamimPct = total > 0 ? 100 - mikeyPct : 50;
        return (
          <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold text-gray-600 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Active Participants by Branch
              </h3>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 min-w-[110px]">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#1d4ed8' }} />
                  <span className="text-sm font-medium text-gray-700">צוות מייקי</span>
                </div>
                <div className="text-2xl font-bold text-blue-700 min-w-[36px] text-center">{mikeyActive.length}</div>
                <div className="flex-1">
                  <div className="flex h-5 rounded-full overflow-hidden bg-gray-100">
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${mikeyPct}%`, backgroundColor: '#1d4ed8' }}
                    />
                    <div
                      className="h-full transition-all duration-500"
                      style={{ width: `${lochamimPct}%`, backgroundColor: '#15803d' }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>{mikeyPct}%</span>
                    <span>{lochamimPct}%</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-green-700 min-w-[36px] text-center">{lochamimActive.length}</div>
                <div className="flex items-center gap-2 min-w-[110px] justify-end">
                  <span className="text-sm font-medium text-gray-700">צוות לוחמים</span>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#15803d' }} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Main Content Tabs */}
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="bg-white/10">
          <TabsTrigger value="all" className="text-white data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Users className="w-4 h-4 mr-1.5" />
            All Users
            <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 font-semibold ${activeTab === 'all' ? 'bg-gray-200 text-gray-800' : 'bg-white/20 text-white'}`}>{filteredUsers.length}</span>
          </TabsTrigger>
          <TabsTrigger value="pending" className="text-white data-[state=active]:bg-white data-[state=active]:text-gray-900">
            <Clock className="w-4 h-4 mr-1.5" />
            Pending Activation
            <span className={`ml-2 text-xs rounded-full px-1.5 py-0.5 font-semibold ${pendingTabCount > 0 ? 'bg-amber-500 text-white' : (activeTab === 'pending' ? 'bg-gray-200 text-gray-800' : 'bg-white/20 text-white')}`}>{pendingTabCount}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <PendingInvitationsPanel 
            users={users} 
            onCountChange={(n) => setPendingTabCount(n)}
            onSelectUser={handleViewUser}
          />
        </TabsContent>

        <TabsContent value="all">

      {/* Filters */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or country..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10" />

            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="participant">Participants</SelectItem>
                <SelectItem value="instructor">Instructors</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="alumni">Alumni</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="alumni">Alumni</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.map((user) => {
                const stats = getAttendanceStats(user.id);
                const isAlumni = user.participant_status === 'alumni' || user.user_type === 'alumni';

                return (
                  <Card key={user.id} className="border-none shadow bg-white/80">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Header: Name + Badges + Actions */}
                        <div className="flex items-start justify-between gap-3">
                          <button
                            onClick={() => handleViewUser(user)}
                            className="flex-1 text-left hover:opacity-70 transition-opacity"
                          >
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {user.full_name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap mt-1">
                              <Badge className={getUserTypeColor(user.user_type)}>
                                {getUserTypeIcon(user.user_type)}
                                <span className="ml-1 capitalize">{user.user_type || 'participant'}</span>
                              </Badge>
                              {isAlumni && (
                                <Badge className="bg-amber-100 text-amber-800">
                                  <GraduationCap className="w-3 h-3 mr-1" />
                                  Alumni
                                </Badge>
                              )}
                              {user.account_status === 'frozen' && (
                                <Badge className="bg-blue-100 text-blue-700">
                                  <Snowflake className="w-3 h-3 mr-1" />
                                  Frozen
                                </Badge>
                              )}
                              {user.account_status === 'archived' && (
                                <Badge className="bg-gray-200 text-gray-600">
                                  <Archive className="w-3 h-3 mr-1" />
                                  Archived
                                </Badge>
                              )}
                            </div>
                          </button>

                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <div className="text-right">
                              <p className="text-sm font-medium text-gray-900">{stats.registered} events</p>
                              <p className="text-xs text-gray-500">{stats.attended} attended</p>
                            </div>
                            {user.account_status === 'archived' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 text-xs px-2"
                                onClick={() => setUserToRestore(user)}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Restore
                              </Button>
                            ) : user.account_status === 'frozen' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 border-green-200 hover:bg-green-50 text-xs px-2"
                                onClick={() => handleUnfreeze(user)}
                              >
                                Unfreeze
                              </Button>
                            ) : (user.user_type === 'participant' || !user.user_type) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs px-2"
                                onClick={() => setFreezeTargetUser(user)}
                              >
                                <Snowflake className="w-3 h-3 mr-1" />
                                Freeze
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Timestamps and Details */}
                        <div className="space-y-2 text-sm">
                          {user.created_date && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">Date added:</span>
                              <span>{format(new Date(user.created_date), 'MMM d, yyyy')}</span>
                            </div>
                          )}
                          {user.primary_branch && (
                            <div className="text-gray-600">
                              <span className="font-medium" style={{ color: user.primary_branch === 'צוות לוחמים' ? '#15803d' : '#1d4ed8' }}>
                                {user.primary_branch}
                              </span>
                            </div>
                          )}
                          {user.country_of_origin && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Globe className="w-4 h-4 text-gray-400" />
                              <span>{user.country_of_origin}</span>
                            </div>
                          )}
                        </div>

                        {/* Email */}
                        <div className="pt-2 border-t border-gray-200 text-gray-500 text-sm">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </CardContent>
      </Card>
        </TabsContent> {/* end "all" TabsContent */}
      </Tabs>

      {/* User Detail Dialog - Outside tabs so it works from any tab */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Participant Details</span>
              {!isEditing ?
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button> :

              <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSaveUser}>
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              }
            </DialogTitle>
          </DialogHeader>

          {selectedUser &&
          <Tabs defaultValue="stats" className="mt-4">
              <TabsList className="w-full">
                <TabsTrigger value="stats" className="flex-1">Stats</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">Event History</TabsTrigger>
                <TabsTrigger value="performance" className="flex-1">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="stats" className="space-y-6 mt-4">
                {/* Header */}
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  {editForm.profile_image_url ?
                <img
                  src={editForm.profile_image_url}
                  alt={selectedUser.full_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100" /> :


                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold ${
                (editForm.participant_status === 'alumni' || editForm.user_type === 'alumni') ? 'bg-amber-400' : 'bg-indigo-500'}`
                }>
                      {selectedUser.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                }
                  <div>
                    <h3 className="text-xl font-bold">{selectedUser.full_name}</h3>
                    <p className="text-gray-500">{selectedUser.email}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge className={getUserTypeColor(editForm.user_type)}>
                        {editForm.user_type}
                      </Badge>
                      {(editForm.participant_status === 'alumni' || editForm.user_type === 'alumni') &&
                    <Badge className="bg-amber-100 text-amber-800">Alumni</Badge>
                    }
                      {selectedUser.account_status === 'pending' &&
                    <Badge className="bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending Activation
                      </Badge>
                    }
                    </div>
                  </div>
                </div>

                {/* Stats Content */}
                <StatsOverviewTab user={selectedUser} viewerUser={currentUser} />
                {selectedUser?.user_type === 'participant' && <ParticipantDossier user={selectedUser} />}

                {/* Notes - Admin Only */}
                <div className="space-y-2 border-t pt-4">
                  <Label>Notes</Label>
                  <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Additional notes..."
                  rows={3} />

                </div>

                {/* Quick Actions - Admin Only */}
                {!isEditing && editForm.user_type === 'participant' &&
                <div className="border-t pt-4">
                    <h4 className="font-semibold mb-3">Quick Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {editForm.participant_status !== 'alumni' ?
                  <Button
                    variant="outline"
                    className="text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={() => {
                      handleMarkAsAlumni(selectedUser);
                      setEditForm({ ...editForm, participant_status: 'alumni', graduation_date: new Date().toISOString().split('T')[0] });
                    }}>
                          <GraduationCap className="w-4 h-4 mr-2" />
                          Mark as Alumni
                        </Button> :
                  <Button
                    variant="outline"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => {
                      handleReactivate(selectedUser);
                      setEditForm({ ...editForm, participant_status: 'active', graduation_date: '' });
                    }}>
                          <User className="w-4 h-4 mr-2" />
                          Reactivate
                        </Button>
                  }
                      {selectedUser?.account_status === 'frozen' ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-blue-700 flex items-center gap-1">
                            <Snowflake className="w-4 h-4" />
                            Frozen until {selectedUser.freeze_end_date ? format(new Date(selectedUser.freeze_end_date), 'MMM d, yyyy') : '—'}
                          </span>
                          <Button
                            variant="outline"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleUnfreeze(selectedUser)}
                          >
                            Unfreeze Now
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => { setShowDetailDialog(false); setFreezeTargetUser(selectedUser); }}
                        >
                          <Snowflake className="w-4 h-4 mr-2" />
                          Freeze Account
                        </Button>
                      )}
                      {/* [Fix 3.4 — IMPLEMENTED] Exempt-from-attendance-requirements toggle */}
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-200 bg-purple-50">
                        <Switch
                          id="freeze-exempt"
                          checked={selectedUser?.freeze_exempt || false}
                          onCheckedChange={async (checked) => {
                            await base44.entities.User.update(selectedUser.id, { freeze_exempt: checked });
                            setSelectedUser({ ...selectedUser, freeze_exempt: checked });
                            toast.success(checked ? 'Participant marked as exempt from attendance requirements' : 'Exemption removed');
                            loadData();
                          }}
                        />
                        <div>
                          <label htmlFor="freeze-exempt" className="text-sm font-medium text-purple-800 cursor-pointer">
                            Exempt from attendance requirements
                          </label>
                          <p className="text-xs text-purple-600 mt-0.5">
                            Exempt participants won't appear in the Low Engagement Report
                          </p>
                        </div>
                      </div>

                      {selectedUser?.account_status === 'archived' ? (
                        <Button
                          variant="outline"
                          className="text-green-600 border-green-200 hover:bg-green-50"
                          onClick={() => setUserToRestore(selectedUser)}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Restore User
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          className="text-gray-500 border-gray-200 hover:bg-gray-50"
                          onClick={() => setUserToArchive(selectedUser)}
                        >
                          <Archive className="w-4 h-4 mr-2" />
                          Archive User
                        </Button>
                      )}
                      </div>
                      </div>
                      }
                      </TabsContent>

              <TabsContent value="history" className="mt-4">
                {/* Attendance Stats */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="border-none bg-indigo-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-indigo-600">{getAttendanceStats(selectedUser.id).registered}</p>
                      <p className="text-sm text-indigo-500">Registered</p>
                    </CardContent>
                  </Card>
                  <Card className="border-none bg-green-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{getAttendanceStats(selectedUser.id).attended}</p>
                      <p className="text-sm text-green-500">Attended</p>
                    </CardContent>
                  </Card>
                  <Card className="border-none bg-purple-50">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {getAttendanceStats(selectedUser.id).registered > 0 ?
                      Math.round(getAttendanceStats(selectedUser.id).attended / getAttendanceStats(selectedUser.id).registered * 100) :
                      0}%
                      </p>
                      <p className="text-sm text-purple-500">Attendance Rate</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Event History */}
                <div className="space-y-2">
                  {getUserEvents(selectedUser.id).length === 0 ?
                <div className="text-center py-8 text-gray-500">
                      <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                      <p>No event history</p>
                    </div> :

                getUserEvents(selectedUser.id).map((reg) =>
                <div key={reg.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="font-medium">{reg.event.title}</p>
                          <p className="text-sm text-gray-500">
                            {format(new Date(reg.event.start_datetime), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                        <Badge className={
                  reg.status === 'attended' ? 'bg-green-100 text-green-800' :
                  reg.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                  reg.status === 'no_show' ? 'bg-gray-100 text-gray-800' :
                  'bg-blue-100 text-blue-800'
                  }>
                          {reg.status}
                        </Badge>
                      </div>
                )
                }
                </div>
              </TabsContent>

              <TabsContent value="performance" className="mt-4">
                <PerformanceLogsTab user={selectedUser} viewerUser={currentUser} />
              </TabsContent>
            </Tabs>
          }
        </DialogContent>
      </Dialog>

      {freezeTargetUser && (
        <FreezeAccountDialog
          user={freezeTargetUser}
          open={!!freezeTargetUser}
          onClose={() => setFreezeTargetUser(null)}
          onSuccess={loadData}
        />
      )}

      <AlertDialog open={!!userToArchive} onOpenChange={(open) => !open && setUserToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive User?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userToArchive?.full_name || userToArchive?.email}</strong> will be marked as archived and hidden from the main list. You can restore them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleArchiveUser(userToArchive)} className="bg-gray-700 hover:bg-gray-800">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!userToRestore} onOpenChange={(open) => !open && setUserToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore User?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{userToRestore?.full_name || userToRestore?.email}</strong> will be restored to active status and reappear in the main list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleRestoreUser(userToRestore)} className="bg-green-600 hover:bg-green-700">
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}