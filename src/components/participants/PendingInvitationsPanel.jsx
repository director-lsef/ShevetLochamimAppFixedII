import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Mail, Calendar, RefreshCw, CheckCircle, Trash2, Send, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function PendingInvitationsPanel({ users, onCountChange, onSelectUser }) {
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadPending();
  }, [users]);

  const loadPending = async () => {
    setLoading(true);
    try {
      const invites = await base44.entities.PendingInvitation.list();
      setPendingInvitations(invites);
    } catch (err) {
      console.error('Failed to load pending invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  // [Fix 1.1 — IMPLEMENTED] Three-state pending list:
  //   1. Not Yet Invited  — email known, no invite sent
  //   2. Invite Sent      — invited, hasn't signed in yet
  //   3. Signed In        — first login complete, profile merged (processed=true)
  // Records with processed=true stay visible until the cleanup pass in
  // processNewUserRegistration deletes them after the grace period.
  const seenEmails = new Set();
  const allPending = [];

  // 1. Users not yet active
  const pendingUsers = users.filter(u => u.account_status !== 'active');
  for (const u of pendingUsers) {
    const lowerEmail = u.email?.toLowerCase();
    const inv = pendingInvitations.find(i => i.email?.toLowerCase() === lowerEmail);
    seenEmails.add(lowerEmail);
    allPending.push({
      id: u.id,
      email: u.email,
      full_name: u.full_name,
      user_type: u.user_type || 'participant',
      invited_at: inv?.invited_at || u.created_date,
      last_invited_at: inv?.last_invited_at,
      signed_in_at: inv?.signed_in_at || null,
      signedIn: inv?.processed === true,
      source: 'user',
      user: u,
    });
  }

  // 2. Orphaned PendingInvitations (no matching user, or processed awaiting cleanup)
  for (const inv of pendingInvitations) {
    const lowerEmail = inv.email?.toLowerCase();
    if (!seenEmails.has(lowerEmail)) {
      seenEmails.add(lowerEmail);
      allPending.push({
        id: inv.id,
        email: inv.email,
        user_type: inv.user_type,
        invited_at: inv.invited_at,
        last_invited_at: inv.last_invited_at,
        signed_in_at: inv.signed_in_at || null,
        signedIn: inv.processed === true,
        source: 'invitation',
        user: null,
      });
    }
  }

  useEffect(() => {
    if (!loading) {
      onCountChange?.(allPending.length);
    }
  }, [allPending.length, loading]);

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      const res = await base44.functions.invoke('processNewUserRegistration', {});
      if (res.data?.success) {
        toast.success(res.data.merged > 0 ? `Synced ${res.data.merged} profile(s)` : 'No new profiles to sync');
        await loadPending();
      } else {
        toast.error('Sync failed');
      }
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleSendInvite = async (email, userType) => {
    setSendingTo(email);
    try {
      const res = await base44.functions.invoke('inviteUserWithType', {
        email,
        user_type: userType || 'participant',
      });
      if (res.data?.success) {
        toast.success(`Invitation sent to ${email}`);
        await loadPending();
      } else {
        toast.error(res.data?.error || 'Failed to send invite');
      }
    } catch (err) {
      toast.error('Failed to send invite: ' + err.message);
    } finally {
      setSendingTo(null);
    }
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    let successCount = 0;
    let failCount = 0;
    for (const item of allPending) {
      try {
        const res = await base44.functions.invoke('inviteUserWithType', {
          email: item.email,
          user_type: item.user_type || 'participant',
        });
        if (res.data?.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }
    await loadPending();
    setSendingAll(false);
    if (successCount > 0) toast.success(`Sent ${successCount} invitation${successCount !== 1 ? 's' : ''}`);
    if (failCount > 0) toast.error(`${failCount} invitation${failCount !== 1 ? 's' : ''} failed`);
  };

  const handleDeleteConfirmed = async (item) => {
    setDeletingId(item.id);
    try {
      if (item.source === 'user' && item.user) {
        // Mark user as active to remove from pending
        await base44.entities.User.update(item.user.id, { account_status: 'active' });
      } else if (item.source === 'invitation') {
        // Delete orphaned invitation
        await base44.entities.PendingInvitation.delete(item.id);
      }
      toast.success('Removed from pending list');
      await loadPending();
    } catch (err) {
      toast.error('Failed to remove: ' + err.message);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-400">
          {allPending.length} participant{allPending.length !== 1 ? 's' : ''} pending account activation
        </p>
        <div className="flex items-center gap-2">
          {allPending.length > 1 && (
            <Button
              size="sm"
              onClick={handleSendAll}
              disabled={sendingAll}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {sendingAll ? (
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1.5" />
              )}
              Send All Invites
            </Button>
          )}
          <Button
            variant="outline" size="sm"
            onClick={handleForceSync}
            disabled={syncing}
            className="text-amber-400 border-amber-400/30 hover:bg-amber-400/10"
            title="Force sync Monday.com profile data into newly signed-in users"
          >
            {syncing ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Zap className="w-4 h-4 mr-1" />}
            Force Sync
          </Button>
          <Button variant="outline" size="sm" onClick={loadPending} className="text-gray-300 border-white/20 hover:bg-white/10">
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {allPending.length === 0 ? (
        <Card className="border-none shadow bg-white/80">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p className="text-gray-500">No pending activations — all users have signed in!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {allPending.map((item) => {
            const inviteSent = item.last_invited_at || (item.source === 'invitation' && item.invited_at);
            const isInvited = item.user?.account_status === 'invited' || (item.source === 'invitation' && inviteSent);
            const dateAdded = item.invited_at || item.user?.created_date;
            
            return (
              <Card key={item.id} className="border-none shadow bg-white/80">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header: Name + Badges + Actions */}
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => onSelectUser?.(item.user || { email: item.email, user_type: item.user_type, full_name: item.full_name })}
                        className="flex-1 text-left hover:opacity-70 transition-opacity"
                      >
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {item.full_name || item.email}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {item.signedIn ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              ✓ Signed In — Syncing Profile
                            </Badge>
                          ) : isInvited ? (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">Invite Sent</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800 text-xs">Not Yet Invited</Badge>
                          )}
                          <Badge className="bg-gray-100 text-gray-700 text-xs capitalize">{item.user_type}</Badge>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSendInvite(item.email, item.user_type)}
                          disabled={sendingTo === item.email}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {sendingTo === item.email ? (
                            <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <Mail className="w-4 h-4 mr-1" />
                          )}
                          {inviteSent ? 'Resend' : 'Send'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => setConfirmDelete(item)}
                          disabled={deletingId === item.id}
                          title="Remove from pending list"
                        >
                          {deletingId === item.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Timestamps and Details */}
                    <div className="space-y-2 text-sm">
                      {dateAdded && (
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium">Date added:</span>
                          <span>{format(new Date(dateAdded), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {inviteSent && (
                        <div className="flex items-center gap-2 text-blue-600">
                          <Mail className="w-4 h-4 text-blue-400" />
                          <span className="font-medium">Invite sent:</span>
                          <span>{format(new Date(inviteSent), 'MMM d, yyyy')}</span>
                        </div>
                      )}
                      {item.user?.primary_branch && (
                        <div className="text-gray-600">
                          <span className="font-medium" style={{ color: item.user.primary_branch === 'צוות לוחמים' ? '#15803d' : '#1d4ed8' }}>
                            {item.user.primary_branch}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    <div className="pt-2 border-t border-gray-200 text-gray-500 text-sm">
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {item.email}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Pending?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{confirmDelete?.user?.full_name || confirmDelete?.email}</strong> from the pending activation list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleDeleteConfirmed(confirmDelete)} className="bg-red-600 hover:bg-red-700">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


    </div>
  );
}