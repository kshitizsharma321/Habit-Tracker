import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function useOnboarding() {
  const { user, updateUser } = useAuth();

  const isOnboarded = user?.onboardingComplete === true;

  // updateUser already PUTs /auth/profile — one call marks onboarding done.
  const skip = useCallback(async () => {
    await updateUser({ onboardingComplete: true });
  }, [updateUser]);

  return { isOnboarded, skipOnboarding: skip };
}
