import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://vxiIIbSdEYnHn-95hFnNRQ_ug1v9vuG.supabase.co';
const supabaseKey = process.env.SUPABASE_SECRET_KEY || '';

// Initialize the Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);

// Example migration function: 
// To migrate from Firestore to Supabase:
// Old: await db.collection('farmers').doc(address).set({ fcmToken });
// New: await supabase.from('farmers').upsert({ address, fcm_token: fcmToken });
