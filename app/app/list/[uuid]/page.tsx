import { GroceryListClient } from "@features/grocery_list/components/GroceryListClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function ListPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Grocery List</h1>
      <GroceryListClient uuid={uuid} apiUrl={API_URL} />
      {/* ShareLink — ticket #8 */}
    </main>
  );
}
