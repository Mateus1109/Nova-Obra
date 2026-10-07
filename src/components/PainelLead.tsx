import { useEffect, useMemo, useState } from "react";
import {
  X,
  User,
  Briefcase,
  Activity,
  History,
  Users,
  MapPin,
  ClipboardList,
  ChevronRight,
  Pencil,
  Tag as TagIcon,
  MessageCircle,
  Phone,
  Mail,
  Plus,
  Star,
  Building2,
  HardHat,
  Navigation,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { tituloCard, useData, type Card } from "@/lib/data";
import { Avatar, Button, CampoEditavel, Select, SeloTipo, Tag } from "./ui";
import { CampoTags, NovoLeadModal } from "./NovoLead";
import { BuscaLead, NovoNegocioModal } from "./NovoNegocio";
import { ListaAtividades } from "./Atividades";
import { ListaVisitas, SecaoObra } from "./SecaoObra";
import { CLASSIFICACOES, ORIGENS, SEGMENTOS, type Classificacao, type Historico, type Lead, type RelatorioVisita } from "@/lib/types";
import { brl, corAvatar, cx, dataBR, linkWhatsApp, mapsLink } from "@/lib/utils";

type Secao = "perfil" | "negocio" | "negocios" | "atividades" | "visitas" | "historico" | "pessoas" | "endereco";

const ITENS: { key: Secao; label: string; icon: typeof User }[] = [
  { key: "perfil", label: "Perfil", icon: User },
  { key: "negocio", label: "Negócio e obra", icon: HardHat },
  { key: "negocios", label: "Negócios", icon: Briefcase },
  { key: "atividades", label: "Atividades", icon: Activity },
  { key: "visitas", label: "Visitas", icon: ClipboardList },
  { key: "historico", label: "Históricos", icon: History },
  { key: "pessoas", label: "Pessoas", icon: Users },
  { key: "endereco", label: "Endereços", icon: MapPin },
];

export default function PainelLead({
  leadId,
  cardId,
  onClose,
  onMudarEtapa,
}: {
  leadId?: string | null;
  cardId?: string | null;
  onClose: () => void;
  /** Mudança de etapa passa pelo quadro (pede confirmação em ganho/perdido) */
  onMudarEtapa?: (card: Card, etapaId: string) => void;
}) {
  const { cards, leads, etapas, pipelines, vendedores, atualizarLead, atualizarOportunidade, setResponsavel, moverEtapa, recarregar } =
    useData();
  const { isAdmin, pode } = useAuth();
  const podeMover = pode("mover_funil");
  const [cardAtivoId, setCardAtivoId] = useState<string | null>(cardId ?? null);
  const [leadAtualId, setLeadAtualId] = useState<string | null>(leadId ?? null);
  const card = cards.find((c) => c.id === cardAtivoId) ?? null;
  const lead: Lead | null = leads.find((l) => l.id === (leadAtualId ?? card?.lead_id)) ?? card?.lead ?? null;
  const negocios = useMemo(() => (lead ? cards.filter((c) => c.lead_id === lead.id) : card ? [card] : []), [cards, lead, card]);
  const [secao, setSecao] = useState<Secao>(cardId ? "negocio" : "perfil");
  const [editTags, setEditTags] = useState(false);

  const nome = lead ? lead.nome_exibicao || lead.nome : card ? tituloCard(card) : "—";
  const cor = corAvatar(nome);
  const ganhou = negocios.some((c) => etapas.find((e) => e.id === c.etapa_id)?.tipo === "ganho");
  const wa = linkWhatsApp(lead?.telefone);
  const itens = ITENS.filter((i) => (i.key === "negocio" ? !!card : i.key === "pessoas" ? !!lead : true));

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const mudarEtapa = (etapaId: string) => {
    if (!card) return;
    if (onMudarEtapa) onMudarEtapa(card, etapaId);
    else moverEtapa(card.id, etapaId);
  };
  const salvarLead = (patch: Partial<Lead>) => lead && atualizarLead(lead.id, patch);
  const colunasDoCard = card
    ? etapas.filter((e) => e.pipeline_id === etapas.find((x) => x.id === card.etapa_id)?.pipeline_id)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-marinho-900/40" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-[1180px] flex-col overflow-hidden bg-slate-50 shadow-cardhover lg:w-[calc(100%-96px)] lg:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-card hover:bg-slate-50 lg:left-3 lg:right-auto"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {/* -------- Coluna da esquerda -------- */}
        <aside className="flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:w-[21rem]">
          <div className="h-24" style={{ background: cor.banner }} />
          <div className="-mt-14 flex flex-col items-center px-6 text-center">
            <div className="relative">
              <div className="rounded-full bg-white p-1.5">
                <Avatar nome={nome} size={100} />
              </div>
              <button
                onClick={() => setSecao("perfil")}
                className="absolute bottom-2 right-1 grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-marinho-800 shadow-card hover:bg-slate-50"
                aria-label="Editar perfil"
              >
                <Pencil size={15} />
              </button>
            </div>
            <h2 className="mt-2 text-xl font-semibold text-marinho-800">{nome}</h2>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <span
                className={cx(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  ganhou ? "border-green-300 bg-green-50 text-green-700" : "border-rose-300 bg-rose-50 text-rose-600"
                )}
              >
                {ganhou ? "Cliente" : "Lead"}
              </span>
              {lead && <SeloTipo tipo={lead.tipo} />}
            </div>

            {/* Tags */}
            {lead && (
              <div className="mt-3 w-full">
                {editTags ? (
                  <div className="text-left">
                    <CampoTags
                      tags={lead.tags ?? []}
                      onChange={(t) => salvarLead({ tags: t })}
                      sugestoes={Array.from(new Set(leads.flatMap((l) => l.tags ?? [])))}
                    />
                    <button onClick={() => setEditTags(false)} className="mt-1 text-xs font-medium text-aco-600">
                      Concluir
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {(lead.tags ?? []).map((t) => (
                      <Tag key={t}>{t}</Tag>
                    ))}
                    <button
                      onClick={() => setEditTags(true)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-[0.6875rem] text-slate-500 hover:border-aco-500 hover:text-aco-600"
                    >
                      <Plus size={11} /> <TagIcon size={11} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Contato rápido */}
            {lead && (lead.telefone || lead.email) && (
              <div className="mt-4 flex gap-2">
                {wa && (
                  <a href={wa} target="_blank" rel="noreferrer" className="grid h-9 w-9 place-items-center rounded-full bg-green-50 text-green-600 hover:bg-green-100" title="WhatsApp">
                    <MessageCircle size={17} />
                  </a>
                )}
                {lead.telefone && (
                  <a href={`tel:${lead.telefone.replace(/\s/g, "")}`} className="grid h-9 w-9 place-items-center rounded-full bg-aco-50 text-aco-600 hover:bg-aco-100" title="Ligar">
                    <Phone size={16} />
                  </a>
                )}
                {lead.email && (
                  <a href={`mailto:${lead.email}`} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200" title="E-mail">
                    <Mail size={16} />
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3 px-6 pt-5">
            <div>
              <p className="mb-1.5 text-left text-[0.8125rem] text-slate-500">Atendente responsável</p>
              {card ? (
                <Select value={card.vendedor_id ?? ""} disabled={!isAdmin} onChange={(e) => setResponsavel(card.id, e.target.value || null)}>
                  <option value="">+ Atribuir atendente</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </Select>
              ) : (
                <Select value={lead?.responsavel_id ?? ""} disabled={!isAdmin || !lead} onChange={(e) => salvarLead({ responsavel_id: e.target.value || null })}>
                  <option value="">+ Atribuir atendente</option>
                  {vendedores.map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
                </Select>
              )}
            </div>
            {card && (
              <>
                <div>
                  <p className="mb-1.5 text-left text-[0.8125rem] text-slate-500">
                    Etapa · {pipelines.find((p) => p.id === colunasDoCard[0]?.pipeline_id)?.nome}
                  </p>
                  <Select value={card.etapa_id} disabled={!podeMover} onChange={(e) => mudarEtapa(e.target.value)}>
                    {colunasDoCard.map((e) => (
                      <option key={e.id} value={e.id}>{e.nome}</option>
                    ))}
                  </Select>
                </div>
              </>
            )}
          </div>

          <nav className="flex gap-1 overflow-x-auto px-4 py-5 lg:flex-col lg:overflow-visible">
            {itens.map((i) => (
              <button
                key={i.key}
                onClick={() => setSecao(i.key)}
                className={cx(
                  "flex flex-shrink-0 items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition lg:w-full",
                  secao === i.key ? "bg-aco-50 text-aco-600" : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <i.icon size={17} />
                <span className="flex-1 text-left">{i.label}</span>
                {secao === i.key && <ChevronRight size={16} className="hidden lg:block" />}
              </button>
            ))}
          </nav>
        </aside>

        {/* -------- Conteúdo -------- */}
        <main className="flex-1 overflow-y-auto p-4 pt-14 sm:p-6 lg:pt-6">
          {secao === "perfil" && (
            <SecaoPerfil lead={lead} card={card} onVincularLead={async (id) => {
              if (!card) return;
              await atualizarOportunidade(card.id, { lead_id: id });
              setLeadAtualId(id);
              recarregar();
            }} />
          )}
          {secao === "negocio" && card && <SecaoNegocio card={card} />}
          {secao === "negocios" && (
            <SecaoNegocios
              lead={lead}
              negocios={negocios}
              onAbrir={(id) => {
                setCardAtivoId(id);
                setSecao("negocio");
              }}
            />
          )}
          {secao === "atividades" && (
            <Bloco titulo="Atividades">
              <div className="p-5">
                <ListaAtividades oportunidadeIds={card ? [card.id, ...negocios.filter((n) => n.id !== card.id).map((n) => n.id)] : negocios.map((n) => n.id)} leadId={lead?.id ?? null} />
              </div>
            </Bloco>
          )}
          {secao === "visitas" && <SecaoVisitas obraIds={negocios.map((n) => n.obra_id).filter(Boolean) as string[]} />}
          {secao === "historico" && <SecaoHistorico negocioIds={negocios.map((n) => n.id)} leadId={lead?.id ?? null} />}
          {secao === "pessoas" && lead && <SecaoPessoas lead={lead} onAbrir={(id) => { setLeadAtualId(id); setCardAtivoId(null); setSecao("perfil"); }} />}
          {secao === "endereco" && (
            <SecaoEndereco lead={lead} card={card} onSalvar={salvarLead} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ---------------- Blocos ---------------- */

function Bloco({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

function SecaoPerfil({ lead, card, onVincularLead }: { lead: Lead | null; card: Card | null; onVincularLead: (id: string) => void }) {
  const { leads, atualizarLead } = useData();
  const [criando, setCriando] = useState<string | null>(null);
  const [vincular, setVincular] = useState(false);

  if (!lead)
    return (
      <Bloco titulo="Lead do negócio">
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-600">
            Este negócio{card?.obra ? ` (obra ${card.obra.nome_obra})` : ""} ainda não tem um lead. Vincule a construtora ou o cliente:
          </p>
          <BuscaLead valor={null} onChange={(l) => l && onVincularLead(l.id)} onCriarNovo={(n) => setCriando(n || card?.obra?.construtora || "")} />
        </div>
        {criando !== null && (
          <NovoLeadModal nomeInicial={criando} onClose={() => setCriando(null)} onCriado={(l) => onVincularLead(l.id)} />
        )}
      </Bloco>
    );

  const s = (patch: Partial<Lead>) => atualizarLead(lead.id, patch);
  const empresa = lead.tipo === "empresa";
  const vinculado = empresa
    ? leads.find((l) => l.id === lead.contato_principal_id)
    : leads.find((l) => l.id === lead.empresa_id);
  const insta = lead.instagram
    ? lead.instagram.startsWith("http")
      ? lead.instagram
      : `https://www.instagram.com/${lead.instagram.replace(/^@/, "")}`
    : null;

  return (
    <>
      <Bloco titulo="Dados cadastrais">
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2">
          <CampoEditavel label={empresa ? "Razão social" : "Nome"} valor={lead.nome} onSalvar={(v) => v && s({ nome: v })} />
          <CampoEditavel label={empresa ? "Nome fantasia" : "Nome de exibição"} valor={lead.nome_exibicao} onSalvar={(v) => s({ nome_exibicao: v })} />
          <CampoEditavel label="Origem" valor={lead.origem} opcoes={ORIGENS} onSalvar={(v) => s({ origem: v })} />
          {empresa ? (
            <CampoEditavel label="Site" valor={lead.site} tipo="url" link={lead.site ? (lead.site.startsWith("http") ? lead.site : `https://${lead.site}`) : null} onSalvar={(v) => s({ site: v })} />
          ) : (
            <CampoEditavel label="Cargo" valor={lead.cargo} onSalvar={(v) => s({ cargo: v })} />
          )}
          <CampoEditavel label="Instagram" valor={lead.instagram} link={insta} onSalvar={(v) => s({ instagram: v })} />
          <CampoEditavel
            label={empresa ? "Data de fundação" : "Data de nascimento"}
            valor={lead.data_referencia}
            tipo="date"
            onSalvar={(v) => s({ data_referencia: v || null })}
          />
          <CampoEditavel label="Documento" valor={lead.documento} onSalvar={(v) => s({ documento: v })} />
          {empresa && <CampoEditavel label="Segmento" valor={lead.segmento} opcoes={SEGMENTOS} onSalvar={(v) => s({ segmento: v })} />}
        </div>
      </Bloco>

      <Bloco titulo="Contatos">
        <div className="divide-y divide-slate-100">
          <LinhaContato rotulo="E-mail" valor={lead.email} tipo="email" onSalvar={(v) => s({ email: v })} />
          <LinhaContato rotulo="Telefone" valor={lead.telefone} tipo="tel" onSalvar={(v) => s({ telefone: v })} />
        </div>
      </Bloco>

      <Bloco titulo={empresa ? "Contato principal" : "Empresa associada"}>
        <div className="p-5">
          {vinculado ? (
            <div className="flex items-center gap-3">
              <Avatar nome={vinculado.nome} size={38} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-marinho-800">{vinculado.nome_exibicao || vinculado.nome}</p>
                <p className="text-xs text-slate-500">{[vinculado.cargo, vinculado.telefone].filter(Boolean).join(" · ") || "Sem contato"}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => s(empresa ? { contato_principal_id: null } : { empresa_id: null })}>
                Desvincular
              </Button>
            </div>
          ) : vincular ? (
            <BuscaLead
              valor={null}
              filtro={(l) => l.tipo === (empresa ? "pessoa" : "empresa") && l.id !== lead.id}
              onChange={(l) => {
                if (!l) return;
                if (empresa) {
                  s({ contato_principal_id: l.id });
                  if (!l.empresa_id) atualizarLead(l.id, { empresa_id: lead.id });
                } else s({ empresa_id: l.id });
                setVincular(false);
              }}
              onCriarNovo={(n) => setCriando(n)}
            />
          ) : (
            <button
              onClick={() => setVincular(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-aco-200 py-3 text-sm font-medium text-aco-600 hover:bg-aco-50 sm:w-2/3"
            >
              <Users size={16} /> + {empresa ? "Vincular pessoa" : "Vincular empresa"}
            </button>
          )}
        </div>
        {criando !== null && (
          <NovoLeadModal
            tipoInicial={empresa ? "pessoa" : "empresa"}
            empresaInicialId={empresa ? lead.id : null}
            nomeInicial={criando}
            onClose={() => setCriando(null)}
            onCriado={(l) => {
              if (empresa) s({ contato_principal_id: l.id });
              else s({ empresa_id: l.id });
              setVincular(false);
            }}
          />
        )}
      </Bloco>

      <Bloco titulo="Notas">
        <NotasLead lead={lead} />
      </Bloco>
    </>
  );
}

function NotasLead({ lead }: { lead: Lead }) {
  const { atualizarLead } = useData();
  const [txt, setTxt] = useState(lead.notas ?? "");
  useEffect(() => setTxt(lead.notas ?? ""), [lead.id, lead.notas]);
  return (
    <div className="p-5">
      <textarea
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => txt !== (lead.notas ?? "") && atualizarLead(lead.id, { notas: txt })}
        placeholder="Anotações sobre este lead (salva ao sair do campo)"
        className="min-h-[110px] w-full resize-y rounded-md border border-[#D7DBDF] p-3 text-sm outline-none focus:border-aco-500 focus:ring-2 focus:ring-aco-100"
      />
    </div>
  );
}

function LinhaContato({ rotulo, valor, tipo, onSalvar }: { rotulo: string; valor: string; tipo: "email" | "tel"; onSalvar: (v: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState(valor);
  const salvar = () => {
    setEditando(false);
    if (v.trim() !== valor) onSalvar(v.trim());
  };
  return (
    <div className="group flex items-center gap-6 px-5 py-3.5">
      <span className="w-28 flex-shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{rotulo}</span>
      {editando ? (
        <input
          autoFocus
          type={tipo}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={salvar}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
          className="flex-1 rounded-md border border-[#D7DBDF] px-3 py-1.5 text-sm outline-none focus:border-aco-500"
        />
      ) : (
        <button onClick={() => { setV(valor); setEditando(true); }} className="flex flex-1 items-center gap-2 text-left">
          {valor ? <span className="font-medium text-marinho-800">{valor}</span> : <span className="italic text-slate-400">Não informado</span>}
          <Pencil size={13} className="text-slate-300 opacity-0 group-hover:opacity-100" />
        </button>
      )}
      {!editando && valor && tipo === "tel" && linkWhatsApp(valor) && (
        <a href={linkWhatsApp(valor)!} target="_blank" rel="noreferrer" className="text-green-600 hover:text-green-700" title="WhatsApp">
          <MessageCircle size={17} />
        </a>
      )}
    </div>
  );
}

function SecaoNegocio({ card }: { card: Card }) {
  const { atualizarOportunidade, obras, recarregar } = useData();
  const { pode } = useAuth();
  const podeMover = pode("mover_funil");
  const [obraSel, setObraSel] = useState("");
  return (
    <>
      <Bloco titulo="Negócio">
        <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-3">
          <CampoEditavel
            label="Valor estimado"
            valor={card.valor_estimado ? brl(card.valor_estimado) : ""}
            podeEditar={podeMover}
            onSalvar={(v) => atualizarOportunidade(card.id, { valor_estimado: Number(v.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".")) || 0 })}
          />
          <CampoEditavel
            label="Previsão de fechamento"
            valor={card.previsao_fechamento}
            tipo="date"
            podeEditar={podeMover}
            onSalvar={(v) => atualizarOportunidade(card.id, { previsao_fechamento: v || null })}
          />
          <CampoEditavel
            label="Próximo contato"
            valor={card.proxima_etapa_data}
            tipo="date"
            podeEditar={podeMover}
            onSalvar={(v) => atualizarOportunidade(card.id, { proxima_etapa_data: v || null })}
          />
          <div className="sm:col-span-3">
            <p className="mb-1.5 text-[0.8125rem] text-slate-500">Tags do negócio</p>
            <CampoTags tags={card.tags ?? []} onChange={(t) => atualizarOportunidade(card.id, { tags: t })} />
          </div>
          {card.motivo_perda && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 sm:col-span-3">
              <b>Motivo da perda:</b> {card.motivo_perda}
              {card.concorrente ? ` · Concorrente: ${card.concorrente}` : ""}
            </div>
          )}
          <p className="text-xs text-slate-400 sm:col-span-3">Negócio criado em {dataBR(card.criado_em)}</p>
        </div>
      </Bloco>

      <Bloco titulo="Obra">
        <div className="p-5">
          {card.obra ? (
            <SecaoObra card={card} obra={card.obra} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">Nenhuma obra vinculada a este negócio.</p>
              <div className="flex gap-2">
                <Select value={obraSel} onChange={(e) => setObraSel(e.target.value)}>
                  <option value="">Escolha uma obra cadastrada...</option>
                  {obras.map((o) => (
                    <option key={o.id} value={o.id}>{o.nome_obra}{o.bairro ? ` — ${o.bairro}` : ""}</option>
                  ))}
                </Select>
                <Button
                  disabled={!obraSel}
                  onClick={async () => {
                    await atualizarOportunidade(card.id, { obra_id: obraSel });
                    recarregar();
                  }}
                >
                  Vincular
                </Button>
              </div>
            </div>
          )}
        </div>
      </Bloco>
    </>
  );
}

function SecaoNegocios({ lead, negocios, onAbrir }: { lead: Lead | null; negocios: Card[]; onAbrir: (id: string) => void }) {
  const { etapas, pipelines } = useData();
  const [novo, setNovo] = useState(false);
  return (
    <Bloco titulo={`Negócios (${negocios.length})`} acao={lead && <Button size="sm" onClick={() => setNovo(true)}>+ Novo negócio</Button>}>
      {negocios.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">Nenhum negócio com este lead.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {negocios.map((n) => {
            const et = etapas.find((e) => e.id === n.etapa_id);
            const pi = pipelines.find((p) => p.id === et?.pipeline_id);
            return (
              <button key={n.id} onClick={() => onAbrir(n.id)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: et?.cor ?? "#94a3b8" }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-marinho-800">{n.obra?.nome_obra ?? "Sem obra"}</p>
                  <p className="truncate text-xs text-slate-500">{[pi?.nome, et?.nome, n.vendedor?.nome].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="text-sm font-semibold text-marinho-800">{brl(n.valor_estimado || 0)}</span>
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            );
          })}
        </div>
      )}
      {novo && lead && (
        <NovoNegocioModal pipelineId={pipelines[0]?.id ?? ""} leadInicial={lead} onClose={() => setNovo(false)} onCriado={onAbrir} />
      )}
    </Bloco>
  );
}

function SecaoVisitas({ obraIds }: { obraIds: string[] }) {
  const [lista, setLista] = useState<RelatorioVisita[] | null>(null);
  const chave = obraIds.join(",");
  useEffect(() => {
    let vivo = true;
    if (!obraIds.length) {
      setLista([]);
      return;
    }
    supabase
      .from("relatorios_visita")
      .select("*, vendedor:profiles(nome)")
      .in("obra_id", obraIds)
      .order("data_visita", { ascending: false })
      .then(({ data }) => vivo && setLista((data as RelatorioVisita[]) ?? []));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  return (
    <Bloco titulo="Visitas registradas">
      <div className="p-5">
        <ListaVisitas historico={lista} />
      </div>
    </Bloco>
  );
}

function SecaoHistorico({ negocioIds, leadId }: { negocioIds: string[]; leadId: string | null }) {
  const [lista, setLista] = useState<Historico[] | null>(null);
  const chave = negocioIds.join(",");
  useEffect(() => {
    let vivo = true;
    const filtros = [leadId ? `lead_id.eq.${leadId}` : null, negocioIds.length ? `oportunidade_id.in.(${negocioIds.join(",")})` : null].filter(Boolean);
    if (!filtros.length) {
      setLista([]);
      return;
    }
    supabase
      .from("historico")
      .select("*, usuario:profiles(nome)")
      .or(filtros.join(","))
      .order("criado_em", { ascending: false })
      .limit(200)
      .then(({ data }) => vivo && setLista((data as Historico[]) ?? []));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, leadId]);
  return (
    <Bloco titulo="Históricos">
      <div className="p-5">
        {lista === null ? (
          <p className="text-sm text-slate-400">Carregando...</p>
        ) : lista.length === 0 ? (
          <p className="text-center text-sm text-slate-400">Sem histórico ainda. Mudanças de etapa, valor e responsável aparecem aqui.</p>
        ) : (
          <ol className="relative ml-2 border-l border-slate-200">
            {lista.map((h) => (
              <li key={h.id} className="mb-4 ml-5">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-aco-500" />
                <p className="text-sm font-medium text-marinho-800">{h.acao}</p>
                {h.detalhe && <p className="text-sm text-slate-600">{h.detalhe}</p>}
                <p className="text-xs text-slate-400">
                  {new Date(h.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  {h.usuario?.nome ? ` · ${h.usuario.nome}` : " · sistema"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Bloco>
  );
}

function SecaoPessoas({ lead, onAbrir }: { lead: Lead; onAbrir: (id: string) => void }) {
  const { leads, atualizarLead } = useData();
  const [vincular, setVincular] = useState(false);
  const [criando, setCriando] = useState<string | null>(null);

  if (lead.tipo === "pessoa") {
    const emp = leads.find((l) => l.id === lead.empresa_id);
    return (
      <Bloco titulo="Empresa">
        <div className="p-5">
          {emp ? (
            <button onClick={() => onAbrir(emp.id)} className="flex w-full items-center gap-3 rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50">
              <Avatar nome={emp.nome} size={38} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-marinho-800">{emp.nome_exibicao || emp.nome}</p>
                <p className="text-xs text-slate-500">{emp.segmento || "Empresa"}</p>
              </div>
              <Building2 size={16} className="text-slate-400" />
            </button>
          ) : (
            <p className="text-sm text-slate-400">Sem empresa vinculada. Vincule em Perfil → Empresa associada.</p>
          )}
        </div>
      </Bloco>
    );
  }

  const pessoas = leads.filter((l) => l.empresa_id === lead.id);
  return (
    <Bloco titulo={`Pessoas (${pessoas.length})`} acao={<Button size="sm" onClick={() => setVincular((v) => !v)}>+ Vincular pessoa</Button>}>
      {vincular && (
        <div className="border-b border-slate-100 p-5">
          <BuscaLead
            valor={null}
            filtro={(l) => l.tipo === "pessoa" && l.empresa_id !== lead.id}
            onChange={(l) => {
              if (!l) return;
              atualizarLead(l.id, { empresa_id: lead.id });
              if (!lead.contato_principal_id) atualizarLead(lead.id, { contato_principal_id: l.id });
              setVincular(false);
            }}
            onCriarNovo={(n) => setCriando(n)}
          />
        </div>
      )}
      {pessoas.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-400">Nenhuma pessoa vinculada (engenheiro, comprador, mestre de obras...).</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {pessoas.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3">
              <Avatar nome={p.nome} size={36} />
              <button onClick={() => onAbrir(p.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-medium text-marinho-800 hover:text-aco-600">{p.nome_exibicao || p.nome}</p>
                <p className="truncate text-xs text-slate-500">{[p.cargo, p.telefone].filter(Boolean).join(" · ") || "Sem contato"}</p>
              </button>
              <button
                onClick={() => atualizarLead(lead.id, { contato_principal_id: p.id })}
                title={lead.contato_principal_id === p.id ? "Contato principal" : "Tornar contato principal"}
                className={lead.contato_principal_id === p.id ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}
              >
                <Star size={17} fill={lead.contato_principal_id === p.id ? "currentColor" : "none"} />
              </button>
              {linkWhatsApp(p.telefone) && (
                <a href={linkWhatsApp(p.telefone)!} target="_blank" rel="noreferrer" className="text-green-600">
                  <MessageCircle size={17} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      {criando !== null && (
        <NovoLeadModal
          tipoInicial="pessoa"
          empresaInicialId={lead.id}
          nomeInicial={criando}
          onClose={() => setCriando(null)}
          onCriado={() => setVincular(false)}
        />
      )}
    </Bloco>
  );
}

function SecaoEndereco({ lead, card, onSalvar }: { lead: Lead | null; card: Card | null; onSalvar: (p: Partial<Lead>) => void }) {
  const o = card?.obra;
  return (
    <>
      {lead && (
        <Bloco
          titulo={lead.tipo === "empresa" ? "Endereço da empresa" : "Endereço"}
          acao={
            (lead.logradouro || lead.bairro) && (
              <a
                href={mapsLink(null, null, [lead.logradouro, lead.numero, lead.bairro, lead.cidade, lead.uf].filter(Boolean).join(", "))}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-sm font-medium text-aco-600"
              >
                <Navigation size={14} /> Abrir no mapa
              </a>
            )
          }
        >
          <div className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-3">
            <CampoEditavel label="CEP" valor={lead.cep} onSalvar={(v) => onSalvar({ cep: v })} />
            <div className="sm:col-span-2">
              <CampoEditavel label="Logradouro" valor={lead.logradouro} onSalvar={(v) => onSalvar({ logradouro: v })} />
            </div>
            <CampoEditavel label="Número" valor={lead.numero} onSalvar={(v) => onSalvar({ numero: v })} />
            <CampoEditavel label="Complemento" valor={lead.complemento} onSalvar={(v) => onSalvar({ complemento: v })} />
            <CampoEditavel label="Bairro" valor={lead.bairro} onSalvar={(v) => onSalvar({ bairro: v })} />
            <CampoEditavel label="Cidade" valor={lead.cidade} onSalvar={(v) => onSalvar({ cidade: v })} />
            <CampoEditavel label="UF" valor={lead.uf} onSalvar={(v) => onSalvar({ uf: v.toUpperCase().slice(0, 2) })} />
          </div>
        </Bloco>
      )}
      {o && (
        <Bloco titulo="Endereço da obra">
          <div className="flex items-center justify-between gap-3 p-5">
            <div>
              <p className="font-medium text-marinho-800">{o.nome_obra}</p>
              <p className="text-sm text-slate-500">{[o.endereco, o.bairro, o.cidade].filter(Boolean).join(" · ") || "Sem endereço"}</p>
            </div>
            <a href={mapsLink(o.latitude, o.longitude, o.endereco || o.bairro)} target="_blank" rel="noreferrer">
              <Button variant="secondary"><Navigation size={15} /> Rota</Button>
            </a>
          </div>
        </Bloco>
      )}
      {!lead && !o && <p className="text-sm text-slate-400">Sem endereço cadastrado.</p>}
    </>
  );
}
