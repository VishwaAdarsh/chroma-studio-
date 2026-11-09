import { useState, useEffect } from 'react';
import { storageMonitorService, StorageMonitorState } from '../services/storageMonitorService';

/**
 * React hook subscribing to live cloud storage quota updates.
 * Provides instant reactivity for sidebars, profile dialogs, and upgrade cards.
 */
export function useStorageMonitor(): StorageMonitorState & { refresh: () => Promise<void> } {
  const [state, setState] = useState<StorageMonitorState>(() => storageMonitorService.getState());

  useEffect(() => {
    return storageMonitorService.subscribe((updated) => {
      setState(updated);
    });
  }, []);

  return {
    ...state,
    refresh: async () => {
      await storageMonitorService.refresh(true);
    },
  };
}
