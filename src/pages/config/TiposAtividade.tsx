import { useMemo, useState } from "react";
import { useData } from "@/lib/data";
import { Badge, Field, Input, Modal } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import { ICONE_ATIVIDADE } from "@/components/Atividades";
import { TIPO_ATIVIDADE, type TipoAtividade, type TipoAtividadeConfig } from "@/lib/types";
import { cx, dataBR } from "@/lib/utils";
import {
  AcoesEditarExcluir,
  BarraPesquisa,
  BotaoCriar,
  BotoesOrdem,
  CabecalhoSecao,
  Erro,
  Interruptor,
  LinhaInterruptor,
  RodapeModal,
  Tabela,
  contem,
  proximaOrdem,
  trocar,
  useLoteConfig,
} from "./comum";

const ICONES = Object.keys(TIPO_ATIVIDADE) as TipoAtividade[];

function IconeTipo({ icone, ativo = true }: { icone: TipoAtividade; ativo?: boolean }) {
  const Icone = ICONE_ATIVIDADE[icone] ?? ICONE_ATIVIDADE.tarefa;
  return (
    <span
      className={cx(
        "grid h-8 w-8 flex-shrink-0 place-items-center rounded-md",
        ativo ? "bg-aco-50 text-aco-600" : "bg-slate-100 text-slate-400"
      )}
    >
      <Icone size={16} />
    </span>
  );
}

export default function TiposAtividade() {
  const { tiposAtividade, salvarConfig } = useData();
  const { excluirVarios, reordenar, ocupado } = useLoteConfig();
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<TipoAtividadeConfig | "novo" | null>(null);
  const [excluir, setExcluir] = useState<TipoAtividadeConfig | null>(null);

  const lista = useMemo(() => tiposAtividade.filter((t) => contem(t.nome, q)), [tiposAtividade, q]);
  // reordenar só faz sentido com a lista completa (sem pesquisa)
  const podeOrdenar = !q.trim();

  return (
    <div>
      <CabecalhoSecao titulo="Tipos de atividades" subtitulo="Defina os tipos de atividade que a equipe agenda nos leads e negócios">
        <BotaoCriar onClick={() => setEditando("novo")} />
      </CabecalhoSecao>

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <Tabela
        linhas={lista}
        apagada={(t) => !t.ativo}
        vazio={q ? "Nenhum tipo encontrado para essa pesquisa." : "Nenhum tipo de atividade cadastrado. Clique em Criar."}
        colunas={[
          {
            titulo: "Tipo de atividade",
            celula: (t) => (
              <span className="inline-flex items-center gap-2.5">
                <IconeTipo icone={t.icone} ativo={t.ativo} />
                <span className="font-medium">{t.nome}</span>
                {!t.ativo && <Badge>Inativo</Badge>}
              </span>
            ),
          },
          {
            titulo: "Ativo",
            className: "w-28",
            celula: (t) => (
              <Interruptor ligado={t.ativo} rotulo={`${t.nome} ativo`} onChange={(v) => salvarConfig("tipos_atividade", { id: t.id, ativo: v })} />
            ),
          },
          { titulo: "Data de criação", celula: (t) => <span className="text-slate-500">{dataBR(t.criado_em)}</span>, className: "w-40", celular: false },
        ]}
        acoes={(t, i) => (
          <>
            {podeOrdenar && (
              <BotoesOrdem
                primeiro={i === 0}
                ultimo={i === lista.length - 1}
                disabled={ocupado}
                onMover={(dir) => reordenar("tipos_atividade", trocar(tiposAtividade, i, dir))}
              />
            )}
            <AcoesEditarExcluir nome={t.nome} onEditar={() => setEditando(t)} onExcluir={() => setExcluir(t)} />
          </>
        )}
      />

      <p className="mt-3 text-xs text-slate-500">
        A ordem aqui é a mesma em que os tipos aparecem ao agendar uma atividade. Tipos inativos somem da lista, mas as atividades antigas continuam.
      </p>

      {editando && <TipoModal tipo={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />}

      {excluir && (
        <ConfirmarModal
          titulo="Excluir tipo de atividade"
          texto={`"${excluir.nome}" será excluído. As atividades já registradas com esse tipo continuam, só perdem o vínculo. Se quiser só esconder, desative.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={() => excluirVarios("tipos_atividade", [excluir.id])}
        />
      )}
    </div>
  );
}

function TipoModal({ tipo, onClose }: { tipo: TipoAtividadeConfig | null; onClose: () => void }) {
  const { tiposAtividade, salvarConfig, avisar } = useData();
  const [nome, setNome] = useState(tipo?.nome ?? "");
  const [icone, setIcone] = useState<TipoAtividade>(tipo?.icone ?? "tarefa");
  const [ativo, setAtivo] = useState(tipo?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    const n = nome.trim();
    if (!n) return setErro("Informe o nome do tipo.");
    if (tiposAtividade.some((t) => t.id !== tipo?.id && t.nome.toLowerCase() === n.toLowerCase()))
      return setErro("Já existe um tipo com esse nome.");
    setSalvando(true);
    const ok = await salvarConfig(
      "tipos_atividade",
      tipo ? { id: tipo.id, nome: n, icone, ativo } : { nome: n, icone, ativo, ordem: proximaOrdem(tiposAtividade) }
    );
    setSalvando(false);
    if (ok) {
      avisar(tipo ? "Tipo de atividade atualizado." : "Tipo de atividade criado.", "ok");
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={tipo ? "Editar tipo de atividade" : "Criar tipo de atividade"}>
      <div className="space-y-4">
        <Field label="Nome *">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Ex.: Visita técnica, Envio de traço..."
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-marinho-800">Ícone</p>
          <div className="grid grid-cols-4 gap-2">
            {ICONES.map((k) => {
              const Icone = ICONE_ATIVIDADE[k];
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIcone(k)}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-lg border px-1 py-2 text-[0.6875rem] transition",
                    icone === k ? "border-aco-500 bg-aco-50 text-aco-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icone size={18} />
                  <span className="w-full text-center leading-tight">{TIPO_ATIVIDADE[k]}</span>
                </button>
              );
            })}
          </div>
        </div>
        <LinhaInterruptor ligado={ativo} onChange={setAtivo} titulo="Ativo" desc="Aparece na lista ao agendar uma atividade." />
        <Erro texto={erro} />
        <RodapeModal onCancelar={onClose} onSalvar={salvar} salvando={salvando} rotulo={tipo ? "Salvar" : "Criar"} />
      </div>
    </Modal>
  );
}
