import type { Metadata } from 'next'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'ReadyBoard — Construction Management Software for GCs & Specialty Contractors',
  description: 'ReadyBoard is the legal infrastructure platform for commercial construction. GC project oversight dashboard, real-time Ready Board grid, auto-generated NODs with SHA-256 verification, and offline-first foreman app. Built for NYC, Miami, Chicago construction.',
  keywords: ['construction management software', 'general contractor dashboard', 'GC project oversight', 'notice of delay', 'commercial construction', 'specialty contractor', 'foreman app', 'construction delay tracking', 'legal evidence construction', 'ready board'],
  icons: {
    icon: '/favicon.svg',
  },
  openGraph: {
    title: 'ReadyBoard — Your Jobsite Under Control',
    description: 'Real-time Ready Board grid, auto-generated legal docs, and a 60-second foreman app. No calls. No chaos.',
    type: 'website',
    url: 'https://readyboard.ai',
    siteName: 'ReadyBoard',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReadyBoard — Construction Management Software',
    description: 'Legal infrastructure for commercial construction. GC dashboard + foreman app.',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
          <Toaster theme="dark" position="bottom-right" richColors />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
