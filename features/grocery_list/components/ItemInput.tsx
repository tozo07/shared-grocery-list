"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  listUuid: string;
  apiUrl: string;
  onItemAdded: () => void;
}

export function ItemInput({ listUuid, apiUrl, onItemAdded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (value.length < 1) {
      setSuggestions([]);
      return;
    }
    fetch(`${apiUrl}/lists/${listUuid}/history`)
      .then((r) => r.json())
      .then((data: { names: string[] }) => setSuggestions(data.names))
      .catch(() => setSuggestions([]));
  }, [value, listUuid, apiUrl]);

  async function submit(name: string) {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`${apiUrl}/lists/${listUuid}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      setValue("");
      setSuggestions([]);
      onItemAdded();
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
      className="flex gap-2"
    >
      <input
        ref={inputRef}
        list="item-suggestions"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add an item…"
        disabled={submitting}
        className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
      />
      <datalist id="item-suggestions">
        {suggestions.map((s: string) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button
        type="submit"
        disabled={!value.trim() || submitting}
        className="rounded bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-40"
      >
        Add
      </button>
    </form>
  );
}
