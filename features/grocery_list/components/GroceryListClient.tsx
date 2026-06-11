"use client";

import { useCallback, useState } from "react";
import { ItemInput } from "./ItemInput";

interface Props {
  uuid: string;
  apiUrl: string;
}

export function GroceryListClient({ uuid, apiUrl }: Props) {
  // refresh counter — incremented after each mutation so child components
  // can re-fetch without a full page reload (ItemList wired in #6, polling in #7)
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k: number) => k + 1), []);

  return (
    <div>
      <ItemInput listUuid={uuid} apiUrl={apiUrl} onItemAdded={refresh} />
      {/* ItemList — ticket #6 (refreshKey={refreshKey}) */}
    </div>
  );
}
