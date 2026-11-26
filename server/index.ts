/**
 * SunHost Floripa — API e servidor de produção.
 *
 * Funcionalidades: contas (hóspede/anfitrião e administrador), anúncios com
 * várias fotos, busca com disponibilidade, reservas com aceite do anfitrião,
 * conversa por reserva, avaliações com estrelas e resposta do anfitrião,
 * favoritos, Pontos Cívicos com cupons, denúncias e painel administrativo.
 * O pagamento não passa pela plataforma: é combinado direto com o anfitrião.
 */
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createServer } from "http";
import path from "path";
import { existsSync } from "fs";
import fs from "fs/promises";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { JsonDriver, PgDriver, type Driver, type Row } from "./db";
import {
  DEMO_GUEST,
  DEMO_HOST,
  DEMO_PASSWORD,
  SEED_LISTINGS,
  seedListingRow,
} from "./seed";
import {
  AMENITIES,
  CATEGORIES,
  DISTRICTS,
  REPORT_REASONS,
  REWARDS,
  WELCOME_POINTS,
  pointsForPrice,
} from "../shared/catalog";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// Carrega o .env da raiz do projeto, quando existir (Node 20.12+).
try {
  const envFile = path.join(ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);
} catch {
  /* sem .env: usa apenas as variáveis do ambiente */
}

const app = express();
const server = createServer(app);
const port = Number(process.env.PORT || 3001);
const ADMIN_EMAIL = (
  process.env.ADMIN_EMAIL || "admin@sunhost.local"
).toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Floripa@2026";
const SESSION_DAYS = 30;

let db: Driver;

// =============================================================================
// Utilidades
// =============================================================================

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}
function fail(status: number, message: string): never {
  throw new HttpError(status, message);
}

type Handler = (req: Request, res: Response) => unknown;
const route =
  (handler: Handler) => (req: Request, res: Response, _next: NextFunction) => {
    Promise.resolve()
      .then(() => handler(req, res))
      .catch((error: any) => {
        if (error instanceof HttpError)
          return res.status(error.status).json({ error: error.message });
        if (error?.code === "23505")
          return res.status(409).json({ error: "Este registro já existe." });
        console.error("[api]", req.method, req.url, error);
        res
          .status(500)
          .json({ error: "Erro interno. Tente novamente em instantes." });
      });
  };

const nowIso = () => new Date().toISOString();
const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex");
const unique = <T>(items: T[]) => Array.from(new Set(items));
const round1 = (value: number) => Math.round(value * 10) / 10;

/** Data de hoje no fuso de Florianópolis, no formato AAAA-MM-DD. */
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
function nightsBetween(checkIn: string, checkOut: string) {
  return Math.round(
    (Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) /
      86400000
  );
}
const overlaps = (aIn: string, aOut: string, bIn: string, bOut: string) =>
  aIn < bOut && bIn < aOut;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function text(
  value: unknown,
  field: string,
  min: number,
  max: number,
  required = true
) {
  const result = typeof value === "string" ? value.trim() : "";
  if (!result && !required) return "";
  if (result.length < min)
    fail(400, `${field}: informe pelo menos ${min} caracteres.`);
  if (result.length > max)
    fail(400, `${field}: use no máximo ${max} caracteres.`);
  return result;
}
function int(value: unknown, field: string, min: number, max: number) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max)
    fail(400, `${field}: use um número entre ${min} e ${max}.`);
  return result;
}
function money(value: unknown, field: string, min: number, max: number) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < min || result > max)
    fail(400, `${field}: use um valor entre R$ ${min} e R$ ${max}.`);
  return Math.round(result * 100) / 100;
}
function idParam(req: Request, name = "id") {
  const id = Number(req.params[name]);
  if (!Number.isInteger(id) || id <= 0) fail(404, "Registro não encontrado.");
  return id;
}
function phone(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13)
    fail(400, "Telefone/WhatsApp: informe DDD e número.");
  return digits;
}
const PHOTO_URL =
  /^(\/api\/uploads\/\d+|\/assets\/[\w.-]+|https?:\/\/[^\s"'<>]{4,490})$/;
function photoUrl(value: unknown) {
  const url = typeof value === "string" ? value.trim() : "";
  if (!PHOTO_URL.test(url))
    fail(
      400,
      "Foto inválida. Envie uma imagem do dispositivo ou um link https."
    );
  return url;
}

// -----------------------------------------------------------------------------
// Senhas e sessões
// -----------------------------------------------------------------------------

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}
function verifyPassword(password: string, stored: string) {
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const expected = Buffer.from(hash, "hex");
    const actual = crypto.scryptSync(password, salt, expected.length);
    return (
      expected.length === actual.length &&
      crypto.timingSafeEqual(expected, actual)
    );
  }
  // Formato da versão anterior (pepper global). Convertido no próximo login.
  const legacy = crypto
    .scryptSync(
      password,
      process.env.PASSWORD_PEPPER || "sunhost-local-pepper",
      64
    )
    .toString("hex");
  return legacy === stored;
}

async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.insert("sessions", {
    token_hash: sha256(token),
    user_id: userId,
    expires_at: expires,
  });
  return token;
}
function bearer(req: Request, allowQuery = false) {
  const header = String(req.headers.authorization || "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  // EventSource (tempo real) não envia cabeçalhos: só essa rota aceita o token na URL.
  return header || (allowQuery ? String(req.query.token || "") : "");
}
async function currentUser(
  req: Request,
  allowQuery = false
): Promise<Row | null> {
  const token = bearer(req, allowQuery);
  if (!token) return null;
  const session = await db.findOne("sessions", { token_hash: sha256(token) });
  if (!session) return null;
  if (String(session.expires_at) < nowIso()) {
    await db.remove("sessions", { token_hash: session.token_hash });
    return null;
  }
  const user = await db.findOne("users", { id: session.user_id });
  if (!user || user.status !== "active") return null;
  user.is_host = Boolean(
    await db.findOne("accommodations", { owner_id: user.id })
  );
  return user;
}
async function requireUser(req: Request) {
  const user = await currentUser(req);
  if (!user) fail(401, "Entre na sua conta para continuar.");
  return user;
}
async function requireAdmin(req: Request) {
  const user = await requireUser(req);
  if (user.role !== "admin") fail(403, "Acesso restrito ao administrador.");
  return user;
}

// Proteção simples contra tentativas repetidas de login.
const loginAttempts = new Map<string, { count: number; until: number }>();
function checkLoginLimit(key: string) {
  const entry = loginAttempts.get(key);
  if (entry && entry.until > Date.now())
    fail(429, "Muitas tentativas. Aguarde alguns minutos e tente de novo.");
}
function registerLoginFailure(key: string) {
  const entry = loginAttempts.get(key) || { count: 0, until: 0 };
  entry.count += 1;
  if (entry.count >= 8) {
    entry.until = Date.now() + 5 * 60000;
    entry.count = 0;
  }
  loginAttempts.set(key, entry);
}

// =============================================================================
// Tempo real (Server-Sent Events): cada navegador logado mantém uma conexão
// aberta em /api/events e recebe na hora mensagens e mudanças de reserva.
// =============================================================================

const streams = new Map<string, Set<Response>>();
function notify(
  userIds: (string | undefined | null)[],
  event: string,
  data: unknown
) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const id of unique(userIds.filter(Boolean) as string[]))
    for (const res of streams.get(id) || []) res.write(payload);
}

// =============================================================================
// Serialização
// =============================================================================

function userJson(user: Row, isHost = Boolean(user.is_host)) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isHost,
    phone: user.phone || "",
    bio: user.bio || "",
    avatarUrl: user.avatar_url || "",
    status: user.status,
    createdAt: user.created_at,
  };
}
function personJson(user: Row | undefined, withContact = false) {
  if (!user) return { id: "", name: "Conta removida", avatarUrl: "" };
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatar_url || "",
    createdAt: user.created_at,
    ...(withContact ? { email: user.email, phone: user.phone || "" } : {}),
  };
}

