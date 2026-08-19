# Accademia Musicale — Registro Appuntamenti

App di gestione appuntamenti, pubblicata su [registro.battiesenti.com](https://registro.battiesenti.com) (dominio personalizzato via file `public/CNAME`).

## Stack

- **React 19 + TypeScript + Vite** — build statica, deploy su GitHub Pages
- **Tailwind CSS v4** — styling
- **TanStack React Query** — fetching, cache e invalidazione dati
- **React Router** — routing e protezione rotte per ruolo (admin/teacher/student)
- **FullCalendar (React)** — vista calendario
- **Supabase** — auth, database, RPC (stesso progetto dell'app precedente)
- **SheetJS (xlsx)** — export Excel del riepilogo lezioni

## Sviluppo locale

```bash
npm install
npm run dev
```

Richiede un file `.env` con:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

(vedi `.env.example`)

## Build

```bash
npm run build
```

Output statico in `dist/`.

## Deploy

Il workflow `.github/workflows/deploy.yml` builda e pubblica automaticamente su GitHub Pages a ogni push su `main`.

**Prima del primo deploy**, nelle impostazioni del repository (Settings → Pages) impostare "Source" su **GitHub Actions**.

## Struttura

```
src/
  components/   Componenti condivisi (layout, modali)
  contexts/     AuthContext
  hooks/        Hook React Query per dati Supabase
  lib/          Client Supabase, tipi, utility
  pages/        Una pagina per vista (Calendario, Note, Admin, Riepilogo)
```
