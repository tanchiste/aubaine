import { SiteFooter } from '@/components/SiteFooter';
import { TabBar } from '@/components/TabBar';
import { TopNav, type NavUser } from '@/components/TopNav';
import { getCurrentUser, getMyVenues } from '@/lib/auth';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const mine = user ? await getMyVenues(user.id) : [];
  const nav: NavUser = user ? { name: user.firstName ?? user.email, pro: mine.length > 0, admin: user.isAdmin } : null;
  return (
    <div className="client">
      <TopNav user={nav} />
      <main className="client-main">
        {children}
        <SiteFooter />
      </main>
      <TabBar />
    </div>
  );
}
