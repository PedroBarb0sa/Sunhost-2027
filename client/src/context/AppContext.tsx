/**
 * Estado global: sessão do usuário, favoritos (no navegador ou na conta) e avisos.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, getToken, setToken, setUnauthorizedHandler } from "@/lib/api";
import type { Listing, RealtimeMessage, RealtimeReservation, User } from "@/lib/types";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; text: string };

type AppState = {
  user: User | null;
  ready: boolean;
  signIn: (user: User, token: string) => Promise<void>;
  signOut: () => Promise<void>;
  setUser: (user: User) => void;
  favorites: number[];
  isFavorite: (id: number) => boolean;
  toggleFavorite: (listing: Pick<Listing, "id" | "title">) => void;
  toasts: Toast[];
  toast: (text: string, kind?: ToastKind) => void;
  dismissToast: (id: number) => void;
  hostPending: number;
  refreshHostPending: () => void;
  unread: { guest: number; host: number };
  refreshUnread: () => void;
  live: boolean;
};

/** Conversa aberta no momento (não mostra aviso de mensagem nova para ela). */
let activeChat: number | null = null;
export function setActiveChat(id: number | null) {
  activeChat = id;
}

/** Assina eventos em tempo real: "sunhost:message" e "sunhost:reservation". */
export function useRealtime<T>(name: "message" | "reservation", handler: (data: T) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const listener = (event: Event) => ref.current((event as CustomEvent<T>).detail);
    window.addEventListener(`sunhost:${name}`, listener);
    return () => window.removeEventListener(`sunhost:${name}`, listener);
  }, [name]);
}

const AppContext = createContext<AppState | null>(null);
const LOCAL_FAVORITES = "sunhost-favoritos";

