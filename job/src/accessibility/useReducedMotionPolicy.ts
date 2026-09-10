import { useEffect, useState } from 'react';
import { createMotionPolicy, type MotionPolicy } from './motion-policy.ts';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotionPolicy(): MotionPolicy {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return createMotionPolicy(reduced);
}
