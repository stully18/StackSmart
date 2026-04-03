import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your StackSmart account — update your profile and change your password.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
