import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useData } from "@/lib/data";
import { agruparPorProximidade, dataBR, mapsLink } from "@/lib/utils";
import { PRODUTO_LABEL } from "@/lib/types";
import { Spinner } from "@/components/ui";

export default function RotaPrint() {
  const { vendedorId, data } = useParams();
  const { visitas, vendedores, loading } = useData();

  const vendedor = vendedores.find((v) => v.id === vendedorId);
  const doDia = useMemo(() => {
    const lista = visitas.filter((v) => v.vendedor_id === vendedorId && v.data_visita === data);
    const ordem = agruparPorProximidade(lista.map((v) => v.obra));
    const idx = new Map(ordem.map((o, i) => [o.id, i]));
    return [...lista].sort((a, b) => (idx.get(a.obra.id) ?? 0) - (idx.get(b.obra.id) ?? 0));
  }, [visitas, vendedorId, data]);

  useEffect(() => {
    if (!loading && doDia.length) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [loading, doDia.length]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-marinho-900 print-area">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b-2 border-marinho-700 pb-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-marinho-700 text-xl font-black text-white">M</div>
          <div>
            <p className="text-xl font-black text-marinho-800">Megamix</p>
            <p className="text-sm text-aco-600">Rota de visitas · São Luís-MA</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-marinho-800">{dataBR(data)}</p>
          <p className="text-sm text-slate-500">{vendedor?.nome}</p>
          <p className="text-xs text-slate-400">{doDia.length} visita(s)</p>
        </div>
      </div>

      {/* Lista */}
      <div className="mt-5 space-y-3">
        {doDia.map((v, i) => (
          <div key={v.id} className="print-break rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-marinho-700 text-sm font-bold text-white">
                  {i + 1}
                </div>
                <div>
                  <p className="font-bold text-marinho-800">{v.obra.nome_obra}</p>
                  <p className="text-sm text-slate-500">
                    {v.obra.construtora} · {PRODUTO_LABEL[v.obra.produto_alvo]} · {v.obra.volume_estimado_m3} m³
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 pl-10 text-sm">
              <p><b>Endereço:</b> {v.obra.endereco || v.obra.bairro}, {v.obra.bairro}</p>
              <p><b>Contato:</b> {v.obra.contato_nome} {v.obra.contato_telefone && `(${v.obra.contato_telefone})`}</p>
              {v.proximo_passo && <p className="col-span-2"><b>Objetivo:</b> {v.proximo_passo}</p>}
              <p className="col-span-2 break-all text-aco-600">
                {mapsLink(v.obra.latitude, v.obra.longitude, v.obra.endereco)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="no-print mt-6 flex justify-center gap-2">
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-marinho-700 px-5 py-2.5 font-semibold text-white"
        >
          Imprimir / Salvar PDF
        </button>
        <button
          onClick={() => window.close()}
          className="rounded-xl bg-slate-100 px-5 py-2.5 font-semibold text-slate-600"
        >
          Fechar
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-slate-400">
        Gerado pelo sistema Megamix · Nova Obra · {dataBR(data)}
      </p>
    </div>
  );
}
