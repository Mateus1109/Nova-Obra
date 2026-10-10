import { useState } from "react";
import { MessageCircle, Send, ExternalLink, CheckCircle2, AlertTriangle } from "lucide-react";
import { enviarWhatsApp } from "@/lib/whatsapp";
import { linkWhatsApp } from "@/lib/utils";
import { Button, Modal, Textarea } from "./ui";

/**
 * Compositor de WhatsApp: escreve e envia pelo gateway da empresa (sem sair do CRM).
 * Se o gateway não estiver configurado ou falhar, dá para abrir no WhatsApp normal (wa.me).
 */
export function WhatsAppModal({
  telefone,
  nome,
  mensagemInicial = "",
  onClose,
}: {
  telefone: string | null | undefined;
  nome?: string;
  mensagemInicial?: string;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState(mensagemInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const wa = linkWhatsApp(telefone);

  async function enviar() {
    if (!texto.trim()) return setErro("Escreva a mensagem.");
    setErro(null);
    setEnviando(true);
    const r = await enviarWhatsApp({ telefone, mensagem: texto.trim() });
    setEnviando(false);
    if (r.ok) {
      setOk(true);
      setTimeout(onClose, 1200);
    } else {
      setErro(r.error ?? "Não foi possível enviar.");
    }
  }

  return (
    <Modal open onClose={onClose} title={nome ? `WhatsApp para ${nome}` : "Enviar WhatsApp"}>
      {ok ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 size={40} className="text-green-600" />
          <p className="font-semibold text-marinho-800">Mensagem enviada!</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <MessageCircle size={15} className="text-green-600" /> Para: <span className="font-medium text-marinho-800">{telefone || "sem telefone"}</span>
          </p>
          <Textarea
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escreva a mensagem..."
            className="min-h-[120px]"
          />
          {erro && (
            <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" /> {erro}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="mr-auto">
                <Button variant="ghost" type="button">
                  <ExternalLink size={15} /> Abrir no WhatsApp
                </Button>
              </a>
            )}
            <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
            <Button onClick={enviar} disabled={enviando || !telefone}>
              <Send size={15} /> {enviando ? "Enviando..." : "Enviar pelo CRM"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
