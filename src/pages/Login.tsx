import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { Building2, CheckCircle2 } from "lucide-react";
import { cx } from "@/lib/utils";

type Aba = "entrar" | "cadastrar";

export default function Login() {
  const { entrar, cadastrar } = useAuth();
  const [aba, setAba] = useState<Aba>("entrar");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function trocar(a: Aba) {
    setAba(a);
    setErro(null);
    setAviso(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (aba === "cadastrar") {
      if (nome.trim().length < 3) return setErro("Informe seu nome completo.");
      if (senha.length < 8) return setErro("A senha precisa ter pelo menos 8 caracteres.");
      if (senha !== confirma) return setErro("As senhas não conferem.");
    }
    setCarregando(true);
    if (aba === "entrar") {
      const { error } = await entrar(email.trim(), senha);
      if (error) setErro(error);
    } else {
      const r = await cadastrar({ nome: nome.trim(), telefone: telefone.trim(), email: email.trim(), senha });
      if (r.error) setErro(r.error);
      else if (r.precisaConfirmar) {
        setAviso(
          "Conta criada! Enviamos um link para o seu e-mail. Confirme e depois entre aqui — o administrador vai liberar seu acesso."
        );
        setAba("entrar");
        setSenha("");
        setConfirma("");
      }
      // com sessão, o app já abre a tela de "aguardando liberação"
    }
    setCarregando(false);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Painel de marca */}
      <div className="relative flex flex-1 flex-col justify-between overflow-hidden bg-marinho-700 p-8 text-white lg:p-12">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-aco-500 font-black text-xl">M</div>
          <div>
            <p className="text-lg font-black">Megamix</p>
            <p className="text-sm text-aco-100">Concreto usinado e bombeado · São Luís-MA</p>
          </div>
        </div>
        <div className="relative z-10 my-10">
          <h1 className="max-w-md text-3xl font-black leading-tight lg:text-4xl">
            Aquisição de obras e gestão de visitas de vendedores
          </h1>
          <p className="mt-4 max-w-md text-aco-100">
            Prospecte obras, registre cada visita com foto e localização, acompanhe o funil no kanban e meça a
            produtividade da equipe — tudo em um só lugar.
          </p>
        </div>
        <Building2 className="pointer-events-none absolute -right-10 -bottom-10 text-white/5" size={320} />
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-6 grid grid-cols-2 rounded-2xl bg-slate-200/70 p-1">
            {(["entrar", "cadastrar"] as Aba[]).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => trocar(a)}
                className={cx(
                  "rounded-xl py-2 text-sm font-bold transition",
                  aba === a ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500"
                )}
              >
                {a === "entrar" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <h2 className="text-2xl font-black text-marinho-800">
            {aba === "entrar" ? "Entrar" : "Criar minha conta"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {aba === "entrar"
              ? "Acesse sua conta para continuar."
              : "Depois do cadastro, o administrador libera o seu acesso."}
          </p>

          {aviso && (
            <p className="mt-4 flex gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm font-medium text-green-800">
              <CheckCircle2 size={18} className="mt-0.5 flex-shrink-0" />
              {aviso}
            </p>
          )}

          <div className="mt-6 space-y-4">
            {aba === "cadastrar" && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-marinho-800">Nome completo</label>
                  <Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" required />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-marinho-800">Telefone / WhatsApp</label>
                  <Input
                    inputMode="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(98) 9...."
                    autoComplete="tel"
                  />
                </div>
              </>
            )}
            <div>
              <label className="mb-1 block text-sm font-semibold text-marinho-800">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-marinho-800">
                Senha{aba === "cadastrar" && <span className="font-medium text-slate-400"> (mín. 8 caracteres)</span>}
              </label>
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                autoComplete={aba === "entrar" ? "current-password" : "new-password"}
                required
              />
            </div>
            {aba === "cadastrar" && (
              <div>
                <label className="mb-1 block text-sm font-semibold text-marinho-800">Repita a senha</label>
                <Input
                  type="password"
                  value={confirma}
                  onChange={(e) => setConfirma(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            )}
          </div>

          {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={carregando}>
            {carregando
              ? aba === "entrar"
                ? "Entrando..."
                : "Criando conta..."
              : aba === "entrar"
                ? "Entrar"
                : "Criar conta"}
          </Button>
        </form>
      </div>
    </div>
  );
}
