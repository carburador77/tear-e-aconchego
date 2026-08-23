'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { addSelectionItem, changeSelectionQuantity, deleteSelectionItem, parseStoredSelection, SELECTION_STORAGE_KEY } from '@/lib/selection';
import type { SelectionItem } from '@/types/selection';

type SelectionContextValue = {
  items: SelectionItem[];
  hydrated: boolean;
  lineCount: number;
  addItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  clearSelection: () => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export default function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SelectionItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let storedSelection: SelectionItem[] = [];
    try {
      storedSelection = parseStoredSelection(window.localStorage.getItem(SELECTION_STORAGE_KEY));
    } catch {
      storedSelection = [];
    }
    // A leitura precisa acontecer após a montagem para manter o HTML do servidor estável.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(storedSelection);
    setHydrated(true);
    const syncSelection = (event: StorageEvent) => {
      if (event.key === SELECTION_STORAGE_KEY || event.key === null) setItems(parseStoredSelection(event.newValue));
    };
    window.addEventListener('storage', syncSelection);
    return () => window.removeEventListener('storage', syncSelection);
  }, []);

  const commit = useCallback((update: (current: SelectionItem[]) => SelectionItem[]) => {
    setItems((current) => {
      const next = update(current);
      try {
        window.localStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // A seleção continua utilizável durante a sessão mesmo se o navegador bloquear o armazenamento.
      }
      return next;
    });
  }, []);

  const addItem = useCallback((productId: string, variantId: string | null = null) => {
    commit((current) => addSelectionItem(current, productId, variantId));
  }, [commit]);

  const updateQuantity = useCallback((productId: string, variantId: string | null, quantity: number) => {
    commit((current) => changeSelectionQuantity(current, productId, variantId, quantity));
  }, [commit]);

  const removeItem = useCallback((productId: string, variantId: string | null = null) => {
    commit((current) => deleteSelectionItem(current, productId, variantId));
  }, [commit]);

  const clearSelection = useCallback(() => commit(() => []), [commit]);
  const value = useMemo<SelectionContextValue>(() => ({ items, hydrated, lineCount: items.length, addItem, updateQuantity, removeItem, clearSelection }), [addItem, clearSelection, hydrated, items, removeItem, updateQuantity]);
  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection() {
  const value = useContext(SelectionContext);
  if (!value) throw new Error('useSelection precisa estar dentro de SelectionProvider.');
  return value;
}
