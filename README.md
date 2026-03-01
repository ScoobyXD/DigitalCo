# DigitalCo Inventory Simulation (Phase 1 MVP)

Enterprise-ready desktop inventory simulator built with **Tauri + Vite + React + TypeScript**, **Convex**, **xlsx (SheetJS)**, and **pptxgenjs**.

## Structure

- `apps/desk` – Tauri desktop app with React UI, simulation engine, Excel I/O, and PPTX report generation.
- `convex` – backend schema + mutations/queries for items, events, and settings.
- `data/sample.xlsx` – Excel source of truth file (generated on first run if missing; not committed to git to avoid binary-diff PR blockers).
- `reports/` – auto/manual generated PowerPoint reports.

## Features (MVP)

- Inventory primitives in Convex:
  - `items`: `sku`, `name`, `qty`, `unitCost`, `updatedAt`
  - `events`: `sku`, `kind`, `delta`, `at`, `note`
  - `settings`: `criticalLevel` (default 5), `reportEverySec` (default 60)
- Excel import/export to local file.
- Trigger system:
  - `warning` when `qty <= criticalLevel` and `qty > 0`
  - `empty` when `qty == 0`
  - buy recommendation with approve purchase flow.
- Simulation sandbox:
  - Start/Stop, configurable tick rate, manual `-1 sale` / `+1 restock`.
  - random 0-3 item sales each tick, decrement by 1-3.
- Auto report PPTX every configured interval + "Generate report now".

## Prerequisites

- Node.js 20+
- Rust toolchain (for Tauri)
- Windows WebView2 runtime
- Convex account + project

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variable for desktop app:

Create `apps/desk/.env`:

```env
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
```

3. Start Convex dev backend (from repo root):

```bash
npm run convex:dev
```

4. Run Tauri desktop shell (from root):

```bash
npm run tauri --workspace apps/desk dev
```

> `tauri dev` automatically starts the Vite dev server via `beforeDevCommand`, so you do **not** need to run `npm run dev:desk` in another terminal.

## Build EXE (Windows)

```bash
npm run tauri --workspace apps/desk build
```

The executable/installer will be under `apps/desk/src-tauri/target/release/bundle`.

## Windows exact command sequence

```powershell
cd C:\path\to\DigitalCo
npm install
@"
VITE_CONVEX_URL=https://<your-convex-deployment>.convex.cloud
"@ | Set-Content apps/desk/.env
npm run convex:dev
# new terminal
cd C:\path\to\DigitalCo
npm run tauri --workspace apps/desk dev
```

## Excel source file

- Default path used by app: `data/sample.xlsx` (referenced as `../../../data/sample.xlsx` from Tauri runtime cwd).
- If missing, the app generates a seeded workbook on first run.
- To change the source file:
  - edit the path in the UI top input, or
  - modify `DEFAULT_EXCEL_PATH` in `apps/desk/src/lib/constants.ts`.

## Notes

- Excel and PPTX writing are performed in desktop app via Tauri commands (local filesystem access).
- Reports are written to `reports/report-<timestamp>.pptx`.