async function hydrateListings(rows: Row[]) {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const [photos, reviews, owners] = await Promise.all([
    db.find(
      "accommodation_photos",
      { accommodation_id: ids },
      { orderBy: "position" }
    ),
    db.find("reviews", { accommodation_id: ids, status: "published" }),
    db.find("users", { id: unique(rows.map(row => row.owner_id)) }),
  ]);
  return rows.map(row => {
    const ownPhotos = photos
      .filter(photo => photo.accommodation_id === row.id)
      .sort((a, b) => a.position - b.position || a.id - b.id);
    const ratings = reviews
      .filter(review => review.accommodation_id === row.id)
      .map(review => review.rating);
    const owner = owners.find(user => user.id === row.owner_id);
    return {
      id: row.id,
      title: row.title,
      district: row.district,
      location: `${row.district}, Florianópolis`,
      category: row.category,
      description: row.description,
      price: Number(row.price),
      cleaningFee: Number(row.cleaning_fee || 0),
      guests: row.guests,
      bedrooms: row.bedrooms,
      beds: row.beds,
      bathrooms: row.bathrooms,
      minNights: row.min_nights,
      amenities: (row.amenities || []) as string[],
      houseRules: row.house_rules || "",
      checkInTime: row.check_in_time,
      checkOutTime: row.check_out_time,
      localNote: row.local_note || "",
      points: row.points,
      featured: Boolean(row.featured),
      status: row.status,
      moderationNote: row.moderation_note || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      ownerId: row.owner_id,
      photos: ownPhotos.map(photo => ({ id: photo.id, url: photo.url })),
      images: ownPhotos.map(photo => photo.url),
      host: personJson(owner),
      rating: ratings.length
        ? round1(
            ratings.reduce((sum, value) => sum + value, 0) / ratings.length
          )
        : null,
      reviewCount: ratings.length,
    };
  });
}

async function publicListingRows() {
  const [rows, blocked] = await Promise.all([
    db.find("accommodations", { status: "approved" }),
    db.find("users", { status: "blocked" }),
  ]);
  const blockedIds = new Set(blocked.map(user => user.id));
  return rows.filter(row => !blockedIds.has(row.owner_id));
}

function stageOf(row: Row) {
  if (row.status !== "confirmed") return row.status as string;
  const day = today();
  if (row.check_out <= day) return "completed";
  if (row.check_in <= day) return "ongoing";
  return "upcoming";
}

async function hydrateReservations(rows: Row[], viewer: Row) {
  if (!rows.length) return [];
  const listingIds = unique(rows.map(row => row.accommodation_id));
  const listings = await db.find("accommodations", { id: listingIds });
  const [photos, users, reviews, redemptions, messages] = await Promise.all([
    db.find(
      "accommodation_photos",
      { accommodation_id: listingIds },
      { orderBy: "position" }
    ),
    db.find("users", {
      id: unique([
        ...rows.map(row => row.guest_id),
        ...listings.map(row => row.owner_id),
      ]),
    }),
    db.find("reviews", {
      accommodation_id: listingIds,
      user_id: unique(rows.map(row => row.guest_id)),
    }),
    db.find("redemptions", {
      id: rows.map(row => row.redemption_id).filter(Boolean),
    }),
    db.find("messages", { reservation_id: rows.map(row => row.id) }),
  ]);
  const day = today();
  return rows
    .map(row => {
      const listing = listings.find(item => item.id === row.accommodation_id);
      const host = users.find(user => user.id === listing?.owner_id);
      const guest = users.find(user => user.id === row.guest_id);
      const isGuest = viewer.id === row.guest_id;
      const isHost = viewer.id === listing?.owner_id;
      const showContacts =
        row.status === "confirmed" || viewer.role === "admin";
      const stage = stageOf(row);
      const coupon = redemptions.find(item => item.id === row.redemption_id);
      const threadMessages = messages.filter(
        item => item.reservation_id === row.id
      );
      const readAt = String(
        (isHost ? row.host_read_at : isGuest ? row.guest_read_at : null) || ""
      );
      const unreadCount =
        isHost || isGuest
          ? threadMessages.filter(
              item =>
                item.sender_id !== viewer.id && String(item.created_at) > readAt
            ).length
          : 0;
      const lastMessage = threadMessages.sort((a, b) =>
        a.created_at > b.created_at ? -1 : 1
      )[0];
      const reviewed = reviews.some(
        review =>
          review.accommodation_id === row.accommodation_id &&
          review.user_id === row.guest_id
      );
      return {
        id: row.id,
        status: row.status,
        stage,
        statusNote: row.status_note || "",
        checkIn: row.check_in,
        checkOut: row.check_out,
        guests: row.guests,
        nights: row.nights,
        pricePerNight: Number(row.price_per_night),
        cleaningFee: Number(row.cleaning_fee),
        discount: Number(row.discount),
        total: Number(row.total),
        points: row.points,
        message: row.message || "",
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        coupon: coupon
          ? { code: coupon.code, amount: Number(coupon.amount) }
          : null,
        listing: listing
          ? {
              id: listing.id,
              title: listing.title,
              district: listing.district,
              image:
                photos.find(photo => photo.accommodation_id === listing.id)
                  ?.url || "",
              checkInTime: listing.check_in_time,
              checkOutTime: listing.check_out_time,
            }
          : null,
        guest: personJson(guest, showContacts || isGuest),
        host: personJson(host, showContacts || isHost),
        role: isHost ? "host" : isGuest ? "guest" : "admin",
        messageCount: threadMessages.length,
        unreadCount,
        lastMessageAt: lastMessage?.created_at || null,
        lastMessageFromMe: lastMessage
          ? lastMessage.sender_id === viewer.id
          : false,
        canRespond: isHost && row.status === "pending",
        canCancel:
          (isGuest &&
            (row.status === "pending" ||
              (row.status === "confirmed" && row.check_in > day))) ||
          (isHost && row.status === "confirmed" && row.check_in > day) ||
          (viewer.role === "admin" &&
            ["pending", "confirmed"].includes(row.status)),
        canReview: isGuest && stage === "completed" && !reviewed,
      };
    })
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

async function reviewsJson(rows: Row[]) {
  const users = await db.find("users", {
    id: unique(rows.map(row => row.user_id)),
  });
  const listings = await db.find("accommodations", {
    id: unique(rows.map(row => row.accommodation_id)),
  });
  return rows
    .map(row => ({
      id: row.id,
      listingId: row.accommodation_id,
      listingTitle:
        listings.find(item => item.id === row.accommodation_id)?.title || "",
      rating: row.rating,
      body: row.body,
      status: row.status,
      verified: Boolean(row.reservation_id),
      hostReply: row.host_reply || "",
      hostReplyAt: row.host_reply_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: personJson(users.find(user => user.id === row.user_id)),
    }))
    .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
}

async function pointsSummary(user: Row) {
  const day = today();
  const [reservations, redemptions] = await Promise.all([
    db.find("reservations", { guest_id: user.id, status: "confirmed" }),
    db.find(
      "redemptions",
      { user_id: user.id },
      { orderBy: "created_at", desc: true }
    ),
  ]);
  const listings = await db.find("accommodations", {
    id: unique(reservations.map(row => row.accommodation_id)),
  });
  const completed = reservations.filter(row => row.check_out <= day);
  const upcoming = reservations.filter(row => row.check_out > day);
  const welcome = Number(user.welcome_points ?? WELCOME_POINTS);
  const earned = completed.reduce(
    (sum, row) => sum + Number(row.points || 0),
    0
  );
  const spent = redemptions.reduce(
    (sum, row) => sum + Number(row.points || 0),
    0
  );
  const titleOf = (id: number) =>
    listings.find(item => item.id === id)?.title || "Estadia";
  const history = [
    {
      id: "welcome",
      label: "Bônus de boas-vindas",
      points: welcome,
      date: user.created_at,
    },
    ...completed.map(row => ({
      id: `stay-${row.id}`,
      label: `Estadia concluída · ${titleOf(row.accommodation_id)}`,
      points: Number(row.points),
      date: row.check_out,
    })),
    ...redemptions.map(row => ({
      id: `redeem-${row.id}`,
      label: `Cupom ${row.code} (R$ ${Number(row.amount)})`,
      points: -Number(row.points),
      date: row.created_at,
    })),
  ].sort((a, b) => (String(a.date) > String(b.date) ? -1 : 1));
  return {
    balance: welcome + earned - spent,
    welcome,
    earned,
    spent,
    pending: upcoming.reduce((sum, row) => sum + Number(row.points || 0), 0),
    history,
    coupons: redemptions.map(row => ({
      id: row.id,
      rewardId: row.reward_id,
      code: row.code,
      amount: Number(row.amount),
      points: Number(row.points),
      status: row.status,
      reservationId: row.reservation_id,
      createdAt: row.created_at,
    })),
    rewards: REWARDS,
  };
}

// =============================================================================
// Rotas
// =============================================================================

app.disable("x-powered-by");
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.use(express.json({ limit: "8mb" }));

app.get(
  "/api/health",
  route(async (_req, res) => {
    await db.count("users");
    res.json({ ok: true, database: db.kind });
  })
);

app.get("/api/meta", (_req: Request, res: Response) => {
  res.json({
    categories: CATEGORIES,
    amenities: AMENITIES,
    districts: DISTRICTS,
    rewards: REWARDS,
    reportReasons: REPORT_REASONS,
    welcomePoints: WELCOME_POINTS,
  });
});

// -----------------------------------------------------------------------------
// Autenticação e perfil
// -----------------------------------------------------------------------------

app.post(
  "/api/auth/signup",
  route(async (req, res) => {
    const body = req.body || {};
    const name = text(body.name, "Nome", 2, 60);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
      fail(400, "Informe um e-mail válido.");
    const password = String(body.password || "");
    if (password.length < 6)
      fail(400, "A senha precisa ter pelo menos 6 caracteres.");
    if (password.length > 128) fail(400, "A senha é longa demais.");
    if (await db.findOne("users", { email }))
      fail(409, "Este e-mail já está cadastrado. Tente entrar.");
    const user = await db.insert("users", {
      id: crypto.randomUUID(),
      name,
      email,
      password_hash: hashPassword(password),
      role: "user",
      phone: phone(body.phone),
      status: "active",
      welcome_points: WELCOME_POINTS,
    });
    res
      .status(201)
      .json({
        user: userJson(user, false),
        token: await createSession(user.id),
      });
  })
);

app.post(
  "/api/auth/login",
  route(async (req, res) => {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password || "");
    const key = `${req.ip}|${email}`;
    checkLoginLimit(key);
    const user = await db.findOne("users", { email });
    if (!user || !verifyPassword(password, user.password_hash)) {
      registerLoginFailure(key);
      fail(401, "E-mail ou senha incorretos.");
    }
    if (user.status !== "active")
      fail(403, "Esta conta está suspensa. Fale com a equipe SunHost.");
    loginAttempts.delete(key);
    if (!String(user.password_hash).startsWith("scrypt$"))
      await db.update(
        "users",
        { id: user.id },
        { password_hash: hashPassword(password) }
      );
    const hostListing = await db.findOne("accommodations", {
      owner_id: user.id,
    });
    res.json({
      user: userJson(user, Boolean(hostListing)),
      token: await createSession(user.id),
    });
  })
);

