'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/push';

export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return null;
}
