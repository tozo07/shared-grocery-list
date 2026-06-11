// Main list page — components wired in tickets #5, #6, #7, #8
export default function ListPage({ params }: { params: { uuid: string } }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Grocery List</h1>
      <p className="text-gray-400 text-sm">List UUID: {params.uuid}</p>
      {/* ItemInput — ticket #5 */}
      {/* ItemList  — ticket #6 */}
      {/* ShareLink — ticket #8 */}
    </main>
  );
}
