/**
 * Entrar e Criar conta.
 */
import { type FormEvent, useEffect, useState } from "react";
import { WELCOME_POINTS } from "@shared/catalog";
import { Icon } from "@/components/Icon";
import { Logo } from "@/components/Layout";
import { useDocumentTitle } from "@/components/ui";
import { useApp } from "@/context/AppContext";
import { api, errorMessage } from "@/lib/api";
import { Link, navigate, useSearchParams } from "@/lib/router";
import type { User } from "@/lib/types";

const DEMO_ACCOUNTS = [
  { label: "Hóspede", email: "hospede@sunhost.local", icon: "compass" },
  { label: "Anfitriã", email: "anfitria@sunhost.local", icon: "home" },
  { label: "Admin", email: "admin@sunhost.local", icon: "shield" },
];
const DEMO_PASSWORD = "Floripa@2026";

function safeReturn(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "";
}

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  useDocumentTitle(mode === "login" ? "Entrar" : "Criar conta");
  const { user, signIn, toast } = useApp();
  const [params] = useSearchParams();
  const back = safeReturn(params.get("voltar"));
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "", accept: false });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (user) navigate(back || (user.role === "admin" ? "/admin" : "/"), { replace: true });
  }, [user, back]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (mode === "signup" && !form.accept) return setError("Para criar a conta, aceite os termos de uso.");
    setSending(true);
    try {
      const data = await api<{ user: User; token: string }>(`/api/auth/${mode}`, {
        method: "POST",
        body: mode === "login" ? { email: form.email, password: form.password } : { name: form.name, email: form.email, password: form.password, phone: form.phone },
      });
      await signIn(data.user, data.token);
      toast(mode === "login" ? `Olá de novo, ${data.user.name.split(" ")[0]}!` : `Conta criada! Você ganhou ${WELCOME_POINTS} Pontos Cívicos de boas-vindas.`);
      navigate(back || (data.user.role === "admin" ? "/admin" : "/"), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const switchTo = mode === "login" ? `/cadastro${back ? `?voltar=${encodeURIComponent(back)}` : ""}` : `/entrar${back ? `?voltar=${encodeURIComponent(back)}` : ""}`;

  return (
    <div className="auth-page">
      <div className="auth-visual">
        <img src="/assets/floripa-lagoa-amanhecer_e0cb2e0a.jpg" alt="" />
        <div className="auth-visual-copy">
          <Logo light />
          <h2>
            A sua estadia começa pelo bairro que mais combina com <em>você.</em>
          </h2>
          <ul>
            <li>
              <Icon name="heart" size={18} /> Salve favoritos e compare com calma
            </li>
            <li>
              <Icon name="send" size={18} /> Solicite reservas e converse com anfitriões
            </li>
            <li>
              <Icon name="sparkles" size={18} /> Ganhe Pontos Cívicos a cada estadia
            </li>
          </ul>
        </div>
      </div>
      <div className="auth-panel">
        <form className="auth-form" onSubmit={submit} noValidate={false}>
          <span className="eyebrow">{mode === "login" ? "Bem-vindo de volta" : `Ganhe ${WELCOME_POINTS} pontos ao se cadastrar`}</span>
          <h1>{mode === "login" ? "Entrar na SunHost" : "Criar sua conta"}</h1>
          <p className="muted">{mode === "login" ? "Use o e-mail e a senha cadastrados." : "Uma só conta para viajar e para anunciar o seu espaço."}</p>

          {mode === "signup" && (
            <label className="field">
              <span className="field-label">Nome completo</span>
              <input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} autoComplete="name" required minLength={2} maxLength={60} placeholder="Como podemos chamar você?" />
            </label>
          )}
          <label className="field">
            <span className="field-label">E-mail</span>
            <input type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} autoComplete="email" required placeholder="voce@email.com" />
          </label>
          {mode === "signup" && (
            <label className="field">
              <span className="field-label">
                Telefone / WhatsApp <em>opcional</em>
              </span>
              <input type="tel" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} autoComplete="tel" placeholder="(48) 99999-0000" />
              <small className="field-hint">Compartilhado só com quem tiver reserva confirmada com você.</small>
            </label>
          )}
          <label className="field">
            <span className="field-label">Senha</span>
            <span className="input-with-btn">
              <input type={showPassword ? "text" : "password"} value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={6} placeholder="Mínimo de 6 caracteres" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                <Icon name={showPassword ? "eye-off" : "eye"} size={18} />
              </button>
            </span>
          </label>
          {mode === "signup" && (
            <label className="check-field">
              <input type="checkbox" checked={form.accept} onChange={event => setForm({ ...form, accept: event.target.checked })} />
              <span>
                Li e aceito os <Link to="/ajuda#termos">termos de uso e a política de privacidade</Link>.
              </span>
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              <Icon name="alert" size={16} /> {error}
            </p>
          )}
          <button className="btn btn-primary btn-lg btn-block" disabled={sending}>
            {sending ? "Aguarde…" : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
          <p className="auth-switch">
            {mode === "login" ? "Ainda não tem conta?" : "Já tem uma conta?"} <Link to={switchTo}>{mode === "login" ? "Cadastre-se" : "Entrar"}</Link>
          </p>
          {mode === "login" && (
            <div className="demo-box">
              <strong>
                <Icon name="key" size={16} /> Contas de demonstração
              </strong>
              <small>Senha de todas: {DEMO_PASSWORD}</small>
              <div className="demo-buttons">
                {DEMO_ACCOUNTS.map(account => (
                  <button type="button" key={account.email} className="chip" onClick={() => setForm({ ...form, email: account.email, password: DEMO_PASSWORD })}>
                    <Icon name={account.icon} size={15} /> {account.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
