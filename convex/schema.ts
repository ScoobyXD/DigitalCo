import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  items: defineTable({
    sku: v.string(),
    name: v.string(),
    qty: v.number(),
    unitCost: v.number(),
    updatedAt: v.number()
  }).index("by_sku", ["sku"]),
  events: defineTable({
    sku: v.string(),
    kind: v.union(v.literal("sale"), v.literal("restock"), v.literal("warning"), v.literal("empty")),
    delta: v.number(),
    at: v.number(),
    note: v.optional(v.string())
  }).index("by_at", ["at"]),
  settings: defineTable({
    criticalLevel: v.number(),
    reportEverySec: v.number()
  })
});
