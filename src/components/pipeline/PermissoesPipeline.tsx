import { useEffect, useMemo, useState } from "react";
import { Lock, Search, ShieldCheck } from "lucide-react";
import { useData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { Pipeline, Vendedor } from "@/lib/types";
import { Avatar, Button, Input, Modal } from "@/components/ui";
import { cx } from "@/lib/utils";
import { Caixa, Interruptor } from "./pecas";

/**
 * Quem acessa o pipeline. Administradores sempre veem tudo; com o pipeline
 * restrito, só os usuários marcados (pipeline_membros) enxergam ele e seus negócios.
 */
export function PermissoesPipeline({ pipeline, onClose }: { pipeline: Pipeline; onClose: () => void }) {
  const { vendedores, pipelineMembros, salvarPermissoesPipeline } = useData();
  const [admins, setAdmins] = useState<Vendedor[]>([]);
  const [restrito, setRestrito] = useState(!!pipeline.restrito);
  const [sel, setSel] = useState<Set<string>>(
    () => new Set(pipelineMembros.filter((m) => m.pipeline_id === pipeline.id).map((m) => m.usuario_id))
  );
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  // vendedores já vêm do contexto; os administradores ativos buscamos aqui
  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("role", "admin").eq("status", "ativo").order("nome");
      if (vivo) setAdmins((data as Vendedor[]) ?? []);
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const usuarios = useMemo(() => {
    const m = new Map<string, Vendedor>();
    for (const a of admins) m.set(a.id, a);
    for (const v of vendedores) if (!m.has(v.id)) m.set(v.id, v);
    return Array.from(m.values()).sort((a, b) =>
      a.role === b.role ? a.nome.localeCompare(b.nome) : a.role === "admin" ? -1 : 1
    );
  }, [admins, vendedores]);

  const q = busca.trim().toLowerCase();
  const visiveis = usuarios.filter((u) => !q || `${u.nome} ${u.email}`.toLowerCase().includes(q));
  const atendentes = usuarios.filter((u) => u.role !== "admin");
  const marcados = atendentes.filter((u) => sel.has(u.id)).length;
  const todos = atendentes.length > 0 && marcados === atendentes.length;

  const alternar = (id: string) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function salvar() {
    setSalvando(true);
    const ok = await salvarPermissoesPipeline(pipeline.id, restrito, Array.from(sel));
    setSalvando(false);
    if (ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Permissões da pipeline">
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
          <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-md bg-aco-50 text-aco-600">
            <Lock size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-marinho-800">Pipeline restrito</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Administradores sempre veem todos os pipelines. Com o pipeline restrito, só os usuários marcados abaixo acessam
              {` "${pipeline.nome}" `}e seus negócios.
            </p>
          </div>
          <Interruptor ligado={restrito} onChange={setRestrito} rotulo="Pipeline restrito" />
        </div>

        <div className={cx(!restrito && "opacity-60")}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-marinho-800">
              Usuários com acesso <span className="font-normal text-slate-500">({marcados} de {atendentes.length} atendentes)</span>
            </p>
            {atendentes.length > 0 && (
              <button
                onClick={() =>
                  setSel((s) => {
                    const n = new Set(s);
                    atendentes.forEach((u) => (todos ? n.delete(u.id) : n.add(u.id)));
                    return n;
                  })
                }
                className="text-sm font-medium text-aco-600 hover:underline"
              >
                {todos ? "Desmarcar todos" : "Marcar todos"}
              </button>
            )}
          </div>
          {usuarios.length > 6 && (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar usuário..." className="py-2 pl-9" />
            </div>
          )}
          <div className="max-h-[45vh] divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {visiveis.length === 0 && <p className="p-4 text-center text-sm text-slate-500">Nenhum usuário encontrado.</p>}
            {visiveis.map((u) => {
              const admin = u.role === "admin";
              return (
                <div
                  key={u.id}
                  onClick={() => !admin && alternar(u.id)}
                  className={cx("flex items-center gap-3 px-3 py-2.5", admin ? "bg-slate-50/60" : "cursor-pointer hover:bg-slate-50")}
                >
                  <Caixa
                    marcada={admin || sel.has(u.id)}
                    disabled={admin}
                    onChange={() => alternar(u.id)}
                    rotulo={`Acesso de ${u.nome}`}
                  />
                  <Avatar nome={u.nome} size={30} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-marinho-800">{u.nome}</p>
                    <p className="truncate text-xs text-slate-500">{u.email}</p>
                  </div>
                  {admin && (
                    <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-aco-50 px-2 py-0.5 text-[0.6875rem] font-medium text-aco-700">
                      <ShieldCheck size={12} /> <span className="hidden sm:inline">Administrador ·</span> sempre vê
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {!restrito && (
            <p className="mt-2 text-xs text-slate-500">
              Pipeline aberto: todos os atendentes veem. A lista acima passa a valer quando você ligar “Pipeline restrito”.
            </p>
          )}
          {restrito && marcados === 0 && (
            <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum atendente marcado: só administradores verão este pipeline.</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar permissões"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
