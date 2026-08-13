/**
 * A caixa que paira sobre a mesa: resumo da mão, fim de partida, confirmação de
 * saída e perfil.
 *
 * O teto de altura com rolagem interna não é detalhe: a lista de fim de partida
 * de uma mesa de 8 e a tabela de cinco colunas do resumo não cabem na altura de
 * um celular, e sem ele o botão de continuar fica abaixo da dobra, inalcançável.
 */
export function Overlay({
  children,
  onFechar,
  label,
}: {
  children: React.ReactNode;
  /** Quando dado, clicar no fundo ou apertar Esc fecha. */
  onFechar?: () => void;
  label?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-3 sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-white/15 bg-felt-800 p-4 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** Botão dourado de ação principal, do tamanho mínimo de um alvo de toque. */
export function BotaoPrimario({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 cursor-pointer rounded-lg bg-amber-300 px-4 py-2.5 font-bold text-felt-900 transition-colors hover:bg-amber-200 ${className}`}
    >
      {children}
    </button>
  );
}

/** Botão neutro de contorno, mesmo alvo de toque. */
export function BotaoNeutro({
  children,
  onClick,
  className = '',
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`min-h-11 cursor-pointer rounded-lg border border-white/20 px-4 py-2 transition-colors hover:bg-white/10 ${className}`}
    >
      {children}
    </button>
  );
}
