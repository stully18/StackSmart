'use client'

import { useAuth } from '@/app/context/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import ProfileCard from './ProfileCard'
import ChangePasswordForm from './ChangePasswordForm'

export default function SettingsPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <div className="text-text-muted">Loading...</div>
  }

  return (
    <main className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary mb-8">Settings</h1>

        <div className="space-y-6">
          <ProfileCard />
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  )
}
