-- =====================================================================
-- MIGRATION 004 — Appearance & Branding: layout templates, colour themes,
-- fonts, per-user preferences, versioned publish / rollback, and an
-- accessibility guard that keeps text readable on any brand colour.
-- Run AFTER migrations 001–003 (PostgreSQL 15+).
--
--   Layers (later wins):  platform base tokens → template → school theme → user preferences
--   Status colours (success / warning / danger) are platform-locked: schools cannot recolour them.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. COLOUR MATHS (WCAG 2.x contrast)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION hex_luminance(hex TEXT) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE h TEXT := ltrim(hex, '#'); c NUMERIC[]; i INT; v NUMERIC;
BEGIN
  c := ARRAY[('x' || substr(h,1,2))::bit(8)::int, ('x' || substr(h,3,2))::bit(8)::int, ('x' || substr(h,5,2))::bit(8)::int];
  FOR i IN 1..3 LOOP
    v := c[i] / 255.0;
    c[i] := CASE WHEN v <= 0.03928 THEN v / 12.92 ELSE power((v + 0.055) / 1.055, 2.4) END;
  END LOOP;
  RETURN 0.2126 * c[1] + 0.7152 * c[2] + 0.0722 * c[3];
END $$;

CREATE OR REPLACE FUNCTION contrast_ratio(a TEXT, b TEXT) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE AS $$
  SELECT round((GREATEST(hex_luminance(a), hex_luminance(b)) + 0.05)
             / (LEAST(hex_luminance(a), hex_luminance(b)) + 0.05), 2)
$$;

-- Darken a colour in small steps until white text on it reaches the target ratio
CREATE OR REPLACE FUNCTION accessible_shade(hex TEXT, target NUMERIC DEFAULT 4.5) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE h TEXT := ltrim(hex, '#'); r INT; g INT; b INT; out TEXT; n INT := 0;
BEGIN
  r := ('x' || substr(h,1,2))::bit(8)::int; g := ('x' || substr(h,3,2))::bit(8)::int; b := ('x' || substr(h,5,2))::bit(8)::int;
  out := '#' || upper(h);
  WHILE contrast_ratio('#FFFFFF', out) < target AND n < 40 LOOP
    r := floor(r * 0.94); g := floor(g * 0.94); b := floor(b * 0.94); n := n + 1;
    out := '#' || upper(lpad(to_hex(r),2,'0') || lpad(to_hex(g),2,'0') || lpad(to_hex(b),2,'0'));
  END LOOP;
  RETURN out;
END $$;

-- Mix a colour with white (amount 0..1) — used for light tints (selected rows, chips)
CREATE OR REPLACE FUNCTION tint(hex TEXT, amount NUMERIC) RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE h TEXT := ltrim(hex, '#'); r INT; g INT; b INT;
BEGIN
  r := ('x' || substr(h,1,2))::bit(8)::int; g := ('x' || substr(h,3,2))::bit(8)::int; b := ('x' || substr(h,5,2))::bit(8)::int;
  r := round(r + (255 - r) * amount); g := round(g + (255 - g) * amount); b := round(b + (255 - b) * amount);
  RETURN '#' || upper(lpad(to_hex(r),2,'0') || lpad(to_hex(g),2,'0') || lpad(to_hex(b),2,'0'));
END $$;

-- ---------------------------------------------------------------------
-- 2. CATALOG: layout templates, colour presets, fonts
-- ---------------------------------------------------------------------
CREATE TABLE ui_templates (
  template_id    SERIAL PRIMARY KEY,
  code           VARCHAR(20) UNIQUE NOT NULL,
  name           VARCHAR(60) NOT NULL,
  description    VARCHAR(200),
  nav_position   VARCHAR(6)  NOT NULL CHECK (nav_position IN ('SIDE','TOP','RAIL')),
  default_sidebar VARCHAR(6) NOT NULL CHECK (default_sidebar IN ('DARK','BRAND','LIGHT')),
  default_density VARCHAR(12) NOT NULL CHECK (default_density IN ('COMFORTABLE','COMPACT')),
  default_radius INTEGER NOT NULL,
  min_plan_rank  INTEGER NOT NULL DEFAULT 1,
  sort_order     INTEGER DEFAULT 0
);

CREATE TABLE theme_presets (
  preset_id   SERIAL PRIMARY KEY,
  code        VARCHAR(20) UNIQUE NOT NULL,
  name        VARCHAR(40) NOT NULL,
  primary_hex CHAR(7) NOT NULL,
  sort_order  INTEGER DEFAULT 0
);

