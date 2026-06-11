import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi, beforeEach } from "vitest";
import { ItemInput } from "@features/grocery_list/components/ItemInput";

const API = "http://localhost:8000";
const UUID = "test-uuid";

function setup(onItemAdded = vi.fn()) {
  return {
    user: userEvent.setup(),
    onItemAdded,
    ...render(<ItemInput listUuid={UUID} apiUrl={API} onItemAdded={onItemAdded} />),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  // Default: empty history, successful POST
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    if (String(url).includes("/history")) {
      return Promise.resolve(new Response(JSON.stringify({ names: [] })));
    }
    return Promise.resolve(new Response(JSON.stringify({ id: 1, name: "Milk" }), { status: 201 }));
  });
});

// ---------- auto-focus ----------

it("auto-focuses the input on mount", () => {
  setup();
  expect(screen.getByPlaceholderText("Add an item…")).toHaveFocus();
});

// ---------- submit ----------

it("submits on Enter and clears the input", async () => {
  const { user, onItemAdded } = setup();
  const input = screen.getByPlaceholderText("Add an item…");
  await user.type(input, "Milk");
  await user.keyboard("{Enter}");
  await waitFor(() => expect(onItemAdded).toHaveBeenCalledOnce());
  expect(input).toHaveValue("");
});

it("submits on Add button click", async () => {
  const { user, onItemAdded } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "Eggs");
  await user.click(screen.getByRole("button", { name: "Add" }));
  await waitFor(() => expect(onItemAdded).toHaveBeenCalledOnce());
});

it("does not submit an empty value", async () => {
  const { user, onItemAdded } = setup();
  await user.keyboard("{Enter}");
  expect(onItemAdded).not.toHaveBeenCalled();
});

it("shows an error and keeps the value when POST fails", async () => {
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    if (String(url).includes("/history")) {
      return Promise.resolve(new Response(JSON.stringify({ names: [] })));
    }
    return Promise.resolve(new Response(null, { status: 500 }));
  });
  const { user } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "Milk");
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(screen.getByText(/failed to add item/i)).toBeInTheDocument()
  );
  expect(screen.getByPlaceholderText("Add an item…")).toHaveValue("Milk");
});

it("shows an error when fetch throws (network failure)", async () => {
  vi.spyOn(global, "fetch").mockImplementation((url) => {
    if (String(url).includes("/history")) {
      return Promise.resolve(new Response(JSON.stringify({ names: [] })));
    }
    return Promise.reject(new Error("network error"));
  });
  const { user } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "Milk");
  await user.keyboard("{Enter}");
  await waitFor(() =>
    expect(screen.getByText(/failed to add item/i)).toBeInTheDocument()
  );
});

// ---------- clear button ----------

it("shows the × button only when input has a value", async () => {
  const { user } = setup();
  expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
  await user.type(screen.getByPlaceholderText("Add an item…"), "x");
  expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
});

it("× clears the input without submitting", async () => {
  const { user, onItemAdded } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "Milk");
  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(screen.getByPlaceholderText("Add an item…")).toHaveValue("");
  expect(onItemAdded).not.toHaveBeenCalled();
});

// ---------- autocomplete dropdown ----------

it("shows dropdown with filtered suggestions after 1 character", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ names: ["Milk", "Mineral water", "Eggs"] }))
  );
  const { user } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "mi");
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  expect(screen.getByText("Mineral water")).toBeInTheDocument();
  expect(screen.queryByText("Eggs")).not.toBeInTheDocument();
});

it("selecting a suggestion submits it and clears the input", async () => {
  vi.spyOn(global, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ names: ["Milk"] }))
  );
  const { user, onItemAdded } = setup();
  await user.type(screen.getByPlaceholderText("Add an item…"), "mi");
  await waitFor(() => expect(screen.getByText("Milk")).toBeInTheDocument());
  await user.click(screen.getByText("Milk"));
  await waitFor(() => expect(onItemAdded).toHaveBeenCalledOnce());
  expect(screen.getByPlaceholderText("Add an item…")).toHaveValue("");
});
