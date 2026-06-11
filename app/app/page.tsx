"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const LIST_UUID_KEY = "grocery_list_uuid";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const existing = localStorage.getItem(LIST_UUID_KEY);
    if (existing) {
      router.replace(`/list/${existing}`);
      return;
    }
    fetch(`${API_URL}/lists`, { method: "POST" })
      .then((r) => r.json())
      .then((data: { uuid: string }) => {
        localStorage.setItem(LIST_UUID_KEY, data.uuid);
        router.replace(`/list/${data.uuid}`);
      });
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Loading your list…</p>
    </div>
  );
}
