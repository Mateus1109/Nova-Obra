import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { Building2, CheckCheck, TrendingUp, AlertTriangle, Flame, Navigation } from "lucide-react";
import { useData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { Card, Empty, Spinner } from "@/components/ui";
import { CLASSIFICACOES, type Classificacao } from "@/lib/types";
import { diasDesde, isoLocal, mapsLink } from "@/lib/utils";

const PARADA_DIAS = 7;

export default function Dashboard() {
  const { cards, etapas, obras, vendedores, loading } = useData();
  // Visitas = relatórios de visita dos últimos 30 dias
  const [visitas, setVisitas] = useState<{ vendedor_id: string; data_visita: string }[]>([]);
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    supabase
      .from("relatorios_visita")
      .select("vendedor_id, data_visita")
      .gte("data_visita", isoLocal(d))
      .then(({ data }) => setVisitas(data ?? []));
  }, []);
  const tipoDe = useMemo(() => new Map(etapas.map((e) => [e.id, e.tipo])), [etapas]);

  const kpis = useMemo(() => {
    const agora = new Date();
    const noMes = obras.filter((o) => {
      const d = new Date(o.criado_em);
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    }).length;
    const realizadas = visitas.length;
    const ganhos = cards.filter((c) => tipoDe.get(c.etapa_id) === "ganho").length;
    const fechados = cards.filter((c) => tipoDe.get(c.etapa_id) !== "aberta").length;
    const conversao = fechados ? Math.round((ganhos / fechados) * 100) : 0;
    return { noMes, realizadas, conversao, ganhos };
  }, [obras, visitas, cards, tipoDe]);

  const funil = useMemo(
    () =>
      etapas.map((e) => ({
        etapa: e.nome,
        cor: e.cor,
        qtd: cards.filter((c) => c.etapa_id === e.id).length,
      })),
    [cards, etapas]
  );

  const porVendedor = useMemo(
    () =>
      vendedores.map((v) => ({
        nome: v.nome.split(" ")[0],
        visitas: visitas.filter((x) => x.vendedor_id === v.id).length,
        obras: cards.filter((c) => c.vendedor_id === v.id).length,
      })),
    [vendedores, visitas, cards]
  );

  const porClasse = useMemo(
    () =>
      (["quente", "morno", "frio"] as Classificacao[]).map((c) => ({
        name: CLASSIFICACOES[c].label,
        value: cards.filter((x) => x.classificacao === c).length,
        cor: CLASSIFICACOES[c].fg,
      })),
    [cards]
  );

  const paradas = useMemo(
    () =>
      cards
        .filter((c) => tipoDe.get(c.etapa_id) === "aberta")
        .filter((c) => diasDesde(c.atualizado_em) >= PARADA_DIAS)
        .sort((a, b) => diasDesde(b.atualizado_em) - diasDesde(a.atualizado_em)),
    [cards, tipoDe]
  );

  if (loading) return <Spinner />;

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-2xl font-black text-marinho-800">Painel comercial</h1>
        <p className="text-sm text-slate-500">Visão geral da aquisição de obras e produtividade</p>
      </header>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Building2 />} label="Obras no mês" valor={kpis.noMes} cor="#2E78A8" />
        <Kpi icon={<CheckCheck />} label="Visitas (30 dias)" valor={kpis.realizadas} cor="#16a34a" />
        <Kpi icon={<TrendingUp />} label="Conversão" valor={`${kpis.conversao}%`} cor="#7c3aed" />
        <Kpi icon={<Flame />} label="Obras ganhas" valor={kpis.ganhos} cor="#f59e0b" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Funil */}
        <Card className="p-5">
          <h3 className="mb-4 font-bold text-marinho-800">Funil de obras por etapa</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funil} margin={{ left: -20 }}>
              <XAxis dataKey="etapa" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                {funil.map((f, i) => (<Cell key={i} fill={f.cor} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Produtividade */}
        <Card className="p-5">
          <h3 className="mb-4 font-bold text-marinho-800">Produtividade por vendedor</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porVendedor} margin={{ left: -20 }}>
              <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="visitas" name="Visitas (30 dias)" fill="#2E78A8" radius={[6, 6, 0, 0]} />
              <Bar dataKey="obras" name="Obras no funil" fill="#173A5E" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Classificação */}
        <Card className="p-5">
          <h3 className="mb-4 font-bold text-marinho-800">Obras por classificação</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porClasse} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {porClasse.map((c, i) => (<Cell key={i} fill={c.cor} />))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Obras paradas */}
        <Card className="p-5">
          <h3 className="mb-4 flex items-center gap-2 font-bold text-marinho-800">
            <AlertTriangle size={18} className="text-amber-500" />
            Obras paradas há {PARADA_DIAS}+ dias
          </h3>
          {paradas.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Nenhuma obra parada. 👏</p>
          ) : (
            <div className="space-y-2">
              {paradas.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-marinho-800">{c.obra.nome_obra}</p>
                    <p className="text-xs text-slate-500">{c.vendedor?.nome} · {c.obra.bairro}</p>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                    {diasDesde(c.atualizado_em)}d
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Mapa */}
      <Card className="mt-4 overflow-hidden">
        <h3 className="border-b border-slate-100 p-5 font-bold text-marinho-800">
          Mapa de obras · São Luís-MA
        </h3>
        {obras.some((o) => o.latitude && o.longitude) ? (
          <div className="h-[420px]">
            <MapContainer center={[-2.53, -44.3]} zoom={12} className="h-full w-full" scrollWheelZoom={false}>
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {obras.filter((o) => o.latitude && o.longitude).map((o) => {
                const cor = o.status_obra === "lancamento" ? "#2E78A8" : "#16a34a";
                return (
                  <CircleMarker
                    key={o.id}
                    center={[o.latitude!, o.longitude!]}
                    radius={9}
                    pathOptions={{ color: "#fff", weight: 2, fillColor: cor, fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-marinho-800">{o.nome_obra}</p>
                        <p className="text-slate-500">{o.construtora} · {o.bairro}</p>
                        <p className="mt-1">{o.status_obra === "lancamento" ? "Lançamento" : "Em andamento"}</p>
                        <a href={mapsLink(o.latitude, o.longitude, o.endereco)} target="_blank" rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-bold text-aco-600">
                          <Navigation size={12} /> Abrir rota
                        </a>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        ) : (
          <div className="p-5">
            <Empty icon={<Building2 size={36} />} titulo="Sem coordenadas" texto="Cadastre obras com latitude/longitude para vê-las no mapa." />
          </div>
        )}
        <div className="flex gap-4 border-t border-slate-100 p-4 text-xs font-semibold text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-aco-500" /> Lançamento</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-green-600" /> Em andamento</span>
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon, label, valor, cor }: { icon: React.ReactNode; label: string; valor: string | number; cor: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl text-white" style={{ background: cor }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black text-marinho-800">{valor}</p>
        <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
      </div>
    </Card>
  );
}
