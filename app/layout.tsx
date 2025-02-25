import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/app/components/theme-provider';
import { TooltipProvider } from '@/app/components/ui/tooltip';
import '@/app/styles/globals.css';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" }
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Advanced Deep Research',
  description: 'AI-powered research assistant for deep analysis and comprehensive exploration of any topic',
  keywords: ['research', 'AI', 'deep research', 'analysis', 'knowledge exploration'],
  authors: [{ name: 'Advanced Deep Research Team' }],
  applicationName: 'Advanced Deep Research',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
            <Toaster position="top-center" closeButton richColors />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 