app.post(
  "/api/auth/logout",
  route(async (req, res) => {
    const token = bearer(req);
    if (token) await db.remove("sessions", { token_hash: sha256(token) });
    res.json({ ok: true });
  })
);

app.get(
  "/api/auth/me",
  route(async (req, res) => {
    const user = await requireUser(req);
    res.json({ user: userJson(user) });
  })
);

app.patch(
  "/api/me",
  route(async (req, res) => {
    const user = await requireUser(req);
    const body = req.body || {};
    const patch: Row = {};
    if (body.name !== undefined) patch.name = text(body.name, "Nome", 2, 60);
    if (body.phone !== undefined) patch.phone = phone(body.phone);
    if (body.bio !== undefined)
      patch.bio = text(body.bio, "Sobre você", 0, 600, false) || null;
    if (body.avatarUrl !== undefined)
      patch.avatar_url = body.avatarUrl ? photoUrl(body.avatarUrl) : null;
    const [updated] = await db.update("users", { id: user.id }, patch);
    res.json({ user: userJson(updated) });
  })
);

app.post(
  "/api/me/password",
  route(async (req, res) => {
    const user = await requireUser(req);
    if (
      !verifyPassword(
        String(req.body?.currentPassword || ""),
        user.password_hash
      )
    )
      fail(400, "A senha atual não confere.");
    const next = String(req.body?.newPassword || "");
    if (next.length < 6)
      fail(400, "A nova senha precisa ter pelo menos 6 caracteres.");
    await db.update(
      "users",
      { id: user.id },
      { password_hash: hashPassword(next) }
    );
    // Encerra as outras sessões por segurança e devolve uma nova.
    await db.remove("sessions", { user_id: user.id });
    res.json({ ok: true, token: await createSession(user.id) });
  })
);

app.delete(
  "/api/me",
  route(async (req, res) => {
    const user = await requireUser(req);
    if (user.role === "admin")
      fail(400, "A conta de administrador não pode ser excluída por aqui.");
    if (!verifyPassword(String(req.body?.password || ""), user.password_hash))
      fail(400, "Senha incorreta.");
    const day = today();
    const listings = await db.find("accommodations", { owner_id: user.id });
    const hosted = listings.length
      ? await db.find("reservations", {
          accommodation_id: listings.map(row => row.id),
          status: "confirmed",
        })
      : [];
    if (hosted.some(row => row.check_out > day))
      fail(
        400,
        "Você tem hóspedes com reservas confirmadas. Cancele-as antes de excluir a conta."
      );
    await db.remove("users", { id: user.id });
    res.json({ ok: true });
  })
);

// -----------------------------------------------------------------------------
// Uploads de imagem (fotos de anúncio e avatar)
// -----------------------------------------------------------------------------

app.post(
  "/api/uploads",
  route(async (req, res) => {
    const user = await requireUser(req);
    const match =
      /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
        String(req.body?.dataUrl || "")
      );
    if (!match)
      fail(400, "Formato de imagem não suportado. Use JPG, PNG ou WEBP.");
    const bytes = Math.floor((match[2].length * 3) / 4);
    if (bytes > 4 * 1024 * 1024)
      fail(413, "Imagem grande demais (máximo de 4 MB).");
    const upload = await db.insert("uploads", {
      owner_id: user.id,
      mime: match[1],
      data: match[2],
    });
    res.status(201).json({ url: `/api/uploads/${upload.id}` });
  })
);

