import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, beforeEach } from "vitest";
import { ItemList } from "@features/grocery_list/components/ItemList";

const API = "http://localhost:8000";
const UUID = "test-uuid";

const ITEMS = [
  { id: 1, name: "Milk", checked: false },
  { id: 2, name: "Eggs", checked: false },
  { id: 3, name: "Butter", checked: true },
];

function setup(_items = ITEMS, refreshKey = 0) {
  return {
    user: userEvent.setup(),
    ...render(<ItemList listUuid={UUID} apiUrl={API} refreshKey={refreshKey} />),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(global, "fetch").mockImplementation((_url, opts) => {
    const u = String(_url);
    // GET list
    if (!opts || opts.method === undefined || opts.method === "GET") {
      return Promise.resolve(new Response(JSON.stringify({ uuid: UUID, items: ITEMS })));
    }
    // PATCH toggle
    if (opts.method === "PATCH") {
      const id = Number(u.split("/items/")[1]);
      const item = ITEMS.find((i) => i.id === id)!;
      return Promise.resolve(
        new Response(JSON.stringify({ ...item, checked: !item.checked }), { status: 200 })
      );
    }
    // DELETE checked
    if (opts.method === "DELETE") {
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
});

// ---------- rendering ----------

it("renders all items", async () => {
  setup();
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  expect(screen.getByText("Eggs")).toBeInTheDocument();
  expect(screen.getByText("Butter")).toBeInTheDocument();
});

it("renders item count badge", async () => {
  setup();
  await waitFor(() => expect(screen.getByText(/3 items/)).toBeInTheDocument());
});

it("renders checked items with strikethrough class", async () => {
  setup();
  await waitFor(() => expect(screen.getByText("Butter")).toBeInTheDocument());
  expect(screen.getByText("Butter")).toHaveClass("line-through");
});

it("renders unchecked items without strikethrough", async () => {
  setup();
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  expect(screen.getByText("Milk")).not.toHaveClass("line-through");
});

it("shows empty state when no items", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ uuid: UUID, items: [] }))
  );
  setup();
  await waitFor(() =>
    expect(screen.getByText(/your list is empty/i)).toBeInTheDocument()
  );
});

// ---------- toggle ----------

it("toggling an item calls PATCH and updates the UI", async () => {
  const { user } = setup();
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  await user.click(screen.getByText("Milk").closest("button")!);
  await waitFor(() => expect(screen.getByText("Milk")).toHaveClass("line-through"));
});

it("toggling a checked item unchecks it", async () => {
  vi.spyOn(global, "fetch").mockImplementation((_url, opts) => {
    if (!opts?.method || opts.method === "GET") {
      return Promise.resolve(new Response(JSON.stringify({ uuid: UUID, items: ITEMS })));
    }
    if (opts.method === "PATCH") {
      // id=3 (Butter) → toggle to unchecked
      return Promise.resolve(
        new Response(JSON.stringify({ id: 3, name: "Butter", checked: false }), { status: 200 })
      );
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
  const { user } = setup();
  await waitFor(() => expect(screen.getByText("Butter")).toBeInTheDocument());
  await user.click(screen.getByText("Butter").closest("button")!);
  await waitFor(() => expect(screen.getByText("Butter")).not.toHaveClass("line-through"));
});

it("reverts optimistic update when PATCH fails", async () => {
  vi.spyOn(global, "fetch").mockImplementation((_url, opts) => {
    if (!opts?.method || opts.method === "GET") {
      return Promise.resolve(new Response(JSON.stringify({ uuid: UUID, items: ITEMS })));
    }
    return Promise.resolve(new Response(null, { status: 500 }));
  });
  const { user } = setup();
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  await user.click(screen.getByText("Milk").closest("button")!);
  // Optimistic: Milk appears checked briefly, then reverts
  await waitFor(() => expect(screen.getByText("Milk")).not.toHaveClass("line-through"));
});

// ---------- clear checked ----------

it("shows Clear checked button only when checked items exist", async () => {
  setup();
  await waitFor(() => expect(screen.getByText("Butter")).toBeInTheDocument());
  expect(screen.getByRole("button", { name: /clear checked/i })).toBeInTheDocument();
});

it("hides Clear checked button when no items are checked", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ uuid: UUID, items: [{ id: 1, name: "Milk", checked: false }] }))
  );
  setup();
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  expect(screen.queryByRole("button", { name: /clear checked/i })).not.toBeInTheDocument();
});

it("Clear checked removes checked items from the list", async () => {
  const { user } = setup();
  await waitFor(() => expect(screen.getByText("Butter")).toBeInTheDocument());
  await user.click(screen.getByRole("button", { name: /clear checked/i }));
  await waitFor(() => expect(screen.queryByText("Butter")).not.toBeInTheDocument());
  expect(screen.getByText("Milk")).toBeInTheDocument();
});

// ---------- re-fetch on refreshKey change ----------

it("re-fetches when refreshKey changes", async () => {
  const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ uuid: UUID, items: [] }))
  );
  const { rerender } = render(
    <ItemList listUuid={UUID} apiUrl={API} refreshKey={0} />
  );
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1));
  rerender(<ItemList listUuid={UUID} apiUrl={API} refreshKey={1} />);
  await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
});
