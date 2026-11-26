/**
 * Estrutura comum: cabeçalho, menu da conta, rodapé e navegação inferior no celular.
 */
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Link, navigate, useLocation } from "@/lib/router";
import { Icon } from "./Icon";
import { Avatar } from "./ui";

export const LOGO_SRC = "/assets/sunhost-symbol_64f5c7ec.png";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className={`logo${light ? " logo-light" : ""}`} aria-label="SunHost Floripa — início">
      <span className="logo-mark">
        <img src={LOGO_SRC} alt="" />
      </span>
      <span className="logo-text">
        SunHost<em>Floripa</em>
      </span>
    </Link>
  );
}

function UserMenu() {
  const { user, signOut, favorites, hostPending, toast, unread } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { path } = useLocation();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={ref}>
      <button className={`user-trigger${open ? " is-open" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label="Abrir menu da conta">
        <Icon name="menu" size={18} />
        {user ? <Avatar name={user.name} url={user.avatarUrl} size={30} /> : <span className="user-anon"><Icon name="user" size={18} /></span>}
        {hostPending + unread.guest + unread.host > 0 && <span className="dot-badge" aria-label="Há novidades na sua conta" />}
      </button>
      {open && (
        <div className="menu-panel" role="menu">
          {user ? (
            <>
              <div className="menu-user">
                <Avatar name={user.name} url={user.avatarUrl} size={40} />
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </div>
              </div>
              {user.role === "admin" && (
                <Link to="/admin" className="menu-item menu-strong" role="menuitem">
                  <Icon name="shield" size={18} /> Painel de administração
                </Link>
              )}
              <Link to="/viagens" className="menu-item" role="menuitem">
                <Icon name="compass" size={18} /> Minhas viagens {unread.guest > 0 && <span className="menu-count" title="Mensagens não lidas">{unread.guest}</span>}
              </Link>
              <Link to="/favoritos" className="menu-item" role="menuitem">
                <Icon name="heart" size={18} /> Favoritos {favorites.length > 0 && <span className="menu-count">{favorites.length}</span>}
              </Link>
              <Link to="/pontos" className="menu-item" role="menuitem">
                <Icon name="sparkles" size={18} /> Pontos Cívicos
              </Link>
              <hr />
              {user.role !== "admin" && (
                <Link to="/anfitriao" className="menu-item" role="menuitem">
                  <Icon name="home" size={18} /> Painel do anfitrião {hostPending + unread.host > 0 && <span className="menu-count">{hostPending + unread.host}</span>}
                </Link>
              )}
              <Link to="/conta" className="menu-item" role="menuitem">
                <Icon name="settings" size={18} /> Conta e perfil
              </Link>
              <Link to="/ajuda" className="menu-item" role="menuitem">
                <Icon name="help" size={18} /> Central de ajuda
              </Link>
              <hr />
              <button
                className="menu-item"
                role="menuitem"
                onClick={async () => {
                  await signOut();
                  toast("Você saiu da sua conta.", "info");
                  navigate("/");
                }}
              >
                <Icon name="logout" size={18} /> Sair
              </button>
            </>
          ) : (
            <>
              <Link to="/entrar" className="menu-item menu-strong" role="menuitem">
                <Icon name="login" size={18} /> Entrar
              </Link>
              <Link to="/cadastro" className="menu-item" role="menuitem">
                <Icon name="user" size={18} /> Criar conta
              </Link>
              <hr />
              <Link to="/anfitriao/novo" className="menu-item" role="menuitem">
                <Icon name="home" size={18} /> Anuncie seu espaço
              </Link>
              <Link to="/favoritos" className="menu-item" role="menuitem">
                <Icon name="heart" size={18} /> Favoritos {favorites.length > 0 && <span className="menu-count">{favorites.length}</span>}
              </Link>
              <Link to="/ajuda" className="menu-item" role="menuitem">
                <Icon name="help" size={18} /> Central de ajuda
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { user } = useApp();
  const { path } = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const transparent = path === "/" && !scrolled;
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header${transparent ? " is-transparent" : ""}`}>
      <div className="header-inner">
        <Logo light={transparent} />
        <nav className="header-nav" aria-label="Principal">
          <Link to="/explorar" className={path.startsWith("/explorar") ? "active" : ""}>
            Explorar
          </Link>
          <Link to="/#pontos">Pontos Cívicos</Link>
          <Link to="/ajuda" className={path.startsWith("/ajuda") ? "active" : ""}>
            Como funciona
          </Link>
        </nav>
        <div className="header-actions">
          {user?.role !== "admin" && (
            <Link to={user ? "/anfitriao" : "/anfitriao/novo"} className="host-link">
              {user ? "Modo anfitrião" : "Anuncie seu espaço"}
            </Link>
          )}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const { user, favorites, hostPending, unread } = useApp();
  const { path } = useLocation();
  const items = [
    { to: "/", label: "Início", icon: "home", active: path === "/" },
    { to: "/explorar", label: "Explorar", icon: "search", active: path.startsWith("/explorar") || path.startsWith("/acomodacao") },
    { to: "/favoritos", label: "Favoritos", icon: "heart", active: path === "/favoritos", badge: favorites.length },
    user?.role === "admin"
      ? { to: "/admin", label: "Admin", icon: "shield", active: path.startsWith("/admin") }
      : { to: user ? "/viagens" : "/entrar", label: user ? "Viagens" : "Entrar", icon: user ? "compass" : "login", active: path === "/viagens" || path === "/entrar", badge: user ? unread.guest : 0 },
    { to: user ? (user.role === "admin" ? "/conta" : "/anfitriao") : "/cadastro", label: user ? (user.role === "admin" ? "Perfil" : "Anfitrião") : "Cadastro", icon: user ? (user.role === "admin" ? "user" : "building") : "user", active: path.startsWith("/anfitriao") || path === "/conta" || path === "/cadastro", badge: user?.role !== "admin" ? hostPending + unread.host : 0 },
  ];
  return (
    <nav className="mobile-nav" aria-label="Navegação rápida">
      {items.map(item => (
        <Link key={item.label} to={item.to} className={item.active ? "active" : ""}>
          <span className="mobile-nav-icon">
            <Icon name={item.icon} size={22} filled={item.icon === "heart" && item.active} />
            {Boolean(item.badge) && <span className="mobile-badge">{item.badge}</span>}
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Logo light />
          <p>Hospedagens locais para viver Florianópolis com mais contexto — e deixar boas marcas na ilha.</p>
          <div className="footer-tags">
            <span>Feito para Floripa</span>
            <span>Sem taxas de serviço</span>
          </div>
        </div>
        <div>
          <h4>Viajantes</h4>
          <Link to="/explorar">Explorar estadias</Link>
          <Link to="/favoritos">Favoritos</Link>
          <Link to="/viagens">Minhas viagens</Link>
          <Link to="/pontos">Pontos Cívicos</Link>
        </div>
        <div>
          <h4>Anfitriões</h4>
          <Link to="/anfitriao/novo">Anuncie seu espaço</Link>
          <Link to="/anfitriao">Painel do anfitrião</Link>
          <Link to="/ajuda#anfitrioes">Dicas para anfitriões</Link>
        </div>
        <div>
          <h4>SunHost</h4>
          <Link to="/ajuda">Como funciona</Link>
          <Link to="/ajuda#seguranca">Segurança</Link>
          <Link to="/ajuda#termos">Termos e privacidade</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© {new Date().getFullYear()} SunHost Floripa · Projeto acadêmico de Análise e Desenvolvimento de Sistemas</span>
        <span>O pagamento é combinado diretamente com o anfitrião.</span>
      </div>
    </footer>
  );
}
