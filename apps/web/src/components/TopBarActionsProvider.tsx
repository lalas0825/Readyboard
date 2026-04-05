'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

type SetActionsCallback = (actions: ReactNode) => void;

const TopBarActionsCtx = createContext<{
  actions: ReactNode;
  setActions: SetActionsCallback;
}>({
  actions: null,
  setActions: () => {},
});

export function TopBarActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);

  const setActions = useCallback((node: ReactNode) => {
    setActionsState(node);
  }, []);

  return (
    <TopBarActionsCtx.Provider value={{ actions, setActions }}>
      {children}
    </TopBarActionsCtx.Provider>
  );
}

/** Slot rendered inside the top bar — outputs whatever the current page injected */
export function TopBarActionsSlot() {
  const { actions } = useContext(TopBarActionsCtx);
  return <>{actions}</>;
}

/** Hook for pages/components to inject action buttons into the top bar */
export function useTopBarActions() {
  return useContext(TopBarActionsCtx).setActions;
}
