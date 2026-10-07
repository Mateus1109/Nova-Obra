import { useState } from "react";
import { ThumbsDown, AlertTriangle } from "lucide-react";
import { useData } from "@/lib/data";
import { Button, Field, Modal, Select, Textarea } from "./ui";
import { STATUS_NEGOCIO, type StatusNegocio } from "@/lib/types";

/** Selo "Ganho" / "Perdido" / "Em aberto" */
export function SeloStatus({ status, mostrarAberto = false }: { status: StatusNegocio; mostrarAberto?: boolean }) {
  if (status === "aberto" && !mostrarAberto) return null;
  const s = STATUS_NEGOCIO[status];
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold" style={{ background: s.bg, color: s.fg }}>
      {s.label}
    </span>
  );
}

/**
 * Perder um ou vários negócios: escolhe o motivo (Configurações → Motivos de perda)
 * e descreve — a descrição é obrigatória quando o motivo exige.
 */
export function PerderModal({ ids, onClose, onPerdido }: { ids: string[]; onClose: () => void; onPerdido?: () => void }) {
  const { motivosPerda, perderNegocios } = useData();
  const ativos = motivosPerda.filter((m) => m.ativo);
  const [motivoId, setMotivoId] = useState(ativos[0]?.id ?? "");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const motivo = ativos.find((m) => m.id === motivoId);

  async function confirmar() {
    setErro(null);
    if (ativos.length && !motivoId) return setErro("Escolha o motivo da perda.");
    if (motivo?.obrigatorio && !descricao.trim()) return setErro(`O motivo "${motivo.nome}" exige uma descrição.`);
    setSalvando(true);
    const ok = await perderNegocios(ids, motivoId || null, descricao.trim());
    setSalvando(false);
    if (ok) {
      onPerdido?.();
      onClose();
    }
  }

  return (
    <Modal open onClose={onClose} title={ids.length === 1 ? "Perder negócio" : `Perder ${ids.length} negócios`}>
      <div className="space-y-4">
        <Field label="Motivo da perda">
          <Select value={motivoId} onChange={(e) => setMotivoId(e.target.value)}>
            {!ativos.length && <option value="">Nenhum motivo cadastrado</option>}
            {ativos.map((m) => (
              <option key={m.id} value={m.id}>{m.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label={motivo?.obrigatorio ? "Descrição *" : "Descrição (opcional)"}>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex.: fechou com outra concreteira pelo preço do m³"
            className="min-h-[80px]"
          />
        </Field>
        {erro && (
          <p className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle size={15} /> {erro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="danger" onClick={confirmar} disabled={salvando}>
            <ThumbsDown size={16} /> {salvando ? "Salvando..." : "Marcar como perdido"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** Confirmação simples (excluir, restaurar etc.) */
export function ConfirmarModal({
  titulo,
  texto,
  rotulo,
  perigo,
  onClose,
  onConfirmar,
}: {
  titulo: string;
  texto: string;
  rotulo: string;
  perigo?: boolean;
  onClose: () => void;
  onConfirmar: () => Promise<unknown> | void;
}) {
  const [ocupado, setOcupado] = useState(false);
  return (
    <Modal open onClose={onClose} title={titulo}>
      <p className="text-sm text-slate-600">{texto}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button
          variant={perigo ? "danger" : "primary"}
          disabled={ocupado}
          onClick={async () => {
            setOcupado(true);
            await onConfirmar();
            setOcupado(false);
            onClose();
          }}
        >
          {ocupado ? "Aguarde..." : rotulo}
        </Button>
      </div>
    </Modal>
  );
}