CREATE TABLE ui_fonts (
  font_code   VARCHAR(20) PRIMARY KEY,
  family      VARCHAR(60) NOT NULL,
  scripts     VARCHAR(120),                         -- Latin, Devanagari, Tamil ...
  min_plan_rank INTEGER NOT NULL DEFAULT 1
);

-- ---------------------------------------------------------------------
-- 3. SCHOOL THEMES — versioned; one PUBLISHED per school, any number of drafts
-- ---------------------------------------------------------------------
CREATE TABLE tenant_themes (
  theme_id        SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES tenants(tenant_id),
  version_no      INTEGER NOT NULL,
  status          VARCHAR(10) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  template_id     INTEGER NOT NULL REFERENCES ui_templates(template_id),
  preset_id       INTEGER REFERENCES theme_presets(preset_id),
  brand_hex       CHAR(7) NOT NULL,                  -- what the school picked
  primary_hex     CHAR(7),                           -- accessible version actually used (set by trigger)
  primary_tint    CHAR(7),                           -- light background tint (set by trigger)
  contrast_on_primary NUMERIC(4,2),                  -- white text on primary (set by trigger)
  sidebar_style   VARCHAR(6)  NOT NULL CHECK (sidebar_style IN ('DARK','BRAND','LIGHT')),
  radius_px       INTEGER NOT NULL CHECK (radius_px BETWEEN 0 AND 20),
  density         VARCHAR(12) NOT NULL CHECK (density IN ('COMFORTABLE','COMPACT')),
  font_code       VARCHAR(20) NOT NULL REFERENCES ui_fonts(font_code),
  logo_url        VARCHAR(255),
  favicon_url     VARCHAR(255),
  login_image_url VARCHAR(255),
  print_header    BOOLEAN DEFAULT TRUE,              -- logo + colour on receipts, papers, report cards
  tokens          JSONB,                             -- generated design tokens (set by trigger)
  created_by      INTEGER REFERENCES users(user_id),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  published_by    INTEGER REFERENCES users(user_id),
  published_at    TIMESTAMP,
  UNIQUE (tenant_id, version_no)
);
CREATE UNIQUE INDEX one_published_theme ON tenant_themes(tenant_id) WHERE status = 'PUBLISHED';

