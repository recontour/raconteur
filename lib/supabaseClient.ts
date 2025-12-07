import { createClient } from "@supabase/supabase-js";

// 1. Load the environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 2. Safety Check: Stop the app immediately if keys are missing
// This prevents hours of debugging "why is my database not connecting?"
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase Environment Variables. Check your .env.local file."
  );
}

// 3. Create and Export the Client
// We export this 'supabase' variable so we can import it in any other file.
export const supabase = createClient(supabaseUrl, supabaseKey);
