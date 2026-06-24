/**
 * ============================================================
 * NotificationBell.jsx
 * ============================================================
 * PURPOSE:
 *   Persistent header notification icon that polls for unread
 *   UserNotification records and renders a dropdown list.
 *   Marks all notifications as read when the dropdown is opened.
 *
 * PROPS:
 *   userId — The current user's ID (passed from AppShell)
 *
 * POLLING:
 *   Fetches notifications on mount and every 30 seconds.
 *   Uses setInterval — the interval is cleared on unmount via
 *   the useEffect cleanup function to prevent memory leaks.
 *
 * ENTITY: UserNotification (correct — no bug here)
 *   This component correctly uses 'UserNotification'.
 *   Contrast with Notifications.jsx and SubmissionReviewCard.jsx
 *   which incorrectly use 'Notification'.
 *
 * READ BEHAVIOUR:
 *   - Unread count badge shows on the bell icon
 *   - Opening the dropdown immediately calls markAllRead()
 *   - markAllRead() patches each unread record individually
 *     (one API call per notification — acceptable for low volumes,
 *     but could be batched for performance if counts grow large)
 *
 * OUTSIDE CLICK:
 *   Uses a mousedown listener on document to close the dropdown
 *   when the user clicks outside. The ref is attached to the
 *   component's root div. Listener is cleaned up on unmount.
 *
 * NO KNOWN BUGS in this file.
 * ============================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell } from 'lucide-react';
import { format } from 'date-fns';

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const ref = useRef(null); // ref for outside-click detection

  useEffect(() => {
    if (!userId) return;

    loadNotifications();

    // Poll every 30 seconds for new notifications.
    // 30s is a balance between freshness and API call frequency.
    // For higher urgency, reduce to 10s; for lower, increase to 60s.
    const pollInterval = setInterval(loadNotifications, 30000);

    // Close dropdown when user clicks outside the component
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);

    // Cleanup: clear interval and remove event listener on unmount
    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [userId]); // re-run if userId changes (e.g. after login)

  // ─── loadNotifications ─────────────────────────────────────────────────
  // Fetches the 20 most recent notifications for this user, ordered newest first.
  const loadNotifications = async () => {
    try {
      const all = await base44.entities.UserNotification.filter(
        { user_id: userId },
        '-created_date', // sort descending by creation date
        20               // limit to 20 records
      );
      setNotifications(all);
      setUnreadCount(all.filter(n => !n.read).length);
    } catch {
      // Silently fail — UserNotification fetch errors should not break the UI.
      // Common cause: network interruption or stale session.
    }
  };

  // ─── markAllRead ───────────────────────────────────────────────────────
  // Patches each unread notification individually to read: true.
  // Also updates local state immediately for optimistic UI (no re-fetch needed).
  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await base44.entities.UserNotification.update(n.id, { read: true });
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  return (
    <div ref={ref} className="relative">

      {/* ── Bell icon button ───────────────────────────────────────────────
          Opens/closes the dropdown. If there are unread notifications,
          opens and immediately marks them all as read. */}
      <button
        onClick={() => {
          setOpen(o => !o);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative p-2 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {/* Unread count badge — capped at 9+ to prevent overflow */}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Notification dropdown ─────────────────────────────────────────
          Absolute-positioned below the bell icon. Constrained to 70vh height
          with overflow-y-auto for long notification lists. */}
      {open && (
        <div className="absolute right-0 top-12 w-80 max-h-[70vh] overflow-y-auto rounded-xl shadow-2xl bg-white border border-gray-100 z-50">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Notifications</h3>
            {notifications.length > 0 && (
              <button onClick={markAllRead} className="text-xs text-indigo-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No notifications yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifications.map(notif => (
                // Unread notifications get a subtle blue tint background
                <div key={notif.id} className={`p-4 ${!notif.read ? 'bg-indigo-50/60' : ''}`}>
                  <div className="flex items-start gap-3">
                    {/* Unread indicator dot — visible only for unread items */}
                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${!notif.read ? 'bg-indigo-500' : 'bg-transparent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900">{notif.title}</p>
                      {/* line-clamp-2 prevents long messages from expanding the dropdown */}
                      <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {notif.created_date ? format(new Date(notif.created_date), 'MMM d, h:mm a') : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
