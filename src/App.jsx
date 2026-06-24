/**
 * ============================================================
 * App.jsx — Root application component
 * ============================================================
 * PURPOSE:
 *   Composes the top-level provider tree and React Router routes.
 *   All pages are registered via pages.config.js (auto-generated).
 *
 * PROVIDER ORDER (outermost → innermost):
 *   AuthProvider → QueryClientProvider → Router → NavigationTracker
 *   Note: Toaster is a sibling of Router (not inside it) because
 *   toasts should persist across navigation events.
 *
 * ROUTE REGISTRATION:
 *   Pages from pages.config.js are registered dynamically via
 *   Object.entries(Pages).map(...). The main page (defined by
 *   `mainPage` in pages.config.js) is rendered at the root path "/".
 *
 * KNOWN BUGS (do not fix until Phase 2 of the fix plan):
 *   [Step 2.3] UserDirectory route duplication:
 *     - This file manually imports UserDirectory and registers it
 *       as an explicit <Route path="/UserDirectory">.
 *     - UserDirectory is NOT in pages.config.js — so the explicit
 *       route is currently the only registration that works.
 *     - However, the import + hardcoded route is undocumented and
 *       will be silently lost if pages.config.js is ever regenerated.
 *     - Fix: add UserDirectory to pages.config.js and remove the
 *       manual import and explicit route from this file.
 * ============================================================
 */

import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// ── [Fix 2.3] ACTIVE FIX — removed manual UserDirectory import ──────────────
// UserDirectory is now registered in pages.config.js. This import is no longer
// needed. Keeping it commented here for reference — the hardcoded route below
// has also been removed.
// DELETED: import UserDirectory from './pages/UserDirectory';

// Resolve the main (landing) page from pages.config.js.
// Falls back to the first registered page if mainPage is not set.
const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

/**
 * LayoutWrapper — Conditionally wraps a page in the Layout component.
 * If no Layout is configured in pages.config.js, renders children directly.
 * The currentPageName prop is passed to Layout for active nav highlighting.
 */
const LayoutWrapper = ({ children, currentPageName }) => Layout
  ? <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

/**
 * AuthenticatedApp — Renders the route tree after auth is resolved.
 *
 * Rendering logic:
 *   1. Show spinner while auth or public settings are loading.
 *   2. If auth fails with 'user_not_registered', show the error screen.
 *   3. If auth fails with 'auth_required', redirect to login immediately.
 *   4. Otherwise, render all routes.
 *
 * Note: navigateToLogin() triggers a full redirect — the return value
 * is null because no React rendering is needed after the redirect fires.
 */
const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Block rendering until both the public settings fetch and the auth check complete.
  // isLoadingPublicSettings must be checked first because auth depends on it.
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      // User has a valid session but is not registered for this app
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // No valid session — redirect to login, passing current URL for return
      navigateToLogin();
      return null;
    }
    // Other auth errors (e.g. 'unknown') fall through to render the app normally.
    // This is intentional — some non-critical errors should not block rendering.
  }

  return (
    <Routes>
      {/* Root path renders the main page defined in pages.config.js */}
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />

      {/* ── [Fix 2.3] ACTIVE FIX — removed hardcoded UserDirectory route ──────────
          UserDirectory is now registered via pages.config.js and will appear
          in the Object.entries(Pages).map() loop below. Nothing needed here. */}

      {/* Dynamic routes — auto-registered from pages.config.js */}
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}

      {/* Catch-all 404 */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

/**
 * App — The root component.
 * Wraps everything in the required provider tree.
 * AuthProvider must be outermost so QueryClientProvider and Router
 * components can access auth state via useAuth() if needed.
 */
function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        {/* Toaster is outside <Router> so toasts persist across navigations */}
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