-- ---------------------------------------------------------------------
-- 4. PER-USER PREFERENCES (applied on top of the school theme)
-- ---------------------------------------------------------------------
CREATE TABLE user_ui_preferences (
  user_id       INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(tenant_id),
  color_mode    VARCHAR(14) NOT NULL DEFAULT 'SYSTEM' CHECK (color_mode IN ('SYSTEM','LIGHT','DARK','HIGH_CONTRAST')),
  text_scale    INTEGER NOT NULL DEFAULT 100 CHECK (text_scale IN (90,100,115,130)),
  density       VARCHAR(12) CHECK (density IN ('COMFORTABLE','COMPACT')),   -- NULL = school default
  language      VARCHAR(10) DEFAULT 'en',
  reduce_motion BOOLEAN DEFAULT FALSE,
  home_widgets  JSONB,                                                     -- dashboard widget order
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------
-- 5. GUARDRAILS: accessible primary, generated tokens, plan checks
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_theme_tokens() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  rank INT; tpl ui_templates%ROWTYPE; fnt ui_fonts%ROWTYPE; preset_only BOOLEAN;
BEGIN
  SELECT p.tier_rank INTO rank FROM tenant_subscriptions s JOIN plans p USING (plan_id)
  WHERE s.tenant_id = NEW.tenant_id AND s.status = 'ACTIVE';
  SELECT * INTO tpl FROM ui_templates WHERE template_id = NEW.template_id;
  SELECT * INTO fnt FROM ui_fonts WHERE font_code = NEW.font_code;

  -- plan gating (add-ons switched on in the console also unlock these)
  IF tpl.min_plan_rank > COALESCE(rank,1) AND NOT EXISTS (
       SELECT 1 FROM v_tenant_features f WHERE f.tenant_id = NEW.tenant_id AND f.code = 'FN_LAYOUT_TEMPLATES' AND f.enabled) THEN
    RAISE EXCEPTION 'Template % is not included in this school''s plan', tpl.code;
  END IF;
  IF fnt.min_plan_rank > COALESCE(rank,1) AND NOT EXISTS (
       SELECT 1 FROM v_tenant_features f WHERE f.tenant_id = NEW.tenant_id AND f.code = 'FN_CUSTOM_FONTS' AND f.enabled) THEN
    RAISE EXCEPTION 'Font % is not included in this school''s plan', fnt.family;
  END IF;
  preset_only := NOT EXISTS (SELECT 1 FROM v_tenant_features f WHERE f.tenant_id = NEW.tenant_id AND f.code = 'FN_CUSTOM_BRAND_COLOR' AND f.enabled);
  IF preset_only AND NOT EXISTS (SELECT 1 FROM theme_presets WHERE upper(primary_hex) = upper(NEW.brand_hex)) THEN
    RAISE EXCEPTION 'Custom brand colours need the Growth plan or the add-on; pick a preset';
  END IF;

  NEW.brand_hex           := upper(NEW.brand_hex);
  NEW.primary_hex         := accessible_shade(NEW.brand_hex, 4.5);
  NEW.contrast_on_primary := contrast_ratio('#FFFFFF', NEW.primary_hex);
  NEW.primary_tint        := tint(NEW.primary_hex, 0.90);
  NEW.tokens := jsonb_build_object(
    'color', jsonb_build_object(
      'primary', NEW.primary_hex, 'onPrimary', '#FFFFFF', 'primaryTint', NEW.primary_tint,
      'primaryHover', accessible_shade(NEW.primary_hex, 6.0),
      'sidebarBg', CASE NEW.sidebar_style WHEN 'DARK' THEN '#111827' WHEN 'BRAND' THEN accessible_shade(NEW.primary_hex, 7.0) ELSE '#FFFFFF' END,
      'sidebarText', CASE NEW.sidebar_style WHEN 'LIGHT' THEN '#14171C' ELSE '#FFFFFF' END,
      'success', '#0F6B32', 'warning', '#8A3B00', 'danger', '#A11A12'),          -- locked
    'layout', jsonb_build_object('nav', tpl.nav_position, 'density', NEW.density, 'radius', NEW.radius_px,
                                 'rowHeight', CASE NEW.density WHEN 'COMPACT' THEN 36 ELSE 44 END),
    'font', jsonb_build_object('family', fnt.family, 'scripts', fnt.scripts),
    'brand', jsonb_build_object('logo', NEW.logo_url, 'favicon', NEW.favicon_url, 'printHeader', NEW.print_header));
  RETURN NEW;
END $$;
CREATE TRIGGER theme_tokens BEFORE INSERT OR UPDATE ON tenant_themes FOR EACH ROW EXECUTE FUNCTION trg_theme_tokens();

-- Publish a draft: archive the current published theme, publish this one (rollback = publish an old version)
CREATE OR REPLACE FUNCTION publish_theme(p_theme_id INTEGER, p_user INTEGER) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE t INT;
BEGIN
  SELECT tenant_id INTO t FROM tenant_themes WHERE theme_id = p_theme_id;
  UPDATE tenant_themes SET status = 'ARCHIVED' WHERE tenant_id = t AND status = 'PUBLISHED';
  UPDATE tenant_themes SET status = 'PUBLISHED', published_by = p_user, published_at = CURRENT_TIMESTAMP WHERE theme_id = p_theme_id;
END $$;

-- What the app loads at sign-in: school theme + this user's preferences
CREATE VIEW v_effective_theme WITH (security_invoker = true) AS
SELECT u.user_id, u.tenant_id, th.version_no,
       th.tokens
       || jsonb_build_object('user', jsonb_build_object(
            'colorMode', COALESCE(p.color_mode, 'SYSTEM'),
            'textScale', COALESCE(p.text_scale, 100),
            'density',   COALESCE(p.density, th.density),
            'language',  COALESCE(p.language, 'en'),
            'reduceMotion', COALESCE(p.reduce_motion, FALSE))) AS theme
FROM users u
LEFT JOIN tenant_themes th ON th.tenant_id = u.tenant_id AND th.status = 'PUBLISHED'
LEFT JOIN user_ui_preferences p ON p.user_id = u.user_id;

-- ---------------------------------------------------------------------
-- 6. ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------
ALTER TABLE tenant_themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_themes
  USING (tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);
ALTER TABLE user_ui_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON user_ui_preferences
  USING (tenant_id = current_setting('app.tenant_id', true)::int)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::int);

