import { AlertCircle, ExternalLink } from "lucide-react";
import { tituloCard, type Card } from "@/lib/data";
import type { Etapa } from "@/lib/types";
import { Button, Modal } from "@/components/ui";

/** Avisa o que falta para o negócio poder sair da etapa atual (Configurações de etapa) */
export function FaltandoModal({
  card,
  etapa,
  falta,
  onClose,
  onAbrir,
}: {
  card: Card;
  etapa: Etapa;
  falta: string[];
  onClose: () => void;
  onAbrir: () => void;
}) {
  return (
    <Modal open onClose={onClose} title="Ainda não dá para mover">
      <p className="text-sm text-slate-600">
        Para sair de <b className="text-marinho-800">{etapa.nome}</b> este negócio precisa:
      </p>
      <ul className="mt-3 space-y-2">
        {falta.map((f) => (
          <li key={f} className="flex items-center gap-2.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
            <AlertCircle size={16} className="flex-shrink-0 text-amber-600" /> {f}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">
        Negócio: <span className="font-medium text-marinho-800">{tituloCard(card)}</span>. Complete os dados e tente de novo.
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Fechar</Button>
        <Button onClick={onAbrir}>
          <ExternalLink size={15} /> Abrir negócio
        </Button>
      </div>
    </Modal>
  );
}
