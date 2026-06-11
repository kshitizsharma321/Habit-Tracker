import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { saveOnboarding } from '../api/onboardingApi';

export function useOnboarding() {
  const { user, updateUser } = useAuth();

  const isOnboarded = user?.onboardingComplete === true;

  const skip = useCallback(async () => {
    await saveOnboarding({ onboardingComplete: true });
    await updateUser({ onboardingComplete: true });
  }, [updateUser]);

  return { isOnboarded, skipOnboarding: skip };
}
