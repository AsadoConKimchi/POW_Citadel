import Header from '@/components/layout/Header';
import BottomNav from '@/components/layout/BottomNav';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Header />
      <main className="pt-14 pb-20 px-4 max-w-screen-xl mx-auto">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
