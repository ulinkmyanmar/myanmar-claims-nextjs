import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Myanmar Claims History Checking System', description: 'Secure internal historical claims checking platform' }
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en"><body>{children}</body></html> }
