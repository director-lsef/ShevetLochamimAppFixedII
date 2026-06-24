/**
 * ============================================================
 * AuthContext.jsx
 * ============================================================
 * PURPOSE:
 *   Global authentication state provider. Runs once on app load,
 *   verifies the user's session, and exposes auth state to all
 *   components via the useAuth() hook.
 *
 * CRITICAL:
 *   This is the SINGLE source of truth for the authenticated user.
 *   All pages MUST consume `user` from useAuth() instead of calling
 *   base44.auth.me() independently.
 *
 *   ⚠️ BUG [Step 3.1]: 14 page components currently re-call
 *   base44.auth.me() inside their own loadData() functions, ignoring
 *   this context. This adds a redundant network round-trip on every
 *   page navigation. Fix: replace those calls with `const { user } = useAuth()`.
 *
 * STARTUP SEQUENCE:
 *   1. Fetch app public settings (determines if auth is required)
 *   2. If a token is present, call checkUserAuth() → base44.auth.me()
 *   3. Set isAuthenticated and user state
 *   App.jsx reads isLoadingAuth and authError to gate rendering.
 *
 * CONTEXT VALUE:
 *   user               — The authenticated User entity (or null)
 *   isAuthenticated    — Boolean; true after successful auth.me()
 *   isLoadingAuth      — Boolean; true while auth check is in flight
 *   isLoadingPublicSettings — Boolean; true while app settings load
 *   authError          — { type, message } or null
 *   appPublicSettings  — { id, public_settings } or null
 *   logout(redirect?)  — Signs out; redirects to login by default
 *   navigateToLogin()  — Redirects to the base44 login page
 *   checkAppState()    — Re-runs the full auth sequence (e.g. on token refresh)
 * ============================================================
 */

import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { appParams } from '@/lib/app-params';
import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null); // { id, public_settings }

  useEffect(() => {
    checkAppState();
  }, []);

  /**
   * checkAppState — Entry point for the auth flow.
   * Step 1: Fetch app public settings (no auth required).
   * Step 2: If a token exists, proceed to checkUserAuth().
   * Sets authError for known failure modes (auth_required, user_not_registered).
   */
  const checkAppState = async () => {
    try {
      setIsLoadingPublicSettings(true);
      setAuthError(null);

      // Fetch public settings using the app ID from the URL/localStorage.
      // This endpoint does not require authentication but accepts a token
      // header if one is present (for apps with auth required settings).
      const appClient = createAxiosClient({
        baseURL: `/api/apps/public`,
        headers: { 'X-App-Id': appParams.appId },
        token: appParams.token,
        interceptResponses: true
      });

      try {
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        setAppPublicSettings(publicSettings);

        if (appParams.token) {
          // A token is present — check if it's valid
          await checkUserAuth();
        } else {
          // No token — unauthenticated state, show login prompt
          setIsLoadingAuth(false);
          setIsAuthenticated(false);
        }
        setIsLoadingPublicSettings(false);

      } catch (appError) {
        console.error('App state check failed:', appError);

        // 403 with a specific reason code means the app has intentional access controls.
        // Map known reasons to typed errors for the UI to handle.
        if (appError.status === 403 && appError.data?.extra_data?.reason) {
          const reason = appError.data.extra_data.reason;
          if (reason === 'auth_required') {
            // App requires login — App.jsx will redirect to login automatically
            setAuthError({ type: 'auth_required', message: 'Authentication required' });
          } else if (reason === 'user_not_registered') {
            // User is authenticated but not registered for this app
            setAuthError({ type: 'user_not_registered', message: 'User not registered for this app' });
          } else {
            setAuthError({ type: reason, message: appError.message });
          }
        } else {
          setAuthError({ type: 'unknown', message: appError.message || 'Failed to load app' });
        }
        setIsLoadingPublicSettings(false);
        setIsLoadingAuth(false);
      }

    } catch (error) {
      // Unexpected top-level error (network failure, JSON parse error, etc.)
      console.error('Unexpected error:', error);
      setAuthError({ type: 'unknown', message: error.message || 'An unexpected error occurred' });
      setIsLoadingPublicSettings(false);
      setIsLoadingAuth(false);
    }
  };

  /**
   * checkUserAuth — Validates the current session token.
   * Calls base44.auth.me() and stores the result in context.
   * On 401/403, sets an auth_required error to trigger re-login.
   */
  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
    } catch (error) {
      console.error('User auth check failed:', error);
      setIsLoadingAuth(false);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 403) {
        // Token expired or revoked — prompt re-login
        setAuthError({ type: 'auth_required', message: 'Authentication required' });
      }
    }
  };

  /**
   * logout — Clears auth state.
   * @param shouldRedirect — If true (default), redirects to the base44 login page
   *   passing the current URL so the user returns after logging in.
   *   If false, only clears the local token without a redirect (useful for
   *   programmatic flows that handle navigation themselves).
   */
  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  };

  /**
   * navigateToLogin — Redirects to the base44 hosted login page.
   * Passes the current URL so the user is returned here after sign-in.
   */
  const navigateToLogin = () => {
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState     // exposed so components can trigger a re-auth (e.g. after token refresh)
    }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * useAuth — Hook to access the auth context.
 * Must be used inside an <AuthProvider> tree.
 * Usage: const { user, isAuthenticated, logout } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
