/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AssignSessionPlan from './pages/AssignSessionPlan';
import EventDetails from './pages/EventDetails';
import Events from './pages/Events';
import Home from './pages/Home';
import InstructorCalendar from './pages/InstructorCalendar';
import InstructorPortal from './pages/InstructorPortal';
import ManageCustomDrills from './pages/ManageCustomDrills';
import ManageSessionPlans from './pages/ManageSessionPlans';
import MyEvents from './pages/MyEvents';
import Notifications from './pages/Notifications';
import Participants from './pages/Participants';
import Profile from './pages/Profile';
import RateParticipants from './pages/RateParticipants';
import SessionPlanBank from './pages/SessionPlanBank';
import Statistics from './pages/Statistics';
import SubmissionReview from './pages/SubmissionReview';
import WarriorDashboard from './pages/WarriorDashboard';
// ── [Fix 2.3] ACTIVE FIX — UserDirectory added to pages.config ──────────────
// OLD: UserDirectory was only registered via a hardcoded route in App.jsx.
//      It was missing from this file entirely and would be lost if auto-regenerated.
// NEW: Added here so it's registered through the normal page loop.
//      After adding this, remove the hardcoded route from App.jsx (see annotation there).
import UserDirectory from './pages/UserDirectory';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AssignSessionPlan": AssignSessionPlan,
    "EventDetails": EventDetails,
    "Events": Events,
    "Home": Home,
    "InstructorCalendar": InstructorCalendar,
    "InstructorPortal": InstructorPortal,
    "ManageCustomDrills": ManageCustomDrills,
    "ManageSessionPlans": ManageSessionPlans,
    "MyEvents": MyEvents,
    "Notifications": Notifications,
    "Participants": Participants,
    "Profile": Profile,
    "RateParticipants": RateParticipants,
    "SessionPlanBank": SessionPlanBank,
    "Statistics": Statistics,
    "SubmissionReview": SubmissionReview,
    "WarriorDashboard": WarriorDashboard,
    // ── [Fix 2.3] ACTIVE FIX — added UserDirectory to PAGES object ──
    "UserDirectory": UserDirectory,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};