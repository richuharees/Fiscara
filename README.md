# Fiscara

Fiscara is a calm, privacy-minded personal finance workspace for accounts,
transactions, monthly budgets, planned income, savings, and financial insights.

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it once.
3. Copy `.env.example` to `.env.local`.
4. Add the project URL and publishable key.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

## Local development

```bash
npm install
npm run dev
```

## Vercel

Import this repository as a Next.js project and add the same two environment
variables under Project Settings → Environment Variables. No secret or
service-role key is required by the app.
