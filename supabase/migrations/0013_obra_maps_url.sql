-- Link de rota da obra (Google Maps ou Waze) colado pelo usuário.
-- Tem prioridade sobre as coordenadas no botão "Rota".
alter table public.obras add column if not exists maps_url text;
