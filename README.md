# ANCA TGX Studio

Browser app for **cutting tool design**, **TGX job travelers**, and **ToolRoom handoff**.  
Exports human/machine-friendly parameters for ToolRoom / TGX setup — **not** proprietary ANCA TOM / ToolRoom binary files.

> **For ToolRoom / TGX setup — not a TOM file.**  
> **ToolRoom creates the .TOM. This app does not write TOM files. Verify in CIM3D before grinding.**

## Stack

- Vite + React + TypeScript
- Three.js (simplified live 3D tool preview)
- localStorage (no backend / auth)

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

Production build:

```bash
npm run build
npm run preview
```

## Features

### Designer

- Tool types: **solid endmill**, **drill**
- Parameter forms with validation
- Live Three.js preview (approximate geometry — not grind simulation)
- Save / load / delete designs in localStorage
- Export: **JSON**, **CSV**, printable **setup sheet**

### Traveler

- Link to a saved design (or create from Designer)
- Job #, customer/PO, quantity, date
- Blank stock, editable wheel pack, TGX ops checklist
- Optional **ToolRoom TOM filename** (text reference only; persisted with traveler)
- Machine defaults to **ANCA TGX**
- Print traveler / export JSON

### ToolRoom Handoff

Safe path to recreate a studio design in ANCA ToolRoom (which writes the real `.TOM`):

- Field-by-field map: studio params → typical ToolRoom iGrind wizard labels
- Per-row **copy** (and copy-all TSV)
- Printable **handoff sheet** (`window.print`)
- JSON download (`schema: "toolroomHandoff"`, `schemaVersion: 1`)
- Downloadable **script skeleton** at `public/toolroom-script-skeleton.txt` (template only — adapt param IDs to your ToolRoom RN via ANCA docs / Club)

Uses the current Designer form, or load a saved design into the shared draft.

## Safe workflow

```
Studio params
    → ToolRoom (manual iGrind entry OR adapted script skeleton)
    → .TOM created by ToolRoom
    → CIM3D verify
    → TGX grind (confirm software generation with ANCA)
```

1. Design the tool in **Designer** (or load a saved design).
2. Open **ToolRoom Handoff** — copy values or download JSON / print the sheet.
3. Enter params in ToolRoom iGrind (or adapt the script skeleton with your release’s parameter IDs — see ANCA Club samples).
4. Let **ToolRoom** save the `.TOM`.
5. Verify in **CIM3D** before grinding.
6. Optionally note the TOM filename on the **Traveler**.

## Disclaimer

This project does **not** reverse-engineer or write proprietary ANCA TOM/ToolRoom binaries. The script skeleton is **not** production-ready for all RN versions. Use exports as setup references only.
