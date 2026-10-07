import { NavLink, useLocation } from "react-router-dom";
import { KanbanSquare, Building2, MapPinned, BarChart3, Users, ClipboardList, LogOut, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input, Modal } from "./ui";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/utils";
import type { ReactNode } from "react";
import type { Permissao } from "@/lib/types";

const nav: {
  to: string;
  label: string;
  curto: string;
  icon: typeof KanbanSquare;
  end?: boolean;
  adminOnly?: boolean;
  perm?: Permissao;
}[] = [
  { to: "/", label: "Funil", curto: "Funil", icon: KanbanSquare, end: true },
  { to: "/obras/nova", label: "Nova obra", curto: "Obra", icon: Building2, perm: "cadastrar_obras" },
  { to: "/visitas", label: "Visitas do dia", curto: "Visitas", icon: MapPinned },
  { to: "/relatorios", label: "Relatórios de visita", curto: "Relatórios", icon: ClipboardList },
  { to: "/equipe", label: "Equipe e acessos", curto: "Equipe", icon: Users, adminOnly: true },
  { to: "/dashboard", label: "Painel", curto: "Painel", icon: BarChart3, perm: "ver_painel" },
];

/** Quantos cadastros aguardam liberação (só para o administrador) */
function usePendentes(ativo: boolean) {
  const [qtd, setQtd] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const contar = async () => {
      const { count } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pendente");
      setQtd(count ?? 0);
    };
    contar();
    const ch = supabase
      .channel("pendentes-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, contar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ativo]);
  return qtd;
}

function Contador({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-black text-marinho-900">
      {n}
    </span>
  );
}

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
  const { profile, isAdmin, pode, sair } = useAuth();
  const loc = useLocation();
  const itens = nav.filter((n) => (n.adminOnly ? isAdmin : !n.perm || pode(n.perm)));
  const pendentes = usePendentes(isAdmin);
  const [senhaAberta, setSenhaAberta] = useState(false);

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
              {n.to === "/equipe" && <Contador n={pendentes} />}
            </NavLink>
          ))}
        </nav>
        <div className="rounded-xl bg-white/10 p-3">
          <p className="truncate text-sm font-bold text-white">{profile?.nome}</p>
          <p className="truncate text-[11px] text-aco-100">
            {isAdmin ? "Administrador" : "Vendedor"}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => setSenhaAberta(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-aco-100 hover:text-white"
            >
              <KeyRound size={14} /> Senha
            </button>
            <button
              onClick={sair}
              className="flex items-center gap-1.5 text-xs font-semibold text-aco-100 hover:text-white"
            >
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </aside>

      {/* Topbar mobile */}
      <header className="no-print sticky top-0 z-30 flex items-center justify-between bg-marinho-700 px-4 py-3 lg:hidden">
        <Logo />
        <div className="flex items-center gap-4">
          <button onClick={() => setSenhaAberta(true)} className="text-aco-100" aria-label="Alterar senha">
            <KeyRound size={18} />
          </button>
          <button onClick={sair} className="flex items-center gap-1.5 text-sm font-semibold text-aco-100">
            <LogOut size={16} /> Sair
          </button>
        </div>
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
                "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 whitespace-nowrap py-2.5 text-[10px] font-semibold",
                active ? "text-aco-600" : "text-slate-400"
              )}
            >
              <n.icon size={21} />
              {n.curto}
              {n.to === "/equipe" && pendentes > 0 && (
                <span className="absolute right-[calc(50%-18px)] top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-marinho-900">
                  {pendentes}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {senhaAberta && <AlterarSenha onClose={() => setSenhaAberta(false)} />}
    </div>
  );
}

function AlterarSenha({ onClose }: { onClose: () => void }) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (senha.length < 8) return setMsg({ ok: false, texto: "Use pelo menos 8 caracteres." });
    if (senha !== confirma) return setMsg({ ok: false, texto: "As senhas não conferem." });
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error) return setMsg({ ok: false, texto: "Não foi possível alterar. Tente uma senha diferente." });
    setMsg({ ok: true, texto: "Senha alterada! Use a nova senha no próximo acesso." });
    setTimeout(onClose, 1500);
  }

  return (
    <Modal open onClose={onClose} title="Alterar minha senha">
      <div className="space-y-4">
        <Field label="Nova senha">
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repita a nova senha">
          <Input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
        </Field>
        {msg && (
          <p className={cx("rounded-xl px-3 py-2 text-sm font-medium", msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700")}>
            {msg.texto}
          </p>
        )}
        <Button className="w-full" size="lg" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar nova senha"}
        </Button>
      </div>
    </Modal>
  );
}
