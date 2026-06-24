/**
 * ============================================================
 * Notifications.jsx — Admin broadcast notifications page
 * ============================================================
 * PURPOSE:
 *   Admin-only page with two sections:
 *   1. Submission Review Recipients — configure which staff receive
 *      in-app alerts when a participant submits a PerformanceRecord.
 *   2. Send Notification — compose and broadcast a message to a
 *      user segment (all, participants, instructors, specific users,
 *      or event registrants), delivered as in-app notifications
 *      and emails.
 *
 * ACCESS CONTROL:
 *   Checks user_type === 'admin' after load. Non-admins see an
 *   "Access Denied" screen. The check is frontend-only — backend
 *   operations rely on their own auth guards.
 *
 * DATA LOADED:
 *   - User.list()                    — all users (for recipient picker)
 *   - Event.filter(active)           — events (for event_registrants mode)
 *   - EventRegistration.filter(registered) — for event_registrants resolution
 *   - Notification.list()            — recent sent notifications (history panel)
 *   - AppSettings(submission_notification_recipients) — saved recipient config
 *
 * KNOWN BUGS (do not fix until Phase 2 of the fix plan):
 *
 *   [Step 2.2 — CRITICAL] Three broken entity references:
 *
 *   a) loadData() calls base44.entities.Notification.list()
 *      The entity is 'UserNotification', not 'Notification'.
 *      This call throws, the entire Promise.all() rejects,
 *      and loadData() catches the error silently. Result: ALL five
 *      data loads fail together, leaving the page blank.
 *      Fix: replace with UserNotification.filter({ user_id: currentUser.id })
 *
 *   b) handleSendNotification() calls base44.entities.Notification.create()
 *      Same wrong entity name. The email loop runs first (successfully),
 *      then the create() throws and is caught — the notification history
 *      is never updated. But since the Notification.list() in loadData()
 *      also fails, the history panel is always empty regardless.
 *      Fix: replace with a loop creating one UserNotification per recipient:
 *        await base44.entities.UserNotification.create({
 *          user_id: recipient.id,
 *          title:   form.title,
 *          message: form.message,
 *          type:    'general',
 *          read:    false,
 *        })
 *
 *   c) [Step 3.1] loadData() calls base44.auth.me() on every page visit.
 *      The authenticated user is already available via useAuth().
 *      Fix: replace with const { user: currentUser } = useAuth() and
 *      remove the auth.me() call from loadData().
 *
 *   d) The "Recent Notifications" panel renders fields like
 *      notif.recipient_type, notif.recipient_ids, and notif.sent_at
 *      which exist on the (non-existent) Notification schema but NOT
 *      on UserNotification. After the entity fix, this JSX will need
 *      to be updated to show UserNotification fields instead.
 * ============================================================
 */

