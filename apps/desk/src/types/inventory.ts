export type Item = {
  _id?: string;
  sku: string;
  name: string;
  qty: number;
  unitCost: number;
  updatedAt?: number;
};

export type InventoryEvent = {
  _id?: string;
  sku: string;
  kind: "sale" | "restock" | "warning" | "empty";
  delta: number;
  at: number;
  note?: string;
};

export type Settings = {
  criticalLevel: number;
  reportEverySec: number;
};

export type Recommendation = {
  sku: string;
  name: string;
  currentQty: number;
  recommendedBuyQty: number;
  expectedCost: number;
  reason: "warning" | "empty";
};
