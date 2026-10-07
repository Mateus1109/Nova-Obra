import { useCallback, useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Users,
  Phone,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ShieldX,
  UserCheck,
  Crown,
  Mail,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Badge, Button, Card, Field, Input, Modal, Spinner } from "@/components/ui";
import {
  PERMISSOES,
  PERMISSOES_PADRAO,
  type Permissao,
  type Role,
  type StatusUsuario,
  type Vendedor,
} from "@/lib/types";
import { cx, dataBR } from "@/lib/utils";

type Aba = StatusUsuario;

const ABAS: { key: Aba; label: string; icon: typeof Clock }[] = [
  { key: "pendente", label: "Aguardando", icon: Clock },
  { key: "ativo", label: "Liberados", icon: UserCheck },
  { key: "bloqueado", label: "Bloqueados", icon: ShieldX },
];

export default function Vendedores() {
  const { recarregar } = useData();
  const [usuarios, setUsuarios] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<Aba>("ativo");
  const [abaEscolhida, setAbaEscolhida] = useState(false);
  const [editando, setEditando] = useState<Vendedor | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const carregar = useCallback(async () => {
    const { data } = await supabase.from("profiles").select("*").order("criado_em", { ascending: false });
    setUsuarios((data as Vendedor[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("equipe-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => carregar())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  const porStatus = useMemo(() => {
    const m: Record<Aba, Vendedor[]> = { pendente: [], ativo: [], bloqueado: [] };
    usuarios.forEach((u) => m[u.status]?.push(u));
    m.ativo.sort((a, b) => (a.role === b.role ? a.nome.localeCompare(b.nome) : a.role === "admin" ? -1 : 1));
    return m;
  }, [usuarios]);

  // Abre direto em "Aguardando" quando houver gente esperando
  useEffect(() => {
    if (!loading && !abaEscolhida && porStatus.pendente.length) setAba("pendente");
  }, [loading, abaEscolhida, porStatus.pendente.length]);

  async function aposSalvar() {
    setEditando(null);
    await Promise.all([carregar(), recarregar()]);
  }

  if (loading) return <Spinner />;
  const lista = porStatus[aba];

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-marinho-800">Equipe e acessos</h1>
          <p className="text-sm text-slate-500">
            Quem se cadastra fica aguardando. Você libera e escolhe o que cada pessoa pode fazer.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setNovoAberto(true)}>
          <UserPlus size={16} /> Cadastrar manualmente
        </Button>
      </header>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-slate-200/70 p-1">
        {ABAS.map((a) => {
          const n = porStatus[a.key].length;
          return (
            <button
              key={a.key}
              onClick={() => {
                setAba(a.key);
                setAbaEscolhida(true);
              }}
              className={cx(
                "flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-bold transition",
                aba === a.key ? "bg-white text-marinho-800 shadow-sm" : "text-slate-500"
              )}
            >
              <a.icon size={15} />
              <span className="hidden sm:inline">{a.label}</span>
              <span
                className={cx(
                  "rounded-full px-1.5 text-[0.6875rem]",
                  a.key === "pendente" && n ? "bg-amber-400 text-marinho-900" : "bg-slate-200 text-slate-600"
                )}
              >
                {n}
              </span>
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white/50 p-10 text-center">
          <Users className="mx-auto mb-3 text-aco-500" size={40} />
          <p className="font-bold text-marinho-800">
            {aba === "pendente" ? "Ninguém aguardando liberação" : aba === "ativo" ? "Ninguém liberado ainda" : "Ninguém bloqueado"}
          </p>
          {aba === "pendente" && (
            <p className="mt-1 text-sm text-slate-500">
              Peça para o vendedor abrir o sistema e tocar em <b>Criar conta</b>. O cadastro aparece aqui.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((u) => (
            <UsuarioCard key={u.id} u={u} onAbrir={() => setEditando(u)} onAlterado={aposSalvar} />
          ))}
        </div>
      )}

      {editando && <UsuarioModal u={editando} onClose={() => setEditando(null)} onSalvo={aposSalvar} />}

      {novoAberto && (
        <NovoVendedorModal
          onClose={() => setNovoAberto(false)}
          onCriado={async () => {
            setNovoAberto(false);
            await Promise.all([carregar(), recarregar()]);
          }}
        />
      )}
    </div>
  );
}

function Avatar({ u }: { u: Vendedor }) {
  return (
    <div
      className={cx(
        "grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl font-black text-white",
        u.role === "admin" ? "bg-marinho-700" : u.status === "pendente" ? "bg-amber-500" : "bg-aco-500"
      )}
    >
      {u.nome?.charAt(0)?.toUpperCase() ?? "?"}
    </div>
  );
}

function UsuarioCard({ u, onAbrir, onAlterado }: { u: Vendedor; onAbrir: () => void; onAlterado: () => void }) {
  const [ocupado, setOcupado] = useState(false);
  const liberadas = PERMISSOES.filter((p) => u.permissoes?.[p.key]);

  async function recusar() {
    if (!window.confirm(`Recusar o cadastro de ${u.nome}? A pessoa não vai conseguir usar o sistema.`)) return;
    setOcupado(true);
    await supabase.from("profiles").update({ status: "bloqueado" }).eq("id", u.id);
    setOcupado(false);
    onAlterado();
  }

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <Avatar u={u} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold text-marinho-800">{u.nome}</p>
            {u.role === "admin" && <Crown size={14} className="flex-shrink-0 text-amber-500" />}
          </div>
          <p className="flex items-center gap-1 truncate text-xs text-slate-500">
            <Mail size={12} /> {u.email}
          </p>
          {u.telefone && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <Phone size={12} /> {u.telefone}
            </p>
          )}
          {u.zona_atuacao && (
            <p className="flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} /> {u.zona_atuacao}
            </p>
          )}
          {u.status === "pendente" && u.criado_em && (
            <p className="mt-1 text-[0.6875rem] font-semibold text-amber-700">Cadastrou-se em {dataBR(u.criado_em)}</p>
          )}
        </div>
      </div>

      {u.status === "ativo" && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {u.role === "admin" ? (
            <Badge bg="#173A5E" fg="#fff">Administrador · acesso total</Badge>
          ) : liberadas.length ? (
            liberadas.map((p) => (
              <Badge key={p.key} bg="#eef6fb" fg="#1d4a76">{p.label}</Badge>
            ))
          ) : (
            <Badge>Só registra visitas</Badge>
          )}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        {u.status === "pendente" ? (
          <>
            <Button variant="ghost" className="flex-1 text-red-600 hover:bg-red-50" onClick={recusar} disabled={ocupado}>
              Recusar
            </Button>
            <Button variant="success" className="flex-[2]" onClick={onAbrir} disabled={ocupado}>
              <ShieldCheck size={16} /> Liberar acesso
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="w-full" onClick={onAbrir}>
            {u.status === "bloqueado" ? "Ver / reativar" : "Editar acesso"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function UsuarioModal({ u, onClose, onSalvo }: { u: Vendedor; onClose: () => void; onSalvo: () => void }) {
  const { profile } = useAuth();
  const souEu = profile?.id === u.id;
  const [nome, setNome] = useState(u.nome);
  const [telefone, setTelefone] = useState(u.telefone ?? "");
  const [zona, setZona] = useState(u.zona_atuacao ?? "");
  const [role, setRole] = useState<Role>(u.role);
  const [perms, setPerms] = useState<Partial<Record<Permissao, boolean>>>(
    u.status === "pendente" && !Object.keys(u.permissoes ?? {}).length ? PERMISSOES_PADRAO : u.permissoes ?? {}
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function gravar(status: StatusUsuario) {
    setErro(null);
    if (!nome.trim()) return setErro("Informe o nome.");
    setSalvando(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        nome: nome.trim(),
        telefone: telefone.trim(),
        zona_atuacao: zona.trim(),
        role,
        permissoes: perms,
        status,
      })
      .eq("id", u.id);
    if (error) {
      setSalvando(false);
      return setErro(
        /pelo menos um administrador/i.test(error.message)
          ? "É preciso manter pelo menos um administrador ativo."
          : "Não foi possível salvar. Tente novamente."
      );
    }
    // Quem se cadastrou sozinho pode ainda não ter confirmado o e-mail: ao liberar, confirmamos por ele
    if (status === "ativo" && u.status !== "ativo") {
      await supabase.functions.invoke("criar-vendedor", { body: { acao: "confirmar_email", id: u.id } }).catch(() => null);
    }
    setSalvando(false);
    onSalvo();
  }

  const titulo = u.status === "pendente" ? "Liberar acesso" : u.status === "bloqueado" ? "Acesso bloqueado" : "Editar acesso";

  return (
    <Modal open onClose={salvando ? () => {} : onClose} title={titulo}>
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
          <Avatar u={u} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-marinho-800">{u.email}</p>
            {u.criado_em && <p className="text-xs text-slate-500">Cadastrado em {dataBR(u.criado_em)}</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </Field>
          <Field label="Telefone">
            <Input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Zona de atuação">
              <Input value={zona} onChange={(e) => setZona(e.target.value)} placeholder="Ex.: Turu / Calhau" />
            </Field>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold text-marinho-800">Função</p>
          <div className="grid grid-cols-2 gap-2">
            {(["vendedor", "admin"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                disabled={souEu}
                onClick={() => setRole(r)}
                className={cx(
                  "rounded-2xl border-2 px-3 py-3 text-left transition disabled:opacity-60",
                  role === r ? "border-marinho-700 bg-marinho-50" : "border-slate-200"
                )}
              >
                <p className="flex items-center gap-1.5 text-sm font-bold text-marinho-800">
                  {r === "admin" ? <Crown size={15} className="text-amber-500" /> : <Users size={15} />}
                  {r === "admin" ? "Administrador" : "Vendedor"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {r === "admin" ? "Acesso total, libera pessoas e edita o funil" : "Só o que você liberar abaixo"}
                </p>
              </button>
            ))}
          </div>
          {souEu && <p className="mt-1.5 text-xs text-slate-400">Você não pode mudar a sua própria função.</p>}
        </div>

        {role === "vendedor" && (
          <div>
            <p className="mb-2 text-sm font-bold text-marinho-800">O que pode fazer</p>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-3 px-4 py-3 opacity-70">
                <CheckCircle2 size={20} className="flex-shrink-0 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-marinho-800">Registrar visitas e ver as próprias obras</p>
                  <p className="text-xs text-slate-500">Sempre liberado para quem tem acesso</p>
                </div>
              </div>
              {PERMISSOES.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-center gap-3 px-4 py-3">
                  <Toggle ligado={!!perms[p.key]} onChange={(v) => setPerms((x) => ({ ...x, [p.key]: v }))} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-marinho-800">{p.label}</p>
                    <p className="text-xs text-slate-500">{p.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {erro && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{erro}</p>}

        <div className="flex flex-wrap gap-2 pt-1">
          {u.status === "ativo" && !souEu && (
            <Button
              variant="ghost"
              className="text-red-600 hover:bg-red-50"
              disabled={salvando}
              onClick={() => window.confirm(`Bloquear o acesso de ${u.nome}?`) && gravar("bloqueado")}
            >
              <ShieldX size={16} /> Bloquear
            </Button>
          )}
          <Button variant="ghost" className="flex-1" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          {u.status === "ativo" ? (
            <Button className="flex-1" onClick={() => gravar("ativo")} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          ) : (
            <Button variant="success" className="flex-[2]" onClick={() => gravar("ativo")} disabled={salvando}>
              <ShieldCheck size={16} /> {salvando ? "Liberando..." : u.status === "bloqueado" ? "Reativar acesso" : "Liberar acesso"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Toggle({ ligado, onChange }: { ligado: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={(e) => {
        e.preventDefault();
        onChange(!ligado);
      }}
      className={cx(
        "relative h-6 w-11 flex-shrink-0 rounded-full transition",
        ligado ? "bg-green-500" : "bg-slate-300"
      )}
    >
      <span
        className={cx(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
          ligado ? "left-[22px]" : "left-0.5"
        )}
      />
    </button>
  );
}

function NovoVendedorModal({ onClose, onCriado }: { onClose: () => void; onCriado: () => void }) {
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
    if (!nome || !email || senha.length < 8) {
      setErro("Preencha nome, e-mail e senha (mínimo 8 caracteres).");
      return;
    }
    setSalvando(true);
    const { data, error } = await supabase.functions.invoke("criar-vendedor", {
      body: { nome, email, senha, telefone, zona_atuacao: zona },
    });
    setSalvando(false);
    if (error || (data && (data as { error?: string }).error)) {
      setErro((data as { error?: string })?.error ?? "Não foi possível cadastrar. Tente novamente.");
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
            Acesso liberado para cadastrar obras e mover cards. Ajuste as permissões em “Editar acesso”.
          </p>
        </div>
      </Modal>
    );

  return (
    <Modal open onClose={onClose} title="Cadastrar vendedor manualmente">
      <div className="space-y-4">
        <p className="rounded-xl bg-aco-50 px-3 py-2 text-xs text-marinho-800">
          Dica: o mais simples é o vendedor tocar em <b>Criar conta</b> na tela de entrada. Use esta opção só se
          quiser definir a senha por ele.
        </p>
        <Field label="Nome completo *">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: João da Silva" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail (login) *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="joao@megamix.com" />
          </Field>
          <Field label="Senha * (mín. 8)">
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
