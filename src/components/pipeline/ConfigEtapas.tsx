import { useState } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useData } from "@/lib/data";
import { REQUISITOS_ETAPA, type Etapa, type Pipeline, type RequisitoEtapa, type TipoEtapa } from "@/lib/types";
import { Button, Modal } from "@/components/ui";
import { cx } from "@/lib/utils";
import { Caixa } from "./pecas";

const TIPOS: { key: TipoEtapa; label: string; desc: string; cor: string }[] = [
  { key: "aberta", label: "Aberta", desc: "Negócios em andamento", cor: "#3385FF" },
  { key: "ganho", label: "Ganho", desc: "Ao entrar, o negócio é marcado como ganho", cor: "#22c55e" },
  { key: "perdido", label: "Perdido", desc: "Ao entrar, pede o motivo da perda", cor: "#ef4444" },
];

type Conf = { tipo: TipoEtapa; requisitos: RequisitoEtapa[] };

/** Tipo de cada coluna e as condições para um negócio poder SAIR dela */
export function ConfigEtapas({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { etapas, atualizarEtapa } = useData();
  const colunas = etapas.filter((e) => e.pipeline_id === pipeline.id);
  const [conf, setConf] = useState<Record<string, Conf>>(() =>
    Object.fromEntries(colunas.map((c) => [c.id, { tipo: c.tipo, requisitos: c.requisitos ?? [] }]))
  );
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(colunas.slice(0, 1).map((c) => c.id)));
  const [salvando, setSalvando] = useState(false);

  const mudou = (c: Etapa) => {
    const n = conf[c.id];
    if (!n) return false;
    const antes = c.requisitos ?? [];
    return n.tipo !== c.tipo || n.requisitos.length !== antes.length || n.requisitos.some((r) => !antes.includes(r));
  };
  const alteradas = colunas.filter(mudou);

  const editar = (id: string, patch: Partial<Conf>) => setConf((s) => ({ ...s, [id]: { ...s[id], ...patch } }));
  const alternarReq = (id: string, r: RequisitoEtapa) => {
    const atual = conf[id]?.requisitos ?? [];
    // mantém a ordem da lista de condições
    const nova = atual.includes(r) ? atual.filter((x) => x !== r) : REQUISITOS_ETAPA.map((x) => x.key).filter((k) => k === r || atual.includes(k));
    editar(id, { requisitos: nova });
  };
  const alternarSecao = (id: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function salvar() {
    if (!alteradas.length) return onClose();
    setSalvando(true);
    await Promise.all(alteradas.map((c) => atualizarEtapa(c.id, { tipo: conf[c.id].tipo, requisitos: conf[c.id].requisitos })));
    setSalvando(false);
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="Configurações de etapa" wide>
      <p className="text-sm text-slate-600">
        Escolha o que o negócio precisa ter para poder <b className="text-marinho-800">sair</b> de cada etapa. Quem tentar mover sem cumprir vê o que
        está faltando.
      </p>

      <div className="mt-4 space-y-3">
        {colunas.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Este pipeline ainda não tem colunas.</p>}
        {colunas.map((c) => {
          const n = conf[c.id] ?? { tipo: c.tipo, requisitos: [] };
          const aberta = abertas.has(c.id);
          const tipo = TIPOS.find((t) => t.key === n.tipo) ?? TIPOS[0];
          return (
            <section key={c.id} className="overflow-hidden rounded-lg border border-slate-200">
              <button onClick={() => alternarSecao(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" aria-expanded={aberta}>
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: c.cor }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-marinho-800">{c.nome}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: tipo.cor }} /> {tipo.label}
                    </span>
                    <span>·</span>
                    <span className={n.requisitos.length ? "font-medium text-aco-700" : undefined}>
                      {n.requisitos.length === 0
                        ? "Sem condições para sair"
                        : `${n.requisitos.length} condiç${n.requisitos.length === 1 ? "ão" : "ões"} para sair`}
                    </span>
                    {mudou(c) && <span className="rounded bg-amber-50 px-1.5 text-amber-700">não salvo</span>}
                  </span>
                </span>
                <ChevronDown size={18} className={cx("flex-shrink-0 text-slate-400 transition", aberta && "rotate-180")} />
              </button>

              {aberta && (
                <div className="space-y-4 border-t border-slate-100 bg-slate-50/50 px-4 py-4">
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-marinho-800">Tipo da coluna</p>
                    <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200 bg-white p-1">
                      {TIPOS.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => editar(c.id, { tipo: t.key })}
                          className={cx(
                            "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition",
                            n.tipo === t.key ? "bg-aco-50 text-aco-700 ring-1 ring-aco-200" : "text-slate-600 hover:bg-slate-50"
                          )}
                          aria-pressed={n.tipo === t.key}
                        >
                          <span className="h-2 w-2 rounded-full" style={{ background: t.cor }} /> {t.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500">{tipo.desc}</p>
                  </div>

                  <div>
                    <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-marinho-800">
                      <ShieldCheck size={15} className="text-aco-600" /> Para sair desta etapa, o negócio precisa ter:
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {REQUISITOS_ETAPA.map((r) => {
                        const marcado = n.requisitos.includes(r.key);
                        return (
                          <div
                            key={r.key}
                            onClick={() => alternarReq(c.id, r.key)}
                            className={cx(
                              "flex cursor-pointer items-start gap-2.5 rounded-md border bg-white px-3 py-2.5 transition",
                              marcado ? "border-aco-200 ring-1 ring-aco-100" : "border-slate-200 hover:border-slate-300"
                            )}
                          >
                            <span className="pt-0.5">
                              <Caixa marcada={marcado} onChange={() => alternarReq(c.id, r.key)} rotulo={r.label} />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-marinho-800">{r.label}</span>
                              <span className="block text-xs text-slate-500">{r.desc}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-5 flex items-center justify-end gap-2 border-t border-slate-100 bg-white px-5 py-3">
        {alteradas.length > 0 && (
          <span className="mr-auto text-xs text-slate-500">
            {alteradas.length} coluna{alteradas.length === 1 ? "" : "s"} alterada{alteradas.length === 1 ? "" : "s"}
          </span>
        )}
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </Modal>
  );
}
