import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, Circle, Crown, KeyRound, Mail } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Avatar, Badge, Button, Field, Input } from "@/components/ui";
import { CampoTelefone } from "@/components/NovoLead";
import { PERMISSOES } from "@/lib/types";
import { cx } from "@/lib/utils";
import { CabecalhoSecao, Erro } from "./comum";

function Bloco({ titulo, desc, children }: { titulo: string; desc?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-100 px-4 py-3 sm:px-5">
        <h3 className="font-semibold text-marinho-800">{titulo}</h3>
        {desc && <p className="text-xs text-slate-500">{desc}</p>}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export default function Perfil() {
  const { profile, isAdmin, pode, recarregarPerfil } = useAuth();
  const { avisar, recarregar } = useData();
  const [nome, setNome] = useState(profile?.nome ?? "");
  const [telefone, setTelefone] = useState(profile?.telefone ?? "");
  const [zona, setZona] = useState(profile?.zona_atuacao ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // perfil chegou/atualizou depois (realtime): mostra os dados novos
  useEffect(() => {
    setNome(profile?.nome ?? "");
    setTelefone(profile?.telefone ?? "");
    setZona(profile?.zona_atuacao ?? "");
  }, [profile?.nome, profile?.telefone, profile?.zona_atuacao]);

  if (!profile) return null;
  const mudou =
    nome.trim() !== (profile.nome ?? "") || telefone.trim() !== (profile.telefone ?? "") || zona.trim() !== (profile.zona_atuacao ?? "");

  async function salvar() {
    setErro(null);
    if (!nome.trim()) return setErro("Informe seu nome.");
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({ nome: nome.trim(), telefone: telefone.trim(), zona_atuacao: zona.trim() })
      .eq("id", profile!.id);
    setSalvando(false);
    if (error) return setErro("Não foi possível salvar. Tente novamente.");
    await Promise.all([recarregarPerfil(), recarregar()]);
    avisar("Perfil atualizado.", "ok");
  }

  return (
    <div className="max-w-3xl">
      <CabecalhoSecao titulo="Meu perfil" subtitulo="Seus dados de contato, senha e o que você pode fazer no sistema" />

      <div className="space-y-4">
        <Bloco titulo="Dados pessoais">
          <div className="mb-5 flex items-center gap-3">
            <Avatar nome={profile.nome} size={52} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-[1.0625rem] font-semibold text-marinho-800">
                {profile.nome}
                {isAdmin && <Crown size={15} className="flex-shrink-0 text-amber-500" />}
              </p>
              <p className="flex items-center gap-1 truncate text-sm text-slate-500">
                <Mail size={13} className="flex-shrink-0" /> {profile.email}
              </p>
              <div className="mt-1">
                {isAdmin ? <Badge bg="#eff6ff" fg="#1f6fe5">Administrador</Badge> : <Badge>Vendedor</Badge>}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome *">
                <Input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
              </Field>
            </div>
            <Field label="Telefone / WhatsApp">
              <CampoTelefone value={telefone} onChange={setTelefone} />
            </Field>
            <Field label="Zona de atuação">
              <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ex.: Turu / Calhau" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="E-mail (login)">
                <Input value={profile.email} disabled className="bg-slate-50 text-slate-500" />
              </Field>
              <p className="mt-1 text-xs text-slate-400">Para trocar o e-mail de acesso, fale com o administrador.</p>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            <Erro texto={erro} />
            <div className="flex justify-end">
              <Button onClick={salvar} disabled={salvando || !mudou} className="w-full sm:w-auto">
                {salvando ? "Salvando..." : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </Bloco>

        <TrocarSenha />

        <Bloco titulo="Seus acessos" desc={isAdmin ? "Administradores têm acesso total" : "Quem libera é o administrador, em Configurações → Membros"}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {PERMISSOES.map((p) => {
              const tem = pode(p.key);
              return (
                <li key={p.key} className="flex items-start gap-2">
                  {tem ? (
                    <CheckCircle2 size={17} className="mt-px flex-shrink-0 text-green-600" />
                  ) : (
                    <Circle size={17} className="mt-px flex-shrink-0 text-slate-300" />
                  )}
                  <div className="min-w-0">
                    <p className={cx("text-sm font-medium", tem ? "text-marinho-800" : "text-slate-400")}>{p.label}</p>
                    <p className="text-xs text-slate-400">{p.desc}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Bloco>
      </div>
    </div>
  );
}

function TrocarSenha() {
  const { avisar } = useData();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setErro(null);
    if (senha.length < 8) return setErro("A nova senha precisa ter pelo menos 8 caracteres.");
    if (senha !== confirma) return setErro("As senhas não conferem.");
    setSalvando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setSalvando(false);
    if (error)
      return setErro(
        /different from the old|same/i.test(error.message)
          ? "A nova senha precisa ser diferente da atual."
          : "Não foi possível alterar a senha. Tente uma senha diferente."
      );
    setSenha("");
    setConfirma("");
    avisar("Senha alterada! Use a nova senha no próximo acesso.", "ok");
  }

  return (
    <Bloco titulo="Alterar senha" desc="Mínimo de 8 caracteres">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <Field label="Nova senha">
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Repita a nova senha">
          <Input type="password" value={confirma} onChange={(e) => setConfirma(e.target.value)} autoComplete="new-password" />
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <Erro texto={erro} />
          <div className="flex justify-end">
            <Button type="submit" variant="secondary" disabled={salvando || !senha} className="w-full sm:w-auto">
              <KeyRound size={15} /> {salvando ? "Salvando..." : "Alterar senha"}
            </Button>
          </div>
        </div>
      </form>
    </Bloco>
  );
}
