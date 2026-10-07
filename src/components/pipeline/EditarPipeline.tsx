import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Copy, Trash2 } from "lucide-react";
import { useData } from "@/lib/data";
import type { Pipeline } from "@/lib/types";
import { Button, Field, Input, Modal } from "@/components/ui";
import { ConfirmarModal } from "@/components/StatusNegocio";

/** Nome, descrição e grupo do pipeline; também exclui (só o administrador) */
export function EditarPipeline({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { atualizarPipeline, excluirPipeline, pipelines } = useData();
  const nav = useNavigate();
  const [nome, setNome] = useState(pipeline.nome);
  const [descricao, setDescricao] = useState(pipeline.descricao ?? "");
  const [grupo, setGrupo] = useState(pipeline.grupo ?? "");
  const [excluir, setExcluir] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const grupos = Array.from(new Set(pipelines.map((p) => p.grupo).filter(Boolean)));

  return (
    <>
      <Modal open onClose={onClose} title="Editar pipeline">
        <div className="space-y-4">
          <Field label="Nome *">
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Descrição">
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Funil básico de vendas" />
          </Field>
          <Field label="Grupo">
            <Input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Padrão" list="grupos-pipeline" />
            <datalist id="grupos-pipeline">
              {grupos.map((g) => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            {pipelines.length > 1 && (
              <Button variant="ghost" className="mr-auto text-red-600 hover:bg-red-50" onClick={() => setExcluir(true)}>
                <Trash2 size={15} /> Excluir pipeline
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={!nome.trim() || salvando}
              onClick={async () => {
                setSalvando(true);
                await atualizarPipeline(pipeline.id, { nome: nome.trim(), descricao: descricao.trim(), grupo: grupo.trim() || "Padrão" });
                setSalvando(false);
                onClose();
              }}
            >
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
      {excluir && (
        <ConfirmarModal
          titulo="Excluir pipeline"
          texto={`O pipeline "${pipeline.nome}" e suas colunas serão apagados. Só dá para excluir um pipeline sem negócios — mova-os antes (⋮ → Mover negócios).`}
          rotulo="Excluir pipeline"
          perigo
          onClose={() => setExcluir(false)}
          onConfirmar={async () => {
            if (await excluirPipeline(pipeline.id)) {
              onClose();
              nav("/");
            }
          }}
        />
      )}
    </>
  );
}

/** Cria uma cópia do pipeline (colunas, condições de etapa e permissões; sem os negócios) */
export function DuplicarPipeline({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { duplicarPipeline } = useData();
  const nav = useNavigate();
  const [nome, setNome] = useState(`Cópia de ${pipeline.nome}`);
  const [salvando, setSalvando] = useState(false);

  async function duplicar() {
    if (!nome.trim()) return;
    setSalvando(true);
    const id = await duplicarPipeline(pipeline.id, nome.trim());
    setSalvando(false);
    if (id) {
      onClose();
      nav(`/pipelines/${id}`);
    }
  }

  return (
    <Modal open onClose={onClose} title="Duplicar pipeline">
      <div className="space-y-4">
        <Field label="Nome do novo pipeline *">
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && duplicar()}
          />
        </Field>
        <p className="rounded-md bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          São copiadas as colunas (com cores, tipo e condições de etapa), o grupo e as permissões. Os negócios não são copiados.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || salvando} onClick={duplicar}>
            <Copy size={16} /> {salvando ? "Duplicando..." : "Duplicar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
