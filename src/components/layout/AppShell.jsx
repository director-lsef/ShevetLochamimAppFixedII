import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import {
  Home, Calendar, Users, BarChart3, LogOut,
  UserCircle, Bell, Shield, Clipboard, Target,
  ChevronUp, Menu, X, ChevronDown
} from 'lucide-react';
import NotificationBell from '@/components/layout/NotificationBell';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';

export default function AppShell({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
      if (userData?.user_type === 'admin' || userData?.role === 'admin') {
        const pending = await base44.entities.PerformanceRecord.filter({ status: 'pending_verification' });
        setPendingCount(pending.length);
      }
    } catch (e) {
      console.log('Not logged in');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => base44.auth.logout();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#001A3D' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#0038A8' }}></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#001A3D' }}>
        <div className="text-center p-8 rounded-2xl max-w-sm w-full mx-4" style={{ backgroundColor: '#002D62' }}>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972a13d876a46730ee1f676/ce7dea82b_BlackText-WhiteWings-BlackFace.png"
            alt="Logo" className="h-16 w-auto mx-auto mb-4" style={{ filter: 'invert(1) brightness(2)' }}
          />
          <h2 className="text-2xl font-bold text-white mb-2">Tzevet Mikey</h2>
          <p className="text-gray-400 mb-6">Please log in to continue</p>
          <Button onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="w-full text-white rounded-2xl" style={{ backgroundColor: '#0038A8' }}>
            Log In
          </Button>
        </div>
      </div>
    );
  }

  const isAdmin = user?.user_type === 'admin' || user?.role === 'admin';
  const isInstructor = user?.user_type === 'instructor';
  const isParticipant = !isAdmin && !isInstructor;

  const isActive = (path) => currentPageName === path;

  // Nav items per role
  const coreNav = [
    { name: 'Home', icon: Home, path: 'Home' },
    { name: 'Dashboard', icon: BarChart3, path: 'WarriorDashboard' },
    { name: 'Events', icon: Calendar, path: 'Events' },
  ];

  const participantNav = [
    ...coreNav,
    { name: 'My Events', icon: UserCircle, path: 'MyEvents' },
    { name: 'Profile', icon: UserCircle, path: 'Profile' },
  ];

  const instructorNav = [
    ...coreNav,
    { name: 'Instructor', icon: Clipboard, path: 'InstructorPortal' },
    { name: 'Profile', icon: UserCircle, path: 'Profile' },
  ];

  const adminBottomNav = [
    ...coreNav,
    { name: 'Instructor', icon: Clipboard, path: 'InstructorPortal' },
  ];

  const bottomNavItems = isAdmin ? adminBottomNav : isInstructor ? instructorNav : participantNav;

  const sidebarExtras = isInstructor || isAdmin ? [
    { name: 'Drill Bank', icon: Target, path: 'ManageCustomDrills' },
    { name: 'Session Plans', icon: Clipboard, path: 'SessionPlanBank' },
  ] : [];

  const adminMenuItems = [
    { name: 'Participants', icon: Users, path: 'Participants' },
    { name: 'User Directory', icon: Users, path: 'UserDirectory' },
    { name: 'Submission Review', icon: Shield, path: 'SubmissionReview' },
    { name: 'Statistics', icon: BarChart3, path: 'Statistics' },
    { name: 'Notifications', icon: Bell, path: 'Notifications' },
  ];

  const NavLink = ({ item, onClick, compact }) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    return (
      <Link
        to={createPageUrl(item.path)}
        onClick={onClick}
        className={`flex ${compact ? 'flex-col items-center py-2 px-3 gap-1' : 'items-center gap-3 px-4 py-3 rounded-2xl'} transition-all ${
          active ? 'text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
        }`}
        style={active && !compact ? { backgroundColor: '#0038A8' } : {}}
      >
        <Icon className={compact ? 'w-5 h-5' : 'w-5 h-5 shrink-0'} style={active && compact ? { color: '#60a5fa' } : {}} />
        <span className={compact ? 'text-[10px] font-medium' : 'text-sm font-medium'} style={active && compact ? { color: '#60a5fa' } : {}}>
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#001A3D' }}>
      {/* ── DESKTOP SIDEBAR ────────────────────────────────── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col z-40 border-r"
        style={{ backgroundColor: '#002D62', borderColor: '#0038A8' }}>
        {/* Logo */}
        <div className="p-5 border-b flex items-center gap-3" style={{ borderColor: '#0038A8' }}>
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972a13d876a46730ee1f676/ce7dea82b_BlackText-WhiteWings-BlackFace.png"
            alt="Logo" className="h-9 w-auto" style={{ filter: 'invert(1) brightness(2)' }}
          />
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Tzevet Mikey</h1>
            <p className="text-[11px] text-gray-400">{user.full_name}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {coreNav.map(item => <NavLink key={item.path} item={item} />)}

          {(isInstructor || isAdmin) && (
            <>
              <div className="pt-3 pb-1 px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Instructor</div>
              <NavLink item={{ name: 'Instructor Portal', icon: Clipboard, path: 'InstructorPortal' }} />
              {sidebarExtras.map(item => <NavLink key={item.path} item={item} />)}
            </>
          )}

          {isAdmin && (
            <>
              <div className="pt-3 pb-1 px-4 text-[10px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                Admin
                {pendingCount > 0 && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold">{pendingCount}</span>
                )}
              </div>
              {adminMenuItems.map(item => <NavLink key={item.path} item={item} />)}
            </>
          )}
        </nav>

        {/* Bottom: Profile + Notifications + Logout */}
        <div className="p-3 border-t space-y-1" style={{ borderColor: '#0038A8' }}>
          {user && <div className="flex justify-center pb-1"><NotificationBell userId={user.id} /></div>}
          <NavLink item={{ name: 'Profile', icon: UserCircle, path: 'Profile' }} />
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all text-sm font-medium"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            Log Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ───────────────────────────────────── */}
      <div className="md:ml-64 pb-24 md:pb-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14"
          style={{ backgroundColor: '#002D62', borderBottom: '1px solid #0038A8' }}>
          <Link to={createPageUrl('Home')}>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6972a13d876a46730ee1f676/ce7dea82b_BlackText-WhiteWings-BlackFace.png"
              alt="Logo" className="h-8 w-auto" style={{ filter: 'invert(1) brightness(2)' }}
            />
          </Link>
          <div className="flex items-center gap-2">
            {user && <NotificationBell userId={user.id} />}
          </div>
        </header>

        {/* Page content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAV ──────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch"
        style={{ backgroundColor: '#002D62', borderTop: '1px solid #0038A8' }}>
        {bottomNavItems.slice(0, isAdmin ? 4 : 5).map(item => (
          <NavLink key={item.path} item={item} compact />
        ))}

        {/* Admin "Menu" button with slide-up panel */}
        {isAdmin && (
          <div className="flex-1 relative">
            <button
              onClick={() => setAdminMenuOpen(o => !o)}
              className="w-full flex flex-col items-center py-2 px-3 gap-1 text-gray-400 hover:text-white transition-all"
            >
              {adminMenuOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
              <span className="text-[10px] font-medium">Menu</span>
            </button>

            {/* Slide-up panel */}
            {adminMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAdminMenuOpen(false)} />
                <div className="fixed bottom-14 left-0 right-0 z-50 rounded-t-3xl shadow-2xl p-4 space-y-1"
                  style={{ backgroundColor: '#002D62', borderTop: '1px solid #0038A8' }}>
                  <p className="text-xs text-gray-500 uppercase tracking-widest px-4 pb-2">Admin Panel</p>
                  {adminMenuItems.map(item => {
                    const Icon = item.icon;
                    return (
                      <Link key={item.path} to={createPageUrl(item.path)}
                        onClick={() => setAdminMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                        <Icon className="w-5 h-5" />
                        <span className="text-sm font-medium">{item.name}</span>
                      </Link>
                    );
                  })}
                  <div className="border-t pt-2 mt-2" style={{ borderColor: '#0038A8' }}>
                    <Link to={createPageUrl('Profile')} onClick={() => setAdminMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-300 hover:text-white hover:bg-white/10 transition-all">
                      <UserCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Profile</span>
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-400 hover:text-red-400 hover:bg-red-900/20 transition-all">
                      <LogOut className="w-5 h-5" />
                      <span className="text-sm font-medium">Log Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}