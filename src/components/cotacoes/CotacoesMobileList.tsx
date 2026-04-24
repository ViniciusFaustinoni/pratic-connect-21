import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  ClipboardCopy,
  Copy,
  Eye,
  ExternalLink,
  FileDown,
  FileText,
  Link2,
  MoreVertical,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { CotacaoWithRelations } from '@/hooks/useCotacoes';
import {
  getEtapaVenda,
  statusConfig,
  etapaVendaConfig,
  type CotacoesTablePermissions,
  type StatusCotacaoExtended,
} from './CotacoesTable';

interface CotacoesMobileListProps {
  cotacoes: CotacaoWithRelations[];
  onRowClick: (cotacao: CotacaoWithRelations) => void;
  onCopiarWhatsApp: (cotacao: CotacaoWithRelations) => void;
  onPdf: (cotacao: CotacaoWithRelations) => void;
  onDuplicar: (cotacao: CotacaoWithRelations) => void;
  onContinuar?: (cotacao: CotacaoWithRelations) => void;
  onExcluir: (id: string) => void;
  copiandoWhatsAppId: string | null;
  getPermissions: (cotacao: CotacaoWithRelations) => CotacoesTablePermissions;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  groupByDate?: boolean;
}

function formatPhone(phone?: string | null) {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11)
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
  if (cleaned.length === 10)
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  return phone;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatSmartDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Hoje';
  if (isYesterday(date)) return 'Ontem';
  return format(date, 'dd/MM');
}

export function CotacoesMobileList({
  cotacoes,
  onRowClick,
  onCopiarWhatsApp,
  onPdf,
  onDuplicar,
  onContinuar,
  onExcluir,
  copiandoWhatsAppId,
  getPermissions,
  selectable = false,
  selectedIds,
  onToggleSelect,
  groupByDate = false,
}: CotacoesMobileListProps) {
  if (cotacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-center">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-4">
          <FileText className="h-8 w-8 text-primary/60" />
        </div>
        <p className="text-foreground font-semibold">Nenhuma cotação encontrada</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Ajuste os filtros ou crie uma nova cotação.
        </p>
      </div>
    );
  }

  let lastDateKey = '';

  return (
    <div className="space-y-2">
      {cotacoes.map((cotacao) => {
        const dateKey = groupByDate
          ? format(new Date(cotacao.updated_at || cotacao.created_at), 'yyyy-MM-dd')
          : '';
        const showDateHeader = groupByDate && dateKey !== lastDateKey;
        if (showDateHeader) lastDateKey = dateKey;

        const status =
          statusConfig[cotacao.status as StatusCotacaoExtended] || statusConfig.rascunho;
        const etapaVenda = getEtapaVenda(cotacao);
        const etapaInfo = etapaVenda ? etapaVendaConfig[etapaVenda] : null;
        const permissions = getPermissions(cotacao);
        const isCopiando = copiandoWhatsAppId === cotacao.id;
        const clienteName =
          cotacao.leads?.nome || cotacao.nome_solicitante || 'Sem nome';
        const telefone = cotacao.leads?.telefone || cotacao.telefone1_solicitante;
        const isSelected = selectedIds?.has(cotacao.id) ?? false;

        return (
          <div key={cotacao.id}>
            {showDateHeader && (
              <div className="px-1 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                📅 {format(new Date(dateKey), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}
              </div>
            )}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onRowClick(cotacao)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onRowClick(cotacao);
                }
              }}
              className={cn(
                'rounded-xl border bg-card p-3 shadow-sm transition-all active:scale-[0.99]',
                'border-l-4',
                status.borderColor,
                isSelected && 'ring-2 ring-primary/40 bg-primary/[0.04]',
              )}
            >
              {/* Linha 1: status + etapa + ações */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col gap-1.5 min-w-0">
                  <Badge
                    className={cn(
                      status.bgColor,
                      status.color,
                      'font-semibold border-0 text-[10px] px-2 py-0.5 w-fit rounded-full',
                    )}
                  >
                    <status.icon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                  {etapaInfo && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-[10px] font-medium w-fit px-2 py-0.5 rounded-full',
                        etapaInfo.bgColor,
                        etapaInfo.color,
                      )}
                    >
                      <ArrowRight className="h-2.5 w-2.5" />
                      {etapaInfo.label}
                    </div>
                  )}
                </div>

                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {selectable && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect?.(cotacao.id)}
                      aria-label={`Selecionar cotação ${cotacao.numero}`}
                      className="mr-1"
                    />
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label="Ações"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => onRowClick(cotacao)}>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalhes
                      </DropdownMenuItem>
                      {cotacao.status === 'rascunho' && onContinuar && (
                        <DropdownMenuItem onClick={() => onContinuar(cotacao)}>
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Continuar cotação
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => onPdf(cotacao)}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Baixar PDF
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onCopiarWhatsApp(cotacao)}
                        disabled={isCopiando || permissions.canSend === false}
                      >
                        <ClipboardCopy className="h-4 w-4 mr-2" />
                        Copiar para WhatsApp
                      </DropdownMenuItem>
                      {cotacao.token_publico && (
                        <>
                          <DropdownMenuItem
                            onClick={() => {
                              const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                              window.open(link, '_blank');
                            }}
                          >
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Acessar link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
                              navigator.clipboard.writeText(link);
                              toast.success('Link copiado!');
                            }}
                          >
                            <Link2 className="h-4 w-4 mr-2" />
                            Copiar link
                          </DropdownMenuItem>
                        </>
                      )}
                      {permissions.canDuplicate && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDuplicar(cotacao)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={!permissions.canDelete}
                        onClick={
                          permissions.canDelete ? () => onExcluir(cotacao.id) : undefined
                        }
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Linha 2: cliente */}
              <div className="mt-2.5">
                <p className="font-semibold text-sm leading-tight truncate">
                  {clienteName}
                </p>
                {telefone && (
                  <a
                    href={`tel:${telefone}`}
                    className="text-[11px] text-muted-foreground hover:text-primary inline-flex items-center gap-1 mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Phone className="h-3 w-3" />
                    {formatPhone(telefone)}
                  </a>
                )}
              </div>

              {/* Linha 3: veículo */}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs truncate">
                    {cotacao.veiculo_marca} {cotacao.veiculo_modelo}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">
                      {cotacao.veiculo_ano}
                    </span>
                    {cotacao.veiculo_placa && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold tracking-wider">
                        {cotacao.veiculo_placa}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground leading-none">FIPE</p>
                  <p className="text-sm font-semibold text-primary leading-tight">
                    {formatCurrency(cotacao.valor_fipe)}
                  </p>
                </div>
              </div>

              {/* Linha 4: rodapé com data e consultor */}
              <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  {formatSmartDate(cotacao.created_at)} •{' '}
                  {format(new Date(cotacao.created_at), 'HH:mm')}
                </span>
                {cotacao.vendedor?.nome && (
                  <span className="truncate max-w-[55%] text-right">
                    {cotacao.vendedor.nome}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
