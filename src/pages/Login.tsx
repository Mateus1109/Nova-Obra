import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button, Input } from "@/components/ui";
import { Building2 } from "lucide-react";

export default function Login() {
  const { entrar } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro(null);
    const { error } = await entrar(email.trim(), senha);
    if (error) setErro(error);
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
            Prospecte obras, distribua visitas por dia, acompanhe o funil no kanban e meça a
            produtividade da equipe — tudo em um só lugar.
          </p>
        </div>
        <Building2 className="pointer-events-none absolute -right-10 -bottom-10 text-white/5" size={320} />
      </div>

      {/* Formulário */}
      <div className="flex flex-1 items-center justify-center bg-slate-50 p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h2 className="text-2xl font-black text-marinho-800">Entrar</h2>
          <p className="mt-1 text-sm text-slate-500">Acesse sua conta para continuar.</p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-marinho-800">E-mail</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-marinho-800">Senha</label>
              <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            </div>
          </div>

          {erro && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={carregando}>
            {carregando ? "Entrando..." : "Entrar"}
          </Button>

        </form>
      </div>
    </div>
  );
}
