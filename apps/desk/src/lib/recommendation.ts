import type { Item, Recommendation, Settings } from "../types/inventory";

export const getRecommendation = (item: Item, settings: Settings): Recommendation => {
  const recommendedBuyQty = Math.max(10, 2 * settings.criticalLevel);
  return {
    sku: item.sku,
    name: item.name,
    currentQty: item.qty,
    recommendedBuyQty,
    expectedCost: Number((recommendedBuyQty * item.unitCost).toFixed(2)),
    reason: item.qty === 0 ? "empty" : "warning"
  };
};
