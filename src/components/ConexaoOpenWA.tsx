import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, KeyRound, Link2, Loader2, QrCode, RefreshCw, Smartphone, WifiOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button, Field, Input } from "./ui";
import { cx } from "@/lib/utils";

type Estado = {
  configurado?: boolean;
  status?: string;
  telefone?: string | null;
  nome?: string | null;
  webhook?: boolean;
  error?: string;
};

async function chamar(acao: string): Promise<Estado & { qr_imagem?: string; qr_texto?: string }> {
  const { data, error } = await supabase.functions.invoke("openwa-sessao", { body: { acao } });
  if (error) {
    let msg = error.message;
    try {
      const corpo = await (error as { context?: Response }).context?.json();
      if (corpo?.error) msg = corpo.error as string;
    } catch {
      /* sem corpo */
    }
    return { error: msg };
  }
  return data ?? {};
}

/**
 * Conecta o WhatsApp pelo OpenWA sem sair do CRM: informa URL e chave do servidor,
 * gera o QR code aqui mesmo e acompanha o status até conectar.
 */
export function ConexaoOpenWA() {
  const [url, setUrl] = useState("");
  const [chave, setChave] = useState("");
  const [temChave, setTemChave] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<number>();

  // URL salva e se já existe chave (a chave em si não volta para a tela)
  useEffect(() => {
    supabase
      .from("integracoes_segredos")
      .select("chave, valor")
      .in("chave", ["openwa_url", "openwa_key"])
      .then(({ data }) => {
        for (const r of data ?? []) {
          if (r.chave === "openwa_url") setUrl(r.valor);
          if (r.chave === "openwa_key") setTemChave(!!r.valor);
        }
      });
  }, []);

  const atualizar = useCallback(async () => {
    const r = await chamar("status");
    setEstado(r);
    return r;
  }, []);

  useEffect(() => {
    atualizar();
    return () => window.clearInterval(timer.current);
  }, [atualizar]);

  // enquanto espera o QR ser escaneado, renova o QR e o status a cada 4s
  const acompanhar = useCallback(() => {
    window.clearInterval(timer.current);
    const passo = async () => {
      const st = await atualizar();
      if (st.status === "conectado") {
        setQr(null);
        window.clearInterval(timer.current);
        return;
      }
      const q = await chamar("qr");
      if (q.qr_imagem) setQr(q.qr_imagem);
      else if (q.qr_texto) setQr(await QRCode.toDataURL(q.qr_texto, { width: 264, margin: 1 }));
    };
    passo();
    timer.current = window.setInterval(passo, 4000);
  }, [atualizar]);

  async function salvarServidor() {
    setErro(null);
    const u = url.trim().replace(/\/+$/, "");
    if (!/^https?:\/\//.test(u)) return setErro("Informe a URL completa, começando com http:// ou https://");
    if (!chave.trim() && !temChave) return setErro("Informe a API key do OpenWA.");
    setSalvando(true);
    const linhas = [{ chave: "openwa_url", valor: u, atualizado_em: new Date().toISOString() }];
    if (chave.trim()) linhas.push({ chave: "openwa_key", valor: chave.trim(), atualizado_em: new Date().toISOString() });
    const { error } = await supabase.from("integracoes_segredos").upsert(linhas);
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar.");
    if (chave.trim()) setTemChave(true);
    setChave("");
    setUrl(u);
    await atualizar();
  }

  async function conectar() {
    setErro(null);
    setOcupado(true);
    const r = await chamar("conectar");
    setOcupado(false);
    if (r.error) return setErro(r.error);
    setEstado(r);
    if (r.status !== "conectado") acompanhar();
  }

  const st = estado?.status;
  const conectado = st === "conectado";

  return (
    <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Link2 size={18} className="text-aco-500" />
        <p className="font-semibold text-marinho-800">Conexão do OpenWA</p>
        <span
          className={cx(
            "ml-auto rounded-full px-2 py-0.5 text-xs font-semibold",
            conectado ? "bg-green-50 text-green-700" : st === "qr" || st === "iniciando" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"
          )}
        >
          {estado === null
            ? "Verificando..."
            : conectado
              ? "Conectado"
              : st === "qr"
                ? "Aguardando QR"
                : st === "iniciando"
                  ? "Iniciando"
                  : st === "sem_config"
                    ? "Servidor não informado"
                    : st === "chave_invalida"
                      ? "Chave recusada"
                      : st === "erro"
                        ? "Servidor fora do ar"
                        : "Desconectado"}
        </span>
      </div>

      {/* 1) Servidor */}
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="URL do servidor OpenWA">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seu-openwa.up.railway.app" />
        </Field>
        <Field label={temChave ? "API key (salva — preencha só para trocar)" : "API key do OpenWA"}>
          <Input type="password" value={chave} onChange={(e) => setChave(e.target.value)} placeholder={temChave ? "••••••••" : "chave do arquivo data/.api-key"} />
        </Field>
        <Button variant="secondary" onClick={salvarServidor} disabled={salvando}>
          <KeyRound size={15} /> {salvando ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* 2) Conectar o número */}
      {estado?.configurado && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          {conectado ? (
            <div className="flex items-start gap-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle2 size={20} className="mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">WhatsApp conectado{estado.telefone ? ` · +${estado.telefone}` : ""}</p>
                <p className="text-green-700">
                  O CRM já envia e recebe por este número.{" "}
                  {estado.webhook ? "Recebimento ativo." : "Recebimento ainda não confirmado — clique em Reconectar para cadastrar o webhook."}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={conectar} disabled={ocupado}>
                <RefreshCw size={14} /> Reconectar
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
              <div className="grid h-[17rem] w-[17rem] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
                {qr ? (
                  <img src={qr} alt="QR code para conectar o WhatsApp" className="h-64 w-64 rounded-lg" />
                ) : ocupado || st === "iniciando" ? (
                  <Loader2 size={30} className="animate-spin text-slate-400" />
                ) : (
                  <QrCode size={44} className="text-slate-300" />
                )}
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                <p className="font-medium text-marinho-800">Conecte o número da empresa</p>
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Clique em <b>Gerar QR code</b>.</li>
                  <li>No celular, abra o WhatsApp → <b>Aparelhos conectados</b> → <b>Conectar um aparelho</b>.</li>
                  <li>Aponte a câmera para o QR. A tela muda para “Conectado” sozinha.</li>
                </ol>
                <p className="flex items-start gap-1.5 text-xs text-slate-500">
                  <Smartphone size={13} className="mt-0.5 flex-shrink-0" /> O número continua funcionando no celular (é como o WhatsApp Web).
                </p>
                <Button onClick={conectar} disabled={ocupado}>
                  <QrCode size={16} /> {ocupado ? "Preparando..." : qr ? "Gerar novo QR" : "Gerar QR code"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {estado?.error && !erro && <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600"><WifiOff size={14} /> {estado.error}</p>}
      {erro && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}
    </div>
  );
}
