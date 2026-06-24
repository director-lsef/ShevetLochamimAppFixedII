/**
 * Centralized user role/type helpers to ensure consistency across the app.
 * A "participant" is someone who:
 *   - has user_type === 'participant', OR
 *   - has no user_type set AND is not a platform admin (role !== 'admin')
 * AND is not alumni.
 */

export const isAdminUser = (user) =>
  user?.user_type === 'admin' || user?.role === 'admin';

export const isInstructorUser = (user) =>
  user?.user_type === 'instructor';

export const isParticipantUser = (user) =>
  (user?.user_type === 'participant' || (!user?.user_type && user?.role !== 'admin')) &&
  user?.user_type !== 'alumni' &&
  user?.participant_status !== 'alumni';

export const isAlumniUser = (user) =>
  user?.user_type === 'alumni' || user?.participant_status === 'alumni';

/**
 * Filter a list of users down to active participants only.
 */
export const filterParticipants = (users) =>
  users.filter(isParticipantUser);