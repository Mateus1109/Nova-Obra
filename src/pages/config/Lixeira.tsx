import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/lib/data";
import { Button, Spinner } from "@/components/ui";
import { ConfirmarModal, SeloStatus } from "@/components/StatusNegocio";
import type { Oportunidade } from "@/lib/types";
import { brl } from "@/lib/utils";
import { BarraPesquisa, BarraSelecao, BotaoIcone, CabecalhoSecao, Tabela, contem, dataHora, plural, useSelecao } from "./comum";

interface ItemLixeira extends Oportunidade {
  obra: { nome_obra: string } | null;
  lead: { nome: string; nome_exibicao: string } | null;
  quem: { nome: string } | null;
}

const BASE = "*, obra:obras(nome_obra), lead:leads(nome,nome_exibicao)";

const nomeItem = (i: ItemLixeira) => i.lead?.nome_exibicao || i.lead?.nome || i.obra?.nome_obra || "Sem nome";

export default function Lixeira() {
  const { etapas, pipelines, restaurarDaLixeira, excluirDefinitivo, avisar } = useData();
  const [itens, setItens] = useState<ItemLixeira[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [q, setQ] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [excluir, setExcluir] = useState<string[] | null>(null);

  const carregar = useCallback(async () => {
    const lixeira = () => supabase.from("oportunidades").select(`${BASE}, quem:profiles!oportunidades_excluido_por_fkey(nome)`);
    let { data, error } = await lixeira().not("excluido_em", "is", null).order("excluido_em", { ascending: false });
    // sem a relação nomeada: busca os negócios e depois os nomes de quem excluiu
    if (error) {
      const res = await supabase.from("oportunidades").select(BASE).not("excluido_em", "is", null).order("excluido_em", { ascending: false });
      error = res.error;
      data = res.data;
      if (!error && data?.length) {
        const ids = Array.from(new Set(data.map((d) => d.excluido_por).filter(Boolean)));
        const { data: perfis } = ids.length ? await supabase.from("profiles").select("id, nome").in("id", ids) : { data: [] };
        const nomes = new Map((perfis ?? []).map((p) => [p.id as string, p.nome as string]));
        data = data.map((d) => ({ ...d, quem: d.excluido_por && nomes.has(d.excluido_por) ? { nome: nomes.get(d.excluido_por) } : null }));
      }
    }
    if (error) avisar("Não foi possível carregar a lixeira.");
    else setItens((data as ItemLixeira[]) ?? []);
    setCarregando(false);
  }, [avisar]);

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ondeEsta = useCallback(
    (etapaId: string) => {
      const e = etapas.find((x) => x.id === etapaId);
      if (!e) return "—";
      const p = pipelines.find((x) => x.id === e.pipeline_id);
      return p ? `${p.nome} · ${e.nome}` : e.nome;
    },
    [etapas, pipelines]
  );

  const lista = useMemo(
    () => itens.filter((i) => contem(`${nomeItem(i)} ${i.obra?.nome_obra ?? ""} ${i.quem?.nome ?? ""} ${ondeEsta(i.etapa_id)}`, q)),
    [itens, q, ondeEsta]
  );
  const sel = useSelecao(useMemo(() => lista.map((i) => i.id), [lista]));

  async function restaurar(ids: string[]) {
    setOcupado(true);
    const ok = await restaurarDaLixeira(ids);
    if (ok) {
      sel.limpar();
      await carregar();
    }
    setOcupado(false);
  }

  if (carregando) return <Spinner />;

  return (
    <div>
      <CabecalhoSecao titulo="Lixeira" subtitulo="Negócios excluídos ficam aqui até serem restaurados ou excluídos definitivamente">
        {itens.length > 0 && (
          <Button variant="secondary" className="text-red-600 hover:bg-red-50" onClick={() => setExcluir(itens.map((i) => i.id))}>
            <Trash2 size={16} /> Esvaziar lixeira
          </Button>
        )}
      </CabecalhoSecao>

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <BarraSelecao qtd={sel.ids.length} onLimpar={sel.limpar}>
        <Button size="sm" variant="secondary" disabled={ocupado} onClick={() => restaurar(sel.ids)}>
          <RotateCcw size={14} /> Restaurar
        </Button>
        <Button size="sm" variant="danger" disabled={ocupado} onClick={() => setExcluir(sel.ids)}>
          <Trash2 size={14} /> Excluir definitivamente
        </Button>
      </BarraSelecao>

      <Tabela
        linhas={lista}
        selecao={sel}
        vazio={q ? "Nenhum negócio encontrado para essa pesquisa." : "A lixeira está vazia."}
        colunas={[
          {
            titulo: "Negócio",
            className: "md:min-w-[14rem]",
            celula: (i) => (
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 font-medium text-marinho-800">
                  {nomeItem(i)} <SeloStatus status={i.status} />
                </p>
                {i.lead && i.obra?.nome_obra && <p className="truncate text-xs font-normal text-slate-500">{i.obra.nome_obra}</p>}
              </div>
            ),
          },
          { titulo: "Pipeline · etapa", celula: (i) => <span className="text-slate-600">{ondeEsta(i.etapa_id)}</span>, className: "md:min-w-[11rem]" },
          { titulo: "Valor", celula: (i) => brl(i.valor_estimado), className: "md:whitespace-nowrap" },
          { titulo: "Excluído por", celula: (i) => <span className="text-slate-600">{i.quem?.nome ?? "—"}</span>, className: "md:min-w-[9rem]" },
          { titulo: "Excluído em", celula: (i) => <span className="text-slate-500 md:whitespace-nowrap">{dataHora(i.excluido_em)}</span> },
        ]}
        acoes={(i) => (
          <>
            <BotaoIcone titulo="Restaurar" onClick={() => restaurar([i.id])} disabled={ocupado}>
              <RotateCcw size={15} />
            </BotaoIcone>
            <BotaoIcone titulo="Excluir definitivamente" onClick={() => setExcluir([i.id])} perigo disabled={ocupado}>
              <Trash2 size={15} />
            </BotaoIcone>
          </>
        )}
      />

      {excluir && (
        <ConfirmarModal
          titulo="Excluir definitivamente"
          texto={`${
            excluir.length === 1
              ? `"${nomeItem(itens.find((i) => i.id === excluir[0]) ?? ({} as ItemLixeira))}" será apagado`
              : `${plural(excluir.length, "negócio será apagado", "negócios serão apagados")}`
          } para sempre, junto com o histórico e as atividades. Essa ação não pode ser desfeita.`}
          rotulo="Excluir definitivamente"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={async () => {
            setOcupado(true);
            const ok = await excluirDefinitivo(excluir);
            if (ok) sel.limpar();
            await carregar();
            setOcupado(false);
          }}
        />
      )}
    </div>
  );
}