-- ---------------------------------------------------------------------
-- 7. SEED
-- ---------------------------------------------------------------------
INSERT INTO ui_templates (code, name, description, nav_position, default_sidebar, default_density, default_radius, min_plan_rank, sort_order) VALUES
 ('CLASSIC', 'Classic',        'Dark side menu, roomy layout — the default',                 'SIDE', 'DARK',  'COMFORTABLE', 10, 1, 1),
 ('BRIGHT',  'Bright',         'Light side menu with brand-coloured highlights',             'SIDE', 'LIGHT', 'COMFORTABLE', 12, 1, 2),
 ('TOPNAV',  'Top navigation', 'Menus across the top; more width for tables and timetables', 'TOP',  'BRAND', 'COMFORTABLE', 8,  3, 3),
 ('COMPACT', 'Compact rail',   'Icon rail and dense tables for office and accounts staff',   'RAIL', 'DARK',  'COMPACT',     6,  3, 4),
 ('PLAYFUL', 'Primary school', 'Large touch targets and soft corners for young learners',    'SIDE', 'BRAND', 'COMFORTABLE', 18, 3, 5);

INSERT INTO theme_presets (code, name, primary_hex, sort_order) VALUES
 ('ROYAL','Royal blue','#2147C7',1), ('SAFFRON','Saffron','#C2410C',2), ('TEAL','Teal','#0F766E',3),
 ('MAROON','Maroon','#9F1239',4), ('FOREST','Forest','#166534',5), ('VIOLET','Violet','#6D28D9',6),
 ('SLATE','Slate','#334155',7), ('GOLD','Gold','#A16207',8);

INSERT INTO ui_fonts VALUES
 ('INTER', 'Inter', 'Latin', 1),
 ('NOTO_SANS', 'Noto Sans', 'Latin, Devanagari, Tamil, Telugu, Kannada, Bengali', 1),
 ('POPPINS', 'Poppins', 'Latin, Devanagari', 3),
 ('NUNITO', 'Nunito', 'Latin', 3);

-- App config: Operations › Appearance & Branding (Admin), plan features
INSERT INTO menus (parent_id, code, label, route, sort_order)
SELECT menu_id, 'OPS_APPEARANCE', 'Appearance & Branding', '/ops/appearance', 5 FROM menus WHERE code = 'OPERATIONS';
INSERT INTO features (parent_id, code, name, kind, menu_id, sort_order)
SELECT pf.feature_id, m.code, m.label, 'SUBMENU', m.menu_id, m.sort_order
FROM menus m JOIN features pf ON pf.code = 'OPERATIONS' WHERE m.code = 'OPS_APPEARANCE';
INSERT INTO features (parent_id, code, name, kind, is_addon_eligible, sort_order)
SELECT f.feature_id, v.code, v.name, 'FUNCTION', v.addon, 200 + v.ord FROM features f JOIN (VALUES
 ('FN_THEME_PRESETS','Colour presets, logo & dark mode',TRUE,1),
 ('FN_CUSTOM_BRAND_COLOR','Custom brand colour',TRUE,2),
 ('FN_LAYOUT_TEMPLATES','Layout templates',TRUE,3),
 ('FN_CUSTOM_FONTS','Extra fonts',TRUE,4),
 ('FN_WHITE_LABEL_APP','White-label mobile app (own name & icon)',TRUE,5)
) AS v(code, name, addon, ord) ON f.code = 'OPERATIONS';
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.plan_id, f.feature_id FROM features f JOIN (VALUES
 ('OPS_APPEARANCE',1),('FN_THEME_PRESETS',1),('FN_CUSTOM_BRAND_COLOR',2),('FN_LAYOUT_TEMPLATES',3),('FN_CUSTOM_FONTS',3),('FN_WHITE_LABEL_APP',4)
) AS v(code, min_rank) ON f.code = v.code JOIN plans p ON p.tier_rank >= v.min_rank;
INSERT INTO role_menu_permissions (role_id, menu_id, can_view, can_create, can_edit, can_delete, can_approve, data_scope)
SELECT r.role_id, m.menu_id, TRUE, TRUE, TRUE, FALSE, TRUE, 'ALL'
FROM roles r JOIN menus m ON m.code = 'OPS_APPEARANCE' WHERE r.code = 'ADMIN';

-- Default theme for every existing school
INSERT INTO tenant_themes (tenant_id, version_no, status, template_id, preset_id, brand_hex, sidebar_style, radius_px, density, font_code)
SELECT t.tenant_id, 1, 'PUBLISHED', tp.template_id, pr.preset_id, pr.primary_hex, 'DARK', 10, 'COMFORTABLE', 'INTER'
FROM tenants t, ui_templates tp, theme_presets pr WHERE tp.code = 'CLASSIC' AND pr.code = 'ROYAL';
