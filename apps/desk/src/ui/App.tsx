import { useEffect, useMemo, useState } from "react";
import { convexApi } from "../services/convexApi";
import { ensureSampleExcel, readItemsFromExcel, writeItemsToExcel } from "../services/excel";
import { generateReport } from "../services/report";
import { DEFAULT_EXCEL_PATH, REPORTS_DIR } from "../lib/constants";
import { getRecommendation } from "../lib/recommendation";
import type { Item, InventoryEvent, Recommendation, Settings } from "../types/inventory";
import "./styles.css";

const defaultSettings: Settings = { criticalLevel: 5, reportEverySec: 60 };

export const App = () => {
  const [excelPath, setExcelPath] = useState(DEFAULT_EXCEL_PATH);
  const [items, setItems] = useState<Item[]>([]);
  const [events, setEvents] = useState<InventoryEvent[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [running, setRunning] = useState(false);
  const [tickRateSec, setTickRateSec] = useState(2);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [status, setStatus] = useState("idle");

  const refresh = async () => {
    const [nextItems, nextEvents, nextSettings] = await Promise.all([
      convexApi.listItems(),
      convexApi.listEvents(),
      convexApi.getSettings()
    ]);
    setItems(nextItems);
    setEvents(nextEvents);
    setSettings(nextSettings);
  };

  useEffect(() => {
    (async () => {
      await convexApi.initSettings();
      await ensureSampleExcel(excelPath);
      await refresh();
    })().catch((err: Error) => setStatus(err.message));
  }, [excelPath]);

  const runTriggerChecks = async (nextItems: Item[]) => {
    const newRecs: Recommendation[] = [];
    for (const item of nextItems) {
      if (item.qty <= settings.criticalLevel && item.qty >= 0) {
        const recommendation = getRecommendation(item, settings);
        if (item.qty === 0) {
          await convexApi.createEvent(item.sku, "empty", 0, `Buy ${recommendation.recommendedBuyQty} @ ${recommendation.expectedCost}`);
          newRecs.push({ ...recommendation, reason: "empty" });
        } else if (item.qty > 0) {
          await convexApi.createEvent(item.sku, "warning", 0, `Buy ${recommendation.recommendedBuyQty} @ ${recommendation.expectedCost}`);
          newRecs.push({ ...recommendation, reason: "warning" });
        }
      }
    }
    if (newRecs.length) {
      setRecs((prev) => [...newRecs, ...prev].slice(0, 30));
    }
  };

  const importExcel = async () => {
    setStatus("importing...");
    const rows = await readItemsFromExcel(excelPath);
    await convexApi.upsertItemsFromExcel(rows);
    await refresh();
    setStatus(`imported ${rows.length} rows`);
  };

  const exportExcel = async () => {
    setStatus("exporting...");
    await writeItemsToExcel(excelPath, items);
    setStatus("excel updated");
  };

  const changeQty = async (sku: string, delta: number, kind: "sale" | "restock") => {
    await convexApi.adjustQty(sku, delta, kind);
    const nextItems = await convexApi.listItems();
    setItems(nextItems);
    await runTriggerChecks(nextItems);
    setEvents(await convexApi.listEvents());
  };

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(async () => {
      const next = [...items];
      const count = Math.floor(Math.random() * 4);
      for (let i = 0; i < count; i += 1) {
        const pick = next[Math.floor(Math.random() * next.length)];
        if (!pick) continue;
        const saleQty = 1 + Math.floor(Math.random() * 3);
        await convexApi.adjustQty(pick.sku, -saleQty, "sale", "simulation sale");
      }
      const fresh = await convexApi.listItems();
      setItems(fresh);
      await runTriggerChecks(fresh);
      setEvents(await convexApi.listEvents());
    }, tickRateSec * 1000);

    return () => clearInterval(timer);
  }, [running, tickRateSec, items]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const now = Date.now();
      const filePath = `${REPORTS_DIR}/report-${new Date(now).toISOString().replace(/[:.]/g, "-")}.pptx`;
      await generateReport({
        filePath,
        reportsDir: REPORTS_DIR,
        items,
        events,
        from: now - settings.reportEverySec * 1000,
        to: now
      });
    }, settings.reportEverySec * 1000);

    return () => clearInterval(timer);
  }, [items, events, settings.reportEverySec]);

  const generateNow = async () => {
    const now = Date.now();
    const filePath = `${REPORTS_DIR}/report-${new Date(now).toISOString().replace(/[:.]/g, "-")}.pptx`;
    await generateReport({
      filePath,
      reportsDir: REPORTS_DIR,
      items,
      events,
      from: now - settings.reportEverySec * 1000,
      to: now
    });
    setStatus(`report written: ${filePath}`);
  };

  const approve = async (rec: Recommendation) => {
    await convexApi.adjustQty(rec.sku, rec.recommendedBuyQty, "restock", "approved recommendation");
    const nextItems = await convexApi.listItems();
    setItems(nextItems);
    await writeItemsToExcel(excelPath, nextItems);
    setRecs((prev) => prev.filter((r) => !(r.sku === rec.sku && r.reason === rec.reason)));
    setEvents(await convexApi.listEvents());
  };

  const salesTotal = useMemo(
    () => events.filter((e) => e.kind === "sale").reduce((acc, e) => acc + Math.abs(e.delta), 0),
    [events]
  );

  return (
    <div className="page">
      <h1>Inventory Simulation Desktop</h1>
      <div className="toolbar">
        <input value={excelPath} onChange={(e) => setExcelPath(e.target.value)} style={{ width: 360 }} />
        <button onClick={importExcel}>Import Excel → Convex</button>
        <button onClick={exportExcel}>Export Convex → Excel</button>
        <button onClick={generateNow}>Generate report now</button>
      </div>
      <div className="toolbar">
        <button onClick={() => setRunning((v) => !v)}>{running ? "Stop" : "Start"} simulation</button>
        <label>
          Tick rate (sec)
          <input type="number" min={1} max={5} value={tickRateSec} onChange={(e) => setTickRateSec(Number(e.target.value))} />
        </label>
        <label>
          Critical level
          <input
            type="number"
            value={settings.criticalLevel}
            onChange={async (e) => {
              const next = { ...settings, criticalLevel: Number(e.target.value) };
              setSettings(next);
              await convexApi.setSettings(next);
            }}
          />
        </label>
        <label>
          Auto report every (sec)
          <input
            type="number"
            value={settings.reportEverySec}
            onChange={async (e) => {
              const next = { ...settings, reportEverySec: Number(e.target.value) };
              setSettings(next);
              await convexApi.setSettings(next);
            }}
          />
        </label>
      </div>
      <p>Status: {status}</p>
      <p>Sales units: {salesTotal}</p>

      <div className="grid">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Name</th>
              <th>Qty</th>
              <th>Unit Cost</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.sku}>
                <td>{item.sku}</td>
                <td>{item.name}</td>
                <td>{item.qty}</td>
                <td>{item.unitCost}</td>
                <td>
                  <button onClick={() => changeQty(item.sku, -1, "sale")}>-1 sale</button>
                  <button onClick={() => changeQty(item.sku, 1, "restock")}>+1 restock</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div>
          <h3>Recommendations</h3>
          {recs.map((rec, idx) => (
            <div key={`${rec.sku}-${idx}`} className="card">
              <strong>{rec.reason.toUpperCase()}</strong> {rec.sku} ({rec.name}) qty={rec.currentQty}
              <div>
                Buy {rec.recommendedBuyQty} | Est. Cost ${rec.expectedCost}
                <button onClick={() => approve(rec)}>Approve purchase</button>
              </div>
            </div>
          ))}
          {!recs.length && <p>No active recommendations</p>}

          <h3>Recent events</h3>
          <div className="events">
            {events.slice(0, 20).map((evt) => (
              <div key={evt._id ?? `${evt.sku}-${evt.at}`}>
                {new Date(evt.at).toLocaleTimeString()} {evt.sku} {evt.kind} {evt.delta} {evt.note ?? ""}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
