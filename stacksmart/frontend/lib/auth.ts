'use client'

import { supabase } from './supabase'
import { logAppEvent } from './loans'

// Best-effort event logging: never let a logging failure block auth success.
async function logEventQuietly(
  eventType: Parameters<typeof logAppEvent>[0],
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await logAppEvent(eventType, metadata)
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[auth] ${eventType} event logging failed:`, err)
    }
  }
}

interface SignUpData {
  email: string
  password: string
  fullName: string
}

interface SignInData {
  email: string
  password: string
}

export async function signUp({ email, password, fullName }: SignUpData) {
  try {
    // Sign up user - the trigger will automatically create the users_public entry
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    })

    if (authError) throw authError

    // Best-effort: only log when we actually have a confirmed/created user.
    if (authData.user) {
      await logEventQuietly('account_created', { source: 'signup_form', email })
    }

    return { user: authData.user, session: authData.session, error: null }
  } catch (error) {
    return { user: null, session: null, error }
  }
}

export async function signIn({ email, password }: SignInData) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })

    if (error) throw error
    await logEventQuietly('sign_in', { source: 'login_form', email })
    return { user: data.user, session: data.session, error: null }
  } catch (error) {
    return { user: null, session: null, error }
  }
}

export async function signOut() {
  // Log before signing out so auth.uid() is still populated server-side.
  await logEventQuietly('sign_out', { source: 'auth_context' })
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`
  })
  return { data, error }
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  })
  return { data, error }
}

export async function updateProfile(fullName: string) {
  try {
    const { data: user } = await supabase.auth.getUser()

    if (!user.user) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('users_public')
      .update({ full_name: fullName })
      .eq('id', user.user.id)

    if (error) throw error
    return { error: null }
  } catch (error) {
    return { error }
  }
}
