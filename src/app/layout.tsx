import type { Metadata, Viewport } from 'next';
import './globals.css';
import AuthShell from '@/components/auth-shell';

export const metadata: Metadata = {
  title: 'Phaseboard',
  description: 'Capture ideas. Turn them into action.',
  applicationName: 'Phaseboard',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Phaseboard' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#172033',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthShell>{children}</AuthShell></body></html>;
}
