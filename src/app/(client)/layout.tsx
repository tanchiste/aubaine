import { TabBar } from '@/components/TabBar';
import { TopNav } from '@/components/TopNav';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="client">
      <TopNav />
      <main className="client-main">{children}</main>
      <TabBar />
    </div>
  );
}
