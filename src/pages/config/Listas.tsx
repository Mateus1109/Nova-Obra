import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/lib/data";
import { Button, Input } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import type { NomeLista, OpcaoLista } from "@/lib/types";
import { BotaoIcone, BotoesOrdem, CabecalhoSecao, plural, proximaOrdem, trocar, useLoteConfig } from "./comum";

const LISTAS: { lista: NomeLista; titulo: string; desc: string; exemplo: string }[] = [
  { lista: "origem", titulo: "Origens", desc: "De onde o lead veio", exemplo: "Ex.: Feira da construção" },
  { lista: "segmento", titulo: "Segmentos", desc: "Ramo de atuação da empresa", exemplo: "Ex.: Loteadora" },
];

export default function Listas() {
  return (
    <div>
      <CabecalhoSecao titulo="Listas" subtitulo="Personalize as opções de Origem e Segmento usadas no cadastro de leads" />
      <div className="grid gap-4 xl:grid-cols-2">
        {LISTAS.map((l) => (
          <ListaCard key={l.lista} {...l} />
        ))}
      </div>
    </div>
  );
}

function ListaCard({ lista, titulo, desc, exemplo }: (typeof LISTAS)[number]) {
  const { listas, leads, salvarConfig, recarregar, avisar } = useData();
  const { excluirVarios, reordenar, ocupado } = useLoteConfig();
  const [novo, setNovo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [excluir, setExcluir] = useState<OpcaoLista | null>(null);

  const itens = useMemo(() => listas.filter((o) => o.lista === lista), [listas, lista]);
  const existe = (v: string, menosId?: string) => itens.some((o) => o.id !== menosId && o.valor.toLowerCase() === v.toLowerCase());
  const usoDe = (valor: string) => leads.filter((l) => (lista === "origem" ? l.origem : l.segmento) === valor).length;

  async function adicionar() {
    const v = novo.trim();
    if (!v) return;
    if (existe(v)) return avisar("Esse valor já está na lista.");
    setSalvando(true);
    const ok = await salvarConfig("listas_opcoes", { lista, valor: v, ordem: proximaOrdem(itens) });
    setSalvando(false);
    if (ok) setNovo("");
  }

  async function renomear(o: OpcaoLista, valor: string) {
    setEditandoId(null);
    const v = valor.trim();
    if (!v || v === o.valor) return;
    if (existe(v, o.id)) return avisar("Esse valor já está na lista.");
    const ok = await salvarConfig("listas_opcoes", { id: o.id, valor: v });
    if (!ok) return;
    // leads que usavam o valor antigo passam a usar o novo
    if (usoDe(o.valor)) {
      const { error } = await supabase
        .from("leads")
        .update(lista === "origem" ? { origem: v } : { segmento: v })
        .eq(lista, o.valor);
      if (error) avisar("Valor renomeado, mas alguns leads não foram atualizados.");
      await recarregar();
    }
    avisar("Valor renomeado.", "ok");
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-marinho-800">{titulo}</h3>
          <p className="text-xs text-slate-500">{desc}</p>
        </div>
        <span className="flex-shrink-0 text-sm text-slate-500">{plural(itens.length, "opção", "opções")}</span>
      </header>

      {itens.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-slate-500">
          Lista vazia — enquanto isso o cadastro usa as opções padrão do sistema.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {itens.map((o, i) => (
            <li key={o.id} className="group flex items-center gap-2 py-1.5 pl-4 pr-2">
              {editandoId === o.id ? (
                <Input
                  autoFocus
                  defaultValue={o.valor}
                  className="py-1.5"
                  onBlur={(e) => renomear(o, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditandoId(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoId(o.id)}
                  title="Clique para renomear"
                  className="min-w-0 flex-1 truncate py-1 text-left text-[0.9375rem] text-marinho-800 hover:text-aco-600"
                >
                  {o.valor}
                  {usoDe(o.valor) > 0 && <span className="ml-2 text-xs text-slate-400">{plural(usoDe(o.valor), "lead", "leads")}</span>}
                </button>
              )}
              {editandoId !== o.id && (
                <div className="flex flex-shrink-0 items-center">
                  <BotoesOrdem
                    primeiro={i === 0}
                    ultimo={i === itens.length - 1}
                    disabled={ocupado}
                    onMover={(dir) => reordenar("listas_opcoes", trocar(itens, i, dir))}
                  />
                  <BotaoIcone titulo={`Renomear ${o.valor}`} onClick={() => setEditandoId(o.id)}>
                    <Pencil size={15} />
                  </BotaoIcone>
                  <BotaoIcone titulo={`Excluir ${o.valor}`} onClick={() => setExcluir(o)} perigo>
                    <Trash2 size={15} />
                  </BotaoIcone>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex gap-2 border-t border-slate-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          adicionar();
        }}
      >
        <Input value={novo} onChange={(e) => setNovo(e.target.value)} placeholder={exemplo} className="min-w-0 py-2" />
        <Button type="submit" variant="secondary" disabled={!novo.trim() || salvando} className="flex-shrink-0">
          <Plus size={15} /> Adicionar
        </Button>
      </form>

      {excluir && (
        <ConfirmarModal
          titulo={`Excluir de ${titulo}`}
          texto={`"${excluir.valor}" sai da lista. ${
            usoDe(excluir.valor) ? `Os ${plural(usoDe(excluir.valor), "lead", "leads")} que já usam esse valor continuam com ele.` : ""
          }`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={() => excluirVarios("listas_opcoes", [excluir.id])}
        />
      )}
    </section>
  );
}
