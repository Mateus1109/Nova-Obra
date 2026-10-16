import { useEffect, useState } from "react";
import { Check, MessageCircle, ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/utils";
import { CabecalhoSecao } from "./comum";

type Provedor = "openwa" | "oficial";

const OPCOES: { valor: Provedor; titulo: string; tag: string; Icone: typeof ShieldAlert; desc: string; pros: string[]; segredos: string }[] = [
  {
    valor: "openwa",
    titulo: "API não oficial (OpenWA)",
    tag: "Self-hosted",
    Icone: ShieldAlert,
    desc: "Gateway OpenWA rodando num servidor seu, conectado por QR code. Grátis e sem regras de template, mas é não oficial — há risco de o número ser banido. Use um número dedicado.",
    pros: ["Envia para qualquer número, sem janela de 24h", "Grátis (você hospeda)", "Risco de ban (número não oficial)"],
    segredos: "OPENWA_URL, OPENWA_KEY, OPENWA_SESSION",
  },
  {
    valor: "oficial",
    titulo: "WhatsApp Oficial (Meta)",
    tag: "Cloud API",
    Icone: ShieldCheck,
    desc: "WhatsApp Business Cloud API da Meta. Estável e sem risco de ban, porém mensagens fora da janela de 24h só saem por templates aprovados, e há verificação da empresa.",
    pros: ["Oficial, sem risco de ban", "Precisa de template fora da janela de 24h", "Requer conta Business verificada na Meta"],
    segredos: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID",
  },
];

export default function WhatsAppConfig() {
  const { isAdmin } = useAuth();
  const [provedor, setProvedor] = useState<Provedor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("config").select("valor").eq("chave", "whatsapp_provedor").single().then(({ data }) => {
      setProvedor(((data?.valor as Provedor) ?? "openwa") || "openwa");
    });
  }, []);

  async function escolher(p: Provedor) {
    if (!isAdmin || p === provedor) return;
    setProvedor(p);
    setSalvando(true);
    setMsg(null);
    const { error } = await supabase.from("config").upsert({ chave: "whatsapp_provedor", valor: p, atualizado_em: new Date().toISOString() });
    setSalvando(false);
    setMsg(error ? "Não foi possível salvar." : "Provedor atualizado.");
    if (!error) setTimeout(() => setMsg(null), 2500);
  }

  return (
    <div>
      <CabecalhoSecao titulo="WhatsApp" subtitulo="Escolha por qual provedor o CRM envia e recebe mensagens" />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {OPCOES.map((o) => {
          const ativo = provedor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => escolher(o.valor)}
              disabled={!isAdmin}
              className={cx(
                "flex flex-col gap-2 rounded-xl border-2 p-4 text-left transition",
                ativo ? "border-aco-500 bg-aco-50/40" : "border-slate-200 hover:border-slate-300",
                !isAdmin && "cursor-not-allowed opacity-80"
              )}
            >
              <div className="flex items-center gap-2">
                <span className={cx("grid h-9 w-9 place-items-center rounded-lg", o.valor === "oficial" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600")}>
                  <o.Icone size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-marinho-800">{o.titulo}</p>
                  <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-slate-400">{o.tag}</p>
                </div>
                <span className={cx("grid h-5 w-5 place-items-center rounded-full border-2", ativo ? "border-aco-500 bg-aco-500 text-white" : "border-slate-300")}>
                  {ativo && <Check size={13} strokeWidth={3} />}
                </span>
              </div>
              <p className="text-sm text-slate-600">{o.desc}</p>
              <ul className="mt-1 space-y-1 text-xs text-slate-500">
                {o.pros.map((p) => (
                  <li key={p} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" /> {p}
                  </li>
                ))}
              </ul>
              <p className="mt-1 rounded-md bg-slate-50 px-2 py-1 text-[0.6875rem] text-slate-500">
                Segredos no Supabase: <span className="font-mono">{o.segredos}</span>
              </p>
            </button>
          );
        })}
      </div>

      {msg && <p className="mt-3 text-sm font-medium text-aco-600">{salvando ? "Salvando..." : msg}</p>}

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
        <MessageCircle size={18} className="mt-0.5 flex-shrink-0 text-aco-500" />
        <div>
          <p className="font-medium text-marinho-800">Como o envio decide o provedor</p>
          <p className="mt-0.5">
            O botão de WhatsApp e o chat chamam sempre a mesma função; ela lê a opção escolhida aqui e envia pelo provedor correspondente.
            Trocar o provedor vale na hora, sem mexer no código. {isAdmin ? "" : "Só o administrador pode trocar."}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Para recebimento, cadastre o webhook do provedor apontando para a função <span className="font-mono">receber-whatsapp</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
