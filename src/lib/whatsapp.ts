import { supabase } from "./supabase";

/**
 * Envia uma mensagem de WhatsApp pelo gateway (Edge Function enviar-whatsapp).
 * A URL e a chave do gateway ficam no servidor; o navegador só manda telefone e texto.
 */
export async function enviarWhatsApp(p: { telefone?: string | null; jid?: string | null; mensagem: string }): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("enviar-whatsapp", {
    body: { telefone: p.telefone ?? undefined, jid: p.jid ?? undefined, mensagem: p.mensagem },
  });
  if (error) {
    // a Edge Function devolve a mensagem de erro no corpo, mesmo com status != 2xx
    let msg = error.message;
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.error) msg = corpo.error as string;
    } catch {
      /* sem corpo JSON */
    }
    return { ok: false, error: msg };
  }
  if (data && typeof data === "object" && "error" in data) return { ok: false, error: String((data as { error: unknown }).error) };
  return { ok: true };
}
