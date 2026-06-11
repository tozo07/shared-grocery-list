"use client";

import { useCallback, useState } from "react";
import { ItemInput } from "./ItemInput";
import { ItemList } from "./ItemList";

interface Props {
  uuid: string;
  apiUrl: string;
}

interface OptimisticItem {
  id: number; // negative for optimistic items
  name: string;
  checked: boolean;
}

export function GroceryListClient({ uuid, apiUrl }: Props) {
  // refresh counter — incremented after each mutation so child components
  // can re-fetch without a full page reload (ItemList wired in #6, polling in #7)
  const [refreshKey, setRefreshKey] = useState(0);

  // Optimistic items — items added locally before the poll confirms
  const [optimisticItems, setOptimisticItems] = useState<OptimisticItem[]>([]);

  const handleItemAdded = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Pass through callbacks for optimistic updates
  const addOptimisticItem = useCallback((name: string) => {
    const optimisticId = Date.now() * -1; // negative ID for optimistic items
    setOptimisticItems((prev) => [...prev, { id: optimisticId, name, checked: false }]);
  }, []);

  const removeOptimisticItem = useCallback((name: string) => {
    setOptimisticItems((prev) => prev.filter((i) => i.name !== name));
  }, []);

  return (
    <div>
      <ItemInput
        listUuid={uuid}
        apiUrl={apiUrl}
        onItemAdded={handleItemAdded}
        onAddOptimisticItem={addOptimisticItem}
        onRemoveOptimisticItem={removeOptimisticItem}
      />
      <ItemList
        listUuid={uuid}
        apiUrl={apiUrl}
        refreshKey={refreshKey}
        optimisticItems={optimisticItems}
        setOptimisticItems={setOptimisticItems}
      />
    </div>
  );
}
