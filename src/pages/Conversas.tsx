import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleUserRound,
  ExternalLink,
  MessageCircle,
  MoreVertical,
  Phone,
  Search,
  Send,
  StickyNote,
  UserPlus,
  Users,
  Building2,
  ArrowRightLeft,
  CheckCircle2,
  RotateCcw,
  EyeOff,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { enviarWhatsApp } from "@/lib/whatsapp";
import type { Conversa, Departamento, Lead, Mensagem } from "@/lib/types";
import { Avatar, Button, Input, Select, SeloTipo, Spinner } from "@/components/ui";
import { CampoTags } from "@/components/NovoLead";
import { NovoNegocioModal } from "@/components/NovoNegocio";
import PainelLead from "@/components/PainelLead";
import { cx, linkWhatsApp } from "@/lib/utils";

const nomeLead = (l?: Lead | null) => l?.nome_exibicao || l?.nome || "Sem nome";

/** "14:32" hoje, "ontem", "12/10" */
function quando(iso: string) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === ontem.toDateString()) return "ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
const horaMsg = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

type Aba = "abertos" | "finalizados";

export default function Conversas() {
  const { vendedores } = useData();
  const { profile, isAdmin, pode } = useAuth();
  const [conversas, setConversas] = useState<Conversa[] | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [aba, setAba] = useState<Aba>("abertos");
  const [filtro, setFiltro] = useState<"todas" | "minhas" | "sem">("todas");
  const [busca, setBusca] = useState("");
  const [selId, setSelId] = useState<string | null>(null);
  const selIdRef = useRef<string | null>(null);
  selIdRef.current = selId;

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("conversas")
      .select("*, lead:leads(*)")
      .eq("status", aba === "finalizados" ? "finalizado" : "aberto")
      .order("ultima_msg_em", { ascending: false })
      .limit(200);
    setConversas((data as Conversa[]) ?? []);
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    supabase.from("departamentos").select("*").order("ordem").then(({ data }) => setDepartamentos((data as Departamento[]) ?? []));
  }, []);

  // tempo real: qualquer mudança em conversas/mensagens recarrega a lista
  useEffect(() => {
    const ch = supabase
      .channel("chat-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversas" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens" }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (conversas ?? []).filter((c) => {
      if (filtro === "minhas" && c.atendente_id !== profile?.id) return false;
      if (filtro === "sem" && c.atendente_id) return false;
      if (q && !`${nomeLead(c.lead)} ${c.lead?.telefone ?? ""} ${c.ultima_msg}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [conversas, filtro, busca, profile?.id]);

  const sel = visiveis.find((c) => c.id === selId) ?? conversas?.find((c) => c.id === selId) ?? null;

  return (
    <div className="flex h-[calc(100vh-1rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      <header className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Conversas</h1>
          <p className="text-sm text-slate-500">Atendimento de WhatsApp dentro do CRM</p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white lg:grid-cols-[20rem_1fr_19rem]">
        {/* Lista */}
        <aside className={cx("flex min-h-0 flex-col border-r border-slate-200", sel && "hidden lg:flex")}>
          <div className="border-b border-slate-100 p-2.5">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
              {(["abertos", "finalizados"] as Aba[]).map((a) => (
                <button
                  key={a}
                  onClick={() => { setAba(a); setSelId(null); }}
                  className={cx("rounded-md py-1.5 text-sm font-medium transition", aba === a ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500")}
                >
                  {a === "abertos" ? "Em atendimento" : "Finalizados"}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conversa..." className="py-1.5 pl-8 text-sm" />
            </div>
            {(isAdmin || pode("ver_todas_obras")) && (
              <Select value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)} className="mt-2 py-1.5 text-sm">
                <option value="todas">Todas as conversas</option>
                <option value="minhas">Minhas</option>
                <option value="sem">Sem atendente</option>
              </Select>
            )}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversas === null ? (
              <div className="p-6"><Spinner /></div>
            ) : visiveis.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">
                {aba === "finalizados" ? "Nenhuma conversa finalizada." : "Nenhuma conversa por aqui ainda."}
              </p>
            ) : (
              visiveis.map((c) => (
                <ItemConversa key={c.id} c={c} ativo={c.id === selId} eu={profile?.id} onAbrir={() => setSelId(c.id)} />
              ))
            )}
          </div>
        </aside>

        {/* Thread */}
        <section className={cx("flex min-h-0 flex-col bg-slate-50", !sel && "hidden lg:flex")}>
          {sel ? (
            <Thread
              key={sel.id}
              conversa={sel}
              departamentos={departamentos}
              vendedores={vendedores}
              onVoltar={() => setSelId(null)}
              onMudou={carregar}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400">
              <MessageCircle size={44} />
              <p className="text-sm">Escolha uma conversa para começar</p>
            </div>
          )}
        </section>

        {/* Painel do lead */}
        <aside className="hidden min-h-0 overflow-y-auto border-l border-slate-200 lg:block">
          {sel?.lead ? <LadoLead conversa={sel} /> : <div className="p-6 text-center text-sm text-slate-400">Sem lead selecionado.</div>}
        </aside>
      </div>
    </div>
  );
}

function ItemConversa({ c, ativo, eu, onAbrir }: { c: Conversa; ativo: boolean; eu?: string; onAbrir: () => void }) {
  const nome = nomeLead(c.lead);
  return (
    <button
      onClick={onAbrir}
      className={cx("flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition", ativo ? "bg-aco-50" : "hover:bg-slate-50")}
    >
      <div className="relative">
        <Avatar nome={nome} size={42} />
        {c.nao_lidas > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-green-500 px-1 text-[0.625rem] font-bold text-white">
            {c.nao_lidas}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-marinho-800">{nome}</p>
          <span className="flex-shrink-0 text-[0.6875rem] text-slate-400">{quando(c.ultima_msg_em)}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={cx("truncate text-xs", c.nao_lidas > 0 ? "font-medium text-marinho-800" : "text-slate-500")}>{c.ultima_msg || "—"}</p>
          {c.atendente_id === eu ? (
            <span className="flex-shrink-0 text-[0.625rem] font-semibold text-aco-600">você</span>
          ) : !c.atendente_id ? (
            <span className="flex-shrink-0 rounded bg-amber-50 px-1 text-[0.625rem] font-semibold text-amber-700">sem dono</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function Thread({
  conversa,
  departamentos,
  vendedores,
  onVoltar,
  onMudou,
}: {
  conversa: Conversa;
  departamentos: Departamento[];
  vendedores: { id: string; nome: string }[];
  onVoltar: () => void;
  onMudou: () => void;
}) {
  const { profile, isAdmin, pode } = useAuth();
  const [msgs, setMsgs] = useState<Mensagem[] | null>(null);
  const [texto, setTexto] = useState("");
  const [nota, setNota] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [menu, setMenu] = useState<null | "acoes" | "atendente" | "departamento">(null);
  const [painel, setPainel] = useState(false);
  const [negocio, setNegocio] = useState(false);
  const [ladoAberto, setLadoAberto] = useState(false);
  const fim = useRef<HTMLDivElement>(null);
  const tel = conversa.lead?.telefone;

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("mensagens").select("*").eq("conversa_id", conversa.id).order("criado_em");
    setMsgs((data as Mensagem[]) ?? []);
  }, [conversa.id]);

  useEffect(() => {
    carregar();
    // zera não lidas ao abrir
    if (conversa.nao_lidas > 0) supabase.from("conversas").update({ nao_lidas: 0 }).eq("id", conversa.id).then(() => onMudou());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversa.id]);

  useEffect(() => {
    const ch = supabase
      .channel(`msgs-${conversa.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mensagens", filter: `conversa_id=eq.${conversa.id}` }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversa.id, carregar]);

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setTexto("");
    if (nota) {
      await supabase.from("mensagens").insert({ conversa_id: conversa.id, lead_id: conversa.lead_id, direcao: "nota", texto: t, atendente_id: profile?.id });
      setEnviando(false);
      return;
    }
    // mensagem de saída: grava já (não some se o gateway falhar) e atualiza o status
    const { data } = await supabase
      .from("mensagens")
      .insert({ conversa_id: conversa.id, lead_id: conversa.lead_id, direcao: "sai", texto: t, status: "enviando", atendente_id: profile?.id })
      .select("id")
      .single();
    const r = await enviarWhatsApp({ telefone: tel, mensagem: t });
    if (data?.id) await supabase.from("mensagens").update({ status: r.ok ? "enviada" : "erro" }).eq("id", data.id);
    setEnviando(false);
  }

  async function mudar(patch: Partial<Conversa>) {
    setMenu(null);
    await supabase.from("conversas").update(patch).eq("id", conversa.id);
    onMudou();
  }

  const nome = nomeLead(conversa.lead);
  const atendentes = [profile, ...vendedores.filter((v) => v.id !== profile?.id)].filter(Boolean) as { id: string; nome: string }[];
  const depNome = departamentos.find((d) => d.id === conversa.departamento_id)?.nome;

  return (
    <>
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
        <button onClick={onVoltar} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <Avatar nome={nome} size={38} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-semibold text-marinho-800">
            {nome} {conversa.lead && <SeloTipo tipo={conversa.lead.tipo} />}
          </p>
          <p className="truncate text-xs text-slate-500">
            #{conversa.protocolo}
            {conversa.status === "finalizado" && " · finalizado"}
            {depNome && ` · ${depNome}`}
            {conversa.conexao && ` · ${conversa.conexao}`}
          </p>
        </div>
        <button onClick={() => setLadoAberto(true)} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Dados do lead">
          <CircleUserRound size={20} />
        </button>
        <div className="relative">
          <button onClick={() => setMenu(menu ? null : "acoes")} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Ações">
            <MoreVertical size={20} />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(null)} />
              <div className="absolute right-0 top-10 z-40 w-60 rounded-lg border border-slate-200 bg-white p-1 shadow-cardhover">
                {menu === "acoes" && (
                  <>
                    {conversa.atendente_id !== profile?.id && (
                      <ItemMenu icon={<UserPlus size={15} />} onClick={() => mudar({ atendente_id: profile?.id ?? null })}>Assumir atendimento</ItemMenu>
                    )}
                    <ItemMenu icon={<ArrowRightLeft size={15} />} onClick={() => setMenu("atendente")}>Transferir atendente</ItemMenu>
                    <ItemMenu icon={<Users size={15} />} onClick={() => setMenu("departamento")}>Transferir departamento</ItemMenu>
                    {conversa.status === "aberto" ? (
                      <ItemMenu icon={<CheckCircle2 size={15} />} onClick={() => mudar({ status: "finalizado" })}>Finalizar atendimento</ItemMenu>
                    ) : (
                      <ItemMenu icon={<RotateCcw size={15} />} onClick={() => mudar({ status: "aberto" })}>Reabrir</ItemMenu>
                    )}
                    {(isAdmin || pode("excluir_obras")) && (
                      <ItemMenu icon={<EyeOff size={15} />} perigo onClick={() => mudar({ status: "oculto" })}>Ocultar (spam)</ItemMenu>
                    )}
                  </>
                )}
                {menu === "atendente" &&
                  atendentes.map((a) => (
                    <ItemMenu key={a.id} icon={<CircleUserRound size={15} />} onClick={() => mudar({ atendente_id: a.id })}>
                      {a.nome}{a.id === profile?.id ? " (eu)" : ""}
                    </ItemMenu>
                  ))}
                {menu === "departamento" &&
                  departamentos.map((d) => (
                    <ItemMenu key={d.id} icon={<Users size={15} />} onClick={() => mudar({ departamento_id: d.id })}>{d.nome}</ItemMenu>
                  ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mensagens */}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4 sm:px-6">
        {msgs === null ? (
          <Spinner />
        ) : msgs.length === 0 ? (
          <p className="mt-10 text-center text-sm text-slate-400">Nenhuma mensagem ainda.</p>
        ) : (
          msgs.map((m) => <Balao key={m.id} m={m} />)
        )}
        <div ref={fim} />
      </div>

      {/* Composer */}
      <div className="border-t border-slate-200 bg-white p-3">
        {conversa.status !== "aberto" && (
          <p className="mb-2 flex items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Atendimento finalizado.
            <button onClick={() => mudar({ status: "aberto" })} className="font-semibold text-aco-600 hover:underline">Reabrir</button>
          </p>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => setNota((v) => !v)}
            title="Nota interna (só a equipe vê)"
            className={cx("mb-0.5 grid h-10 w-10 flex-shrink-0 place-items-center rounded-lg border transition", nota ? "border-amber-300 bg-amber-50 text-amber-600" : "border-slate-200 text-slate-400 hover:bg-slate-50")}
          >
            <StickyNote size={18} />
          </button>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder={nota ? "Escreva uma nota interna..." : "Escreva uma mensagem..."}
            className={cx(
              "max-h-28 min-h-[2.5rem] flex-1 resize-none rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2",
              nota ? "border-amber-200 bg-amber-50/40 focus:ring-amber-100" : "border-slate-200 focus:border-aco-500 focus:ring-aco-100"
            )}
          />
          <Button onClick={enviar} disabled={!texto.trim() || enviando} className="mb-0.5 h-10 flex-shrink-0 px-3">
            <Send size={16} /> {nota ? "Anotar" : "Enviar"}
          </Button>
        </div>
        {!nota && !tel && <p className="mt-1.5 text-xs text-amber-700">Este lead não tem telefone — adicione um para enviar pelo WhatsApp.</p>}
      </div>

      {/* Lado do lead no celular */}
      {ladoAberto && (
        <div className="fixed inset-0 z-50 flex justify-end bg-marinho-900/40 lg:hidden" onClick={() => setLadoAberto(false)}>
          <div className="h-full w-[85%] max-w-sm overflow-y-auto bg-white" onClick={(e) => e.stopPropagation()}>
            <LadoLead conversa={conversa} onCriarNegocio={() => { setLadoAberto(false); setNegocio(true); }} onPerfil={() => { setLadoAberto(false); setPainel(true); }} />
          </div>
        </div>
      )}
      {painel && conversa.lead && <PainelLead leadId={conversa.lead.id} onClose={() => setPainel(false)} />}
      {negocio && conversa.lead && (
        <NovoNegocioModalWrap leadId={conversa.lead.id} onClose={() => setNegocio(false)} />
      )}
    </>
  );
}

function Balao({ m }: { m: Mensagem }) {
  if (m.direcao === "nota") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="mb-0.5 flex items-center gap-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-amber-600">
            <StickyNote size={11} /> Nota interna
          </p>
          <p className="whitespace-pre-wrap">{m.texto}</p>
          <p className="mt-0.5 text-right text-[0.625rem] text-amber-500">{horaMsg(m.criado_em)}</p>
        </div>
      </div>
    );
  }
  const saida = m.direcao === "sai";
  return (
    <div className={cx("flex", saida ? "justify-end" : "justify-start")}>
      <div
        className={cx(
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          saida ? "rounded-br-sm bg-aco-500 text-white" : "rounded-bl-sm bg-white text-marinho-800"
        )}
      >
        {m.tipo !== "texto" && (
          <p className={cx("mb-0.5 text-xs italic", saida ? "text-aco-50" : "text-slate-500")}>
            {m.tipo === "imagem" ? "📷 Imagem" : m.tipo === "audio" ? "🎙️ Áudio" : m.tipo === "video" ? "🎬 Vídeo" : "📎 Documento"}
            {m.midia_url && (
              <a href={m.midia_url} target="_blank" rel="noreferrer" className="ml-1 underline">abrir</a>
            )}
          </p>
        )}
        {m.texto && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.texto}</p>}
        <p className={cx("mt-0.5 flex items-center justify-end gap-1 text-[0.625rem]", saida ? "text-aco-100" : "text-slate-400")}>
          {horaMsg(m.criado_em)}
          {saida && (m.status === "erro" ? <AlertTriangle size={11} className="text-amber-200" /> : m.status === "enviando" ? <Clock size={11} /> : m.status === "lida" ? <CheckCheck size={11} /> : <Check size={11} />)}
        </p>
      </div>
    </div>
  );
}

function LadoLead({
  conversa,
  onCriarNegocio,
  onPerfil,
}: {
  conversa: Conversa;
  onCriarNegocio?: () => void;
  onPerfil?: () => void;
}) {
  const { atualizarLead } = useData();
  const { pode } = useAuth();
  const lead = conversa.lead!;
  const [painel, setPainel] = useState(false);
  const [negocio, setNegocio] = useState(false);
  const nome = nomeLead(lead);
  const wa = linkWhatsApp(lead.telefone);
  const abrirPerfil = onPerfil ?? (() => setPainel(true));
  const abrirNegocio = onCriarNegocio ?? (() => setNegocio(true));

  return (
    <div className="p-4">
      <div className="flex flex-col items-center text-center">
        <Avatar nome={nome} size={64} />
        <p className="mt-2 flex items-center gap-1.5 font-semibold text-marinho-800">{nome} <SeloTipo tipo={lead.tipo} /></p>
        {lead.telefone && <p className="text-sm text-slate-500">{lead.telefone}</p>}
        <div className="mt-3 flex gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-green-50 text-green-600" title="WhatsApp"><MessageCircle size={17} /></a>
          )}
          {lead.telefone && (
            <a href={`tel:${lead.telefone.replace(/\s/g, "")}`} className="grid h-9 w-9 place-items-center rounded-full bg-aco-50 text-aco-600" title="Ligar"><Phone size={16} /></a>
          )}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</p>
        <CampoTags tags={lead.tags ?? []} onChange={(t) => atualizarLead(lead.id, { tags: t })} />
      </div>

      <div className="mt-5 space-y-2">
        {pode("cadastrar_obras") && (
          <Button variant="secondary" className="w-full justify-center" onClick={abrirNegocio}>
            <Building2 size={16} /> Criar negócio
          </Button>
        )}
        <Button variant="ghost" className="w-full justify-center" onClick={abrirPerfil}>
          <ExternalLink size={16} /> Abrir perfil completo
        </Button>
      </div>

      {painel && <PainelLead leadId={lead.id} onClose={() => setPainel(false)} />}
      {negocio && <NovoNegocioModalWrap leadId={lead.id} onClose={() => setNegocio(false)} />}
    </div>
  );
}

/** NovoNegocioModal precisa do pipeline/etapa iniciais; usa o primeiro pipeline e sua coluna aberta */
function NovoNegocioModalWrap({ leadId, onClose }: { leadId: string; onClose: () => void }) {
  const { pipelines, etapas, leads } = useData();
  const pipe = pipelines[0];
  const lead = leads.find((l) => l.id === leadId) ?? null;
  if (!pipe) {
    return null;
  }
  const etapa = etapas.find((e) => e.pipeline_id === pipe.id && e.tipo === "aberta")?.id ?? etapas.find((e) => e.pipeline_id === pipe.id)?.id;
  return <NovoNegocioModal pipelineId={pipe.id} etapaId={etapa} leadInicial={lead} onClose={onClose} />;
}

function ItemMenu({ icon, children, onClick, perigo }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; perigo?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx("flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm", perigo ? "text-red-600 hover:bg-red-50" : "text-marinho-800 hover:bg-slate-50")}
    >
      <span className={perigo ? "text-red-500" : "text-slate-400"}>{icon}</span> {children}
    </button>
  );
}
