import { useMemo, useState } from "react";
import { Calendar, Hash, List, Plus, ToggleLeft, Type, X } from "lucide-react";
import { useData } from "@/lib/data";
import { Badge, Button, Field, Input, Modal } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import { TIPO_CAMPO_LABEL, type CampoAdicional, type TipoCampo } from "@/lib/types";
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
  plural,
  proximaOrdem,
  trocar,
  useLoteConfig,
} from "./comum";

type Entidade = CampoAdicional["entidade"];

const ABAS: { key: Entidade; label: string }[] = [
  { key: "lead", label: "Leads" },
  { key: "negocio", label: "Negócios" },
];

const ICONE_TIPO: Record<TipoCampo, typeof Type> = {
  texto: Type,
  numero: Hash,
  data: Calendar,
  opcoes: List,
  sim_nao: ToggleLeft,
};
const TIPOS = Object.keys(TIPO_CAMPO_LABEL) as TipoCampo[];

export default function CamposAdicionais() {
  const { camposAdicionais, salvarConfig } = useData();
  const { excluirVarios, reordenar, ocupado } = useLoteConfig();
  const [aba, setAba] = useState<Entidade>("lead");
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<CampoAdicional | "novo" | null>(null);
  const [excluir, setExcluir] = useState<CampoAdicional | null>(null);

  const daAba = useMemo(() => camposAdicionais.filter((c) => c.entidade === aba), [camposAdicionais, aba]);
  const lista = useMemo(() => daAba.filter((c) => contem(c.nome, q)), [daAba, q]);
  const podeOrdenar = !q.trim();

  return (
    <div>
      <CabecalhoSecao titulo="Campos adicionais" subtitulo="Crie campos extras para guardar informações específicas dos leads e negócios">
        <BotaoCriar onClick={() => setEditando("novo")} />
      </CabecalhoSecao>

      <div className="mb-4 flex gap-5 border-b border-slate-200">
        {ABAS.map((a) => {
          const n = camposAdicionais.filter((c) => c.entidade === a.key).length;
          return (
            <button
              key={a.key}
              onClick={() => setAba(a.key)}
              className={cx(
                "-mb-px flex items-center gap-1.5 border-b-2 px-1 pb-2.5 text-[0.9375rem] font-medium transition",
                aba === a.key ? "border-aco-500 text-aco-600" : "border-transparent text-slate-500 hover:text-marinho-800"
              )}
            >
              {a.label}
              <span className={cx("rounded-full px-1.5 text-xs", aba === a.key ? "bg-aco-50 text-aco-600" : "bg-slate-100 text-slate-500")}>{n}</span>
            </button>
          );
        })}
      </div>

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <Tabela
        linhas={lista}
        apagada={(c) => !c.ativo}
        vazio={
          q
            ? "Nenhum campo encontrado para essa pesquisa."
            : `Nenhum campo adicional para ${aba === "lead" ? "leads" : "negócios"}. Clique em Criar.`
        }
        colunas={[
          {
            titulo: "Nome do campo",
            celula: (c) => (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.nome}</span>
                {!c.ativo && <Badge>Inativo</Badge>}
              </span>
            ),
          },
          {
            titulo: "Tipo",
            className: "w-56",
            celula: (c) => {
              const Icone = ICONE_TIPO[c.tipo] ?? Type;
              return (
                <span className="text-slate-600 md:whitespace-nowrap">
                  <Icone size={14} className="mr-1.5 inline align-[-0.125rem] text-slate-400" />
                  {TIPO_CAMPO_LABEL[c.tipo]}
                  {c.tipo === "opcoes" && <span className="ml-1 text-xs text-slate-400">({plural(c.opcoes?.length ?? 0, "opção", "opções")})</span>}
                </span>
              );
            },
          },
          {
            titulo: "Ativo",
            className: "w-24",
            celula: (c) => (
              <Interruptor ligado={c.ativo} rotulo={`${c.nome} ativo`} onChange={(v) => salvarConfig("campos_adicionais", { id: c.id, ativo: v })} />
            ),
          },
          { titulo: "Data de criação", celula: (c) => <span className="text-slate-500">{dataBR(c.criado_em)}</span>, className: "w-36", celular: false },
        ]}
        acoes={(c, i) => (
          <>
            {podeOrdenar && (
              <BotoesOrdem
                primeiro={i === 0}
                ultimo={i === lista.length - 1}
                disabled={ocupado}
                onMover={(dir) => reordenar("campos_adicionais", trocar(daAba, i, dir))}
              />
            )}
            <AcoesEditarExcluir nome={c.nome} onEditar={() => setEditando(c)} onExcluir={() => setExcluir(c)} />
          </>
        )}
      />

      <p className="mt-3 text-xs text-slate-500">
        Os campos ativos aparecem nos dados {aba === "lead" ? "do lead" : "do negócio"}, na ordem desta lista.
      </p>

      {editando && (
        <CampoModal campo={editando === "novo" ? null : editando} entidade={aba} doGrupo={daAba} onClose={() => setEditando(null)} />
      )}

      {excluir && (
        <ConfirmarModal
          titulo="Excluir campo adicional"
          texto={`"${excluir.nome}" será excluído e os valores já preenchidos ${
            excluir.entidade === "lead" ? "nos leads" : "nos negócios"
          } deixam de aparecer. Se quiser só esconder por um tempo, desative em vez de excluir.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={() => excluirVarios("campos_adicionais", [excluir.id])}
        />
      )}
    </div>
  );
}

function CampoModal({
  campo,
  entidade,
  doGrupo,
  onClose,
}: {
  campo: CampoAdicional | null;
  entidade: Entidade;
  doGrupo: CampoAdicional[];
  onClose: () => void;
}) {
  const { salvarConfig, avisar } = useData();
  const [nome, setNome] = useState(campo?.nome ?? "");
  const [tipo, setTipo] = useState<TipoCampo>(campo?.tipo ?? "texto");
  const [opcoes, setOpcoes] = useState<string[]>(campo?.opcoes ?? []);
  const [novaOpcao, setNovaOpcao] = useState("");
  const [ativo, setAtivo] = useState(campo?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const ent = campo?.entidade ?? entidade;

  const addOpcao = () => {
    const v = novaOpcao.trim();
    if (!v) return;
    if (opcoes.some((o) => o.toLowerCase() === v.toLowerCase())) return setErro("Essa opção já está na lista.");
    setErro(null);
    setOpcoes((os) => [...os, v]);
    setNovaOpcao("");
  };

  async function salvar() {
    if (salvando) return; // Enter duas vezes não grava duas vezes
    setErro(null);
    const n = nome.trim();
    if (!n) return setErro("Informe o nome do campo.");
    if (doGrupo.some((c) => c.id !== campo?.id && c.nome.toLowerCase() === n.toLowerCase()))
      return setErro("Já existe um campo com esse nome.");
    // opção digitada e não adicionada também entra
    const pendente = novaOpcao.trim();
    const finais = tipo === "opcoes" ? (pendente && !opcoes.includes(pendente) ? [...opcoes, pendente] : opcoes) : [];
    if (tipo === "opcoes" && !finais.length) return setErro("Adicione pelo menos uma opção.");
    setSalvando(true);
    const ok = await salvarConfig(
      "campos_adicionais",
      campo
        ? { id: campo.id, nome: n, tipo, opcoes: finais, ativo }
        : { entidade: ent, nome: n, tipo, opcoes: finais, ativo, ordem: proximaOrdem(doGrupo) }
    );
    setSalvando(false);
    if (ok) {
      avisar(campo ? "Campo atualizado." : "Campo criado.", "ok");
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={campo ? "Editar campo adicional" : "Criar campo adicional"}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Aparece em: <b className="text-marinho-800">{ent === "lead" ? "Leads" : "Negócios"}</b>
        </p>
        <Field label="Nome do campo *">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={ent === "lead" ? "Ex.: Inscrição estadual" : "Ex.: Traço (fck)"}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-medium text-marinho-800">Tipo</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {TIPOS.map((t) => {
              const Icone = ICONE_TIPO[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={cx(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition",
                    tipo === t ? "border-aco-500 bg-aco-50 text-aco-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Icone size={15} className="flex-shrink-0" />
                  <span className="whitespace-nowrap">{TIPO_CAMPO_LABEL[t]}</span>
                </button>
              );
            })}
          </div>
          {campo && campo.tipo !== tipo && (
            <p className="mt-1.5 text-xs text-amber-700">Trocar o tipo pode deixar valores já preenchidos fora do novo formato.</p>
          )}
        </div>

        {tipo === "opcoes" && (
          <div>
            <p className="mb-1.5 text-sm font-medium text-marinho-800">Opções *</p>
            {opcoes.length > 0 && (
              <ul className="mb-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {opcoes.map((o, i) => (
                  <li key={o} className="flex items-center gap-1 py-1 pl-3 pr-1 text-sm">
                    <span className="min-w-0 flex-1 truncate text-marinho-800">{o}</span>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => setOpcoes((os) => trocar(os, i, -1))}
                      className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-marinho-800 disabled:opacity-30"
                      aria-label={`Subir ${o}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === opcoes.length - 1}
                      onClick={() => setOpcoes((os) => trocar(os, i, 1))}
                      className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-100 hover:text-marinho-800 disabled:opacity-30"
                      aria-label={`Descer ${o}`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpcoes((os) => os.filter((x) => x !== o))}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Remover ${o}`}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                value={novaOpcao}
                onChange={(e) => setNovaOpcao(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOpcao();
                  }
                }}
                placeholder="Digite a opção e tecle Enter"
                className="min-w-0 py-2"
              />
              <Button type="button" variant="secondary" onClick={addOpcao} disabled={!novaOpcao.trim()} className="flex-shrink-0">
                <Plus size={15} /> Adicionar
              </Button>
            </div>
          </div>
        )}

        <LinhaInterruptor ligado={ativo} onChange={setAtivo} titulo="Ativo" desc="Campos inativos ficam escondidos no cadastro." />
        <Erro texto={erro} />
        <RodapeModal onCancelar={onClose} onSalvar={salvar} salvando={salvando} rotulo={campo ? "Salvar" : "Criar"} />
      </div>
    </Modal>
  );
}
