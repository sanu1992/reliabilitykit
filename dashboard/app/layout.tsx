import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    'https://reliabilitykit-sre-console.sanztarun.chatgpt.site',
  ),
  title: 'ReliabilityKit | SRE Reliability Workbench',
  description:
    'A private-by-design SRE workbench for Kubernetes readiness, SLO budgets, and incident postmortems.',
  openGraph: {
    title: 'ReliabilityKit',
    description: 'Kubernetes readiness · SLO clarity · Better incidents',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'ReliabilityKit SRE operations console',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ReliabilityKit',
    description: 'Kubernetes readiness · SLO clarity · Better incidents',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
