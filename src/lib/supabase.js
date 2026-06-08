import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_ANON_KEY in environment variables",
  );
}

// We use the anon key here but RLS is disabled on all tables
// (our backend handles all authorization logic — see blueprint Section 17 point 11)
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
