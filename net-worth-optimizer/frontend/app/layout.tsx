import type { Metadata } from 'next'
import { DM_Sans } from 'next/font/google'
import './globals.css'
import { FinancialProvider } from './context/FinancialContext'
import { AuthProvider } from './context/AuthContext'
import Navigation from './components/Navigation'

const dmSans = DM_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })

export const metadata: Metadata = {
  title: 'StackSmart',
  description: 'Optimize your financial decisions: debt repayment vs investing',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.className} bg-background min-h-screen`}>
        <AuthProvider>
          <FinancialProvider>
            <Navigation />
            {children}
          </FinancialProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
