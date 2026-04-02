import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a custom storage implementation for better reliability
const createStorage = () => {
  if (typeof window === 'undefined') {
    return {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {}
    }
  }

  return {
    getItem: async (key: string) => {
      try {
        return localStorage.getItem(key)
      } catch (e) {
        console.error('Storage getItem error:', e)
        return null
      }
    },
    setItem: async (key: string, value: string) => {
      try {
        localStorage.setItem(key, value)
      } catch (e) {
        console.error('Storage setItem error:', e)
      }
    },
    removeItem: async (key: string) => {
      try {
        localStorage.removeItem(key)
      } catch (e) {
        console.error('Storage removeItem error:', e)
      }
    }
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    storage: createStorage(),
    flowType: 'pkce',
    autoRefreshToken: true
  }
})

export async function getSession() {
  const { data, error } = await supabase.auth.getSession()
  return { session: data.session, error }
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser()
  return { user: data.user, error }
}
