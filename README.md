# Megamix · Nova Obra

Sistema de **aquisição de novas obras** e **gestão de visitas de vendedores** para uma empresa de concreto usinado e bombeado (São Luís-MA). PWA, mobile-first, com funil kanban, rota do dia, painel de indicadores e backend completo no Supabase.

![stack](https://img.shields.io/badge/React-18-173A5E) ![stack](https://img.shields.io/badge/Vite-5-2E78A8) ![stack](https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth%20%2B%20RLS-16a34a)

## Funcionalidades

- **Funil Kanban** com drag-and-drop (Qualificação → Necessita Análise → Apresentação → Proposta → Ganho → Perdido), filtros (vendedor, zona, status, classificação), busca e realtime.
- **Cadastro de obra** com captura de coordenadas (link do Google Maps ou lat/long) e criação automática da oportunidade em *Qualificação*.
- **Visitas do dia** por vendedor, organizadas por dia, com rota agrupada por proximidade, atualização rápida de status e **exportação da rota em PDF**.
- **Painel comercial** (admin): KPIs, funil, produtividade por vendedor, obras por classificação, **mapa com pins** e **alerta de obras paradas** há 7+ dias.
- **Autenticação e permissões por papel (RLS)**: vendedor enxerga apenas o que é dele; admin vê tudo.
- **PWA** instalável, interface 100% em português, datas em dd/mm/aaaa e moeda em R$.

## Stack

React + TypeScript + Vite · TailwindCSS · tipografia **Figtree** (a fonte da monday.com) · @dnd-kit · Recharts · React-Leaflet (OpenStreetMap) · Supabase (Auth + Postgres + RLS + Realtime).

## Acesso de demonstração

| Papel | E-mail | Senha |
|------|--------|-------|
| Diretor (admin) | `diretor@megamix.com` | `megamix123` |
| Vendedor | `carlos@megamix.com` | `megamix123` |
| Vendedora | `fernanda@megamix.com` | `megamix123` |
| Vendedor | `ricardo@megamix.com` | `megamix123` |

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave publishable do seu projeto Supabase
npm run dev
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave publishable (pública) do Supabase |

## Backend (Supabase)

O schema completo — enums, tabelas, índices, triggers, políticas de RLS e realtime — está em
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

## Deploy

Pronto para a **Vercel** (framework Vite, `npm run build`, SPA rewrite em `vercel.json`).
