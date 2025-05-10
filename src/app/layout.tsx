
import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed from Geist for broader character support / preference for Inter
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Added Toaster

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter', // Changed variable name for clarity
});

export const metadata: Metadata = {
  title: 'TriSlide - A Game of Combining Tiles',
  description: 'Engage in TriSlide, a captivating game where you combine tiles on a triangular grid to achieve high scores. Inspired by Trism, built with Next.js.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning> {/* Used new variable and added generic font-sans, added suppressHydrationWarning */}
        {children}
        <Toaster /> {/* Added Toaster component here */}
      </body>
    </html>
  );
}

