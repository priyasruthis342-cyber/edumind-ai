import { useContext } from 'react';
import { AppContext, type AppContextValue } from '@/context/AppContext';

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
