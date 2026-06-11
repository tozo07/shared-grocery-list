"use client";

import { useCallback, useEffect, useState } from "react";

interface Item {
  id: number;
  name: string;
  checked: boolean;
}

interface OptimisticItem {
  id: number; // negative for optimistic items
  name: string;
  checked: boolean;
}

interface Props {
  listUuid: string;
  apiUrl: string;
  refreshKey: number;
  optimisticItems?: OptimisticItem[];
  setOptimisticItems?: (items: OptimisticItem[]) => void;
}

export function ItemList({ listUuid, apiUrl, refreshKey, optimisticItems = [], setOptimisticItems }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [toggling, setToggling] = useState<Set<number>>(new Set());
  const [clearing, setClearing] = useState(false);

  // Fetch function - reused by both refreshKey trigger and polling loop
  const fetchItems = useCallback(() => {
    fetch(`${apiUrl}/lists/${listUuid}`)
      .then((r) => r.json())
      .then((data: { items: Item[] }) => {
        const serverItems = data.items || [];

        setItems((prevItems) => {
          const togglingIds = Array.from(toggling);

          // If nothing is being toggled and no optimistic adds pending, just use server state
          if (togglingIds.length === 0 && optimisticItems.length === 0) {
            return serverItems;
          }

          // Build a map of server items by name for reconciliation
          const serverItemsByName = new Map(serverItems.map((i) => [i.name.toLowerCase(), i]));
          const result: Item[] = [];

          // First, add all server items
          for (const serverItem of serverItems) {
            // If this item is being toggled, preserve optimistic checked state
            if (togglingIds.includes(serverItem.id)) {
              const localItem = prevItems.find((i) => i.id === serverItem.id);
              if (localItem) {
                result.push({ ...serverItem, checked: localItem.checked });
                continue;
              }
            }
            result.push(serverItem);
          }

          // Then, add optimistic items that haven't been confirmed by server yet
          for (const optItem of optimisticItems) {
            const alreadyConfirmed = serverItemsByName.has(optItem.name.toLowerCase());
            if (!alreadyConfirmed) {
              result.push({
                id: optItem.id,
                name: optItem.name,
                checked: optItem.checked,
              });
            }
          }

          // Sort by id (negative/optimistic first, then by server order)
          result.sort((a, b) => {
            if (a.id < 0 && b.id >= 0) return -1;
            if (a.id >= 0 && b.id < 0) return 1;
            return b.id - a.id;
          });

          return result;
        });

        // Clear optimistic items that have been confirmed by the server
        if (optimisticItems.length > 0 && setOptimisticItems) {
          const serverItemsByName = new Map(serverItems.map((i) => [i.name.toLowerCase(), i]));
          const stillPending = optimisticItems.filter((opt) => !serverItemsByName.has(opt.name.toLowerCase()));
          if (stillPending.length !== optimisticItems.length) {
            setOptimisticItems(stillPending);
          }
        }
      })
      .catch(() => {});
  }, [apiUrl, listUuid, toggling, optimisticItems, setOptimisticItems]);

  // Fetch on mount and when refreshKey changes (e.g., after adding an item)
  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshKey]);

  // Polling loop - fetch every 5 seconds to stay in sync with other users
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchItems();
    }, 5000);

    return () => clearInterval(intervalId);
  }, [fetchItems]);

  async function toggle(id: number) {
    if (toggling.has(id)) return;
    setToggling((prev) => new Set(prev).add(id));
    // Optimistic update
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
    try {
      const res = await fetch(`${apiUrl}/lists/${listUuid}/items/${id}`, { method: "PATCH" });
      if (res.ok) {
        const updated: Item = await res.json();
        setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      } else {
        // Revert on failure
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
        );
      }
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
      );
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function clearChecked() {
    if (clearing) return;
    setClearing(true);
    try {
      const res = await fetch(`${apiUrl}/lists/${listUuid}/items/checked`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => !item.checked));
      }
    } catch {
      // leave list unchanged on failure
    } finally {
      setClearing(false);
    }
  }

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <div className="mt-6">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">
          Grocery List{" "}
          {items.length > 0 && (
            <span className="ml-1.5 text-sm font-normal text-green-600">
              {items.length} {items.length === 1 ? "item" : "items"}
            </span>
          )}
        </h2>
        {checkedCount > 0 && (
          <button
            onClick={clearChecked}
            disabled={clearing}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-red-600 disabled:opacity-40"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m3-4h4a1 1 0 011 1v1H9V4a1 1 0 011-1z" />
            </svg>
            Clear checked
          </button>
        )}
      </div>

      {/* List */}
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          Your list is empty — add something above.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => toggle(item.id)}
                disabled={toggling.has(item.id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 disabled:opacity-60"
              >
                {/* Checkbox */}
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    item.checked
                      ? "border-green-600 bg-green-600"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {item.checked && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>

                {/* Name */}
                <span
                  className={`flex-1 text-sm transition-colors ${
                    item.checked ? "text-gray-400 line-through" : "text-gray-800"
                  }`}
                >
                  {item.name}
                </span>

                {/* Drag handle */}
                <span className="text-gray-300">
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 6h8M8 12h8M8 18h8" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
