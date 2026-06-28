import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ ERROR: Supabase URL or Anon Key is missing! Check your .env.local file.");
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '', {
  global: {
    fetch: (url, options) => {
      let finalUrl = url.toString();
      if (finalUrl.includes('rest/v1/')) {
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl = `${finalUrl}${separator}_nocache=${Date.now()}`;
      }
      return fetch(finalUrl, { ...options, cache: 'no-store' });
    }
  }
});
