"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Props {
  listUuid: string;
  apiUrl: string;
  onItemAdded: () => void;
  onAddOptimisticItem?: (name: string) => void;
  onRemoveOptimisticItem?: (name: string) => void;
}

export function ItemInput({ listUuid, apiUrl, onItemAdded, onAddOptimisticItem, onRemoveOptimisticItem }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Fetch full history once per focus/add cycle; filter locally per keystroke.
  const fetchHistory = useCallback(() => {
    fetch(`${apiUrl}/lists/${listUuid}/history`)
      .then((r) => r.json())
      .then((data: { names: string[] }) => setHistory(data.names))
      .catch(() => setHistory([]));
  }, [apiUrl, listUuid]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const suggestions = value.length >= 1
    ? history.filter((n) => n.toLowerCase().includes(value.toLowerCase()))
    : [];

  useEffect(() => {
    setShowDropdown(suggestions.length > 0);
  }, [suggestions.length]);

  // Close dropdown on outside click.
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const [error, setError] = useState<string | null>(null);

  async function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);

    // Optimistic add - show the item immediately
    onAddOptimisticItem?.(trimmed);

    try {
      const res = await fetch(`${apiUrl}/lists/${listUuid}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setError("Failed to add item. Please try again.");
        // Remove from optimistic list on failure
        onRemoveOptimisticItem?.(trimmed);
        return;
      }
      setValue("");
      setShowDropdown(false);
      onItemAdded(); // This triggers refreshKey which will fetch and confirm the item
      fetchHistory();
    } catch {
      setError("Failed to add item. Please try again.");
      // Remove from optimistic list on failure
      onRemoveOptimisticItem?.(trimmed);
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  function clear() {
    setValue("");
    setShowDropdown(false);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(e) => { e.preventDefault(); submit(value); }}
        className="flex gap-2"
      >
        {/* Input with inline clear button */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
            placeholder="Add an item…"
            disabled={submitting}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 pr-9 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:opacity-50"
          />
          {value && (
            <button
              type="button"
              onClick={clear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-lg leading-none text-gray-400 hover:text-gray-600"
              aria-label="Clear"
            >
              ×
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={!value.trim() || submitting}
          className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      {/* Custom autocomplete dropdown */}
      {showDropdown && (
        <ul className="absolute left-0 z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                // mousedown fires before the input's blur so the click registers
                onMouseDown={(e) => { e.preventDefault(); submit(s); }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-base">
                  🛒
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-gray-900">{s}</span>
                  <span className="text-xs text-gray-400">From your history</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
