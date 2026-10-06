import { NavLink, useLocation } from "react-router-dom";
import { KanbanSquare, Building2, MapPinned, BarChart3, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/utils";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Funil", icon: KanbanSquare, end: true },
  { to: "/obras/nova", label: "Nova obra", icon: Building2 },
  { to: "/visitas", label: "Visitas", icon: MapPinned },
  { to: "/dashboard", label: "Painel", icon: BarChart3, adminOnly: true },
];

function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-aco-500 text-white font-black">M</div>
      {!compact && (
        <div className="leading-tight">
          <p className="font-black text-white">Megamix</p>
          <p className="text-[11px] text-aco-100">Nova Obra</p>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, sair } = useAuth();
  const loc = useLocation();
  const itens = nav.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-full">
      {/* Sidebar desktop */}
      <aside className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col bg-marinho-700 px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {itens.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  isActive ? "bg-white/15 text-white" : "text-aco-100 hover:bg-white/10 hover:text-white"
                )
              }
            >
              <n.icon size={19} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="truncate text-sm font-bold text-white">{profile?.nome}</p>
          <p className="truncate text-[11px] text-aco-100">
            {isAdmin ? "Diretor Comercial" : "Vendedor"}
          </p>
          <button
            onClick={sair}
            className="mt-2 flex items-center gap-2 text-xs font-semibold text-aco-100 hover:text-white"
          >
            <LogOut size={14} /> Sair
          </button>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-marinho-700 px-4 py-3 lg:hidden">
        <Logo />
        <button onClick={sair} className="flex items-center gap-1.5 text-sm font-semibold text-aco-100">
          <LogOut size={16} /> Sair
        </button>
      </header>

      {/* Conteúdo */}
      <main className="pb-24 lg:ml-60 lg:pb-0">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:py-8">{children}</div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        {itens.map((n) => {
          const active = n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to);
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold",
                active ? "text-aco-600" : "text-slate-400"
              )}
            >
              <n.icon size={21} />
              {n.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
