import { useMemo, useState } from "react";
import { Plus, Search, Users } from "lucide-react";
import { useData } from "@/lib/data";
import { Avatar, Button, Input, SeloTipo, Spinner, Tag } from "@/components/ui";
import { NovoLeadModal } from "@/components/NovoLead";
import PainelLead from "@/components/PainelLead";
import type { TipoLead } from "@/lib/types";
import { cx, dataBR } from "@/lib/utils";

export default function Leads() {
  const { leads, cards, vendedores, loading } = useData();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<TipoLead | "">("");
  const [novo, setNovo] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const negociosPorLead = useMemo(() => {
    const m = new Map<string, number>();
    cards.forEach((c) => c.lead_id && m.set(c.lead_id, (m.get(c.lead_id) ?? 0) + 1));
    return m;
  }, [cards]);

  const lista = useMemo(() => {
    const t = q.toLowerCase();
    return leads.filter(
      (l) =>
        (!tipo || l.tipo === tipo) &&
        (!t || `${l.nome} ${l.nome_exibicao} ${l.telefone} ${l.email} ${l.documento} ${(l.tags ?? []).join(" ")}`.toLowerCase().includes(t))
    );
  }, [leads, q, tipo]);

  if (loading) return <Spinner />;
  const nomeDe = (id: string | null) => vendedores.find((v) => v.id === id)?.nome;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-semibold leading-tight text-marinho-800">Leads</h1>
          <p className="text-slate-500">Construtoras, clientes e contatos ({leads.length})</p>
        </div>
        <Button onClick={() => setNovo(true)}>
          <Plus size={17} /> Novo lead
        </Button>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar por nome, telefone, CNPJ..." className="py-2 pl-9" />
        </div>
        <div className="inline-flex rounded-lg bg-slate-100 p-1 text-sm">
          {(
            [
              ["", "Todos"],
              ["empresa", "Empresas"],
              ["pessoa", "Pessoas"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTipo(k)}
              className={cx("rounded-md px-3 py-1 font-medium", tipo === k ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
          <Users className="mx-auto text-aco-500" size={36} />
          <p className="mt-3 font-semibold text-marinho-800">Nenhum lead encontrado</p>
          <p className="mt-1 text-sm text-slate-500">Cadastre construtoras e contatos para criar negócios no funil.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden grid-cols-12 gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
            <div className="col-span-4">Nome</div>
            <div className="col-span-2">Telefone</div>
            <div className="col-span-2">Segmento / cargo</div>
            <div className="col-span-1 text-center">Negócios</div>
            <div className="col-span-2">Atendente</div>
            <div className="col-span-1 text-right">Criado</div>
          </div>
          <div className="divide-y divide-slate-100">
            {lista.map((l) => (
              <button
                key={l.id}
                onClick={() => setAberto(l.id)}
                className="grid w-full grid-cols-2 items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 md:grid-cols-12"
              >
                <div className="col-span-2 flex min-w-0 items-center gap-3 md:col-span-4">
                  <Avatar nome={l.nome} size={30} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-medium text-marinho-800">{l.nome_exibicao || l.nome}</p>
                      <SeloTipo tipo={l.tipo} />
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {(l.tags ?? []).slice(0, 3).map((t) => (
                        <Tag key={t}>{t}</Tag>
                      ))}
                      {!l.tags?.length && <span className="truncate text-xs text-slate-400">{l.email || "—"}</span>}
                    </div>
                  </div>
                </div>
                <p className="truncate text-sm text-marinho-800 md:col-span-2">{l.telefone || "—"}</p>
                <p className="truncate text-sm text-slate-600 md:col-span-2">{(l.tipo === "empresa" ? l.segmento : l.cargo) || "—"}</p>
                <p className="text-sm font-medium text-marinho-800 md:col-span-1 md:text-center">{negociosPorLead.get(l.id) ?? 0}</p>
                <p className="truncate text-sm text-slate-600 md:col-span-2">{nomeDe(l.responsavel_id) ?? "—"}</p>
                <p className="text-right text-xs text-slate-400 md:col-span-1">{dataBR(l.criado_em)}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {novo && <NovoLeadModal onClose={() => setNovo(false)} onCriado={(l, abrir) => abrir && setAberto(l.id)} />}
      {aberto && <PainelLead leadId={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}