function readLocalFavorites(): number[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(LOCAL_FAVORITES) || "[]");
    return Array.isArray(value) ? value.filter(item => Number.isInteger(item)) : [];
  } catch {
    return [];
  }
}
function writeLocalFavorites(ids: number[]) {
  try {
    window.localStorage.setItem(LOCAL_FAVORITES, JSON.stringify(ids));
  } catch {
    /* ignora */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [favorites, setFavorites] = useState<number[]>(() => readLocalFavorites());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [hostPending, setHostPending] = useState(0);
  const [unread, setUnread] = useState({ guest: 0, host: 0 });
  const [live, setLive] = useState(false);
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => setToasts(current => current.filter(item => item.id !== id)), []);
  const toast = useCallback(
    (text: string, kind: ToastKind = "success") => {
      const id = ++toastId.current;
      setToasts(current => [...current.slice(-2), { id, kind, text }]);
      window.setTimeout(() => dismissToast(id), kind === "error" ? 6000 : 4200);
    },
    [dismissToast]
  );

  const refreshHostPending = useCallback(() => {
    if (!getToken()) return setHostPending(0);
    api<{ status: string }[]>("/api/host/reservations")
      .then(rows => setHostPending(rows.filter(row => row.status === "pending").length))
      .catch(() => undefined);
  }, []);

  const refreshUnread = useCallback(() => {
    if (!getToken()) return setUnread({ guest: 0, host: 0 });
    api<{ guest: number; host: number }>("/api/unread")
      .then(setUnread)
      .catch(() => undefined);
  }, []);

  const loadFavorites = useCallback(async () => {
    const local = readLocalFavorites();
    const data = await api<{ ids: number[] }>("/api/favorites/sync", { method: "POST", body: { ids: local } });
    setFavorites(data.ids);
    writeLocalFavorites([]);
  }, []);

  const clearSession = useCallback(() => {
    setToken("");
    setUserState(null);
    setFavorites(readLocalFavorites());
    setHostPending(0);
    setUnread({ guest: 0, host: 0 });
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    if (!getToken()) {
      setReady(true);
      return;
    }
    api<{ user: User }>("/api/auth/me")
      .then(async ({ user: me }) => {
        setUserState(me);
        await loadFavorites().catch(() => undefined);
        refreshHostPending();
        refreshUnread();
      })
      .catch(() => clearSession())
      .finally(() => setReady(true));
  }, [clearSession, loadFavorites, refreshHostPending, refreshUnread]);

  const signIn = useCallback(
    async (next: User, token: string) => {
      setToken(token);
      setUserState(next);
      await loadFavorites().catch(() => undefined);
      refreshHostPending();
      refreshUnread();
    },
    [loadFavorites, refreshHostPending, refreshUnread]
  );

  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    setToken("");
    setUserState(null);
    setFavorites([]);
    writeLocalFavorites([]);
    setHostPending(0);
    setUnread({ guest: 0, host: 0 });
  }, []);

  // Conexão em tempo real enquanto houver alguém logado (reconecta sozinha).
  useEffect(() => {
    if (!user || typeof EventSource === "undefined") return undefined;
    const source = new EventSource(`/api/events?token=${encodeURIComponent(getToken())}`);
    source.addEventListener("ready", () => setLive(true));
    source.onerror = () => setLive(false);
    source.addEventListener("message", event => {
      const data = JSON.parse((event as MessageEvent).data) as RealtimeMessage;
      window.dispatchEvent(new CustomEvent("sunhost:message", { detail: data }));
      if (data.message.sender.id === user.id) return;
      if (activeChat === data.reservationId) return;
      toast(`Nova mensagem de ${data.message.sender.name.split(" ")[0]}: “${data.message.body.slice(0, 60)}${data.message.body.length > 60 ? "…" : ""}”`, "info");
      refreshUnread();
    });
    source.addEventListener("reservation", event => {
      const data = JSON.parse((event as MessageEvent).data) as RealtimeReservation;
      window.dispatchEvent(new CustomEvent("sunhost:reservation", { detail: data }));
      refreshHostPending();
      if (data.byId === user.id) return;
      const text: Record<string, string> = {
        new: `Novo pedido de reserva de ${data.from.split(" ")[0]} para “${data.title}”.`,
        accept: `${data.from.split(" ")[0]} confirmou sua reserva em “${data.title}”! Os contatos foram liberados.`,
        decline: `Seu pedido para “${data.title}” foi recusado.`,
        cancel: `A reserva em “${data.title}” foi cancelada por ${data.from.split(" ")[0]}.`,
      };
      if (text[data.kind]) toast(text[data.kind], data.kind === "accept" || data.kind === "new" ? "success" : "info");
    });
    return () => {
      source.close();
      setLive(false);
    };
  }, [user?.id, toast, refreshUnread, refreshHostPending]);

  const toggleFavorite = useCallback(
    (listing: Pick<Listing, "id" | "title">) => {
      const saved = !favorites.includes(listing.id);
      const next = saved ? [listing.id, ...favorites] : favorites.filter(id => id !== listing.id);
      setFavorites(next);
      toast(saved ? "Salvo nos seus favoritos." : "Removido dos favoritos.", "info");
      if (user) {
        api(`/api/favorites/${listing.id}`, { method: "PUT", body: { saved } }).catch(() => {
          setFavorites(favorites);
          toast("Não foi possível atualizar os favoritos.", "error");
        });
      } else writeLocalFavorites(next);
    },
    [favorites, toast, user]
  );

  const value = useMemo<AppState>(
    () => ({
      user,
      ready,
      signIn,
      signOut,
      setUser: setUserState,
      favorites,
      isFavorite: (id: number) => favorites.includes(id),
      toggleFavorite,
      toasts,
      toast,
      dismissToast,
      hostPending,
      refreshHostPending,
      unread,
      refreshUnread,
      live,
    }),
    [user, ready, signIn, signOut, favorites, toggleFavorite, toasts, toast, dismissToast, hostPending, refreshHostPending, unread, refreshUnread, live]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp precisa estar dentro de AppProvider");
  return context;
}
