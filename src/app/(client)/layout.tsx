import { TabBar } from '@/components/TabBar';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="client">
      <main className="client-main">{children}</main>
      <TabBar />
    </div>
  );
}
