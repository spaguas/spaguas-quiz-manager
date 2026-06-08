import { useEffect, useState } from 'react';
import { isOnline } from '../services/offlineService.js';

export default function useOnlineStatus() {
  const [online, setOnline] = useState(isOnline());

  useEffect(() => {
    const updateStatus = () => setOnline(isOnline());

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  return online;
}
