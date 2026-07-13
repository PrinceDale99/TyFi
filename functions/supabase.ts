import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://dkprrplswejxdsjmvsox.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || 'dummy_key_prevent_crash';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
