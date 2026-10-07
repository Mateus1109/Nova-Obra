import { useState, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ArrowLeft, ArrowRight, Check, MoreHorizontal, MoveRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useData, type Card } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { CORES_ETAPA, type Atividade, type Etapa } from "@/lib/types";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { brl, cx } from "@/lib/utils";
import { KanbanCard } from "./CartaoNegocio";
import { ItemMenu, qtdNegocios } from "./pecas";

export function Coluna({
  etapa,
  primeira,
  ultima,
  podeEditar,
  arrastavel,
  cards,
  numero,
  proxAtividade,
  dica,
  onOpen,
  onExcluir,
  onMoverTodos,
  onNovoNegocio,
  onAtividade,
}: {
  etapa: Etapa;
  primeira: boolean;
  ultima: boolean;
  podeEditar: boolean;
  arrastavel: boolean;
  cards: Card[];
  numero: Map<string, number>;
  proxAtividade: Map<string, Atividade>;
  /** texto exibido quando a coluna está vazia (ex.: ganhos ocultos pelo filtro de status) */
  dica?: ReactNode;
  onOpen: (id: string) => void;
  onExcluir: () => void;
  onMoverTodos: () => void;
  onNovoNegocio: () => void;
  onAtividade: (c: Card) => void;
}) {
  const { atualizarEtapa, moverColuna } = useData();
  const { pode } = useAuth();
  // a coluna inteira recebe o card (não só a lista), fica mais fácil acertar no celular
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const [menu, setMenu] = useState(false);
  const [renomeando, setRenomeando] = useState(false);
  const [nome, setNome] = useState(etapa.nome);
  const soma = cards.reduce((s, c) => s + (c.valor_estimado || 0), 0);

  function salvarNome() {
    const n = nome.trim();
    if (n && n !== etapa.nome) atualizarEtapa(etapa.id, { nome: n });
    else setNome(etapa.nome);
    setRenomeando(false);
  }

  return (
    <div
      ref={setNodeRef}
      className={cx(
        "flex w-[min(21.25rem,85vw)] flex-shrink-0 flex-col rounded-lg border border-slate-200 bg-white transition",
        isOver && "ring-2 ring-aco-500"
      )}
      style={{ borderTop: `4px solid ${etapa.cor}` }}
    >
      <div className="relative px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          {renomeando ? (
            <div className="flex flex-1 items-center gap-1">
              <Input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") salvarNome();
                  if (e.key === "Escape") {
                    setNome(etapa.nome);
                    setRenomeando(false);
                  }
                }}
                className="py-1.5"
              />
              <button onClick={salvarNome} className="rounded-md p-1.5 text-green-600 hover:bg-green-50" aria-label="Salvar">
                <Check size={16} />
              </button>
            </div>
          ) : (
            <button
              className="flex min-w-0 items-center gap-2"
              onDoubleClick={() => {
                if (podeEditar) {
                  setNome(etapa.nome);
                  setRenomeando(true);
                }
              }}
              title={podeEditar ? "Clique duas vezes para renomear" : undefined}
            >
              <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: etapa.cor }} />
              <span className="truncate font-semibold text-marinho-800">{etapa.nome}</span>
              {etapa.tipo !== "aberta" && (
                <span
                  className={cx(
                    "rounded-full px-1.5 py-px text-[0.625rem] font-semibold uppercase",
                    etapa.tipo === "ganho" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                  )}
                >
                  {etapa.tipo}
                </span>
              )}
            </button>
          )}
          {podeEditar && !renomeando && (
            <button
              onClick={() => setMenu((m) => !m)}
              className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Opções da coluna"
            >
              <MoreHorizontal size={20} />
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between pl-5 text-sm text-slate-500">
          <span>{brl(soma)}</span>
          <span>{cards.length === 0 ? "Nenhum negócio" : qtdNegocios(cards.length)}</span>
        </div>

        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-3 top-11 z-40 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-cardhover">
              <ItemMenu icon={<Pencil size={15} />} onClick={() => { setMenu(false); setNome(etapa.nome); setRenomeando(true); }}>
                Renomear
              </ItemMenu>
              <div className="flex flex-wrap gap-1.5 px-2.5 py-2">
                {CORES_ETAPA.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => atualizarEtapa(etapa.id, { cor })}
                    className={cx("h-6 w-6 rounded-full border-2", etapa.cor === cor ? "border-marinho-800" : "border-white")}
                    style={{ background: cor }}
                    aria-label={`Cor ${cor}`}
                  />
                ))}
              </div>
              {!primeira && (
                <ItemMenu icon={<ArrowLeft size={15} />} onClick={() => { setMenu(false); moverColuna(etapa.id, -1); }}>
                  Mover para a esquerda
                </ItemMenu>
              )}
              {!ultima && (
                <ItemMenu icon={<ArrowRight size={15} />} onClick={() => { setMenu(false); moverColuna(etapa.id, 1); }}>
                  Mover para a direita
                </ItemMenu>
              )}
              <ItemMenu icon={<MoveRight size={15} />} onClick={() => { setMenu(false); onMoverTodos(); }}>
                Mover todos os negócios
              </ItemMenu>
              <ItemMenu icon={<Trash2 size={15} />} perigo onClick={() => { setMenu(false); onExcluir(); }}>
                Excluir coluna
              </ItemMenu>
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-[10rem] flex-1 flex-col gap-3 overflow-y-auto px-3 pb-3" style={{ maxHeight: "calc(100vh - 330px)" }}>
        {cards.map((c) => (
          <KanbanCard
            key={c.id}
            card={c}
            numero={numero.get(c.id) ?? 0}
            atividade={proxAtividade.get(c.id)}
            arrastavel={arrastavel}
            onOpen={onOpen}
            onAtividade={onAtividade}
          />
        ))}
        {cards.length === 0 && dica && <div className="px-2 py-6 text-center text-[0.8125rem] text-slate-400">{dica}</div>}
      </div>

      {pode("cadastrar_obras") && (
        <button
          onClick={onNovoNegocio}
          className="flex items-center justify-center gap-1.5 border-t border-slate-200 py-3 text-[0.9375rem] text-marinho-800 hover:bg-slate-50"
        >
          <Plus size={17} /> Novo negócio
        </button>
      )}
    </div>
  );
}

