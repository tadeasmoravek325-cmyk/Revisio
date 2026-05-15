# Revisio

A mobile-first Next.js MVP for tracking preparation for final exams.

## Features

- Dashboard with daily progress, weekly study time, subject progress, and focus queue
- Question bank with subject/status filters and confidence tracking
- Calendar view for upcoming sessions and exam dates
- Pomodoro timer that logs completed focus sessions
- Reports page with study totals and progress breakdowns
- MVP persistence with `localStorage`

## Project Structure

- `app/` contains the Next.js route files.
- `components/layout/` contains app-level layout/navigation components.
- `components/study/` contains study-tracker feature components.
- `components/ui/` contains reusable presentation components.
- `hooks/` contains React state hooks such as `useStudyStore`.
- `types/` contains TypeScript entity types.
- `data/` contains seed data and display labels.
- `utils/` contains pure helper functions.
- `services/` contains persistence boundaries, currently localStorage-backed and shaped so a future Supabase repository can replace it.
- `lib/` contains app-level constants and configuration helpers.

## Run Locally

Install dependencies, then start the development server:

```bash
npm install
npm run dev
```

Or, with pnpm:

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.
