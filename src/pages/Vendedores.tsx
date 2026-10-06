import { useState } from "react";
import { UserPlus, Users, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useData } from "@/lib/data";
import { Button, Card, Field, Input, Modal } from "@/components/ui";

export default function Vendedores() {
  const { vendedores, recarregar } = useData();
  const [aberto, setAberto] = useState(false);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Equipe de vendas</h1>
          <p className="text-sm text-slate-500">
            {vendedores.length} vendedor(es) · cadastre quantos precisar
          </p>
        </div>
        <Button onClick={() => setAberto(true)}>
          <UserPlus size={16} /> Cadastrar vendedor
        </Button>
      </header>

      {vendedores.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center">
          <Users className="mx-auto mb-3 text-aco-500" size={40} />
          <p className="font-bold text-marinho-800">Nenhum vendedor cadastrado</p>
          <p className="mt-1 text-sm text-slate-500">Cadastre sua equipe para distribuir as obras.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vendedores.map((v) => (
            <Card key={v.id} className="flex items-start gap-3 p-4">
              <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-aco-500 font-black text-white">
                {v.nome?.charAt(0)?.toUpperCase() ?? "V"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-marinho-800">{v.nome}</p>
                <p className="truncate text-xs text-slate-500">{v.email}</p>
                {v.zona_atuacao && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} /> {v.zona_atuacao}
                  </p>
                )}
                {v.telefone && (
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <Phone size={12} /> {v.telefone}
                  </p>
                )}
              </div>
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                  (v.ativo ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500")
                }
              >
                {v.ativo ? "Ativo" : "Inativo"}
              </span>
            </Card>
          ))}
        </div>
      )}

      {aberto && (
        <NovoVendedorModal
          onClose={() => setAberto(false)}
          onCriado={async () => {
            await recarregar();
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}

function NovoVendedorModal({
  onClose,
  onCriado,
}: {
  onClose: () => void;
  onCriado: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [zona, setZona] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function salvar() {
    setErro(null);
    if (!nome || !email || senha.length < 6) {
      setErro("Preencha nome, e-mail e senha (mínimo 6 caracteres).");
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("criar-vendedor", {
      body: { nome, email, senha, telefone, zona_atuacao: zona },
    });
    setSalvando(false);
    if (error || (data && (data as { error?: string }).error)) {
      setErro(
        (data as { error?: string })?.error ??
          "Não foi possível cadastrar. Tente novamente."
      );
      return;
    }
    setOk(true);
    setTimeout(onCriado, 900);
  }

  if (ok)
    return (
      <Modal open onClose={onClose} title="Vendedor cadastrado">
        <div className="flex flex-col items-center py-4 text-center">
          <CheckCircle2 className="text-green-500" size={48} />
          <p className="mt-3 font-bold text-marinho-800">{nome} já pode entrar!</p>
          <p className="mt-1 text-sm text-slate-500">
            Ele acessa com o e-mail e a senha que você definiu e verá apenas as obras dele.
          </p>
        </div>
      </Modal>
    );

  return (
    <Modal open onClose={onClose} title="Cadastrar vendedor">
      <div className="space-y-4">
        <Field label="Nome completo *">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João da Silva" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail (login) *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@megamix.com" />
          </Field>
          <Field label="Senha * (mín. 6)">
            <Input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha inicial" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Telefone">
            <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(98) 9....." />
          </Field>
          <Field label="Zona de atuação">
            <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ex.: Turu / Calhau" />
          </Field>
        </div>

        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={salvar} disabled={salvando}>
            {salvando ? "Cadastrando..." : "Cadastrar vendedor"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