export function NovaColuna({ pipelineId }: { pipelineId: string }) {
  const { criarEtapa } = useData();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");

  async function criar() {
    if (!nome.trim()) return;
    await criarEtapa(nome.trim(), pipelineId);
    setNome("");
    setAberto(false);
  }

  return (
    <div className="w-[min(21.25rem,85vw)] flex-shrink-0">
      {aberto ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <Input
            autoFocus
            placeholder="Nome da coluna"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") criar();
              if (e.key === "Escape") setAberto(false);
            }}
          />
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="flex-1" onClick={criar}>Criar coluna</Button>
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)} aria-label="Cancelar">
              <X size={16} />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAberto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 py-3.5 text-[0.9375rem] text-slate-500 hover:bg-slate-200 hover:text-marinho-800"
        >
          <Plus size={17} /> Nova coluna
        </button>
      )}
    </div>
  );
}

export function ExcluirColuna({ etapa, colunas, onClose }: { etapa: Etapa; colunas: Etapa[]; onClose: () => void }) {
  const { cards, excluirEtapa } = useData();
  const qtd = cards.filter((c) => c.etapa_id === etapa.id).length;
  const outras = colunas.filter((e) => e.id !== etapa.id);
  const [destino, setDestino] = useState(outras[0]?.id ?? "");
  const [excluindo, setExcluindo] = useState(false);

  return (
    <Modal open onClose={onClose} title={`Excluir a coluna "${etapa.nome}"`}>
      {outras.length === 0 ? (
        <p className="text-sm text-slate-600">O pipeline precisa ter pelo menos uma coluna.</p>
      ) : (
        <div className="space-y-4">
          {qtd > 0 ? (
            <Field label={`Esta coluna tem ${qtd} negócio(s). Mover para:`}>
              <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
                {outras.map((e) => (
                  <option key={e.id} value={e.id}>{e.nome}</option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-slate-600">A coluna está vazia e será removida.</p>
          )}
          {etapa.tipo !== "aberta" && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Esta coluna conta como <b>{etapa.tipo === "ganho" ? "ganho" : "perdido"}</b> na conversão do painel.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              variant="danger"
              disabled={excluindo}
              onClick={async () => {
                setExcluindo(true);
                await excluirEtapa(etapa.id, destino || null);
                onClose();
              }}
            >
              <Trash2 size={16} /> Excluir coluna
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Move todos os negócios de uma coluna para outra (inclusive de outro pipeline). */
export function MoverTodos({ etapa, onClose }: { etapa: Etapa; onClose: () => void }) {
  const { cards, etapas, pipelines, moverTodosDaColuna } = useData();
  const qtd = cards.filter((c) => c.etapa_id === etapa.id).length;
  const destinos = pipelines.flatMap((p) =>
    etapas.filter((e) => e.pipeline_id === p.id && e.id !== etapa.id).map((e) => ({ ...e, pipelineNome: p.nome }))
  );
  const [destino, setDestino] = useState(destinos.find((d) => d.pipeline_id === etapa.pipeline_id)?.id ?? destinos[0]?.id ?? "");
  const [movendo, setMovendo] = useState(false);
  const multi = pipelines.length > 1;

  return (
    <Modal open onClose={onClose} title={`Mover negócios de "${etapa.nome}"`}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {qtd === 0
            ? "Esta coluna não tem negócios."
            : `${qtdNegocios(qtd)} desta coluna ser${qtd === 1 ? "á movido" : "ão movidos"} de uma vez. Os filtros da tela não se aplicam: entram todos.`}
        </p>
        <Field label="Mover para">
          <Select value={destino} onChange={(e) => setDestino(e.target.value)}>
            {multi
              ? pipelines.map((p) => (
                  <optgroup key={p.id} label={p.nome}>
                    {destinos
                      .filter((d) => d.pipeline_id === p.id)
                      .map((d) => (
                        <option key={d.id} value={d.id}>{d.nome}</option>
                      ))}
                  </optgroup>
                ))
              : destinos.map((d) => (
                  <option key={d.id} value={d.id}>{d.nome}</option>
                ))}
          </Select>
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!destino || movendo || qtd === 0}
            onClick={async () => {
              setMovendo(true);
              const ok = await moverTodosDaColuna(etapa.id, destino);
              setMovendo(false);
              if (ok) onClose();
            }}
          >
            <MoveRight size={16} /> {movendo ? "Movendo..." : "Mover todos"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