import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bell, Send, Users, Calendar, Mail,
  CheckCircle, Clock, Search, Filter, Shield
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function Notifications() {
  // ⚠️ BUG [Step 3.1]: currentUser should come from useAuth() not from auth.me() in loadData()
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers]             = useState([]);
  const [events, setEvents]           = useState([]);
  const [registrations, setRegistrations] = useState([]);

  // ⚠️ BUG [Step 2.2a]: notifications is always [] because Notification.list() throws.
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);

  // Compose form state
  // Note: recipient_type, recipient_ids, event_id are UI-only — they are used
  // to resolve getRecipients() and are NOT passed to UserNotification.create().
  const [form, setForm] = useState({
    title:          '',
    message:        '',
    recipient_type: 'all',
    recipient_ids:  [],
    event_id:       ''
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Submission notification recipients — persisted in AppSettings
  const [submissionRecipientIds, setSubmissionRecipientIds] = useState([]);
  const [submissionSettingId, setSubmissionSettingId]       = useState(null);
  const [savingSettings, setSavingSettings]                 = useState(false);
  const [settingsSearchTerm, setSettingsSearchTerm]         = useState('');

  useEffect(() => {
    loadData();
  }, []);

  // ─── loadData ──────────────────────────────────────────────────────────────
  // ⚠️ BUG [Step 3.1]: auth.me() re-fetches the user on every page visit.
  //   Replace with: const { user: currentUser } = useAuth(); (no API call needed)
  //
  // ⚠️ BUG [Step 2.2a]: entities.Notification.list() — wrong entity name.
  //   When this throws, the entire Promise.all() rejects and ALL five parallel
  //   fetches fail together. The entire page loads empty.
  const loadData = async () => {
    try {
      // ⚠️ BUG [Step 3.1]: Remove this — use useAuth() instead
      const userData = await base44.auth.me();
      setCurrentUser(userData);

      // Non-admins see an access denied screen — no need to fetch further data
      if (userData.user_type !== 'admin') {
        setLoading(false);
        return;
      }

      const [usersData, eventsData, regsData, notifsData, settingsData] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.Event.filter({ status: 'active' }, 'start_datetime'),
        base44.entities.EventRegistration.filter({ status: 'registered' }),
        // ⚠️ BUG [Step 2.2a]: 'Notification' entity does not exist. Should be:
        //   base44.entities.UserNotification.filter({ user_id: userData.id }, '-created_date', 20)
        // ── [Fix 2.2a] ACTIVE FIX — replaced Notification.list with UserNotification.filter ──
        // OLD (broken — Notification entity does not exist):
        //   base44.entities.Notification.list('-created_date', 20),
        // NEW (correct — filter current user's notifications):
        base44.entities.UserNotification.filter({ user_id: userData.id }, '-created_date', 20),
        base44.entities.AppSettings.filter({ key: 'submission_notification_recipients' })
      ]);

      setUsers(usersData);
      setEvents(eventsData);
      setRegistrations(regsData);
      setNotifications(notifsData);

      // Restore saved submission recipient IDs from AppSettings
      if (settingsData[0]) {
        setSubmissionSettingId(settingsData[0].id);
        setSubmissionRecipientIds(JSON.parse(settingsData[0].value || '[]'));
      }
    } catch (error) {
      // ⚠️ BUG: This silently catches the Notification.list() throw,
      //   meaning the page loads blank with no error message to the user.
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── getRecipients ─────────────────────────────────────────────────────────
  // Resolves the current form.recipient_type into a list of User objects.
  // Used both for the recipient count badge and for the send loop.
  const getRecipients = () => {
    switch (form.recipient_type) {
      case 'all':
        return users;
      case 'participants':
        return users.filter(u => u.user_type === 'participant');
      case 'instructors':
        return users.filter(u => u.user_type === 'instructor');
      case 'specific_users':
        return users.filter(u => form.recipient_ids.includes(u.id));
      case 'event_registrants':
        if (!form.event_id) return [];
        const eventRegs = registrations.filter(r => r.event_id === form.event_id);
        return users.filter(u => eventRegs.some(r => r.participant_id === u.id));
      default:
        return [];
    }
  };

  // ─── handleSendNotification ────────────────────────────────────────────────
  // ⚠️ BUG [Step 2.2b]: entities.Notification.create() — wrong entity name.
  //   The email loop runs first (and may partially succeed), then the
  //   Notification.create() call throws, rolling back any visual confirmation.
  //   Fix: remove the single Notification.create() and replace with a per-
  //   recipient UserNotification.create() loop alongside the email loop.
  const handleSendNotification = async () => {
    if (!form.title || !form.message) {
      toast.error('Please fill in title and message');
      return;
    }

    setSending(true);
    try {
      const recipients = getRecipients();

      // ⚠️ BUG [Step 2.2b]: This call targets a non-existent entity and throws.
      //   The email loop above it runs first (partially), then this throws,
      //   and the catch block fires — no history is recorded, no toast shown.
      //   Fix: remove this create() and instead create one UserNotification per
      //   recipient inside the email loop below:
      //     await base44.entities.UserNotification.create({
      //       user_id: recipient.id,
      //       title: form.title, message: form.message, type: 'general', read: false,
      //     });
      // ── [Fix 2.2b] ACTIVE FIX — replaced Notification.create with UserNotification loop ──
      // OLD (broken — one phantom Notification record, wrong fields):
      //   await base44.entities.Notification.create({ ...form, sent_at, status });
      // NEW (correct — one UserNotification per recipient):
      for (const r of recipients) {
        await base44.entities.UserNotification.create({
          user_id: r.id,
          title: form.title,
          message: form.message,
          type: 'general',
          read: false,
        });
      }

      // Send emails to all recipients with valid email addresses
      for (const recipient of recipients) {
        if (recipient.email) {
          await base44.integrations.Core.SendEmail({
            to:      recipient.email,
            subject: form.title,
            body: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
                  <h1 style="color: white; margin: 0;">Tzevet Mikey</h1>
                </div>
                <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                  <h2 style="color: #1f2937; margin-top: 0;">${form.title}</h2>
                  <p style="color: #4b5563; line-height: 1.6;">${form.message.replace(/\n/g, '<br>')}</p>
                </div>
              </div>
            `
          });
        }
      }

      toast.success(`Notification sent to ${recipients.length} recipients`);

      // Reset compose form after successful send
      setForm({ title: '', message: '', recipient_type: 'all', recipient_ids: [], event_id: '' });
      loadData();
    } catch (error) {
      toast.error('Failed to send notification');
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  // ─── Recipient filtering helpers ───────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleUserSelection = (userId) => {
    setForm(prev => ({
      ...prev,
      recipient_ids: prev.recipient_ids.includes(userId)
        ? prev.recipient_ids.filter(id => id !== userId)
        : [...prev.recipient_ids, userId]
    }));
  };

  // ─── Submission recipients setting helpers ─────────────────────────────────
  const toggleSubmissionRecipient = (userId) => {
    setSubmissionRecipientIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // Persists the selected submission notification recipients to AppSettings.
  // notifyInstructorsSubmission reads this setting to determine who to notify.
  const saveSubmissionRecipients = async () => {
    setSavingSettings(true);
    try {
      const value = JSON.stringify(submissionRecipientIds);
      if (submissionSettingId) {
        await base44.entities.AppSettings.update(submissionSettingId, { value });
      } else {
        const created = await base44.entities.AppSettings.create({
          key:   'submission_notification_recipients',
          value: value
        });
        setSubmissionSettingId(created.id);
      }
      toast.success('Submission notification recipients saved');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Staff = instructors + admins (only they can receive submission notifications)
  const staffUsers    = users.filter(u => u.user_type === 'instructor' || u.user_type === 'admin' || u.role === 'admin');
  const filteredStaff = staffUsers.filter(u =>
    u.full_name?.toLowerCase().includes(settingsSearchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(settingsSearchTerm.toLowerCase())
  );

  // ─── Loading + access guard ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (currentUser?.user_type !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur max-w-md">
          <CardContent className="py-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-500">Only administrators can send notifications.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const recipients = getRecipients();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
      </div>

      {/* ── Submission Review Recipients Setting ─────────────────────────── */}
      <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-amber-600" />
            Submission Review Notifications
          </CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Choose which instructors/admins receive in-app notifications when a participant submits a result.
            {submissionRecipientIds.length === 0 && <span className="text-amber-600 font-medium"> Currently: all staff (default).</span>}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search staff..."
              value={settingsSearchTerm}
              onChange={(e) => setSettingsSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
            {filteredStaff.map(u => (
              <div
                key={u.id}
                className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                onClick={() => toggleSubmissionRecipient(u.id)}
              >
                <Checkbox
                  checked={submissionRecipientIds.includes(u.id)}
                  onCheckedChange={() => toggleSubmissionRecipient(u.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{u.full_name || u.email}</p>
                  <p className="text-xs text-gray-500 capitalize">{u.user_type}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {submissionRecipientIds.length === 0
                ? 'No specific recipients — all staff will be notified'
                : `${submissionRecipientIds.length} recipient${submissionRecipientIds.length !== 1 ? 's' : ''} selected`}
            </span>
            <Button onClick={saveSubmissionRecipients} disabled={savingSettings} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
              {savingSettings ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* ── Compose Notification ────────────────────────────────────────── */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Send Notification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="Write your message here..."
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <Select
                value={form.recipient_type}
                onValueChange={(v) => setForm({ ...form, recipient_type: v, recipient_ids: [], event_id: '' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="participants">All Participants</SelectItem>
                  <SelectItem value="instructors">All Instructors</SelectItem>
                  <SelectItem value="specific_users">Specific Users</SelectItem>
                  <SelectItem value="event_registrants">Event Registrants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.recipient_type === 'event_registrants' && (
              <div className="space-y-2">
                <Label>Select Event</Label>
                <Select value={form.event_id} onValueChange={(v) => setForm({ ...form, event_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.title} - {format(new Date(event.start_datetime), 'MMM d')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.recipient_type === 'specific_users' && (
              <div className="space-y-2">
                <Label>Select Users</Label>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      onClick={() => toggleUserSelection(user.id)}
                    >
                      <Checkbox
                        checked={form.recipient_ids.includes(user.id)}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                      />
                      <span className="text-sm">{user.full_name || user.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recipient count preview */}
            <div className="p-4 bg-indigo-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-indigo-700">Recipients:</span>
                <Badge className="bg-indigo-100 text-indigo-800">
                  <Users className="w-3 h-3 mr-1" />
                  {recipients.length} users
                </Badge>
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600"
              onClick={handleSendNotification}
              disabled={sending || recipients.length === 0}
            >
              {sending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Notification
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Recent Notifications history ──────────────────────────────────
            ⚠️ BUG [Step 2.2a]: notifications is always [] (Notification.list() fails).
            After the entity fix, this panel will render UserNotification records.
            The field references below (recipient_type, recipient_ids, sent_at) will
            also need to be updated to match UserNotification schema fields. */}
        <Card className="border-none shadow-lg bg-white/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-purple-600" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                {/* ⚠️ NOTE: This empty state always shows due to the bug above. */}
                <p className="text-gray-500">No notifications sent yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-4 border border-gray-100 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-semibold text-gray-900">{notif.title}</h4>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Sent
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2 mb-2">{notif.message}</p>
                    {/* ⚠️ NOTE: recipient_type, recipient_ids, sent_at do not exist
                        on UserNotification — update these after the entity fix */}
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {notif.recipient_type === 'all'              ? 'All Users' :
                         notif.recipient_type === 'participants'     ? 'Participants' :
                         notif.recipient_type === 'instructors'      ? 'Instructors' :
                         notif.recipient_type === 'event_registrants'? 'Event Registrants' :
                         `${notif.recipient_ids?.length || 0} users`}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        {notif.sent_at ? format(new Date(notif.sent_at), 'MMM d, h:mm a') : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
