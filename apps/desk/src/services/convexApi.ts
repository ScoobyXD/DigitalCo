import { ConvexHttpClient } from "convex/browser";
import type { Item, InventoryEvent, Settings } from "../types/inventory";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string;

if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is required");
}

const client = new ConvexHttpClient(convexUrl);

const fn = (name: string) => name as never;

export const convexApi = {
  initSettings: async () => client.mutation(fn("inventory:initSettings"), {}),
  getSettings: async () => client.query(fn("inventory:getSettings"), {}) as Promise<Settings>,
  setSettings: async (input: Settings) => client.mutation(fn("inventory:setSettings"), input),
  listItems: async () => client.query(fn("inventory:listItems"), {}) as Promise<Item[]>,
  listEvents: async (limit = 200) => client.query(fn("inventory:listEvents"), { limit }) as Promise<InventoryEvent[]>,
  upsertItemsFromExcel: async (rows: Item[]) => client.mutation(fn("inventory:upsertItemsFromExcel"), { rows }),
  adjustQty: async (sku: string, delta: number, kind: "sale" | "restock", note?: string) =>
    client.mutation(fn("inventory:adjustQty"), { sku, delta, kind, note }),
  createEvent: async (sku: string, kind: "warning" | "empty", delta: number, note?: string) =>
    client.mutation(fn("inventory:createEvent"), { sku, kind, delta, note })
};
