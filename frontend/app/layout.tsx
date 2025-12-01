import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AutoDoc AI - Workflow Documentation Platform',
  description: 'Capture workflows and create step-by-step guides',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}




