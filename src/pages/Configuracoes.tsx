import { useEffect, useState, type ComponentType } from "react";
import { Link, Navigate, NavLink, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  CircleUserRound,
  Filter,
  ListChecks,
  Tags,
  TextCursorInput,
  ThumbsDown,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Spinner } from "@/components/ui";
import { cx } from "@/lib/utils";
import Vendedores from "./Vendedores";
import Perfil from "./config/Perfil";
import Pipelines from "./config/Pipelines";
import TagsConfig from "./config/Tags";
import MotivosPerda from "./config/MotivosPerda";
import Listas from "./config/Listas";
import CamposAdicionais from "./config/CamposAdicionais";
import Lixeira from "./config/Lixeira";

type Acesso = { isAdmin: boolean; pode: ReturnType<typeof useAuth>["pode"] };

interface Secao {
  key: string;
  label: string;
  /** linha de apoio na lista do celular */
  desc: string;
  icon: LucideIcon;
  Componente: ComponentType;
  /** sem `acesso` = todos os usuários */
  acesso?: (a: Acesso) => boolean;
}

const soAdmin = (a: Acesso) => a.isAdmin;

// Ordem e nomes no padrão do DataCrazy
const SECOES: Secao[] = [
  { key: "perfil", label: "Meu perfil", desc: "Seus dados, senha e acessos", icon: CircleUserRound, Componente: Perfil },
  { key: "membros", label: "Membros", desc: "Equipe, liberação de acesso e permissões", icon: Users, Componente: Vendedores, acesso: soAdmin },
  { key: "pipelines", label: "Pipelines", desc: "Funis de venda, grupos e quem vê cada um", icon: Filter, Componente: Pipelines, acesso: soAdmin },
  { key: "tags", label: "Tags", desc: "Tags coloridas de leads e negócios", icon: Tags, Componente: TagsConfig, acesso: soAdmin },
  { key: "motivos-perda", label: "Motivos de perda", desc: "Por que os negócios são perdidos", icon: ThumbsDown, Componente: MotivosPerda, acesso: soAdmin },
  { key: "listas", label: "Listas", desc: "Opções de origem e segmento", icon: ListChecks, Componente: Listas, acesso: soAdmin },
  { key: "campos-adicionais", label: "Campos adicionais", desc: "Campos extras de leads e negócios", icon: TextCursorInput, Componente: CamposAdicionais, acesso: soAdmin },
  { key: "lixeira", label: "Lixeira", desc: "Restaurar ou apagar negócios excluídos", icon: Trash2, Componente: Lixeira, acesso: (a) => a.isAdmin || (a.pode("excluir_obras") && a.pode("mover_funil")) },
];

/** Quantos cadastros aguardam liberação (só para o administrador) */
function usePendentes(ativo: boolean) {
  const [qtd, setQtd] = useState(0);
  useEffect(() => {
    if (!ativo) return;
    const contar = async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pendente");
      setQtd(count ?? 0);
    };
    contar();
    const ch = supabase
      .channel("pendentes-config-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, contar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ativo]);
  return qtd;
}

export default function Configuracoes() {
  const { secao } = useParams();
  const { isAdmin, pode } = useAuth();
  const { loading } = useData();
  const pendentes = usePendentes(isAdmin);
  const visiveis = SECOES.filter((s) => !s.acesso || s.acesso({ isAdmin, pode }));
  const atual = visiveis.find((s) => s.key === (secao ?? "perfil"));

  // ao trocar de seção, volta ao topo (no celular a lista pode estar rolada)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [secao]);

  // seção inexistente ou sem permissão
  if (!atual) return <Navigate to="/configuracoes/perfil" replace />;

  return (
    <div className="lg:flex lg:items-start lg:gap-8">
      {/* Lista de seções: coluna à esquerda no computador; tela cheia no celular quando nenhuma seção está aberta */}
      <aside className={cx("lg:sticky lg:top-7 lg:block lg:w-60 lg:flex-shrink-0", secao ? "hidden" : "block")}>
        <h1 className="text-[1.375rem] font-semibold leading-tight text-marinho-800 lg:text-[1.75rem]">Configurações</h1>
        <p className="mt-1 text-sm text-slate-500 lg:hidden">Ajuste seus dados e o funcionamento do CRM</p>
        <nav className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white lg:mt-5 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent">
          {visiveis.map((s) => {
            const marcada = s.key === atual.key;
            const badge = s.key === "membros" && pendentes > 0 ? pendentes : null;
            return (
              <NavLink
                key={s.key}
                to={`/configuracoes/${s.key}`}
                className={cx(
                  "flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 active:bg-slate-50",
                  "lg:mb-0.5 lg:rounded-md lg:border-0 lg:px-3 lg:py-2 lg:active:bg-transparent",
                  marcada ? "lg:bg-aco-50" : "lg:hover:bg-slate-100"
                )}
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 lg:h-auto lg:w-auto lg:bg-transparent">
                  <s.icon size={18} className={cx(marcada ? "lg:text-aco-600" : "lg:text-slate-500")} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block text-[0.9375rem] font-medium lg:text-base", marcada ? "lg:text-aco-700" : "text-marinho-800")}>
                    {s.label}
                  </span>
                  <span className="block truncate text-xs text-slate-500 lg:hidden">{s.desc}</span>
                </span>
                {badge && (
                  <span
                    title={`${badge} cadastro(s) aguardando liberação`}
                    className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[0.6875rem] font-bold text-marinho-900"
                  >
                    {badge}
                  </span>
                )}
                <ChevronRight size={18} className="flex-shrink-0 text-slate-300 lg:hidden" />
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Conteúdo da seção (no computador, sem seção na URL mostra "Meu perfil") */}
      <section className={cx("min-w-0 flex-1", !secao && "hidden lg:block")}>
        <Link
          to="/configuracoes"
          className="-ml-1 mb-3 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-aco-600 lg:hidden"
        >
          <ArrowLeft size={16} /> Configurações
        </Link>
        {loading && atual.key !== "perfil" ? <Spinner /> : <atual.Componente key={atual.key} />}
      </section>
    </div>
  );
}
