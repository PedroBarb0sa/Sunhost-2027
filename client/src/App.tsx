/**
 * SunHost Floripa — estrutura da aplicação e rotas.
 */
import type { ReactNode } from "react";
import ErrorBoundary from "./components/ErrorBoundary";
import { Footer, Header, MobileNav } from "./components/Layout";
import { ConfirmHost, RequireAuth, Toasts } from "./components/ui";
import { AppProvider } from "./context/AppContext";
import { matchPath, useLocation } from "./lib/router";
import { AccountPage, FavoritesPage, PointsPage, TripsPage } from "./pages/Account";
import AdminPage from "./pages/Admin";
import AuthPage from "./pages/Auth";
import Explore from "./pages/Explore";
import HelpPage from "./pages/Help";
import Home from "./pages/Home";
import { HostDashboard, HostListingForm } from "./pages/Host";
import ListingPage from "./pages/ListingPage";
import NotFound from "./pages/NotFound";

type RouteDef = { path: string; render: (params: Record<string, string>) => ReactNode; bare?: boolean };

const ROUTES: RouteDef[] = [
  { path: "/", render: () => <Home /> },
  { path: "/explorar", render: () => <Explore /> },
  { path: "/acomodacao/:id", render: ({ id }) => <ListingPage key={id} id={id} /> },
  { path: "/entrar", render: () => <AuthPage key="login" mode="login" />, bare: true },
  { path: "/cadastro", render: () => <AuthPage key="signup" mode="signup" />, bare: true },
  { path: "/favoritos", render: () => <FavoritesPage /> },
  { path: "/viagens", render: () => <RequireAuth><TripsPage /></RequireAuth> },
  { path: "/pontos", render: () => <RequireAuth><PointsPage /></RequireAuth> },
  { path: "/conta", render: () => <RequireAuth><AccountPage /></RequireAuth> },
  { path: "/anfitriao", render: () => <RequireAuth><HostDashboard /></RequireAuth> },
  { path: "/anfitriao/novo", render: () => <RequireAuth><HostListingForm key="new" /></RequireAuth> },
  { path: "/anfitriao/editar/:id", render: ({ id }) => <RequireAuth><HostListingForm key={id} id={id} /></RequireAuth> },
  { path: "/admin", render: () => <RequireAuth admin><AdminPage /></RequireAuth> },
  { path: "/ajuda", render: () => <HelpPage /> },
];

function Router() {
  const { path } = useLocation();
  for (const route of ROUTES) {
    const params = matchPath(route.path, path);
    if (params) {
      if (route.bare) return <main className="main main-bare">{route.render(params)}</main>;
      return (
        <>
          <Header />
          <main className="main">{route.render(params)}</main>
          <Footer />
          <MobileNav />
        </>
      );
    }
  }
  return (
    <>
      <Header />
      <main className="main">
        <NotFound />
      </main>
      <Footer />
      <MobileNav />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router />
        <Toasts />
        <ConfirmHost />
      </AppProvider>
    </ErrorBoundary>
  );
}
