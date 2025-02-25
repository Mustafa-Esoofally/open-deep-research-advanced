import './styles/globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/app/components/theme-provider';
import { TooltipProvider } from '@/app/components/ui/tooltip';

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
  title: 'Advanced Deep Research - Grok 3',
  description: 'A powerful research assistant with deep reasoning capabilities',
  keywords: ['research', 'AI', 'deep research', 'analysis', 'knowledge exploration'],
  authors: [{ name: 'Advanced Deep Research Team' }],
  applicationName: 'Advanced Deep Research',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head />
      <body className={`${inter.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="deep-research-theme"
        >
          <TooltipProvider>
            <div key="root-content-wrapper" id="main-content-container">
              <Toaster 
                position="bottom-right" 
                closeButton 
                theme="dark"
                toastOptions={{
                  style: {
                    background: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    border: '1px solid hsl(var(--border))',
                  },
                }}
              />
              {children}
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 