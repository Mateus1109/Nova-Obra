import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, Copy, Filter, Globe, Lock, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/lib/data";
import { Avatar, Field, Input, Modal } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import type { Pipeline } from "@/lib/types";
import { cx } from "@/lib/utils";
import { BarraPesquisa, BotaoCriar, BotaoIcone, Caixa, CabecalhoSecao, Erro, RodapeModal, Tabela, contem, plural } from "./comum";

export default function Pipelines() {
  const { pipelines, etapas, cards, excluirPipeline, avisar } = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<Pipeline | "novo" | null>(null);
  const [duplicando, setDuplicando] = useState<Pipeline | null>(null);
  const [excluir, setExcluir] = useState<Pipeline | null>(null);

  // colunas e negócios (fora da lixeira) de cada pipeline
  const numeros = useMemo(() => {
    const m = new Map<string, { colunas: number; negocios: number; abertos: number }>();
    pipelines.forEach((p) => m.set(p.id, { colunas: 0, negocios: 0, abertos: 0 }));
    const pipelineDaEtapa = new Map(etapas.map((e) => [e.id, e.pipeline_id]));
    etapas.forEach((e) => {
      const n = m.get(e.pipeline_id);
      if (n) n.colunas++;
    });
    cards.forEach((c) => {
      const n = m.get(pipelineDaEtapa.get(c.etapa_id) ?? "");
      if (!n) return;
      n.negocios++;
      if (c.status === "aberto") n.abertos++;
    });
    return m;
  }, [pipelines, etapas, cards]);

  const lista = useMemo(
    () => pipelines.filter((p) => contem(`${p.nome} ${p.descricao} ${p.grupo}`, q)),
    [pipelines, q]
  );

  async function pedirExclusao(p: Pipeline) {
    if (pipelines.length <= 1) return avisar("É preciso manter pelo menos um pipeline.");
    if (numeros.get(p.id)?.negocios) return avisar("Mova ou exclua os negócios deste pipeline antes de apagá-lo.");
    // negócios na lixeira ainda prendem as colunas do pipeline
    const colunas = etapas.filter((e) => e.pipeline_id === p.id).map((e) => e.id);
    if (colunas.length) {
      const { count } = await supabase
        .from("oportunidades")
        .select("id", { count: "exact", head: true })
        .in("etapa_id", colunas)
        .not("excluido_em", "is", null);
      if (count)
        return avisar(
          `Este pipeline tem ${plural(count, "negócio", "negócios")} na lixeira. Restaure ou exclua definitivamente em Configurações → Lixeira antes de apagá-lo.`
        );
    }
    setExcluir(p);
  }

  return (
    <div>
      <CabecalhoSecao titulo="Pipelines" subtitulo="Organize os funis de venda, seus grupos e quem tem acesso a cada um">
        <BotaoCriar onClick={() => setEditando("novo")} />
      </CabecalhoSecao>

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <Tabela
        linhas={lista}
        vazio={q ? "Nenhum pipeline encontrado para essa pesquisa." : "Nenhum pipeline cadastrado. Clique em Criar."}
        colunas={[
          {
            titulo: "Pipeline",
            celula: (p) => (
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-md bg-aco-50 text-aco-600">
                  <Filter size={15} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-marinho-800">
                    <span className="truncate">{p.nome}</span>
                    {p.restrito && (
                      <span title="Acesso restrito" className="flex-shrink-0 text-amber-600">
                        <Lock size={13} />
                      </span>
                    )}
                  </p>
                  {p.descricao && <p className="truncate text-xs font-normal text-slate-500">{p.descricao}</p>}
                </div>
              </div>
            ),
          },
          { titulo: "Grupo", celula: (p) => <span className="text-slate-600">{p.grupo || "Padrão"}</span>, className: "w-40" },
          { titulo: "Colunas", celula: (p) => numeros.get(p.id)?.colunas ?? 0, className: "w-24" },
          {
            titulo: "Negócios",
            className: "w-36",
            celula: (p) => {
              const n = numeros.get(p.id);
              return (
                <span>
                  {n?.negocios ?? 0}
                  {!!n?.negocios && <span className="ml-1 text-xs text-slate-400">({n.abertos} em aberto)</span>}
                </span>
              );
            },
          },
        ]}
        acoes={(p) => (
          <>
            <BotaoIcone titulo={`Abrir ${p.nome}`} onClick={() => navigate(`/pipelines/${p.id}`)}>
              <ArrowUpRight size={16} />
            </BotaoIcone>
            <BotaoIcone titulo={`Editar ${p.nome}`} onClick={() => setEditando(p)}>
              <Pencil size={15} />
            </BotaoIcone>
            <BotaoIcone titulo={`Duplicar ${p.nome}`} onClick={() => setDuplicando(p)}>
              <Copy size={15} />
            </BotaoIcone>
            <BotaoIcone titulo={`Excluir ${p.nome}`} onClick={() => pedirExclusao(p)} perigo>
              <Trash2 size={15} />
            </BotaoIcone>
          </>
        )}
      />

      <p className="mt-3 text-xs text-slate-500">
        As colunas e os requisitos de cada etapa são editados direto no quadro do pipeline (botão <ArrowUpRight size={12} className="inline" />).
      </p>

      {editando && <PipelineModal pipeline={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />}
      {duplicando && <DuplicarModal pipeline={duplicando} onClose={() => setDuplicando(null)} />}
      {excluir && (
        <ConfirmarModal
          titulo="Excluir pipeline"
          texto={`O pipeline "${excluir.nome}" e as ${plural(numeros.get(excluir.id)?.colunas ?? 0, "coluna", "colunas")} dele serão excluídos. Essa ação não pode ser desfeita.`}
          rotulo="Excluir pipeline"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={async () => {
            if (await excluirPipeline(excluir.id)) avisar("Pipeline excluído.", "ok");
          }}
        />
      )}
    </div>
  );
}

/** Criar / editar: nome, descrição, grupo e quem pode ver */
function PipelineModal({ pipeline, onClose }: { pipeline: Pipeline | null; onClose: () => void }) {
  const { pipelines, vendedores, pipelineMembros, criarPipeline, atualizarPipeline, salvarPermissoesPipeline, avisar } = useData();
  const membrosAtuais = useMemo(
    () => (pipeline ? pipelineMembros.filter((m) => m.pipeline_id === pipeline.id).map((m) => m.usuario_id) : []),
    [pipeline, pipelineMembros]
  );
  const [nome, setNome] = useState(pipeline?.nome ?? "");
  const [descricao, setDescricao] = useState(pipeline?.descricao ?? "");
  const [grupo, setGrupo] = useState(pipeline?.grupo ?? "Padrão");
  const [restrito, setRestrito] = useState(pipeline?.restrito ?? false);
  const [membros, setMembros] = useState<string[]>(membrosAtuais);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const grupos = useMemo(() => Array.from(new Set(pipelines.map((p) => p.grupo || "Padrão"))).sort(), [pipelines]);

  async function salvar() {
    setErro(null);
    const n = nome.trim();
    if (!n) return setErro("Informe o nome do pipeline.");
    setSalvando(true);
    const g = grupo.trim() || "Padrão";
    let id = pipeline?.id ?? null;
    if (pipeline) {
      await atualizarPipeline(pipeline.id, { nome: n, descricao: descricao.trim(), grupo: g });
    } else {
      id = await criarPipeline(n, descricao.trim());
      if (id && g !== "Padrão") await atualizarPipeline(id, { grupo: g });
    }
    if (!id) return setSalvando(false);
    // permissões só são gravadas se mudaram
    const mudouAcesso =
      restrito !== (pipeline?.restrito ?? false) ||
      (restrito && (membros.length !== membrosAtuais.length || membros.some((m) => !membrosAtuais.includes(m))));
    if (mudouAcesso) await salvarPermissoesPipeline(id, restrito, restrito ? membros : membrosAtuais);
    setSalvando(false);
    if (!mudouAcesso) avisar(pipeline ? "Pipeline atualizado." : "Pipeline criado.", "ok");
    onClose();
  }

  const alternar = (uid: string) => setMembros((ms) => (ms.includes(uid) ? ms.filter((m) => m !== uid) : [...ms, uid]));

  return (
    <Modal open onClose={onClose} title={pipeline ? "Editar pipeline" : "Criar pipeline"}>
      <div className="space-y-4">
        <Field label="Nome *">
          <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Aquisição de obras, Bombeamento..." />
        </Field>
        <Field label="Descrição">
          <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Funil de prospecção de novas obras" />
        </Field>
        <Field label="Grupo">
          <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} list="grupos-pipeline" placeholder="Padrão" />
          <datalist id="grupos-pipeline">
            {grupos.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        {!pipeline && (
          <p className="text-xs text-slate-500">Ele já começa com as colunas Novo, Em andamento, Ganho e Perdido — dá para renomear depois no quadro.</p>
        )}

        <div>
          <p className="mb-1.5 text-sm font-medium text-marinho-800">Quem pode ver</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { v: false, icone: Globe, titulo: "Toda a equipe", desc: "Todos com acesso ao sistema" },
              { v: true, icone: Lock, titulo: "Restrito", desc: "Só administradores e quem você escolher" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                onClick={() => setRestrito(o.v)}
                className={cx(
                  "rounded-lg border px-3 py-2.5 text-left transition",
                  restrito === o.v ? "border-aco-500 bg-aco-50" : "border-slate-200 hover:bg-slate-50"
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-medium text-marinho-800">
                  <o.icone size={14} className={restrito === o.v ? "text-aco-600" : "text-slate-400"} /> {o.titulo}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">{o.desc}</p>
              </button>
            ))}
          </div>
          {restrito && (
            <div className="mt-2 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {vendedores.length === 0 ? (
                <p className="px-3 py-3 text-sm text-slate-500">Nenhum vendedor ativo na equipe.</p>
              ) : (
                vendedores.map((v) => (
                  <label key={v.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50">
                    <Caixa marcado={membros.includes(v.id)} onChange={() => alternar(v.id)} rotulo={v.nome} />
                    <Avatar nome={v.nome} size={26} />
                    <span className="min-w-0 flex-1 truncate text-sm text-marinho-800">{v.nome}</span>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <Erro texto={erro} />
        <RodapeModal onCancelar={onClose} onSalvar={salvar} salvando={salvando} rotulo={pipeline ? "Salvar" : "Criar pipeline"} />
      </div>
    </Modal>
  );
}

function DuplicarModal({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { duplicarPipeline } = useData();
  const [nome, setNome] = useState(`${pipeline.nome} (cópia)`);
  const [salvando, setSalvando] = useState(false);

  async function duplicar() {
    if (!nome.trim()) return;
    setSalvando(true);
    const id = await duplicarPipeline(pipeline.id, nome.trim());
    setSalvando(false);
    if (id) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Duplicar pipeline">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          Cria um novo pipeline com as mesmas colunas, requisitos de etapa e permissões de <b>{pipeline.nome}</b>. Os negócios não são copiados.
        </p>
        <Field label="Nome do novo pipeline *">
          <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && duplicar()} />
        </Field>
        <RodapeModal onCancelar={onClose} onSalvar={duplicar} salvando={salvando} rotulo="Duplicar" desabilitado={!nome.trim()} />
      </div>
    </Modal>
  );
}
