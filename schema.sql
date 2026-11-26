-- =============================================================================
-- SunHost Floripa — schema PostgreSQL (versão final)
-- O servidor aplica este arquivo a cada inicialização. Todas as instruções são
-- idempotentes e também migram bancos criados pelas versões anteriores.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Usuários (hóspede e anfitrião usam a mesma conta; admin modera a plataforma)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_points INTEGER NOT NULL DEFAULT 250;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('active', 'blocked'));

-- Sessões persistentes: o token fica só no navegador; aqui guardamos o hash.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- -----------------------------------------------------------------------------
-- Acomodações (anúncios)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS accommodations (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  district TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL CHECK (price > 0),
  description TEXT NOT NULL,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  moderation_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Casa inteira';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS cleaning_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS guests INTEGER NOT NULL DEFAULT 2;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS bedrooms INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS beds INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS bathrooms INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS min_nights INTEGER NOT NULL DEFAULT 1;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS amenities TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS house_rules TEXT;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_in_time TEXT NOT NULL DEFAULT '14:00';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS check_out_time TEXT NOT NULL DEFAULT '11:00';
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS local_note TEXT;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS points INTEGER NOT NULL DEFAULT 50;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE accommodations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE accommodations DROP CONSTRAINT IF EXISTS accommodations_status_check;
ALTER TABLE accommodations ADD CONSTRAINT accommodations_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paused'));
CREATE INDEX IF NOT EXISTS accommodations_status_idx ON accommodations(status);
CREATE INDEX IF NOT EXISTS accommodations_owner_idx ON accommodations(owner_id);

-- Fotos das acomodações (várias por anúncio, ordenadas)
CREATE TABLE IF NOT EXISTS accommodation_photos (
  id BIGSERIAL PRIMARY KEY,
  accommodation_id BIGINT NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS photos_accommodation_idx ON accommodation_photos(accommodation_id);

-- Migração da versão anterior: a coluna image_url vira a primeira foto.
INSERT INTO accommodation_photos (accommodation_id, url, position)
SELECT a.id, a.image_url, 0 FROM accommodations a
WHERE a.image_url IS NOT NULL AND a.image_url <> ''
  AND NOT EXISTS (SELECT 1 FROM accommodation_photos p WHERE p.accommodation_id = a.id);
UPDATE accommodations SET image_url = NULL WHERE image_url IS NOT NULL;

-- Imagens enviadas pelo dispositivo (fotos de anúncios e avatares)
CREATE TABLE IF NOT EXISTS uploads (
  id BIGSERIAL PRIMARY KEY,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Pontos Cívicos: cupons resgatados
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS redemptions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id INTEGER NOT NULL,
  points INTEGER NOT NULL CHECK (points > 0),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'used')),
  reservation_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS redemptions_user_idx ON redemptions(user_id);

-- -----------------------------------------------------------------------------
-- Reservas (o pagamento é combinado diretamente com o anfitrião)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservations (
  id BIGSERIAL PRIMARY KEY,
  accommodation_id BIGINT NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  guests INTEGER NOT NULL CHECK (guests > 0),
  nights INTEGER NOT NULL CHECK (nights > 0),
  price_per_night NUMERIC(10,2) NOT NULL,
  cleaning_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  redemption_id BIGINT REFERENCES redemptions(id) ON DELETE SET NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  status_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);
-- Momento em que cada lado leu a conversa pela última vez (mensagens não lidas)
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_read_at TIMESTAMPTZ;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS host_read_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS reservations_accommodation_idx ON reservations(accommodation_id);
CREATE INDEX IF NOT EXISTS reservations_guest_idx ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS reservations_status_idx ON reservations(status);

-- Conversa entre hóspede e anfitrião dentro de cada reserva
CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_reservation_idx ON messages(reservation_id);

-- -----------------------------------------------------------------------------
-- Avaliações com estrelas (uma por pessoa por acomodação)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  accommodation_id BIGINT NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reservation_id BIGINT REFERENCES reservations(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  host_reply TEXT,
  host_reply_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (accommodation_id, user_id)
);
CREATE INDEX IF NOT EXISTS reviews_accommodation_idx ON reviews(accommodation_id);

-- Migração: comentários aprovados da versão anterior viram avaliações.
DO $$
BEGIN
  IF to_regclass('public.comments') IS NOT NULL THEN
    INSERT INTO reviews (accommodation_id, user_id, rating, body, created_at)
    SELECT accommodation_id, user_id, rating, body, created_at FROM comments
    WHERE status = 'approved'
    ON CONFLICT (accommodation_id, user_id) DO NOTHING;
    ALTER TABLE comments RENAME TO comments_legacy;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Favoritos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accommodation_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, accommodation_id)
);
DELETE FROM favorites f
WHERE NOT EXISTS (SELECT 1 FROM accommodations a WHERE a.id = f.accommodation_id);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_accommodation_fk') THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_accommodation_fk
      FOREIGN KEY (accommodation_id) REFERENCES accommodations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Denúncias de anúncios (analisadas no painel de administração)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id BIGSERIAL PRIMARY KEY,
  accommodation_id BIGINT NOT NULL REFERENCES accommodations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_status_idx ON reports(status);

-- O administrador é criado/atualizado pelo servidor a partir de ADMIN_EMAIL e
-- ADMIN_PASSWORD. Troque essa senha antes de qualquer uso fora da faculdade.
