import { createClient } from '@supabase/supabase-js'
// Fallbacks keep the page rendering before .env is filled in (auth/payments just won't work yet).
const configuredProjectUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
const projectUrl = (configuredProjectUrl || 'https://example.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '')
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'missing-key'
const isPlaceholder = value => /your-|missing-key|example\.supabase\.co/i.test(value || '')
export const supabaseConfigured = Boolean(
  configuredProjectUrl && publicKey && !isPlaceholder(configuredProjectUrl) && !isPlaceholder(publicKey),
)
export const supabase = createClient(projectUrl, publicKey)
