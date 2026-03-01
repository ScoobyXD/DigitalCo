import * as XLSX from "xlsx";
import type { Item } from "../types/inventory";
import { readBinaryBase64, writeBinaryBase64 } from "./fileBridge";

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
};

const fromBase64 = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const normalizeRow = (row: Record<string, unknown>): Item | null => {
  const sku = String(row.sku ?? "").trim();
  const name = String(row.name ?? "").trim();
  const qty = Number(row.qty ?? 0);
  const unitCost = Number(row.unitCost ?? 0);
  if (!sku || !name) return null;
  return { sku, name, qty, unitCost };
};

export const readItemsFromExcel = async (path: string): Promise<Item[]> => {
  const base64 = await readBinaryBase64(path);
  const workbook = XLSX.read(fromBase64(base64), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: 0 });
  return json.map(normalizeRow).filter((row): row is Item => row !== null);
};

export const writeItemsToExcel = async (path: string, items: Item[]): Promise<void> => {
  const rows = items.map((item) => ({
    sku: item.sku,
    name: item.name,
    qty: item.qty,
    unitCost: item.unitCost
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "inventory");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  await writeBinaryBase64(path, toBase64(out));
};

export const ensureSampleExcel = async (path: string): Promise<void> => {
  try {
    await readBinaryBase64(path);
  } catch {
    await writeItemsToExcel(path, [
      { sku: "SKU-100", name: "Widget A", qty: 14, unitCost: 12.5 },
      { sku: "SKU-200", name: "Widget B", qty: 4, unitCost: 19.75 },
      { sku: "SKU-300", name: "Widget C", qty: 0, unitCost: 8.9 },
      { sku: "SKU-400", name: "Widget D", qty: 20, unitCost: 3.2 }
    ]);
  }
};