app.get(
  "/api/uploads/:id",
  route(async (req, res) => {
    const upload = await db.findOne("uploads", { id: idParam(req) });
    if (!upload) fail(404, "Imagem não encontrada.");
    res.setHeader("Content-Type", upload.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.end(Buffer.from(upload.data, "base64"));
  })
);

// -----------------------------------------------------------------------------
// Busca e detalhes de acomodações
// -----------------------------------------------------------------------------

app.get(
  "/api/listings",
  route(async (req, res) => {
    const q = normalize(String(req.query.q || "").trim());
    const guests = Number(req.query.guests || 0);
    const checkIn = String(req.query.checkIn || "");
    const checkOut = String(req.query.checkOut || "");
    const category = String(req.query.category || "");
    const minPrice = Number(req.query.minPrice || 0);
    const maxPrice = Number(req.query.maxPrice || 0);
    const amenities = String(req.query.amenities || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    const sort = String(req.query.sort || "relevance");
    const featuredOnly = req.query.featured === "1";

    let rows = await publicListingRows();
    if (q)
      rows = rows.filter(row =>
        normalize(
          `${row.title} ${row.district} ${row.category} ${row.description} ${row.local_note || ""}`
        ).includes(q)
      );
    if (guests > 0) rows = rows.filter(row => row.guests >= guests);
    if (category) rows = rows.filter(row => row.category === category);
    if (minPrice > 0) rows = rows.filter(row => Number(row.price) >= minPrice);
    if (maxPrice > 0) rows = rows.filter(row => Number(row.price) <= maxPrice);
    if (amenities.length)
      rows = rows.filter(row =>
        amenities.every(item => (row.amenities || []).includes(item))
      );
    if (featuredOnly) rows = rows.filter(row => row.featured);

    const hasDates = isDate(checkIn) && isDate(checkOut) && checkOut > checkIn;
    if (hasDates && rows.length) {
      const nights = nightsBetween(checkIn, checkOut);
      const confirmed = await db.find("reservations", {
        accommodation_id: rows.map(row => row.id),
        status: "confirmed",
      });
      rows = rows.filter(
        row =>
          nights >= row.min_nights &&
          !confirmed.some(
            item =>
              item.accommodation_id === row.id &&
              overlaps(checkIn, checkOut, item.check_in, item.check_out)
          )
      );
    }

    const listings = await hydrateListings(rows);
    const score = (item: (typeof listings)[number]) =>
      (item.featured ? 2 : 0) +
      (item.rating ?? 4) / 5 +
      Math.min(item.reviewCount, 20) / 40;
    listings.sort((a, b) => {
      if (sort === "price_asc") return a.price - b.price;
      if (sort === "price_desc") return b.price - a.price;
      if (sort === "rating")
        return (
          (b.rating ?? 0) - (a.rating ?? 0) || b.reviewCount - a.reviewCount
        );
      if (sort === "newest") return a.createdAt > b.createdAt ? -1 : 1;
      return score(b) - score(a) || (a.createdAt > b.createdAt ? -1 : 1);
    });
    res.json({ listings, total: listings.length });
  })
);

app.get(
  "/api/listings/:id",
  route(async (req, res) => {
    const viewer = await currentUser(req);
    const row = await db.findOne("accommodations", { id: idParam(req) });
    if (!row) fail(404, "Acomodação não encontrada.");
    const owner = await db.findOne("users", { id: row.owner_id });
    const canManage =
      viewer && (viewer.id === row.owner_id || viewer.role === "admin");
    if ((row.status !== "approved" || owner?.status !== "active") && !canManage)
      fail(404, "Esta acomodação não está disponível no momento.");

    const [listing] = await hydrateListings([row]);
    const day = today();
    const [reviews, hostListings, confirmed] = await Promise.all([
      db.find("reviews", { accommodation_id: row.id, status: "published" }),
      db.find("accommodations", { owner_id: row.owner_id, status: "approved" }),
      db.find("reservations", {
        accommodation_id: row.id,
        status: "confirmed",
      }),
    ]);
    const hostReviews = hostListings.length
      ? await db.find("reviews", {
          accommodation_id: hostListings.map(item => item.id),
          status: "published",
        })
      : [];
    const breakdown = [5, 4, 3, 2, 1].map(stars => ({
      stars,
      count: reviews.filter(review => review.rating === stars).length,
    }));
    let viewerInfo = null;
    if (viewer) {
      const [mine, completed] = await Promise.all([
        db.findOne("reviews", { accommodation_id: row.id, user_id: viewer.id }),
        db.find("reservations", {
          accommodation_id: row.id,
          guest_id: viewer.id,
          status: "confirmed",
        }),
      ]);
      viewerInfo = {
        isOwner: viewer.id === row.owner_id,
        hasCompletedStay: completed.some(item => item.check_out <= day),
        myReview: mine
          ? { id: mine.id, rating: mine.rating, body: mine.body }
          : null,
      };
    }
    res.json({
      listing: {
        ...listing,
        host: {
          ...listing.host,
          bio: owner?.bio || "",
          listingsCount: hostListings.length,
          rating: hostReviews.length
            ? round1(
                hostReviews.reduce((sum, item) => sum + item.rating, 0) /
                  hostReviews.length
              )
            : null,
          reviewCount: hostReviews.length,
        },
      },
      bookedRanges: confirmed
        .filter(item => item.check_out > day)
        .map(item => ({ checkIn: item.check_in, checkOut: item.check_out }))
        .sort((a, b) => (a.checkIn > b.checkIn ? 1 : -1)),
      breakdown,
      viewer: viewerInfo,
    });
  })
);

app.get(
  "/api/listings/:id/reviews",
  route(async (req, res) => {
    const rows = await db.find("reviews", {
      accommodation_id: idParam(req),
      status: "published",
    });
    res.json(await reviewsJson(rows));
  })
);

app.post(
  "/api/listings/:id/reviews",
  route(async (req, res) => {
    const user = await requireUser(req);
    const listing = await db.findOne("accommodations", { id: idParam(req) });
    if (!listing || listing.status !== "approved")
      fail(404, "Acomodação não encontrada.");
    if (listing.owner_id === user.id)
      fail(403, "Você não pode avaliar o seu próprio anúncio.");
    const rating = int(req.body?.rating, "Nota", 1, 5);
    const body = text(req.body?.body, "Comentário", 5, 1000);
    const completed = (
      await db.find("reservations", {
        accommodation_id: listing.id,
        guest_id: user.id,
        status: "confirmed",
      })
    )
      .filter(item => item.check_out <= today())
      .sort((a, b) => (a.check_out > b.check_out ? -1 : 1))[0];
    const existing = await db.findOne("reviews", {
      accommodation_id: listing.id,
      user_id: user.id,
    });
    let saved: Row;
    if (existing) {
      [saved] = await db.update(
        "reviews",
        { id: existing.id },
        {
          rating,
          body,
          reservation_id: completed?.id ?? existing.reservation_id ?? null,
          updated_at: nowIso(),
        }
      );
    } else {
      saved = await db.insert("reviews", {
        accommodation_id: listing.id,
        user_id: user.id,
        reservation_id: completed?.id ?? null,
        rating,
        body,
        status: "published",
      });
    }
    const [json] = await reviewsJson([saved]);
    res.status(existing ? 200 : 201).json(json);
  })
);

app.post(
  "/api/reviews/:id/reply",
  route(async (req, res) => {
    const user = await requireUser(req);
    const review = await db.findOne("reviews", { id: idParam(req) });
    if (!review) fail(404, "Avaliação não encontrada.");
    const listing = await db.findOne("accommodations", {
      id: review.accommodation_id,
    });
    if (listing?.owner_id !== user.id)
      fail(403, "Apenas o anfitrião pode responder.");
    const reply = text(req.body?.reply, "Resposta", 0, 1000, false);
    const [saved] = await db.update(
      "reviews",
      { id: review.id },
      { host_reply: reply || null, host_reply_at: reply ? nowIso() : null }
    );
    const [json] = await reviewsJson([saved]);
    res.json(json);
  })
);

app.delete(
  "/api/reviews/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const review = await db.findOne("reviews", { id: idParam(req) });
    if (!review) fail(404, "Avaliação não encontrada.");
    if (review.user_id !== user.id && user.role !== "admin")
      fail(403, "Você não pode remover esta avaliação.");
    await db.remove("reviews", { id: review.id });
    res.json({ ok: true });
  })
);

app.post(
  "/api/listings/:id/report",
  route(async (req, res) => {
    const user = await requireUser(req);
    const listing = await db.findOne("accommodations", { id: idParam(req) });
    if (!listing) fail(404, "Acomodação não encontrada.");
    const reason = String(req.body?.reason || "");
    if (!(REPORT_REASONS as readonly string[]).includes(reason))
      fail(400, "Escolha um motivo para a denúncia.");
    const details = text(req.body?.details, "Detalhes", 0, 1000, false);
    await db.insert("reports", {
      accommodation_id: listing.id,
      user_id: user.id,
      reason,
      details: details || null,
      status: "open",
    });
    res.status(201).json({ ok: true });
  })
);

// -----------------------------------------------------------------------------
// Favoritos
// -----------------------------------------------------------------------------

async function favoritesPayload(userId: string) {
  const rows = await db.find(
    "favorites",
    { user_id: userId },
    { orderBy: "created_at", desc: true }
  );
  const ids = rows.map(row => Number(row.accommodation_id));
  const visible = (await publicListingRows()).filter(row =>
    ids.includes(row.id)
  );
  const listings = await hydrateListings(visible);
  listings.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  return { ids, listings };
}

app.get(
  "/api/favorites",
  route(async (req, res) => {
    const user = await requireUser(req);
    res.json(await favoritesPayload(user.id));
  })
);

app.put(
  "/api/favorites/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const id = idParam(req);
    if (!(await db.findOne("accommodations", { id })))
      fail(404, "Acomodação não encontrada.");
    const existing = await db.findOne("favorites", {
      user_id: user.id,
      accommodation_id: id,
    });
    if (req.body?.saved && !existing)
      await db.insert("favorites", { user_id: user.id, accommodation_id: id });
    if (!req.body?.saved && existing)
      await db.remove("favorites", { user_id: user.id, accommodation_id: id });
    res.json({ ok: true, saved: Boolean(req.body?.saved) });
  })
);

/** Junta os favoritos salvos sem login (no navegador) com os da conta. */
app.post(
  "/api/favorites/sync",
  route(async (req, res) => {
    const user = await requireUser(req);
    const ids: number[] = Array.isArray(req.body?.ids)
      ? req.body.ids
          .map(Number)
          .filter((id: number) => Number.isInteger(id) && id > 0)
      : [];
    if (ids.length) {
      const [existing, listings] = await Promise.all([
        db.find("favorites", { user_id: user.id }),
        db.find("accommodations", { id: unique(ids).slice(0, 100) }),
      ]);
      for (const listing of listings)
        if (!existing.some(row => row.accommodation_id === listing.id))
          await db.insert("favorites", {
            user_id: user.id,
            accommodation_id: listing.id,
          });
    }
    res.json(await favoritesPayload(user.id));
  })
);

// -----------------------------------------------------------------------------
// Reservas e mensagens
// -----------------------------------------------------------------------------

