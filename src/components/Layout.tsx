import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Filter,
  Building2,
  BarChart3,
  Users,
  ClipboardList,
  LogOut,
  KeyRound,
  UserCog,
  Settings,
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  GripVertical,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Avatar, Button, Field, Input, Modal } from "./ui";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { cx } from "@/lib/utils";
import type { ReactNode } from "react";
import type { Permissao } from "@/lib/types";

const nav: {
  to: string;
  label: string;
  icon: typeof Filter;
  adminOnly?: boolean;
  perm?: Permissao;
}[] = [
  { to: "/pipelines", label: "Pipelines", icon: Filter },
  { to: "/leads", label: "Leads", icon: Users },
  { to: "/relatorios", label: "Relatórios de visita", icon: ClipboardList },
  { to: "/dashboard", label: "Dashboard", icon: BarChart3, perm: "ver_painel" },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
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

function Logo() {
  return (
    <div className="grid h-9 w-9 place-items-center rounded-lg bg-aco-500 text-lg font-black text-white" title="Megamix · Nova Obra">
      M
    </div>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, pode, sair } = useAuth();
  const loc = useLocation();
  const itens = nav.filter((n) => (n.adminOnly ? isAdmin : !n.perm || pode(n.perm)));
  const pendentes = usePendentes(isAdmin);
  const [senhaAberta, setSenhaAberta] = useState(false);
  const [painelAberto, setPainelAberto] = useState(true);
  const noPipeline = loc.pathname === "/" || loc.pathname.startsWith("/pipelines");
  const ativo = (to: string) => (to === "/pipelines" ? noPipeline : loc.pathname.startsWith(to));

  return (
    <div className="flex h-full min-h-screen">
      {/* Trilho de ícones (desktop) */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-16 flex-col items-center border-r border-slate-200 bg-white py-4 lg:flex">
        <Logo />
        <div className="mt-5" title={profile?.nome}>
          <Avatar nome={profile?.nome ?? "?"} size={38} className="bg-slate-100" />
        </div>
        <nav className="mt-6 flex flex-1 flex-col items-center gap-1.5">
          {itens.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              title={n.label}
              className={cx(
                "relative grid h-11 w-11 place-items-center rounded-lg transition",
                ativo(n.to) ? "bg-aco-50 text-aco-600" : "text-marinho-800 hover:bg-slate-100"
              )}
            >
              <n.icon size={19} />
              {n.to === "/configuracoes" && pendentes > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[0.625rem] font-bold text-marinho-900">
                  {pendentes}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1.5">
          <button onClick={() => setSenhaAberta(true)} title="Alterar senha" className="grid h-11 w-11 place-items-center rounded-lg text-marinho-800 hover:bg-slate-100">
            <KeyRound size={20} />
          </button>
          <button onClick={sair} title="Sair" className="grid h-11 w-11 place-items-center rounded-lg text-marinho-800 hover:bg-slate-100">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Painel de pipelines (desktop) */}
      {noPipeline && (
        <div className={cx("no-print fixed inset-y-0 left-16 z-20 hidden border-r border-slate-200 bg-white transition-all lg:block", painelAberto ? "w-72" : "w-0")}>
          <button
            onClick={() => setPainelAberto((v) => !v)}
            className="absolute -right-3 top-[70px] z-10 grid h-6 w-6 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-card hover:text-marinho-800"
            aria-label={painelAberto ? "Recolher pipelines" : "Mostrar pipelines"}
          >
            <ChevronRight size={14} className={painelAberto ? "rotate-180" : ""} />
          </button>
          {painelAberto && <PainelPipelines />}
        </div>
      )}

      {/* Topo mobile */}
      <header className="no-print fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
        <Logo />
        {noPipeline ? (
          <SeletorPipelineMobile />
        ) : (
          <span className="flex-1 truncate font-semibold text-marinho-800">
            <span className="font-black tracking-wide">MEGAMIX</span> <span className="font-medium text-slate-400">· Nova Obra</span>
          </span>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setSenhaAberta(true)} className="grid h-9 w-9 place-items-center text-slate-600" aria-label="Alterar senha">
            <KeyRound size={18} />
          </button>
          <button onClick={sair} className="grid h-9 w-9 place-items-center text-slate-600" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className={cx("min-w-0 flex-1 pb-20 pt-14 lg:pb-0 lg:pt-0", noPipeline && painelAberto ? "lg:ml-[22rem]" : "lg:ml-16")}>
        <div className={cx("px-4 py-5 sm:px-6 lg:py-7", noPipeline ? "h-full" : "mx-auto max-w-7xl")}>{children}</div>
      </main>

      {/* Navegação mobile */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-slate-200 bg-white lg:hidden">
        {itens.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={cx(
              "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[0.625rem] font-medium",
              ativo(n.to) ? "text-aco-600" : "text-slate-500"
            )}
          >
            <n.icon size={19} />
            <span className="truncate">{n.label.split(" ")[0]}</span>
            {n.to === "/configuracoes" && pendentes > 0 && (
              <span className="absolute right-[calc(50%-18px)] top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-1 text-[0.625rem] font-bold text-marinho-900">
                {pendentes}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {senhaAberta && <AlterarSenha onClose={() => setSenhaAberta(false)} />}
    </div>
  );
}

function PainelPipelines() {
  const { pipelines, cards, etapas } = useData();
  const { isAdmin } = useAuth();
  const loc = useLocation();
  const [q, setQ] = useState("");
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [novo, setNovo] = useState(false);
  const atual = loc.pathname.split("/")[2] ?? pipelines[0]?.id;

  const grupos = useMemo(() => {
    const m = new Map<string, typeof pipelines>();
    pipelines
      .filter((p) => !q || p.nome.toLowerCase().includes(q.toLowerCase()))
      .forEach((p) => m.set(p.grupo || "Padrão", [...(m.get(p.grupo || "Padrão") ?? []), p]));
    return Array.from(m.entries());
  }, [pipelines, q]);

  const qtd = (pid: string) => {
    const cols = new Set(etapas.filter((e) => e.pipeline_id === pid && e.tipo === "aberta").map((e) => e.id));
    return cards.filter((c) => cols.has(c.etapa_id)).length;
  };

  return (
    <div className="flex h-full flex-col px-4 py-6">
      <h2 className="text-center text-lg font-semibold text-marinho-800">Pipelines</h2>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <Input value={q} onChange={(e) => setQ(e.target.value)} className="py-2 pl-9" placeholder="" />
      </div>
      {isAdmin && (
        <Button className="mt-4 w-full" onClick={() => setNovo(true)}>
          <Plus size={17} /> Adicionar pipeline
        </Button>
      )}
      <div className="mt-5 flex-1 space-y-3 overflow-y-auto">
        {grupos.map(([grupo, lista]) => {
          const fechado = fechados.has(grupo);
          return (
            <div key={grupo}>
              <button
                onClick={() =>
                  setFechados((s) => {
                    const n = new Set(s);
                    if (n.has(grupo)) n.delete(grupo);
                    else n.add(grupo);
                    return n;
                  })
                }
                className="flex w-full items-center justify-between px-1 py-1.5 font-semibold text-marinho-800"
              >
                {grupo}
                <ChevronDown size={17} className={fechado ? "-rotate-90" : ""} />
              </button>
              {!fechado && (
                <div className="mt-1 space-y-1">
                  {lista.map((p) => (
                    <NavLink
                      key={p.id}
                      to={`/pipelines/${p.id}`}
                      className={cx(
                        "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[0.9375rem]",
                        atual === p.id ? "bg-aco-50 text-marinho-800" : "text-marinho-800 hover:bg-slate-50"
                      )}
                    >
                      <Filter size={17} className={atual === p.id ? "text-aco-500" : "text-slate-400"} />
                      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                      <span className="text-xs text-slate-400">{qtd(p.id) || ""}</span>
                      <GripVertical size={15} className="text-slate-300" />
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {novo && <NovoPipelineModal onClose={() => setNovo(false)} />}
    </div>
  );
}

function SeletorPipelineMobile() {
  const { pipelines } = useData();
  const loc = useLocation();
  const navigate = useNavigate();
  const atual = loc.pathname.split("/")[2] ?? pipelines[0]?.id ?? "";
  return (
    <select
      value={atual}
      onChange={(e) => navigate(`/pipelines/${e.target.value}`)}
      className="min-w-0 flex-1 truncate rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-semibold text-marinho-800"
    >
      {pipelines.map((p) => (
        <option key={p.id} value={p.id}>{p.nome}</option>
      ))}
    </select>
  );
}

function NovoPipelineModal({ onClose }: { onClose: () => void }) {
  const { criarPipeline } = useData();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  return (
    <Modal open onClose={onClose} title="Adicionar pipeline">
      <div className="space-y-4">
        <Field label="Nome *">
          <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Clientes ativos, Bombeamento..." />
        </Field>
        <Field label="Descrição">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Funil básico de vendas" />
        </Field>
        <p className="text-xs text-slate-500">Ele já começa com as colunas Novo, Em andamento, Ganho e Perdido — dá para renomear depois.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!nome.trim() || salvando}
            onClick={async () => {
              setSalvando(true);
              const id = await criarPipeline(nome.trim(), descricao.trim());
              setSalvando(false);
              if (id) {
                onClose();
                navigate(`/pipelines/${id}`);
              }
            }}
          >
            {salvando ? "Criando..." : "Criar pipeline"}
          </Button>
        </div>
      </div>
    </Modal>
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
