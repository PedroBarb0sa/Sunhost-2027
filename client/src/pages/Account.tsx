/**
 * Área do viajante: viagens, favoritos, Pontos Cívicos e perfil da conta.
 */
import { type FormEvent, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { ListingCard } from "@/components/ListingCard";
import { ReservationCard } from "@/components/Reservations";
import { Avatar, EmptyState, PageHeader, SkeletonCards, Spinner, StatusPill, Tabs, confirmDialog, useDocumentTitle } from "@/components/ui";
import { useApp, useRealtime } from "@/context/AppContext";
import { api, errorMessage, setToken } from "@/lib/api";
import { brl, longDate, monthYear } from "@/lib/format";
import { uploadImage } from "@/lib/image";
import { Link, navigate } from "@/lib/router";
import type { Listing, PointsSummary, Reservation, User } from "@/lib/types";

// -----------------------------------------------------------------------------
// Minhas viagens
// -----------------------------------------------------------------------------
type TripTab = "upcoming" | "pending" | "past" | "cancelled";

export function TripsPage() {
  useDocumentTitle("Minhas viagens");
  const [trips, setTrips] = useState<Reservation[] | null>(null);
  const [tab, setTab] = useState<TripTab>("upcoming");
  const [error, setError] = useState("");

  const reload = () =>
    api<Reservation[]>("/api/trips")
      .then(setTrips)
      .catch(() => undefined);
  // Atualiza sozinha quando o anfitrião responde ou manda mensagem.
  useRealtime("reservation", reload);
  useRealtime("message", reload);

  useEffect(() => {
    api<Reservation[]>("/api/trips")
      .then(rows => {
        setTrips(rows);
        if (!rows.some(row => ["upcoming", "ongoing"].includes(row.stage)) && rows.some(row => row.stage === "pending")) setTab("pending");
      })
      .catch(err => setError(errorMessage(err)));
  }, []);

  const groups: Record<TripTab, Reservation[]> = {
    upcoming: (trips || []).filter(row => ["upcoming", "ongoing"].includes(row.stage)).sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1)),
    pending: (trips || []).filter(row => row.stage === "pending"),
    past: (trips || []).filter(row => row.stage === "completed"),
    cancelled: (trips || []).filter(row => ["cancelled", "declined"].includes(row.stage)),
  };
  const update = (next: Reservation) => setTrips(current => (current || []).map(row => (row.id === next.id ? next : row)));

  return (
    <div className="page container narrow">
      <PageHeader eyebrow="Viajante" title="Minhas viagens" text="Acompanhe solicitações, converse com anfitriões e avalie as estadias concluídas." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "Próximas", count: groups.upcoming.length },
          { value: "pending", label: "Aguardando resposta", count: groups.pending.length },
          { value: "past", label: "Concluídas", count: groups.past.length },
          { value: "cancelled", label: "Canceladas", count: groups.cancelled.length },
        ]}
      />
      {error ? (
        <EmptyState icon="alert" title="Não foi possível carregar" text={error} />
      ) : !trips ? (
        <Spinner />
      ) : groups[tab].length ? (
        <div className="reservation-list">
          {groups[tab].map(row => (
            <ReservationCard key={row.id} reservation={row} onChanged={update} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="compass"
          title={tab === "upcoming" ? "Nenhuma viagem confirmada" : tab === "pending" ? "Nenhuma solicitação aguardando" : tab === "past" ? "Nenhuma estadia concluída ainda" : "Nada por aqui"}
          text="Encontre um lugar com a sua cara e envie uma solicitação de reserva."
          action={
            <Link to="/explorar" className="btn btn-primary">
              Explorar estadias
            </Link>
          }
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Favoritos
// -----------------------------------------------------------------------------
export function FavoritesPage() {
  useDocumentTitle("Favoritos");
  const { user, favorites, ready } = useApp();
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (user)
      api<{ listings: Listing[] }>("/api/favorites")
        .then(data => setListings(data.listings))
        .catch(() => setListings([]));
    else
      api<{ listings: Listing[] }>("/api/listings")
        .then(data => setListings(data.listings))
        .catch(() => setListings([]));
    // Recarrega quando a sessão muda; a lista é filtrada abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, ready]);

  const visible = (listings || []).filter(item => favorites.includes(item.id)).sort((a, b) => favorites.indexOf(a.id) - favorites.indexOf(b.id));

  return (
    <div className="page container">
      <PageHeader eyebrow="Sua coleção" title="Favoritos" text={user ? "Salvos na sua conta e disponíveis em qualquer dispositivo." : "Salvos neste navegador. Entre na sua conta para guardar em todos os dispositivos."} />
      {!listings ? (
        <SkeletonCards count={3} />
      ) : visible.length ? (
        <div className="listing-grid">
          {visible.map(listing => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="heart"
          title="Sua coleção está vazia"
          text="Toque no coração de uma acomodação para guardar ideias de viagem aqui."
          action={
            <Link to="/explorar" className="btn btn-primary">
              Explorar estadias
            </Link>
          }
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Pontos Cívicos
// -----------------------------------------------------------------------------
export function PointsPage() {
  useDocumentTitle("Pontos Cívicos");
  const { toast } = useApp();
  const [data, setData] = useState<PointsSummary | null>(null);
  const [busy, setBusy] = useState(0);

  useEffect(() => {
    api<PointsSummary>("/api/points")
      .then(setData)
      .catch(err => toast(errorMessage(err), "error"));
  }, [toast]);

  const redeem = async (rewardId: number, points: number, amount: number) => {
    const ok = await confirmDialog({ title: `Trocar ${points} pontos por ${brl(amount)}?`, message: "O cupom fica disponível para aplicar em uma próxima solicitação de reserva.", confirmLabel: "Resgatar cupom" });
    if (!ok) return;
    setBusy(rewardId);
    try {
      setData(await api<PointsSummary>("/api/points/redeem", { method: "POST", body: { rewardId } }));
      toast("Cupom resgatado! Use-o ao solicitar sua próxima reserva.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(0);
    }
  };

  if (!data) return <Spinner />;
  return (
    <div className="page container">
      <PageHeader eyebrow="Benefícios" title="Pontos Cívicos" text="Estadias concluídas rendem pontos. Troque por cupons de desconto e aplique ao solicitar a próxima reserva." />
      <div className="points-layout">
        <aside className="wallet">
          <span className="wallet-label">Saldo disponível</span>
          <strong className="wallet-balance">
            {data.balance}
            <em>pts</em>
          </strong>
          <div className="wallet-rows">
            <span>
              Boas-vindas <b>+{data.welcome}</b>
            </span>
            <span>
              Estadias concluídas <b>+{data.earned}</b>
            </span>
            <span>
              Cupons resgatados <b>−{data.spent}</b>
            </span>
            {data.pending > 0 && (
              <span className="wallet-pending">
                A receber (viagens confirmadas) <b>+{data.pending}</b>
              </span>
            )}
          </div>
        </aside>
        <div>
          <h2 className="block-title">Trocar por desconto</h2>
          <div className="reward-grid">
            {data.rewards.map(reward => {
              const missing = reward.points - data.balance;
              return (
                <div className={`reward-card${missing > 0 ? " locked" : ""}`} key={reward.id}>
                  <span className="reward-pts">
                    <Icon name="sparkles" size={14} /> {reward.points} pontos
                  </span>
                  <strong>{brl(reward.amount)}</strong>
                  <small>{reward.detail}</small>
                  <button className="btn btn-sm btn-primary" disabled={missing > 0 || busy === reward.id} onClick={() => redeem(reward.id, reward.points, reward.amount)}>
                    {missing > 0 ? `Faltam ${missing} pts` : busy === reward.id ? "Resgatando…" : "Resgatar"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="points-bottom">
        <section>
          <h2 className="block-title">Meus cupons</h2>
          {data.coupons.length ? (
            <div className="coupon-list">
              {data.coupons.map(coupon => (
                <div className={`coupon coupon-${coupon.status}`} key={coupon.id}>
                  <Icon name="ticket" size={22} />
                  <div>
                    <strong>{coupon.code}</strong>
                    <span>
                      {brl(coupon.amount)} de desconto · {longDate(coupon.createdAt)}
                    </span>
                  </div>
                  <StatusPill status={coupon.status} label={coupon.status === "used" ? "Aplicado em reserva" : "Disponível"} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Você ainda não resgatou cupons.</p>
          )}
        </section>
        <section>
          <h2 className="block-title">Extrato</h2>
          <ul className="history">
            {data.history.map(item => (
              <li key={item.id}>
                <span>
                  {item.label}
                  <small>{longDate(item.date)}</small>
                </span>
                <b className={item.points >= 0 ? "plus" : "minus"}>
                  {item.points >= 0 ? "+" : "−"}
                  {Math.abs(item.points)}
                </b>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Conta e perfil
// -----------------------------------------------------------------------------
export function AccountPage() {
  useDocumentTitle("Conta e perfil");
  const { user, setUser, toast, signOut } = useApp();
  const [profile, setProfile] = useState({ name: user?.name || "", phone: user?.phone || "", bio: user?.bio || "", avatarUrl: user?.avatarUrl || "" });
  const [passwords, setPasswords] = useState({ currentPassword: "", newPassword: "" });
  const [deletePassword, setDeletePassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return <Spinner />;

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api<{ user: User }>("/api/me", { method: "PATCH", body: profile });
      setUser(data.user);
      toast("Perfil atualizado.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const changeAvatar = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file, 600);
      setProfile(current => ({ ...current, avatarUrl: url }));
      const data = await api<{ user: User }>("/api/me", { method: "PATCH", body: { avatarUrl: url } });
      setUser(data.user);
      toast("Foto de perfil atualizada.");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setUploading(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const data = await api<{ token: string }>("/api/me/password", { method: "POST", body: passwords });
      setToken(data.token);
      setPasswords({ currentPassword: "", newPassword: "" });
      toast("Senha alterada. Outras sessões foram encerradas.");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const deleteAccount = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await confirmDialog({ title: "Excluir sua conta definitivamente?", message: "Seus anúncios, reservas, avaliações, favoritos e pontos serão apagados. Esta ação não pode ser desfeita.", confirmLabel: "Excluir conta", danger: true });
    if (!ok) return;
    try {
      await api("/api/me", { method: "DELETE", body: { password: deletePassword } });
      await signOut();
      toast("Sua conta foi excluída.", "info");
      navigate("/");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="page container narrow">
      <PageHeader eyebrow="Conta" title="Conta e perfil" text={`Membro desde ${monthYear(user.createdAt)} · ${user.email}`} />

      <form className="panel" onSubmit={saveProfile}>
        <h2 className="block-title">Perfil público</h2>
        <p className="muted small">Hóspedes e anfitriões veem seu nome, foto e apresentação. Telefone e e-mail só aparecem em reservas confirmadas.</p>
        <div className="avatar-edit">
          <Avatar name={profile.name || user.name} url={profile.avatarUrl} size={88} />
          <div>
            <label className="btn btn-outline btn-sm">
              <Icon name="upload" size={16} /> {uploading ? "Enviando…" : "Trocar foto"}
              <input type="file" accept="image/*" hidden onChange={event => changeAvatar(event.target.files?.[0])} />
            </label>
            {profile.avatarUrl && (
              <button type="button" className="link-btn" onClick={() => setProfile({ ...profile, avatarUrl: "" })}>
                Remover foto
              </button>
            )}
          </div>
        </div>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Nome</span>
            <input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} required minLength={2} maxLength={60} />
          </label>
          <label className="field">
            <span className="field-label">Telefone / WhatsApp</span>
            <input type="tel" value={profile.phone} onChange={event => setProfile({ ...profile, phone: event.target.value })} placeholder="(48) 99999-0000" />
          </label>
        </div>
        <label className="field">
          <span className="field-label">Sobre você</span>
          <textarea rows={4} value={profile.bio} onChange={event => setProfile({ ...profile, bio: event.target.value })} maxLength={600} placeholder="Conte um pouco sobre você, seus interesses e como gosta de viajar ou receber." />
        </label>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={saving}>
            {saving ? "Salvando…" : "Salvar perfil"}
          </button>
        </div>
      </form>

      <form className="panel" onSubmit={changePassword}>
        <h2 className="block-title">Segurança</h2>
        <div className="form-grid">
          <label className="field">
            <span className="field-label">Senha atual</span>
            <input type="password" value={passwords.currentPassword} onChange={event => setPasswords({ ...passwords, currentPassword: event.target.value })} autoComplete="current-password" required />
          </label>
          <label className="field">
            <span className="field-label">Nova senha</span>
            <input type="password" value={passwords.newPassword} onChange={event => setPasswords({ ...passwords, newPassword: event.target.value })} autoComplete="new-password" minLength={6} required />
          </label>
        </div>
        <div className="form-actions">
          <button className="btn btn-dark">Alterar senha</button>
        </div>
      </form>

      {user.role !== "admin" && (
        <form className="panel panel-danger" onSubmit={deleteAccount}>
          <h2 className="block-title">Excluir conta</h2>
          <p className="muted small">Remove permanentemente seus dados da SunHost (LGPD). Se você tiver hóspedes com reserva confirmada, cancele antes.</p>
          <div className="inline-form">
            <input type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder="Confirme sua senha" required aria-label="Senha para excluir a conta" />
            <button className="btn btn-danger">Excluir minha conta</button>
          </div>
        </form>
      )}
    </div>
  );
}
