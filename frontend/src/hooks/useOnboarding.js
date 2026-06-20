import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { completeOnboarding } from '../api/onboardingApi';

export function useOnboarding() {
  const { user, updateUser } = useAuth();

  const isOnboarded = user?.onboardingComplete === true;

  const skip = useCallback(async () => {
    await completeOnboarding({ onboardingComplete: true });
    await updateUser({ onboardingComplete: true });
  }, [updateUser]);

  return { isOnboarded, skipOnboarding: skip };
}
