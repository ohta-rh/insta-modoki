'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from './register';

/** Registers the Service Worker once after hydration; renders nothing. */
export function PwaRegister() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
