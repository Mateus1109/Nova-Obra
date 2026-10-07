import type { ReactNode } from "react";
import {
  Check,
  Copy,
  LayoutGrid,
  List as ListIcon,
  MoveRight,
  RotateCcw,
  Settings2,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/utils";
import { Folha, TituloSecao } from "./pecas";

export type Vista = "quadro" | "lista";
export type AcaoMassa = "mover" | "ganhar" | "perder" | "restaurar" | "excluir";
export type ModalPipeline = "editar" | "permissoes" | "etapas" | "duplicar";

/**
 * Menu ⋮ do pipeline, no padrão do DataCrazy: "Principais ações" (com ícone e descrição)
 * à esquerda e "Outros" (ações em massa) à direita. Cada item respeita a permissão do usuário.
 */
export function MenuPipeline({
  vista,
  onVista,
  onModal,
  onMassa,
  onClose,
}: {
  vista: Vista;
  onVista: (v: Vista) => void;
  onModal: (m: ModalPipeline) => void;
  onMassa: (a: AcaoMassa) => void;
  onClose: () => void;
}) {
  const { isAdmin, pode } = useAuth();
  const podeMover = pode("mover_funil");
  const podeExcluir = pode("excluir_obras");
  const abrir = (m: ModalPipeline) => {
    onClose();
    onModal(m);
  };
  const massa = (a: AcaoMassa) => {
    onClose();
    onMassa(a);
  };

  const outros: { acao: AcaoMassa; rotulo: string; icone: ReactNode; ok: boolean; perigo?: boolean }[] = [
    { acao: "mover", rotulo: "Mover negócios", icone: <MoveRight size={15} />, ok: podeMover },
    { acao: "ganhar", rotulo: "Ganhar negócios", icone: <ThumbsUp size={15} />, ok: podeMover },
    { acao: "perder", rotulo: "Perder negócios", icone: <ThumbsDown size={15} />, ok: podeMover },
    { acao: "restaurar", rotulo: "Restaurar status", icone: <RotateCcw size={15} />, ok: podeMover },
    { acao: "excluir", rotulo: "Excluir negócios", icone: <Trash2 size={15} />, ok: podeExcluir, perigo: true },
  ];
  const visiveis = outros.filter((o) => o.ok);
  const duasColunas = isAdmin;

  return (
    <Folha onClose={onClose} titulo="Opções do pipeline" largura={duasColunas ? "sm:w-[min(46rem,calc(100vw-2rem))]" : "sm:w-64"}>
      <div className={cx("grid", duasColunas && "sm:grid-cols-[1.45fr_1fr] sm:divide-x sm:divide-slate-100")}>
        {isAdmin && (
          <div className="p-2">
            <TituloSecao>Principais ações</TituloSecao>
            <AcaoPrincipal
              icone={<SquarePen size={18} />}
              titulo="Editar pipeline"
              desc="Edite, configure ou exclua sua pipeline"
              onClick={() => abrir("editar")}
            />
            <AcaoPrincipal
              icone={<Users size={18} />}
              titulo="Permissões da pipeline"
              desc="Adicione acesso para os atendentes e configure permissões"
              onClick={() => abrir("permissoes")}
            />
            <AcaoPrincipal
              icone={<Settings2 size={18} />}
              titulo="Configurações de etapa"
              desc="Configure as condições para que um negócio possa sair da etapa"
              onClick={() => abrir("etapas")}
            />
          </div>
        )}

        <div className="p-2">
          {(isAdmin || visiveis.length > 0) && (
            <>
              <TituloSecao>Outros</TituloSecao>
              {isAdmin && <LinkOutro icone={<Copy size={15} />} rotulo="Duplicar pipeline" onClick={() => abrir("duplicar")} />}
              {visiveis.map((o) => (
                <LinkOutro key={o.acao} icone={o.icone} rotulo={o.rotulo} perigo={o.perigo} onClick={() => massa(o.acao)} />
              ))}
            </>
          )}

          <TituloSecao className={cx((isAdmin || visiveis.length > 0) && "mt-1 border-t border-slate-100 pt-3")}>Visualização</TituloSecao>
          <LinkOutro icone={<LayoutGrid size={15} />} rotulo="Ver em quadro" ativo={vista === "quadro"} onClick={() => { onVista("quadro"); onClose(); }} />
          <LinkOutro icone={<ListIcon size={15} />} rotulo="Ver em lista" ativo={vista === "lista"} onClick={() => { onVista("lista"); onClose(); }} />
        </div>
      </div>
    </Folha>
  );
}

function AcaoPrincipal({ icone, titulo, desc, onClick }: { icone: ReactNode; titulo: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition hover:bg-slate-50" role="menuitem">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-md border border-slate-200 bg-white text-marinho-800 shadow-card">
        {icone}
      </span>
      <span className="min-w-0 pt-0.5">
        <span className="block text-sm font-semibold text-marinho-800">{titulo}</span>
        <span className="block text-[0.8125rem] leading-snug text-slate-500">{desc}</span>
      </span>
    </button>
  );
}

function LinkOutro({
  icone,
  rotulo,
  onClick,
  perigo,
  ativo,
}: {
  icone: ReactNode;
  rotulo: string;
  onClick: () => void;
  perigo?: boolean;
  ativo?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={cx(
        "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition",
        perigo ? "text-red-600 hover:bg-red-50" : ativo ? "font-medium text-aco-700" : "text-marinho-800 hover:bg-slate-50 hover:text-aco-600"
      )}
    >
      <span className={cx("flex-shrink-0", perigo ? "text-red-500" : ativo ? "text-aco-600" : "text-slate-400")}>{icone}</span>
      <span className="flex-1">{rotulo}</span>
      {ativo && <Check size={15} className="text-aco-600" />}
    </button>
  );
}