app.get(
  "/api/events",
  route(async (req, res) => {
    const user = await currentUser(req, true);
    if (!user) fail(401, "Entre na sua conta para continuar.");
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.write(`retry: 3000\nevent: ready\ndata: {}\n\n`);
    const set = streams.get(user.id) || new Set<Response>();
    set.add(res);
    streams.set(user.id, set);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);
    req.on("close", () => {
      clearInterval(heartbeat);
      set.delete(res);
      if (!set.size) streams.delete(user.id);
    });
  })
);

/** Mensagens não lidas, separadas entre viagens (hóspede) e anfitrião. */
app.get(
  "/api/unread",
  route(async (req, res) => {
    const user = await requireUser(req);
    const listings = await db.find("accommodations", { owner_id: user.id });
    const [asGuest, asHost] = await Promise.all([
      db.find("reservations", { guest_id: user.id }),
      listings.length
        ? db.find("reservations", {
            accommodation_id: listings.map(row => row.id),
          })
        : Promise.resolve([]),
    ]);
    const all = [...asGuest, ...asHost];
    const messages = all.length
      ? await db.find("messages", { reservation_id: all.map(row => row.id) })
      : [];
    const count = (rows: Row[], column: string) =>
      rows.reduce(
        (sum, row) =>
          sum +
          messages.filter(
            item =>
              item.reservation_id === row.id &&
              item.sender_id !== user.id &&
              String(item.created_at) > String(row[column] || "")
          ).length,
        0
      );
    res.json({
      guest: count(asGuest, "guest_read_at"),
      host: count(asHost, "host_read_at"),
    });
  })
);

app.post(
  "/api/reservations",
  route(async (req, res) => {
    const user = await requireUser(req);
    const body = req.body || {};
    const listing = await db.findOne("accommodations", {
      id: Number(body.listingId) || 0,
    });
    if (!listing || listing.status !== "approved")
      fail(404, "Esta acomodação não está disponível para reserva.");
    if (listing.owner_id === user.id)
      fail(400, "Você não pode reservar o seu próprio anúncio.");
    const { checkIn, checkOut } = body;
    if (!isDate(checkIn) || !isDate(checkOut))
      fail(400, "Escolha as datas de check-in e check-out.");
    if (checkIn < today()) fail(400, "O check-in não pode ser no passado.");
    if (checkOut <= checkIn)
      fail(400, "O check-out precisa ser depois do check-in.");
    const nights = nightsBetween(checkIn, checkOut);
    if (nights < listing.min_nights)
      fail(
        400,
        `Este espaço exige no mínimo ${listing.min_nights} ${listing.min_nights === 1 ? "noite" : "noites"}.`
      );
    if (nights > 90)
      fail(400, "Reservas pela plataforma são limitadas a 90 noites.");
    const guests = int(body.guests, "Hóspedes", 1, listing.guests);
    const message = text(body.message, "Mensagem", 0, 1000, false);

    const existing = await db.find("reservations", {
      accommodation_id: listing.id,
      status: ["confirmed", "pending"],
    });
    if (
      existing.some(
        item =>
          item.status === "confirmed" &&
          overlaps(checkIn, checkOut, item.check_in, item.check_out)
      )
    )
      fail(409, "Essas datas já estão reservadas. Escolha outro período.");
    if (
      existing.some(
        item =>
          item.status === "pending" &&
          item.guest_id === user.id &&
          overlaps(checkIn, checkOut, item.check_in, item.check_out)
      )
    )
      fail(409, "Você já tem uma solicitação pendente para essas datas.");

    const price = Number(listing.price);
    const cleaningFee = Number(listing.cleaning_fee || 0);
    const subtotal = price * nights + cleaningFee;
    let discount = 0;
    let redemption: Row | null = null;
    if (body.couponId) {
      redemption = await db.findOne("redemptions", {
        id: Number(body.couponId),
        user_id: user.id,
      });
      if (!redemption || redemption.status !== "available")
        fail(400, "Este cupom não está disponível.");
      discount = Math.min(Number(redemption.amount), subtotal);
    }
    const reservation = await db.insert("reservations", {
      accommodation_id: listing.id,
      guest_id: user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      nights,
      price_per_night: price,
      cleaning_fee: cleaningFee,
      discount,
      total: Math.round((subtotal - discount) * 100) / 100,
      points: listing.points,
      redemption_id: redemption?.id ?? null,
      message: message || null,
      status: "pending",
    });
    if (redemption)
      await db.update(
        "redemptions",
        { id: redemption.id },
        { status: "used", reservation_id: reservation.id }
      );
    if (message)
      await db.insert("messages", {
        reservation_id: reservation.id,
        sender_id: user.id,
        body: message,
      });
    await db.update(
      "reservations",
      { id: reservation.id },
      { guest_read_at: nowIso() }
    );
    notify([listing.owner_id], "reservation", {
      id: reservation.id,
      status: "pending",
      kind: "new",
      from: user.name,
      title: listing.title,
    });
    const [json] = await hydrateReservations([reservation], user);
    res.status(201).json(json);
  })
);

app.get(
  "/api/trips",
  route(async (req, res) => {
    const user = await requireUser(req);
    res.json(
      await hydrateReservations(
        await db.find("reservations", { guest_id: user.id }),
        user
      )
    );
  })
);

app.get(
  "/api/host/reservations",
  route(async (req, res) => {
    const user = await requireUser(req);
    const listings = await db.find("accommodations", { owner_id: user.id });
    if (!listings.length) return res.json([]);
    const rows = await db.find("reservations", {
      accommodation_id: listings.map(row => row.id),
    });
    res.json(await hydrateReservations(rows, user));
  })
);

async function loadReservationFor(req: Request, user: Row) {
  const reservation = await db.findOne("reservations", { id: idParam(req) });
  if (!reservation) fail(404, "Reserva não encontrada.");
  const listing = await db.findOne("accommodations", {
    id: reservation.accommodation_id,
  });
  const isGuest = reservation.guest_id === user.id;
  const isHost = listing?.owner_id === user.id;
  if (!isGuest && !isHost && user.role !== "admin")
    fail(404, "Reserva não encontrada.");
  return { reservation, listing: listing as Row, isGuest, isHost };
}

app.get(
  "/api/reservations/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const { reservation } = await loadReservationFor(req, user);
    const [json] = await hydrateReservations([reservation], user);
    res.json(json);
  })
);

app.patch(
  "/api/reservations/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const { reservation, listing, isGuest, isHost } = await loadReservationFor(
      req,
      user
    );
    const action = String(req.body?.action || "");
    const note = text(req.body?.note, "Observação", 0, 500, false);
    const day = today();
    const releaseCoupon = async () => {
      if (reservation.redemption_id)
        await db.update(
          "redemptions",
          { id: reservation.redemption_id },
          { status: "available", reservation_id: null }
        );
    };
    let patch: Row;

    if (action === "accept") {
      if (!isHost) fail(403, "Apenas o anfitrião pode aceitar.");
      if (reservation.status !== "pending")
        fail(400, "Esta solicitação já foi respondida.");
      if (reservation.check_in < day)
        fail(400, "A data de check-in já passou.");
      const confirmed = await db.find("reservations", {
        accommodation_id: listing.id,
        status: "confirmed",
      });
      if (
        confirmed.some(item =>
          overlaps(
            reservation.check_in,
            reservation.check_out,
            item.check_in,
            item.check_out
          )
        )
      )
        fail(409, "Já existe outra reserva confirmada nessas datas.");
      patch = { status: "confirmed", status_note: note || null };
      // Outras solicitações para as mesmas datas são recusadas automaticamente.
      const pending = await db.find("reservations", {
        accommodation_id: listing.id,
        status: "pending",
      });
      for (const item of pending) {
        if (
          item.id === reservation.id ||
          !overlaps(
            reservation.check_in,
            reservation.check_out,
            item.check_in,
            item.check_out
          )
        )
          continue;
        await db.update(
          "reservations",
          { id: item.id },
          {
            status: "declined",
            status_note: "Datas indisponíveis: outra reserva foi confirmada.",
            updated_at: nowIso(),
          }
        );
        if (item.redemption_id)
          await db.update(
            "redemptions",
            { id: item.redemption_id },
            { status: "available", reservation_id: null }
          );
      }
    } else if (action === "decline") {
      if (!isHost) fail(403, "Apenas o anfitrião pode recusar.");
      if (reservation.status !== "pending")
        fail(400, "Esta solicitação já foi respondida.");
      patch = { status: "declined", status_note: note || null };
      await releaseCoupon();
    } else if (action === "cancel") {
      const allowed =
        (isGuest &&
          (reservation.status === "pending" ||
            (reservation.status === "confirmed" &&
              reservation.check_in > day))) ||
        (isHost &&
          reservation.status === "confirmed" &&
          reservation.check_in > day) ||
        (user.role === "admin" &&
          ["pending", "confirmed"].includes(reservation.status));
      if (!allowed) fail(400, "Esta reserva não pode mais ser cancelada.");
      const who = isGuest ? "hóspede" : isHost ? "anfitrião" : "administração";
      patch = {
        status: "cancelled",
        status_note: note || `Cancelada pelo ${who}.`,
      };
      await releaseCoupon();
    } else {
      fail(400, "Ação inválida.");
    }
    const [updated] = await db.update(
      "reservations",
      { id: reservation.id },
      { ...patch, updated_at: nowIso() }
    );
    notify([reservation.guest_id, listing.owner_id], "reservation", {
      id: reservation.id,
      status: updated.status,
      kind: action,
      from: user.name,
      byId: user.id,
      title: listing.title,
    });
    const [json] = await hydrateReservations([updated], user);
    res.json(json);
  })
);

