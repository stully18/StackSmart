'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    let loadingDone = false

    // Set up listener FIRST before checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (isMounted) {
          console.log('[AuthContext] Auth state changed:', event, session?.user?.email)
          setSession(session)
          setUser(session?.user ?? null)
          if (!loadingDone) {
            loadingDone = true
            setIsLoading(false)
          }
        }
      }
    )

    // Check for existing session AND wait for it before marking loading as done
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (isMounted) {
          console.log('[AuthContext] Initial session check:', session?.user?.email)
          setSession(session)
          setUser(session?.user ?? null)
          if (!loadingDone) {
            loadingDone = true
            setIsLoading(false)
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error checking session:', error)
        if (isMounted && !loadingDone) {
          loadingDone = true
          setIsLoading(false)
        }
      }
    }

    checkSession()

    return () => {
      isMounted = false
      subscription?.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
