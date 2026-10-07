import { useState } from "react";
import { Clock, LogOut, RefreshCw, ShieldX } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui";

/** Tela para quem se cadastrou e ainda não foi liberado (ou foi bloqueado) pelo administrador. */
export default function Aguardando() {
  const { profile, session, recarregarPerfil, sair } = useAuth();
  const [verificando, setVerificando] = useState(false);
  const bloqueado = profile?.status === "bloqueado";

  async function verificar() {
    setVerificando(true);
    await recarregarPerfil();
    setVerificando(false);
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-card">
        <div
          className={
            "mx-auto grid h-16 w-16 place-items-center rounded-2xl " +
            (bloqueado ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600")
          }
        >
          {bloqueado ? <ShieldX size={32} /> : <Clock size={32} />}
        </div>
        <h1 className="mt-5 text-xl font-black text-marinho-800">
          {bloqueado ? "Acesso bloqueado" : "Cadastro recebido!"}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {bloqueado
            ? "Seu acesso foi desativado pelo administrador. Se achar que é um engano, fale com ele."
            : "Agora é só aguardar: o administrador vai revisar seu cadastro e liberar o que você pode usar. Esta tela abre o sistema sozinha assim que for liberado."}
        </p>
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm">
          <p className="font-bold text-marinho-800">{profile?.nome ?? "—"}</p>
          <p className="text-slate-500">{profile?.email ?? session?.user.email}</p>
        </div>
        <div className="mt-6 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={sair}>
            <LogOut size={16} /> Sair
          </Button>
          {!bloqueado && (
            <Button className="flex-1" onClick={verificar} disabled={verificando}>
              <RefreshCw size={16} className={verificando ? "animate-spin" : ""} /> Verificar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
