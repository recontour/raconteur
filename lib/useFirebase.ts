'use client';

import { useEffect, useState } from 'react';
import app from './firebase';

export const useFirebase = () => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (app) {
      setIsInitialized(true);
    }
  }, []);

  return { isInitialized, app };
};
