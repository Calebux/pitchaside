import { Nav } from '@/components/nav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <main className="min-h-screen pb-20 md:pb-6 md:pl-56">
        {children}
      </main>
      <Nav />
    </>
  );
}
