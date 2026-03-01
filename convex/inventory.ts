import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const defaultSettings = {
  criticalLevel: 5,
  reportEverySec: 60
};

export const initSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("settings").first();
    if (!existing) {
      await ctx.db.insert("settings", defaultSettings);
    }
    return (await ctx.db.query("settings").first()) ?? defaultSettings;
  }
});

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("settings").first()) ?? defaultSettings;
  }
});

export const setSettings = mutation({
  args: {
    criticalLevel: v.number(),
    reportEverySec: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, args);
      return { ...existing, ...args };
    }
    const id = await ctx.db.insert("settings", args);
    return await ctx.db.get(id);
  }
});

export const upsertItemsFromExcel = mutation({
  args: {
    rows: v.array(
      v.object({
        sku: v.string(),
        name: v.string(),
        qty: v.number(),
        unitCost: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const skus = new Set<string>();
    for (const row of args.rows) {
      skus.add(row.sku);
      const existing = await ctx.db.query("items").withIndex("by_sku", (q) => q.eq("sku", row.sku)).first();
      if (existing) {
        await ctx.db.patch(existing._id, { ...row, updatedAt: now });
      } else {
        await ctx.db.insert("items", { ...row, updatedAt: now });
      }
    }
    return { imported: skus.size };
  }
});

export const listItems = query({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    return items.sort((a, b) => a.sku.localeCompare(b.sku));
  }
});

export const listEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const events = await ctx.db.query("events").withIndex("by_at").order("desc").take(args.limit ?? 200);
    return events;
  }
});

export const adjustQty = mutation({
  args: {
    sku: v.string(),
    delta: v.number(),
    kind: v.union(v.literal("sale"), v.literal("restock")),
    note: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.query("items").withIndex("by_sku", (q) => q.eq("sku", args.sku)).first();
    if (!item) throw new Error(`Item not found for sku ${args.sku}`);
    const nextQty = Math.max(0, item.qty + args.delta);
    await ctx.db.patch(item._id, { qty: nextQty, updatedAt: Date.now() });
    await ctx.db.insert("events", {
      sku: args.sku,
      kind: args.kind,
      delta: args.delta,
      at: Date.now(),
      note: args.note
    });
    return { ...item, qty: nextQty };
  }
});

export const createEvent = mutation({
  args: {
    sku: v.string(),
    kind: v.union(v.literal("warning"), v.literal("empty")),
    delta: v.number(),
    note: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      ...args,
      at: Date.now()
    });
    return true;
  }
});

export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    const items = await ctx.db.query("items").collect();

    const salesBySku = new Map<string, number>();
    let totalSalesUnits = 0;
    let stockouts = 0;

    for (const event of events) {
      if (event.kind === "sale") {
        const units = Math.abs(event.delta);
        totalSalesUnits += units;
        salesBySku.set(event.sku, (salesBySku.get(event.sku) ?? 0) + units);
      }
      if (event.kind === "empty") {
        stockouts += 1;
      }
    }

    const ranked = [...salesBySku.entries()]
      .map(([sku, sold]) => ({ sku, sold }))
      .sort((a, b) => b.sold - a.sold);

    const topSelling = ranked.slice(0, 5);
    const stagnant = items
      .map((item) => ({ sku: item.sku, name: item.name, sold: salesBySku.get(item.sku) ?? 0 }))
      .sort((a, b) => a.sold - b.sold)
      .slice(0, 5);

    const avgInventoryLevel = items.length === 0 ? 0 : items.reduce((acc, item) => acc + item.qty, 0) / items.length;

    return {
      topSelling,
      stagnant,
      kpis: {
        totalSalesUnits,
        stockouts,
        avgInventoryLevel
      }
    };
  }
});
