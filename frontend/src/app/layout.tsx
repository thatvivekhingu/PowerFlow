import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'POWERFLOW — Clean Energy. Stronger Communities.',
  description: 'Grid-aware digital marketplace for localized renewable energy matching and settlement.',
  keywords: ['renewable energy', 'P2P trading', 'solar', 'DISCOM', 'smart grid', 'POWERFLOW'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className={`${plusJakartaSans.className} antialiased bg-[#F8FAFC] text-slate-900`}>
        {children}
      </body>
    </html>
  )
}
