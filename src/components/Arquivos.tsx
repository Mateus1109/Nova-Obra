import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileImage, FileSpreadsheet, FileText, File as FileIcon, Paperclip, Trash2, UploadCloud } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Button } from "./ui";
import { cx, dataBR } from "@/lib/utils";

const BUCKET = "arquivos";
const LIMITE = 25 * 1024 * 1024;

interface Arquivo {
  id: string;
  lead_id: string | null;
  oportunidade_id: string | null;
  nome: string;
  caminho: string;
  tamanho: number;
  tipo: string;
  criado_por: string | null;
  criado_em: string;
}

const tamanhoBR = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1).replace(".", ",")} MB`;

function Icone({ tipo, nome }: { tipo: string; nome: string }) {
  if (tipo.startsWith("image/")) return <FileImage size={20} className="text-violet-500" />;
  if (tipo === "application/pdf" || /\.pdf$/i.test(nome)) return <FileText size={20} className="text-red-500" />;
  if (/sheet|excel|csv/.test(tipo) || /\.(xlsx?|csv)$/i.test(nome)) return <FileSpreadsheet size={20} className="text-green-600" />;
  if (/word|document/.test(tipo) || /\.docx?$/i.test(nome)) return <FileText size={20} className="text-aco-600" />;
  return <FileIcon size={20} className="text-slate-400" />;
}

/** Arquivos do lead e dos seus negócios: enviar (botão ou arrastar), baixar e excluir */
export function ListaArquivos({ leadId, oportunidadeId, oportunidadeIds }: { leadId: string | null; oportunidadeId: string | null; oportunidadeIds: string[] }) {
  const { avisar } = useData();
  const { profile, isAdmin } = useAuth();
  const [lista, setLista] = useState<Arquivo[] | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [sobre, setSobre] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chave = oportunidadeIds.join(",");

  const carregar = useCallback(async () => {
    const filtros = [
      leadId ? `lead_id.eq.${leadId}` : null,
      oportunidadeIds.length ? `oportunidade_id.in.(${oportunidadeIds.join(",")})` : null,
    ].filter(Boolean);
    if (!filtros.length) return setLista([]);
    const { data } = await supabase.from("arquivos").select("*").or(filtros.join(",")).order("criado_em", { ascending: false });
    setLista((data as Arquivo[]) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, leadId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviar(arquivos: FileList | File[]) {
    for (const f of Array.from(arquivos)) {
      if (f.size > LIMITE) {
        avisar(`"${f.name}" passa de 25 MB.`);
        continue;
      }
      setEnviando(f.name);
      const limpo = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_");
      const caminho = `${oportunidadeId ?? leadId}/${crypto.randomUUID()}-${limpo}`;
      const up = await supabase.storage.from(BUCKET).upload(caminho, f, { contentType: f.type || undefined });
      if (up.error) {
        avisar(`Não foi possível enviar "${f.name}".`);
        continue;
      }
      const { error } = await supabase.from("arquivos").insert({
        lead_id: leadId,
        oportunidade_id: oportunidadeId,
        nome: f.name,
        caminho,
        tamanho: f.size,
        tipo: f.type,
        criado_por: profile?.id,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([caminho]);
        avisar(`Não foi possível registrar "${f.name}".`);
      }
    }
    setEnviando(null);
    if (input.current) input.current.value = "";
    carregar();
  }

  async function baixar(a: Arquivo) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(a.caminho, 300, { download: a.nome });
    if (error || !data) return avisar("Não foi possível abrir o arquivo.");
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function excluir(a: Arquivo) {
    if (!window.confirm(`Excluir "${a.nome}"?`)) return;
    const { error } = await supabase.from("arquivos").delete().eq("id", a.id);
    if (error) return avisar("Não foi possível excluir o arquivo.");
    await supabase.storage.from(BUCKET).remove([a.caminho]);
    setLista((l) => l?.filter((x) => x.id !== a.id) ?? null);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSobre(false);
          if (e.dataTransfer.files.length) enviar(e.dataTransfer.files);
        }}
        onClick={() => !enviando && input.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-6 text-center transition",
          sobre ? "border-aco-500 bg-aco-50" : "border-slate-300 hover:border-aco-400 hover:bg-slate-50"
        )}
      >
        <UploadCloud size={26} className="text-aco-500" />
        <p className="text-sm font-medium text-marinho-800">
          {enviando ? `Enviando "${enviando}"...` : (
            <>
              <span className="hidden sm:inline">Arraste arquivos aqui ou </span>
              <span className="text-aco-600 underline underline-offset-2">escolha um arquivo</span>
            </>
          )}
        </p>
        <p className="text-xs text-slate-500">Propostas, plantas, contratos, fotos · até 25 MB cada</p>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files?.length && enviar(e.target.files)} />
      </div>

      <div className="mt-4 space-y-2">
        {lista === null && <p className="text-sm text-slate-500">Carregando...</p>}
        {lista?.length === 0 && (
          <p className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
            <Paperclip size={15} /> Nenhum arquivo anexado ainda.
          </p>
        )}
        {lista?.map((a) => (
          <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
            <Icone tipo={a.tipo} nome={a.nome} />
            <button onClick={() => baixar(a)} className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-medium text-marinho-800 hover:text-aco-600">{a.nome}</p>
              <p className="text-xs text-slate-500">
                {tamanhoBR(a.tamanho)} · {dataBR(a.criado_em)}
              </p>
            </button>
            <Button size="sm" variant="ghost" onClick={() => baixar(a)} aria-label="Baixar">
              <Download size={16} />
            </Button>
            {(isAdmin || a.criado_por === profile?.id) && (
              <button onClick={() => excluir(a)} className="p-1 text-slate-300 hover:text-red-500" aria-label="Excluir arquivo">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
