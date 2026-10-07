// Beyond Supabase client
// Replace these two values with your Supabase project's public URL and publishable/anon key.
// Never put a Supabase service_role/secret key in browser code.

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY";

if (
  SUPABASE_URL === "YOUR_SUPABASE_URL" ||
  SUPABASE_ANON_KEY === "YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY"
) {
  console.warn("Beyond: Add your Supabase URL and publishable/anon key in supabase.js.");
}

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
