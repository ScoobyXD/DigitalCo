import PptxGenJS from "pptxgenjs";
import type { Item, InventoryEvent } from "../types/inventory";
import { ensureDir, writeBinaryBase64 } from "./fileBridge";

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

export const generateReport = async ({
  filePath,
  reportsDir,
  items,
  events,
  from,
  to
}: {
  filePath: string;
  reportsDir: string;
  items: Item[];
  events: InventoryEvent[];
  from: number;
  to: number;
}) => {
  const salesBySku = new Map<string, number>();
  let totalSalesUnits = 0;
  let stockouts = 0;

  events.forEach((evt) => {
    if (evt.kind === "sale") {
      const units = Math.abs(evt.delta);
      totalSalesUnits += units;
      salesBySku.set(evt.sku, (salesBySku.get(evt.sku) ?? 0) + units);
    }
    if (evt.kind === "empty") stockouts += 1;
  });

  const ranked = [...salesBySku.entries()].sort((a, b) => b[1] - a[1]);
  const top5 = ranked.slice(0, 5);
  const stagnant = items
    .map((item) => ({ sku: item.sku, sold: salesBySku.get(item.sku) ?? 0 }))
    .sort((a, b) => a.sold - b.sold)
    .slice(0, 5);
  const avgInventory = items.length ? items.reduce((acc, i) => acc + i.qty, 0) / items.length : 0;

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";

  const s1 = pptx.addSlide();
  s1.addText("Inventory Simulation Report", { x: 0.5, y: 0.7, w: 12, h: 0.8, bold: true, fontSize: 28 });
  s1.addText(`Range: ${new Date(from).toLocaleString()} - ${new Date(to).toLocaleString()}`, {
    x: 0.5,
    y: 1.8,
    w: 12,
    h: 0.5,
    fontSize: 16
  });

  const s2 = pptx.addSlide();
  s2.addText("Top 5 best-selling SKUs", { x: 0.5, y: 0.5, w: 12, h: 0.6, bold: true, fontSize: 22 });
  s2.addText(top5.map((t, i) => `${i + 1}. ${t[0]} - ${t[1]} units`).join("\n") || "No sales events yet", {
    x: 0.8,
    y: 1.3,
    w: 11,
    h: 4,
    fontSize: 16
  });

  const s3 = pptx.addSlide();
  s3.addText("Worst-selling / stagnant items", { x: 0.5, y: 0.5, w: 12, h: 0.6, bold: true, fontSize: 22 });
  s3.addText(stagnant.map((t, i) => `${i + 1}. ${t.sku} - ${t.sold} units sold`).join("\n") || "No items", {
    x: 0.8,
    y: 1.3,
    w: 11,
    h: 4,
    fontSize: 16
  });

  const s4 = pptx.addSlide();
  s4.addText("KPI Snapshot", { x: 0.5, y: 0.5, w: 12, h: 0.6, bold: true, fontSize: 22 });
  s4.addText(
    `Total sales units: ${totalSalesUnits}\nStockouts count: ${stockouts}\nAverage inventory level: ${avgInventory.toFixed(2)}`,
    { x: 0.8, y: 1.3, w: 11, h: 4, fontSize: 18 }
  );

  await ensureDir(reportsDir);
  const out = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  await writeBinaryBase64(filePath, toBase64(out));
};
