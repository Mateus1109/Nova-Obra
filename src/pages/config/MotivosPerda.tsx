import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import { Badge, Button, Field, Input, Modal } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";
import type { MotivoPerda } from "@/lib/types";
import { dataBR } from "@/lib/utils";
import {
  AcoesEditarExcluir,
  BarraPesquisa,
  BarraSelecao,
  BotaoCriar,
  CabecalhoSecao,
  Erro,
  LinhaInterruptor,
  PilulaSimNao,
  RodapeModal,
  Tabela,
  contem,
  plural,
  proximaOrdem,
  useLoteConfig,
  useSelecao,
} from "./comum";

export default function MotivosPerda() {
  const { motivosPerda } = useData();
  const { excluirVarios, ocupado } = useLoteConfig();
  const [q, setQ] = useState("");
  const [editando, setEditando] = useState<MotivoPerda | "novo" | null>(null);
  const [excluir, setExcluir] = useState<string[] | null>(null);

  const lista = useMemo(() => motivosPerda.filter((m) => contem(m.nome, q)), [motivosPerda, q]);
  const sel = useSelecao(useMemo(() => lista.map((m) => m.id), [lista]));

  return (
    <div>
      <CabecalhoSecao titulo="Motivos de perda dos negócios" subtitulo="Descubra, organize e gerencie seus motivos de perda">
        <BotaoCriar onClick={() => setEditando("novo")} />
      </CabecalhoSecao>

      <BarraPesquisa valor={q} onChange={setQ} total={lista.length} />

      <BarraSelecao qtd={sel.ids.length} onLimpar={sel.limpar}>
        <Button size="sm" variant="danger" disabled={ocupado} onClick={() => setExcluir(sel.ids)}>
          <Trash2 size={14} /> Excluir selecionados
        </Button>
      </BarraSelecao>

      <Tabela
        linhas={lista}
        selecao={sel}
        apagada={(m) => !m.ativo}
        vazio={q ? "Nenhum motivo encontrado para essa pesquisa." : "Nenhum motivo de perda cadastrado. Clique em Criar."}
        colunas={[
          {
            titulo: "Motivos de perda dos negócios",
            celula: (m) => (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="font-medium">{m.nome}</span>
                {!m.ativo && <Badge>Inativo</Badge>}
              </span>
            ),
          },
          { titulo: "Obrigatório", celula: (m) => <PilulaSimNao sim={m.obrigatorio} />, className: "w-36" },
          { titulo: "Data de criação", celula: (m) => <span className="text-slate-500">{dataBR(m.criado_em)}</span>, className: "w-40" },
        ]}
        acoes={(m) => <AcoesEditarExcluir nome={m.nome} onEditar={() => setEditando(m)} onExcluir={() => setExcluir([m.id])} />}
      />

      <p className="mt-3 text-xs text-slate-500">
        <b>Obrigatório</b>: ao perder um negócio com esse motivo, o vendedor precisa escrever uma descrição explicando o que aconteceu.
      </p>

      {editando && <MotivoModal motivo={editando === "novo" ? null : editando} onClose={() => setEditando(null)} />}

      {excluir && (
        <ConfirmarModal
          titulo={excluir.length === 1 ? "Excluir motivo de perda" : `Excluir ${excluir.length} motivos de perda`}
          texto={`${
            excluir.length === 1
              ? `"${motivosPerda.find((m) => m.id === excluir[0])?.nome ?? ""}" será excluído.`
              : `${plural(excluir.length, "motivo será excluído", "motivos serão excluídos")}.`
          } Negócios já perdidos com ${excluir.length === 1 ? "ele" : "eles"} ficam sem motivo. Se quiser só esconder da lista, desative em vez de excluir.`}
          rotulo="Excluir"
          perigo
          onClose={() => setExcluir(null)}
          onConfirmar={async () => {
            if (await excluirVarios("motivos_perda", excluir)) sel.limpar();
          }}
        />
      )}
    </div>
  );
}

function MotivoModal({ motivo, onClose }: { motivo: MotivoPerda | null; onClose: () => void }) {
  const { motivosPerda, salvarConfig, avisar } = useData();
  const [nome, setNome] = useState(motivo?.nome ?? "");
  const [obrigatorio, setObrigatorio] = useState(motivo?.obrigatorio ?? false);
  const [ativo, setAtivo] = useState(motivo?.ativo ?? true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (salvando) return; // Enter duas vezes não grava duas vezes
    setErro(null);
    const n = nome.trim();
    if (!n) return setErro("Informe o motivo.");
    if (motivosPerda.some((m) => m.id !== motivo?.id && m.nome.toLowerCase() === n.toLowerCase()))
      return setErro("Já existe um motivo com esse nome.");
    setSalvando(true);
    const ok = await salvarConfig(
      "motivos_perda",
      motivo ? { id: motivo.id, nome: n, obrigatorio, ativo } : { nome: n, obrigatorio, ativo, ordem: proximaOrdem(motivosPerda) }
    );
    setSalvando(false);
    if (ok) {
      avisar(motivo ? "Motivo de perda atualizado." : "Motivo de perda criado.", "ok");
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={motivo ? "Editar motivo de perda" : "Criar motivo de perda"}>
      <div className="space-y-4">
        <Field label="Motivo *">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && salvar()}
            placeholder="Ex.: Preço do m³ acima do concorrente"
          />
        </Field>
        <LinhaInterruptor
          ligado={obrigatorio}
          onChange={setObrigatorio}
          titulo="Obrigatório"
          desc="Exige uma descrição ao perder um negócio com este motivo."
        />
        <LinhaInterruptor
          ligado={ativo}
          onChange={setAtivo}
          titulo="Ativo"
          desc="Motivos inativos não aparecem na hora de perder um negócio, mas continuam nos negócios antigos."
        />
        <Erro texto={erro} />
        <RodapeModal onCancelar={onClose} onSalvar={salvar} salvando={salvando} rotulo={motivo ? "Salvar" : "Criar"} />
      </div>
    </Modal>
  );
}
