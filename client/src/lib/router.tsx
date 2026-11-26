/**
 * Roteador leve baseado na History API: rotas com parâmetros (/acomodacao/:id),
 * links, navegação programática e leitura/escrita da query string.
 */
import { type AnchorHTMLAttributes, type MouseEvent, useEffect, useState } from "react";

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach(listener => listener());
}
if (typeof window !== "undefined") window.addEventListener("popstate", emit);

export function navigate(to: string, options: { replace?: boolean; keepScroll?: boolean } = {}) {
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to === current) return;
  const samePath = to.split("?")[0] === window.location.pathname;
  window.history[options.replace ? "replaceState" : "pushState"](null, "", to);
  emit();
  if (!options.keepScroll && !samePath && !to.includes("#")) window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  if (to.includes("#")) {
    const id = to.split("#")[1];
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }
}

export function useLocation() {
  const [location, setLocation] = useState(() => ({ path: window.location.pathname, search: window.location.search }));
  useEffect(() => {
    const update = () => setLocation({ path: window.location.pathname, search: window.location.search });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);
  return location;
}

export function useSearchParams(): [URLSearchParams, (next: Record<string, string | number | undefined | null>) => void] {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const update = (next: Record<string, string | number | undefined | null>) => {
    const merged = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === null || value === "") merged.delete(key);
      else merged.set(key, String(value));
    }
    const query = merged.toString();
    navigate(`${window.location.pathname}${query ? `?${query}` : ""}`, { replace: true, keepScroll: true });
  };
  return [params, update];
}

/** Compara um caminho com um padrão e devolve os parâmetros encontrados. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = path.replace(/\/+$/, "").split("/").filter(Boolean);
  if (patternParts.length !== pathParts.length) return null;
  const params: Record<string, string> = {};
  for (let index = 0; index < patternParts.length; index++) {
    const part = patternParts[index];
    if (part.startsWith(":")) params[part.slice(1)] = decodeURIComponent(pathParts[index]);
    else if (part !== pathParts[index]) return null;
  }
  return params;
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || rest.target === "_blank") return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