app.get(
  "/api/reservations/:id/messages",
  route(async (req, res) => {
    const user = await requireUser(req);
    const { reservation, isGuest, isHost } = await loadReservationFor(
      req,
      user
    );
    const rows = await db.find(
      "messages",
      { reservation_id: reservation.id },
      { orderBy: "created_at" }
    );
    // Abrir a conversa marca as mensagens como lidas para quem abriu.
    if (isGuest)
      await db.update(
        "reservations",
        { id: reservation.id },
        { guest_read_at: nowIso() }
      );
    if (isHost)
      await db.update(
        "reservations",
        { id: reservation.id },
        { host_read_at: nowIso() }
      );
    const users = await db.find("users", {
      id: unique(rows.map(row => row.sender_id)),
    });
    res.json(
      rows.map(row => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        mine: row.sender_id === user.id,
        sender: personJson(users.find(item => item.id === row.sender_id)),
      }))
    );
  })
);

app.post(
  "/api/reservations/:id/messages",
  route(async (req, res) => {
    const user = await requireUser(req);
    const { reservation, isGuest, isHost } = await loadReservationFor(
      req,
      user
    );
    if (!isGuest && !isHost)
      fail(403, "Apenas hóspede e anfitrião participam da conversa.");
    const body = text(req.body?.body, "Mensagem", 1, 1000);
    const row = await db.insert("messages", {
      reservation_id: reservation.id,
      sender_id: user.id,
      body,
    });
    await db.update(
      "reservations",
      { id: reservation.id },
      isGuest
        ? { guest_read_at: row.created_at }
        : { host_read_at: row.created_at }
    );
    const message = {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      sender: personJson(user),
    };
    const listing = await db.findOne("accommodations", {
      id: reservation.accommodation_id,
    });
    notify([reservation.guest_id, listing?.owner_id], "message", {
      reservationId: reservation.id,
      title: listing?.title || "",
      message,
    });
    res.status(201).json({ ...message, mine: true });
  })
);

// -----------------------------------------------------------------------------
// Pontos Cívicos
// -----------------------------------------------------------------------------

app.get(
  "/api/points",
  route(async (req, res) => {
    res.json(await pointsSummary(await requireUser(req)));
  })
);

