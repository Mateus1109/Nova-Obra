import { useMemo, useState } from "react";
import { Check, Download, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/lib/data";
import { Button, Field, Input, Modal, Tag } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import type { TagConfig } from "@/lib/types";
import { cx, dataBR } from "@/lib/utils";
import {
  AcoesEditarExcluir,
  BarraPesquisa,
  BarraSelecao,
  BotaoCriar,
  CabecalhoSecao,
  Erro,
  RodapeModal,
  Tabela,
  contem,
  plural,
  useLoteConfig,
  useSelecao,
} from "./comum";

/** Cores oferecidas (tons escuros o bastante para o texto da tag ficar legível) */
const PALETA_TAGS = [
  "#3385FF",
  "#0891b2",
  "#0d9488",
  "#16a34a",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#9333ea",
  "#4f46e5",
  "#475569",
];
const COR_PADRAO = "#3385FF";

const chave = (s: string) => s.trim().toLowerCase();

export default function Tags() {
  const { tagsConfig, leads, cards, recarregar, avisar } = useData();
  const { excluirVarios, ocupado } = useLoteConfig();
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<TagConfig | "novo" | null>(null);
  const [excluir, setExcluir] = useState<string[] | null>(null);
  const [importando, setImportando] = useState(false);

  // quantos leads/negócios usam cada tag (sem diferenciar maiúsculas)
  const uso = useMemo(() => {
    const m = new Map<string, { nome: string; leads: number; negocios: number }>();
    const somar = (nome: string, campo: "leads" | "negocios") => {
      const k = chave(nome);
      if (!k) return;
      const atual = m.get(k) ?? { nome: nome.trim(), leads: 0, negocios: 0 };
      atual[campo]++;
      m.set(k, atual);
    };
    leads.forEach((l) => (l.tags ?? []).forEach((t) => somar(t, "leads")));
    cards.forEach((c) => (c.tags ?? []).forEach((t) => somar(t, "negocios")));
    return m;
  }, [leads, cards]);

  const naoCadastradas = useMemo(() => {
    const cadastradas = new Set(tagsConfig.map((t) => chave(t.nome)));
    return Array.from(uso.entries())
      .filter(([k]) => !cadastradas.has(k))
      .map(([, v]) => v.nome)
      .sort((a, b) => a.localeCompare(b));
  }, [uso, tagsConfig]);

  const lista = useMemo(() => tagsConfig.filter((t) => contem(t.nome, q)), [tagsConfig, q]);
  const sel = useSelecao(useMemo(() => lista.map((t) => t.id), [lista]));

  async function importar() {
    if (!naoCadastradas.length) return avisar("Todas as tags em uso já estão cadastradas.", "ok");
    setImportando(true);
    const { error } = await supabase.from("tags").insert(naoCadastradas.map((nome) => ({ nome, cor: COR_PADRAO })));
    if (error) {
      setImportando(false);
      return avisar("Não foi possível importar as tags.");
    }
    await recarregar();
    setImportando(false);
    avisar(`${plural(naoCadastradas.length, "tag importada", "tags importadas")}.`, "ok");
  }

  const usoTexto = (nome: string) => {
    const u = uso.get(chave(nome));
    if (!u) return <span className="text-slate-400">Sem uso</span>;
    return [u.leads && plural(u.leads, "lead", "leads"), u.negocios && plural(u.negocios, "negócio", "negócios")]
      .filter(Boolean)
      .join(" · ");
  };

  return (
    <div>
      <CabecalhoSecao titulo="Tags" subtitulo="Crie e organize as tags usadas para marcar leads e negócios">
        <Button variant="secondary" onClick={importar} disabled={importando}>
          <Download size={16} /> {importando ? "Importando..." : "Importar tags em uso"}
        </Button>
        <BotaoCriar onClick={() => setEditando("novo")} />
      </CabecalhoSecao>

      {naoCadastradas.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <p>
            {plural(naoCadastradas.length, "tag usada ainda não está cadastrada", "tags usadas ainda não estão cadastradas")} — use{" "}
            <b>Importar tags em uso</b> para cadastrá-las de uma vez:
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {naoCadastradas.slice(0, 12).map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {naoCadastradas.length > 12 && <span className="text-xs text-amber-800">+{naoCadastradas.length - 12}</span>}
          </div>
        </div>
      )}

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <BarraSelecao qtd={sel.ids.length} onLimpar={sel.limpar}>
        <Button size="sm" variant="danger" disabled={ocupado} onClick={() => setExcluir(sel.ids)}>
          <Trash2 size={14} /> Excluir selecionadas
        </Button>
      </BarraSelecao>

      <Tabela
        linhas={lista}
        selecao={sel}
        vazio={q ? "Nenhuma tag encontrada para essa pesquisa." : "Nenhuma tag cadastrada. Clique em Criar ou importe as tags em uso."}
        colunas={[
          {
            titulo: "Tag",
            celula: (t) => (
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ background: t.cor }} />
                <Tag cor={t.cor}>{t.nome}</Tag>
              </span>
            ),
          },
          { titulo: "Em uso", celula: (t) => <span className="text-slate-600">{usoTexto(t.nome)}</span>, className: "w-52" },
          { titulo: "Data de criação", celula: (t) => <span className="text-slate-500">{dataBR(t.criado_em)}</span>, className: "w-40" },
        ]}
        acoes={(t) => <AcoesEditarExcluir nome={t.nome} onEditar={() => setEditando(t)} onExcluir={() => setExcluir([t.id])} />}
      />

      {editando && (
        <TagModal tag={editando === "novo" ? null : editando} usoAtual={editando === "novo" ? null : uso.get(chave(editando.nome)) ?? null} onClose={() => setEditando(null)} />
      )}

      {excluir && (
        <ConfirmarModal
          titulo={excluir.length === 1 ? "Excluir tag" : `Excluir ${excluir.length} tags`}
          texto={`${
            excluir.length === 1 ? `A tag "${tagsConfig.find((t) => t.id === excluir[0])?.nome ?? ""}" sai` : "As tags saem"
          } da configuração. Leads e negócios que já usam continuam marcados, mas sem a cor configurada.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={async () => {
            if (await excluirVarios("tags", excluir)) sel.limpar();
          }}
        />
      )}
    </div>
  );
}

function TagModal({
  tag,
  usoAtual,
  onClose,
}: {
  tag: TagConfig | null;
  usoAtual: { leads: number; negocios: number } | null;
  onClose: () => void;
}) {
  const { tagsConfig, salvarConfig, recarregar, avisar } = useData();
  const [nome, setNome] = useState(tag?.nome ?? "");
  const [cor, setCor] = useState(tag?.cor ?? COR_PADRAO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const renomeando = !!tag && nome.trim() !== "" && nome.trim() !== tag.nome;

  async function salvar() {
    if (salvando) return; // Enter duas vezes não grava duas vezes
    setErro(null);
    const n = nome.trim();
    if (!n) return setErro("Informe o nome da tag.");
    if (tagsConfig.some((t) => t.id !== tag?.id && chave(t.nome) === chave(n))) return setErro("Já existe uma tag com esse nome.");
    setSalvando(true);
    const ok = await salvarConfig("tags", tag ? { id: tag.id, nome: n, cor } : { nome: n, cor });
    // renomeou: o banco troca o nome em todos os leads e negócios que usam a tag (inclusive na lixeira)
    let trocou = true;
    if (ok && tag && renomeando) {
      const { error } = await supabase.rpc("renomear_tag", { antigo: tag.nome, novo: n });
      trocou = !error;
      await recarregar();
    }
    setSalvando(false);
    if (ok) {
      if (trocou) avisar(tag ? "Tag atualizada." : "Tag criada.", "ok");
      else avisar("A tag foi renomeada, mas não foi possível atualizar os leads e negócios que a usam.");
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={tag ? "Editar tag" : "Criar tag"}>
      <div className="space-y-4">
        <Field label="Nome *">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Ex.: Alto padrão, Laje em novembro..."
          />
        </Field>
        <div>
          <p className="mb-1.5 text-sm font-medium text-marinho-800">Cor</p>
          <div className="flex flex-wrap gap-2">
            {PALETA_TAGS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                aria-label={`Cor ${c}`}
                className={cx(
                  "grid h-8 w-8 place-items-center rounded-full text-white ring-offset-2 transition",
                  cor === c ? "ring-2 ring-slate-400" : "hover:scale-110"
                )}
                style={{ background: c }}
              >
                {cor === c && <Check size={15} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
          Prévia: <Tag cor={cor}>{nome.trim() || "Nome da tag"}</Tag>
        </div>
        {renomeando && usoAtual && (usoAtual.leads > 0 || usoAtual.negocios > 0) && (
          <p className="rounded-md bg-aco-50 px-3 py-2 text-xs text-marinho-800">
            O nome também será trocado em {[usoAtual.leads && plural(usoAtual.leads, "lead", "leads"), usoAtual.negocios && plural(usoAtual.negocios, "negócio", "negócios")].filter(Boolean).join(" e ")} que usam esta tag.
          </p>
        )}
        <Erro texto={erro} />
        <RodapeModal onCancelar={onClose} onSalvar={salvar} salvando={salvando} rotulo={tag ? "Salvar" : "Criar"} />
      </div>
    </Modal>
  );
}
