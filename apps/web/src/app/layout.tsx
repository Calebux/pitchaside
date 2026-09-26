import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PitchAside',
  description: 'Payment tracking for 5-aside football groups',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
