import { createClient } from '@supabase/supabase-js'
// Fallbacks keep the page rendering before .env is filled in (auth/payments just won't work yet).
const projectUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://example.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'missing-key'
export const supabase = createClient(projectUrl, publicKey)
