-- Create enums
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('new', 'packing', 'ready', 'collected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE delivery_method AS ENUM ('pickup', 'ship');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  short text NOT NULL,
  accent text NOT NULL DEFAULT '#7A1F2B',
  motto text,
  address text,
  shop_hours text,
  shop_email text,
  stripe_account_id text,
  stripe_payouts_enabled boolean DEFAULT false,
  stripe_charges_enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Catalog items
CREATE TABLE IF NOT EXISTS catalog_items (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  size_guide jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Catalog variants
CREATE TABLE IF NOT EXISTS catalog_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
  label text NOT NULL,
  price numeric(10,2) NOT NULL,
  active boolean NOT NULL DEFAULT true
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_mobile text NOT NULL,
  student_name text NOT NULL,
  student_year text NOT NULL,
  student_roll text NOT NULL,
  delivery delivery_method NOT NULL DEFAULT 'pickup',
  delivery_fee numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL,
  gst numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  stripe_payment_intent_id text,
  stripe_ref text,
  status order_status NOT NULL DEFAULT 'new',
  user_id text REFERENCES neon_auth.user(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Order lines
CREATE TABLE IF NOT EXISTS order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  item_name text NOT NULL,
  variant_label text NOT NULL,
  qty integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  line_total numeric(10,2) NOT NULL
);
