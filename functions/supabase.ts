import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('[FATAL] SUPABASE_URL and SUPABASE_SECRET_KEY must be set in environment variables.');
}

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl!, supabaseKey!);
