import { useEffect, useState } from 'react';
import { getUserProfile } from '@/src/services/database';

export function useOnboardingStatus() {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    getUserProfile()
      .then((profile) => {
        setComplete(profile.onboardingComplete);
      })
      .catch((error) => {
        console.warn('Failed to load onboarding status:', error);
        setComplete(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return { loading, complete, setComplete };
}