app.post(
  "/api/points/redeem",
  route(async (req, res) => {
    const user = await requireUser(req);
    const reward = REWARDS.find(item => item.id === Number(req.body?.rewardId));
    if (!reward) fail(400, "Recompensa inválida.");
    const summary = await pointsSummary(user);
    if (summary.balance < reward.points)
      fail(
        400,
        `Faltam ${reward.points - summary.balance} pontos para este cupom.`
      );
    const code = `SUN-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await db.insert("redemptions", {
      user_id: user.id,
      reward_id: reward.id,
      points: reward.points,
      amount: reward.amount,
      code,
      status: "available",
    });
    res.status(201).json(await pointsSummary(user));
  })
);

// -----------------------------------------------------------------------------
// Área do anfitrião
// -----------------------------------------------------------------------------

function parseListingInput(body: Row) {
  const category = String(body.category || "");
  if (!(CATEGORIES as readonly string[]).includes(category))
    fail(400, "Escolha o tipo de espaço.");
  const amenities = Array.isArray(body.amenities)
    ? unique(body.amenities.map(String))
    : [];
  if (amenities.some(item => !(AMENITIES as readonly string[]).includes(item)))
    fail(400, "Comodidade inválida.");
  const photos = Array.isArray(body.photos) ? body.photos.map(photoUrl) : [];
  if (!photos.length) fail(400, "Adicione pelo menos uma foto do espaço.");
  if (photos.length > 12) fail(400, "Use no máximo 12 fotos.");
  const time = (value: unknown, field: string, fallback: string) => {
    const result = String(value || fallback);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(result))
      fail(400, `${field}: use o formato HH:MM.`);
    return result;
  };
  const price = money(body.price, "Preço por noite", 30, 20000);
  return {
    row: {
      title: text(body.title, "Título", 6, 80),
      district: text(body.district, "Bairro", 2, 60),
      category,
      description: text(body.description, "Descrição", 30, 3000),
      price,
      cleaning_fee: money(body.cleaningFee ?? 0, "Taxa de limpeza", 0, 3000),
      guests: int(body.guests, "Hóspedes", 1, 20),
      bedrooms: int(body.bedrooms, "Quartos", 0, 20),
      beds: int(body.beds, "Camas", 1, 30),
      bathrooms: int(body.bathrooms, "Banheiros", 1, 20),
      min_nights: int(body.minNights ?? 1, "Mínimo de noites", 1, 30),
      amenities,
      house_rules:
        text(body.houseRules, "Regras da casa", 0, 1500, false) || null,
      check_in_time: time(body.checkInTime, "Check-in", "14:00"),
      check_out_time: time(body.checkOutTime, "Check-out", "11:00"),
      local_note: text(body.localNote, "Destaque local", 0, 40, false) || null,
      points: pointsForPrice(price),
    },
    photos,
  };
}

async function savePhotos(listingId: number, urls: string[]) {
  const current = await db.find("accommodation_photos", {
    accommodation_id: listingId,
  });
  const same =
    current.length === urls.length &&
    [...current]
      .sort((a, b) => a.position - b.position)
      .every((photo, index) => photo.url === urls[index]);
  if (same) return;
  await db.remove("accommodation_photos", { accommodation_id: listingId });
  for (const [position, url] of urls.entries())
    await db.insert("accommodation_photos", {
      accommodation_id: listingId,
      url,
      position,
    });
}

async function ownListing(req: Request, user: Row) {
  const listing = await db.findOne("accommodations", { id: idParam(req) });
  if (!listing || (listing.owner_id !== user.id && user.role !== "admin"))
    fail(404, "Anúncio não encontrado.");
  return listing;
}

app.get(
  "/api/host/listings",
  route(async (req, res) => {
    const user = await requireUser(req);
    const rows = await db.find(
      "accommodations",
      { owner_id: user.id },
      { orderBy: "created_at", desc: true }
    );
    const listings = await hydrateListings(rows);
    const reservations = rows.length
      ? await db.find("reservations", {
          accommodation_id: rows.map(row => row.id),
        })
      : [];
    const day = today();
    res.json(
      listings.map(listing => ({
        ...listing,
        pendingRequests: reservations.filter(
          item =>
            item.accommodation_id === listing.id && item.status === "pending"
        ).length,
        upcomingStays: reservations.filter(
          item =>
            item.accommodation_id === listing.id &&
            item.status === "confirmed" &&
            item.check_out > day
        ).length,
      }))
    );
  })
);

app.get(
  "/api/host/listings/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const [listing] = await hydrateListings([await ownListing(req, user)]);
    res.json(listing);
  })
);

app.post(
  "/api/host/listings",
  route(async (req, res) => {
    const user = await requireUser(req);
    if (user.role === "admin")
      fail(400, "Use uma conta comum para anunciar espaços.");
    const { row, photos } = parseListingInput(req.body || {});
    const created = await db.insert("accommodations", {
      ...row,
      owner_id: user.id,
      status: "pending",
      featured: false,
      moderation_note: "Aguardando análise da equipe.",
    });
    await savePhotos(created.id, photos);
    const [listing] = await hydrateListings([created]);
    res.status(201).json(listing);
  })
);

app.put(
  "/api/host/listings/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const current = await ownListing(req, user);
    const { row, photos } = parseListingInput(req.body || {});
    const byAdmin = user.role === "admin" && current.owner_id !== user.id;
    const [updated] = await db.update(
      "accommodations",
      { id: current.id },
      {
        ...row,
        status: byAdmin ? current.status : "pending",
        moderation_note: byAdmin
          ? current.moderation_note
          : "Alterações aguardando nova análise.",
        updated_at: nowIso(),
      }
    );
    await savePhotos(current.id, photos);
    const [listing] = await hydrateListings([updated]);
    res.json(listing);
  })
);

app.patch(
  "/api/host/listings/:id/status",
  route(async (req, res) => {
    const user = await requireUser(req);
    const current = await ownListing(req, user);
    const status = String(req.body?.status || "");
    if (status === "paused" && current.status !== "approved")
      fail(400, "Só anúncios publicados podem ser pausados.");
    if (status === "approved" && current.status !== "paused")
      fail(400, "Só anúncios pausados podem ser reativados.");
    if (!["paused", "approved"].includes(status)) fail(400, "Status inválido.");
    const [updated] = await db.update(
      "accommodations",
      { id: current.id },
      { status, updated_at: nowIso() }
    );
    const [listing] = await hydrateListings([updated]);
    res.json(listing);
  })
);

app.delete(
  "/api/host/listings/:id",
  route(async (req, res) => {
    const user = await requireUser(req);
    const current = await ownListing(req, user);
    const future = (
      await db.find("reservations", {
        accommodation_id: current.id,
        status: "confirmed",
      })
    ).filter(item => item.check_out > today());
    if (future.length)
      fail(
        400,
        "Há reservas confirmadas para este espaço. Cancele-as antes de excluir."
      );
    await db.remove("accommodations", { id: current.id });
    res.json({ ok: true });
  })
);

app.get(
  "/api/host/reviews",
  route(async (req, res) => {
    const user = await requireUser(req);
    const listings = await db.find("accommodations", { owner_id: user.id });
    if (!listings.length) return res.json([]);
    res.json(
      await reviewsJson(
        await db.find("reviews", {
          accommodation_id: listings.map(row => row.id),
          status: "published",
        })
      )
    );
  })
);

// -----------------------------------------------------------------------------
// Administração
// -----------------------------------------------------------------------------

app.get(
  "/api/admin/overview",
  route(async (req, res) => {
    await requireAdmin(req);
    const [users, listings, reservations, reviews, reports] = await Promise.all(
      [
        db.find("users"),
        db.find("accommodations"),
        db.find("reservations"),
        db.find("reviews"),
        db.find("reports", { status: "open" }),
      ]
    );
    const byStatus = (rows: Row[], status: string) =>
      rows.filter(row => row.status === status).length;
    const published = reviews.filter(row => row.status === "published");
    res.json({
      users: {
        total: users.length,
        blocked: byStatus(users, "blocked"),
        hosts: unique(listings.map(row => row.owner_id)).length,
      },
      listings: {
        total: listings.length,
        pending: byStatus(listings, "pending"),
        approved: byStatus(listings, "approved"),
        rejected: byStatus(listings, "rejected"),
        paused: byStatus(listings, "paused"),
      },
      reservations: {
        total: reservations.length,
        pending: byStatus(reservations, "pending"),
        confirmed: byStatus(reservations, "confirmed"),
        cancelled: byStatus(reservations, "cancelled"),
        declined: byStatus(reservations, "declined"),
      },
      reviews: {
        total: reviews.length,
        hidden: byStatus(reviews, "hidden"),
        average: published.length
          ? round1(
              published.reduce((sum, row) => sum + row.rating, 0) /
                published.length
            )
          : null,
      },
      reports: { open: reports.length },
      database: db.kind,
    });
  })
);

app.get(
  "/api/admin/listings",
  route(async (req, res) => {
    await requireAdmin(req);
    const rows = await db.find(
      "accommodations",
      {},
      { orderBy: "created_at", desc: true }
    );
    const [listings, owners, reports] = await Promise.all([
      hydrateListings(rows),
      db.find("users", { id: unique(rows.map(row => row.owner_id)) }),
      db.find("reports", { status: "open" }),
    ]);
    res.json(
      listings.map(listing => ({
        ...listing,
        owner: personJson(
          owners.find(user => user.id === listing.ownerId),
          true
        ),
        openReports: reports.filter(
          item => item.accommodation_id === listing.id
        ).length,
      }))
    );
  })
);

app.patch(
  "/api/admin/listings/:id",
  route(async (req, res) => {
    await requireAdmin(req);
    const listing = await db.findOne("accommodations", { id: idParam(req) });
    if (!listing) fail(404, "Anúncio não encontrado.");
    const patch: Row = { updated_at: nowIso() };
    if (req.body?.status !== undefined) {
      const status = String(req.body.status);
      if (!["approved", "rejected", "paused", "pending"].includes(status))
        fail(400, "Status inválido.");
      patch.status = status;
      const defaults: Record<string, string> = {
        approved: "Aprovado e publicado.",
        rejected: "Recusado pela moderação.",
        paused: "Pausado pela moderação.",
        pending: "Aguardando análise da equipe.",
      };
      patch.moderation_note =
        text(req.body?.note, "Observação", 0, 500, false) || defaults[status];
    }
    if (req.body?.featured !== undefined)
      patch.featured = Boolean(req.body.featured);
    const [updated] = await db.update(
      "accommodations",
      { id: listing.id },
      patch
    );
    const [json] = await hydrateListings([updated]);
    res.json(json);
  })
);

app.delete(
  "/api/admin/listings/:id",
  route(async (req, res) => {
    await requireAdmin(req);
    await db.remove("accommodations", { id: idParam(req) });
    res.json({ ok: true });
  })
);

app.delete(
  "/api/admin/photos/:id",
  route(async (req, res) => {
    await requireAdmin(req);
    await db.remove("accommodation_photos", { id: idParam(req) });
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/users",
  route(async (req, res) => {
    await requireAdmin(req);
    const [users, listings, reservations] = await Promise.all([
      db.find("users", {}, { orderBy: "created_at", desc: true }),
      db.find("accommodations"),
      db.find("reservations"),
    ]);
    res.json(
      users.map(user => ({
        ...userJson(
          user,
          listings.some(row => row.owner_id === user.id)
        ),
        listingsCount: listings.filter(row => row.owner_id === user.id).length,
        tripsCount: reservations.filter(row => row.guest_id === user.id).length,
      }))
    );
  })
);

app.patch(
  "/api/admin/users/:id",
  route(async (req, res) => {
    const admin = await requireAdmin(req);
    const user = await db.findOne("users", { id: String(req.params.id) });
    if (!user) fail(404, "Usuário não encontrado.");
    if (user.id === admin.id || user.role === "admin")
      fail(400, "Não é possível alterar uma conta de administrador.");
    const status = String(req.body?.status || "");
    if (!["active", "blocked"].includes(status)) fail(400, "Status inválido.");
    const [updated] = await db.update("users", { id: user.id }, { status });
    if (status === "blocked") await db.remove("sessions", { user_id: user.id });
    res.json(
      userJson(
        updated,
        Boolean(await db.findOne("accommodations", { owner_id: updated.id }))
      )
    );
  })
);

app.get(
  "/api/admin/reviews",
  route(async (req, res) => {
    await requireAdmin(req);
    res.json(await reviewsJson(await db.find("reviews")));
  })
);

app.patch(
  "/api/admin/reviews/:id",
  route(async (req, res) => {
    await requireAdmin(req);
    const status = String(req.body?.status || "");
    if (!["published", "hidden"].includes(status))
      fail(400, "Status inválido.");
    const [updated] = await db.update(
      "reviews",
      { id: idParam(req) },
      { status }
    );
    if (!updated) fail(404, "Avaliação não encontrada.");
    const [json] = await reviewsJson([updated]);
    res.json(json);
  })
);

app.get(
  "/api/admin/reports",
  route(async (req, res) => {
    await requireAdmin(req);
    const rows = await db.find(
      "reports",
      {},
      { orderBy: "created_at", desc: true }
    );
    const [listings, users] = await Promise.all([
      db.find("accommodations", {
        id: unique(rows.map(row => row.accommodation_id)),
      }),
      db.find("users", { id: unique(rows.map(row => row.user_id)) }),
    ]);
    res.json(
      rows.map(row => ({
        id: row.id,
        reason: row.reason,
        details: row.details || "",
        status: row.status,
        createdAt: row.created_at,
        listing: {
          id: row.accommodation_id,
          title:
            listings.find(item => item.id === row.accommodation_id)?.title ||
            "",
          status:
            listings.find(item => item.id === row.accommodation_id)?.status ||
            "",
        },
        user: personJson(
          users.find(item => item.id === row.user_id),
          true
        ),
      }))
    );
  })
);

app.patch(
  "/api/admin/reports/:id",
  route(async (req, res) => {
    await requireAdmin(req);
    const status = String(req.body?.status || "");
    if (!["open", "resolved"].includes(status)) fail(400, "Status inválido.");
    await db.update("reports", { id: idParam(req) }, { status });
    res.json({ ok: true });
  })
);

app.get(
  "/api/admin/reservations",
  route(async (req, res) => {
    const admin = await requireAdmin(req);
    res.json(await hydrateReservations(await db.find("reservations"), admin));
  })
);

app.all("/api/*", (_req: Request, res: Response) => {
  res.status(404).json({ error: "Rota da API não encontrada." });
});

// =============================================================================
// Inicialização
// =============================================================================

/** Converte o arquivo de demonstração da versão anterior para o formato atual. */
function migrateLegacyDemo(legacy: any) {
  if (!legacy || !Array.isArray(legacy.users)) return null;
  const users = legacy.users.map((user: any) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    password_hash: user.passwordHash,
    role: user.role === "admin" ? "admin" : "user",
    phone: null,
    bio: null,
    avatar_url: null,
    status: "active",
    welcome_points: WELCOME_POINTS,
    created_at: user.created_at || nowIso(),
  }));
  const accommodations = (legacy.accommodations || []).map((item: any) => ({
    ...seedListingRow(
      {
        title: item.title,
        district: item.district,
        category: "Casa inteira",
        price: Number(item.price) || 100,
        cleaningFee: 0,
        guests: 2,
        bedrooms: 1,
        beds: 1,
        bathrooms: 1,
        minNights: 1,
        description: item.description,
        amenities: [],
        houseRules: "",
        localNote: "",
        featured: false,
        photos: [],
      },
      item.owner_id
    ),
    id: item.id,
    status: item.status,
    moderation_note: item.moderation_note || null,
    created_at: item.created_at || nowIso(),
    updated_at: item.created_at || nowIso(),
  }));
  const photos = (legacy.accommodations || [])
    .filter((item: any) => item.image_url)
    .map((item: any, index: number) => ({
      id: index + 1,
      accommodation_id: item.id,
      url: item.image_url,
      position: 0,
      created_at: nowIso(),
    }));
  const ids = new Set(accommodations.map((item: any) => item.id));
  const reviews = (legacy.reviews || [])
    .filter((item: any) => ids.has(item.accommodation_id))
    .map((item: any) => ({
      id: item.id,
      accommodation_id: item.accommodation_id,
      user_id: item.user_id,
      reservation_id: null,
      rating: item.rating,
      body: item.body,
      host_reply: null,
      host_reply_at: null,
      status: "published",
      created_at: item.created_at,
      updated_at: item.created_at,
    }));
  return {
    users,
    sessions: [],
    accommodations,
    accommodation_photos: photos,
    uploads: [],
    redemptions: [],
    reservations: [],
    messages: [],
    reviews,
    favorites: [],
    reports: [],
  };
}

async function ensureAdmin() {
  const existing = await db.findOne("users", { email: ADMIN_EMAIL });
  if (existing) {
    await db.update(
      "users",
      { id: existing.id },
      {
        role: "admin",
        status: "active",
        password_hash: hashPassword(ADMIN_PASSWORD),
      }
    );
  } else {
    await db.insert("users", {
      id: crypto.randomUUID(),
      name: "Admin SunHost",
      email: ADMIN_EMAIL,
      password_hash: hashPassword(ADMIN_PASSWORD),
      role: "admin",
      status: "active",
      welcome_points: 0,
    });
  }
}

async function seedDemo() {
  if (process.env.SEED_DEMO === "false") return;
  if (await db.findOne("users", { email: DEMO_HOST.email })) return;
  const host = await db.insert("users", {
    id: crypto.randomUUID(),
    ...DEMO_HOST,
    password_hash: hashPassword(DEMO_PASSWORD),
    role: "user",
    status: "active",
    welcome_points: WELCOME_POINTS,
  });
  const guest = await db.insert("users", {
    id: crypto.randomUUID(),
    ...DEMO_GUEST,
    password_hash: hashPassword(DEMO_PASSWORD),
    role: "user",
    status: "active",
    welcome_points: WELCOME_POINTS,
  });
  const created: Row[] = [];
  for (const listing of SEED_LISTINGS) {
    const row = await db.insert(
      "accommodations",
      seedListingRow(listing, host.id)
    );
    for (const [position, url] of listing.photos.entries())
      await db.insert("accommodation_photos", {
        accommodation_id: row.id,
        url,
        position,
      });
    created.push(row);
  }
  const day = today();
  const stay = (
    listing: Row,
    checkIn: string,
    nights: number,
    status: string,
    message: string
  ) => {
    const subtotal =
      Number(listing.price) * nights + Number(listing.cleaning_fee);
    return {
      accommodation_id: listing.id,
      guest_id: guest.id,
      check_in: checkIn,
      check_out: addDays(checkIn, nights),
      guests: 2,
      nights,
      price_per_night: Number(listing.price),
      cleaning_fee: Number(listing.cleaning_fee),
      discount: 0,
      total: subtotal,
      points: listing.points,
      message,
      status,
    };
  };
  // Estadia já concluída: libera a avaliação verificada e credita Pontos Cívicos.
  const done = await db.insert(
    "reservations",
    stay(
      created[0],
      addDays(day, -21),
      4,
      "confirmed",
      "Oi, Marina! Vou trabalhar remoto alguns dias na Lagoa."
    )
  );
  await db.insert("messages", {
    reservation_id: done.id,
    sender_id: guest.id,
    body: "Oi, Marina! Vou trabalhar remoto alguns dias na Lagoa.",
  });
  await db.insert("messages", {
    reservation_id: done.id,
    sender_id: host.id,
    body: "Que bom, Lucas! A mesa fica de frente para a janela. Te espero.",
  });
  await db.update(
    "reservations",
    { id: done.id },
    { guest_read_at: nowIso(), host_read_at: nowIso() }
  );
  // Solicitação pendente: aparece no painel da anfitriã para aceitar ou recusar.
  const request = await db.insert(
    "reservations",
    stay(
      created[1],
      addDays(day, 20),
      3,
      "pending",
      "Olá! Gostaria de levar minha família para conhecer a Praia Mole."
    )
  );
  await db.insert("messages", {
    reservation_id: request.id,
    sender_id: guest.id,
    body: "Olá! Gostaria de levar minha família para conhecer a Praia Mole.",
  });
  await db.update(
    "reservations",
    { id: request.id },
    { guest_read_at: nowIso() }
  );
  console.log(
    "Dados de demonstração criados (anfitria@sunhost.local e hospede@sunhost.local)."
  );
}

async function start() {
  const mode = String(process.env.DEMO_MODE || "auto").toLowerCase();
  const demoFile = path.join(ROOT, "sunhost-demo-data.json");
  const useJson = async () => {
    const driver = new JsonDriver(demoFile);
    await driver.init(migrateLegacyDemo);
    db = driver;
  };
  if (mode === "true") await useJson();
  else {
    const driver = new PgDriver(process.env.DATABASE_URL);
    try {
      await driver.init(
        await fs.readFile(path.join(ROOT, "schema.sql"), "utf8")
      );
      db = driver;
    } catch (error) {
      await driver.pool.end().catch(() => undefined);
      if (mode === "false") {
        console.error(
          "Falha ao conectar ao PostgreSQL. Confira se o serviço está ativo e se DATABASE_URL está correta."
        );
        throw error;
      }
      console.warn(
        "PostgreSQL indisponível. SunHost iniciado em modo demonstração local."
      );
      await useJson();
    }
  }
  await ensureAdmin();
  await seedDemo();

  const staticPath = path.join(ROOT, "dist", "public");
  if (existsSync(path.join(staticPath, "index.html"))) {
    app.use(express.static(staticPath, { index: false, maxAge: "1h" }));
    app.get("*", (_req: Request, res: Response) =>
      res.sendFile(path.join(staticPath, "index.html"))
    );
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`SunHost Floripa em http://localhost:${port}`);
    console.log(
      `Persistência: ${db.kind === "postgresql" ? "PostgreSQL" : "modo demonstração local (sunhost-demo-data.json)"}`
    );
  });
}

start().catch(error => {
  console.error("Falha ao iniciar:", error);
  process.exit(1);
});
