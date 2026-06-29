import { useEffect, useState } from 'react';
import { getUserProfile } from '@/src/services/database';

export function useOnboardingStatus() {
  const [loading, setLoading] = useState(true);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    getUserProfile().then((profile) => {
      setComplete(profile.onboardingComplete);
      setLoading(false);
    });
  }, []);

  return { loading, complete, setComplete };
}
