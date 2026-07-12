import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stock of the Day',
  description:
    'A transparent, multi-factor daily stock pick with the full scoring breakdown shown — educational, not investment advice.',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
