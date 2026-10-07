import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Circle, Phone, MessageCircle, MapPin, Users, Mail, FileText, ListTodo, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Button, Field, Input, Modal, Select, Textarea } from "./ui";
import { TIPO_ATIVIDADE, type Atividade, type TipoAtividade } from "@/lib/types";
import { cx } from "@/lib/utils";

export const ICONE_ATIVIDADE: Record<TipoAtividade, typeof Phone> = {
  tarefa: ListTodo,
  ligacao: Phone,
  whatsapp: MessageCircle,
  visita: MapPin,
  reuniao: Users,
  email: Mail,
  proposta: FileText,
};

/** "Hoje 14:00", "Amanhã 09:30", "12/10 10:00" */
export function quandoAtividade(iso: string | null) {
  if (!iso) return "Sem data";
  const d = new Date(iso);
  const hoje = new Date();
  const amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === hoje.toDateString()) return `Hoje ${hora}`;
  if (d.toDateString() === amanha.toDateString()) return `Amanhã ${hora}`;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${hora}`;
}

export const atrasada = (a: Pick<Atividade, "data_hora" | "concluida">) =>
  !a.concluida && !!a.data_hora && new Date(a.data_hora).getTime() < Date.now();

function paraInputLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function NovaAtividadeModal({
  oportunidadeId,
  leadId,
  onClose,
  onCriada,
}: {
  oportunidadeId?: string | null;
  leadId?: string | null;
  onClose: () => void;
  onCriada?: () => void;
}) {
  const { criarAtividade, vendedores } = useData();
  const { profile, isAdmin } = useAuth();
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(9, 0, 0, 0);
  const [tipo, setTipo] = useState<TipoAtividade>("ligacao");
  const [titulo, setTitulo] = useState("");
  const [quando, setQuando] = useState(paraInputLocal(amanha));
  const [descricao, setDescricao] = useState("");
  const [responsavel, setResponsavel] = useState(profile?.id ?? "");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    const ok = await criarAtividade({
      oportunidade_id: oportunidadeId ?? null,
      lead_id: leadId ?? null,
      tipo,
      titulo: titulo.trim() || TIPO_ATIVIDADE[tipo],
      descricao: descricao.trim(),
      data_hora: quando ? new Date(quando).toISOString() : null,
      responsavel_id: responsavel || null,
    });
    setSalvando(false);
    if (ok) {
      onCriada?.();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title="Nova atividade">
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {(Object.keys(TIPO_ATIVIDADE) as TipoAtividade[]).map((t) => {
            const Icone = ICONE_ATIVIDADE[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTipo(t)}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-md border px-1 py-2 text-[11px] font-medium transition",
                  tipo === t ? "border-aco-500 bg-aco-50 text-aco-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                )}
              >
                <Icone size={16} />
                {TIPO_ATIVIDADE[t]}
              </button>
            );
          })}
        </div>
        <Field label="Título">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={`Ex.: ${TIPO_ATIVIDADE[tipo]} com o engenheiro da obra`}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Data e hora">
            <Input type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} />
          </Field>
          {isAdmin && (
            <Field label="Responsável">
              <Select value={responsavel} onChange={(e) => setResponsavel(e.target.value)}>
                {profile && <option value={profile.id}>{profile.nome} (eu)</option>}
                {vendedores
                  .filter((v) => v.id !== profile?.id)
                  .map((v) => (
                    <option key={v.id} value={v.id}>{v.nome}</option>
                  ))}
              </Select>
            </Field>
          )}
        </div>
        <Field label="Descrição (opcional)">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-[60px]" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Criar atividade"}</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Lista completa (pendentes + concluídas) de um negócio ou de um lead. */
export function ListaAtividades({ oportunidadeIds, leadId }: { oportunidadeIds: string[]; leadId: string | null }) {
  const { atualizarAtividade } = useData();
  const { profile, isAdmin } = useAuth();
  const [lista, setLista] = useState<Atividade[] | null>(null);
  const [nova, setNova] = useState(false);
  const chave = oportunidadeIds.join(",");

  const carregar = useCallback(async () => {
    const filtros = [
      leadId ? `lead_id.eq.${leadId}` : null,
      oportunidadeIds.length ? `oportunidade_id.in.(${oportunidadeIds.join(",")})` : null,
    ].filter(Boolean);
    if (!filtros.length) return setLista([]);
    const { data } = await supabase
      .from("atividades")
      .select("*")
      .or(filtros.join(","))
      .order("concluida")
      .order("data_hora", { ascending: true, nullsFirst: false });
    setLista((data as Atividade[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, leadId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternar(a: Atividade) {
    const concluida = !a.concluida;
    setLista((l) => l?.map((x) => (x.id === a.id ? { ...x, concluida } : x)) ?? null);
    await atualizarAtividade(a.id, { concluida, concluida_em: concluida ? new Date().toISOString() : null });
  }

  async function excluir(a: Atividade) {
    if (!window.confirm("Excluir esta atividade?")) return;
    setLista((l) => l?.filter((x) => x.id !== a.id) ?? null);
    await supabase.from("atividades").delete().eq("id", a.id);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {lista ? `${lista.filter((a) => !a.concluida).length} pendente(s)` : "Carregando..."}
        </p>
        <Button size="sm" onClick={() => setNova(true)}>+ Nova atividade</Button>
      </div>
      {lista && lista.length === 0 && (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
          Nenhuma atividade. Agende a próxima ligação, visita ou proposta.
        </p>
      )}
      <div className="space-y-2">
        {lista?.map((a) => {
          const Icone = ICONE_ATIVIDADE[a.tipo];
          return (
            <div
              key={a.id}
              className={cx(
                "flex items-start gap-3 rounded-lg border p-3",
                a.concluida ? "border-slate-100 bg-slate-50" : atrasada(a) ? "border-red-200 bg-red-50/40" : "border-slate-200"
              )}
            >
              <button onClick={() => alternar(a)} className="mt-0.5 text-slate-400 hover:text-green-600" aria-label="Concluir">
                {a.concluida ? <CheckCircle2 size={20} className="text-green-600" /> : <Circle size={20} />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cx("flex items-center gap-1.5 font-medium", a.concluida ? "text-slate-400 line-through" : "text-marinho-800")}>
                  <Icone size={14} className="flex-shrink-0" /> {a.titulo}
                </p>
                <p className={cx("mt-0.5 flex items-center gap-1 text-xs", atrasada(a) ? "font-semibold text-red-600" : "text-slate-500")}>
                  <CalendarClock size={12} /> {quandoAtividade(a.data_hora)}
                  {atrasada(a) && " · atrasada"}
                </p>
                {a.descricao && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.descricao}</p>}
              </div>
              {(isAdmin || a.criado_por === profile?.id) && (
                <button onClick={() => excluir(a)} className="text-slate-300 hover:text-red-500" aria-label="Excluir">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {nova && (
        <NovaAtividadeModal
          oportunidadeId={oportunidadeIds[0] ?? null}
          leadId={leadId}
          onClose={() => setNova(false)}
          onCriada={carregar}
        />
      )}
    </div>
  );
}
