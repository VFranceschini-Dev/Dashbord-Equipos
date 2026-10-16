#!/usr/bin/env bash
# setup-supabase-auth.sh — deja lista la migración de login a Supabase Auth.
# Uso:  ./setup-supabase-auth.sh "https://XXXX.supabase.co" "anon-public-key"
set -euo pipefail

BRANCH="qwen-code-09a0b03f-f6cb-49b8-a002-a7116cdf906e"
TITLE="Migrar login a Supabase Auth"
URL="${1:-}"
KEY="${2:-}"

echo "==> 1/5 Verificando rama y estado del repo..."
git fetch origin main 2>/dev/null || true
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  echo "ERROR: no existe la rama $BRANCH (¿clonaste el fork?)" >&2; exit 1
fi
git checkout "$BRANCH"

echo "==> 2/5 Configurando variables de entorno (.env)..."
if [[ -n "$URL" && -n "$KEY" ]]; then
  cp .env.example .env
  sed -i "s|VITE_SUPABASE_URL=.*|VITE_SUPABASE_URL=$URL|" .env
  sed -i "s|VITE_SUPABASE_ANON_KEY=.*|VITE_SUPABASE_ANON_KEY=$KEY|" .env
  echo ".env generado desde .env.example"
else
  if [[ -f .env ]]; then echo ".env ya existe, no se toca."; else
    echo "AVISO: sin argumentos y sin .env — copiá .env.example a .env y completá las credenciales." >&2
  fi
fi

echo "==> 3/5 Instalando dependencias y compilando..."
npm install
npm run build
echo "Build OK ✓"

echo "==> 4/5 SQL para ejecutar en Supabase (SQL Editor o supabase db push):"
cat > supabase-auth-setup.sql << 'SQL'
-- Tabla de perfiles: role = 'admin' | 'user'
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'user' check (role in ('admin','user')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario puede leer su propio perfil...
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
-- ...y los admins pueden leer todos los perfiles.
create policy "profiles_select_admin" on public.profiles
  for select using (
    exists (select 1 from public.profiles p
            where p.id = auth.uid() and p.role = 'admin')
  );

-- Trigger: crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'user')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Alta del admin inicial (reemplazá el email/contraseña):
-- insert into auth.users (instance_id, aud, role, email, encrypted_password, email_confirmed_at)
-- values ('00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@dominio.com',
--         crypt('CambiarEstaClave1!', gen_salt('bf')), now());
-- update auth.users set raw_user_meta_data = jsonb_set(raw_user_meta_data,'{role}','"admin"')
--   where email='admin@dominio.com';
-- Nota: si activaste "Confirm email" en Supabase Auth, ese INSERT no alcanza
-- para que el login funcione; lo más simple es crear el usuario desde
-- Supabase Dashboard > Authentication > Add user (con "Auto-confirm user" tildado)
-- y recién después ejecutar el UPDATE de role de arriba.
SQL
echo "Generado supabase-auth-setup.sql — ejecutalo en Supabase > SQL Editor."

echo "==> 5/5 Push y creación del Pull Request..."
REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
[[ "$REMOTE" == *github.com* ]] || {
  echo "AVISO: remoto no configurado. Ejecutá:"
  echo "  git remote add origin https://github.com/<org>/<repo>.git"
  echo "y volvé a correr este script."
  exit 0
}
git push -u origin "$BRANCH"

if command -v gh >/dev/null 2>&1; then
  gh pr create --base main --head "$BRANCH" --title "$TITLE" \
    --body "Migra el login del frontend hardcodeado a Supabase Auth (signInWithPassword + sesión persistente + tabla profiles). Requiere VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY y ejecutar supabase-auth-setup.sql."
  echo "PR creado ✓"
else
  echo "Sin CLI gh: abrilo manualmente en"
  echo "  https://github.com/$(basename $(dirname $REMOTE))/$(basename $REMOTE .git)/compare/main...$BRANCH?expand=1&title=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$TITLE")"
fi

echo "Listo. Acordate: .env y supabase-auth-setup.sql no deben commitearse con claves reales"
echo "(el repo ya ignora .env; sumá supabase-auth-setup.sql a .gitignore si lo llenás de datos)."
