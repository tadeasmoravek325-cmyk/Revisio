# Revisio Supabase migration

1. In Supabase SQL editor, run `supabase/profiles.sql` if it has not been applied yet.
2. Run `supabase/20260516_cloud_study_data.sql`.
3. Confirm these environment variables exist on Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Redeploy the app.
5. On first login, Revisio loads cloud data. If the cloud account is empty and this browser has old local Revisio data, the app uploads that local data once into Supabase.

Local JSON export/import remains available for manual backups. Supabase becomes the source of truth after this migration.
