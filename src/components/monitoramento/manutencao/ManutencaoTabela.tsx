import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MoreHorizontal, 
  Calendar, 
  ClipboardCheck, 
  XCircle, 
  Eye,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MOTIVO_MANUTENCAO_LABELS,
  MOTIVO_MANUTENCAO_COLORS,
  LOCAL_TIPO_LABELS,
  LOCAL_TIPO_COLORS,
  podeMarcarNaoCompareceu,
  type VistoriaManutencao,
  type LocalTipoManutencao,
  type MotivoManutencao,
} from '@/types/vistoriaManutencao';
import { STATUS_SERVICO_LABELS, STATUS_SERVICO_COLORS, PERIODO_LABELS, type StatusServico } from '@/hooks/useServicos';
import { usePermissions } from '@/hooks/usePermissions';

interface ManutencaoTabelaProps {
  vistorias: VistoriaManutencao[] | undefined;
  isLoading: boolean;
  onAgendar?: (vistoria: VistoriaManutencao) => void;
  onRegistrarResultado?: (vistoria: VistoriaManutencao) => void;
  onMarcarNaoCompareceu?: (vistoria: VistoriaManutencao) => void;
  onCancelar?: (vistoria: VistoriaManutencao) => void;
  onVerDetalhes?: (vistoria: VistoriaManutencao) => void;
}

export function ManutencaoTabela({
  vistorias,
  isLoading,
  onAgendar,
  onRegistrarResultado,
  onMarcarNaoCompareceu,
  onCancelar,
  onVerDetalhes,
}: ManutencaoTabelaProps) {
  const { isDiretor, isCoordenadorMonitoramento, isInstaladorVistoriador } = usePermissions();
  const canManage = isDiretor || isCoordenadorMonitoramento;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!vistorias || vistorias.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Nenhuma vistoria de manutenção encontrada</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    const label = STATUS_SERVICO_LABELS[status as StatusServico] || status;
    const color = STATUS_SERVICO_COLORS[status as StatusServico] || 'bg-gray-100 text-gray-800';
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  const getMotivoBadge = (motivo: string | null) => {
    if (!motivo) return null;
    const label = MOTIVO_MANUTENCAO_LABELS[motivo as MotivoManutencao] || motivo;
    const color = MOTIVO_MANUTENCAO_COLORS[motivo as MotivoManutencao] || 'bg-gray-100 text-gray-800';
    return <Badge variant="outline" className={color}>{label}</Badge>;
  };

  const getLocalBadge = (localTipo: string | null) => {
    if (!localTipo) return null;
    const label = LOCAL_TIPO_LABELS[localTipo as LocalTipoManutencao] || localTipo;
    const color = LOCAL_TIPO_COLORS[localTipo as LocalTipoManutencao] || 'bg-gray-100 text-gray-800';
    return <Badge variant="outline" className={`text-xs ${color}`}>{label}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Protocolo</TableHead>
            <TableHead>Associado</TableHead>
            <TableHead>Veículo</TableHead>
            <TableHead>Rastreador</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Data/Período</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vistorias.map((vistoria) => (
            <TableRow 
              key={vistoria.id}
              className={vistoria.protecao_suspensa ? 'bg-red-50/50' : ''}
            >
              <TableCell className="font-mono text-xs">
                {vistoria.protocolo || '-'}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{vistoria.associado?.nome || '-'}</span>
                  <span className="text-xs text-muted-foreground">
                    {vistoria.associado?.telefone}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{vistoria.veiculo?.placa || '-'}</span>
                  <span className="text-xs text-muted-foreground">
                    {vistoria.veiculo?.marca} {vistoria.veiculo?.modelo}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-sm">{vistoria.rastreador?.codigo || '-'}</span>
              </TableCell>
              <TableCell>
                {getMotivoBadge(vistoria.motivo_manutencao)}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm">
                    {format(new Date(vistoria.data_agendada), 'dd/MM/yyyy', { locale: ptBR })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {PERIODO_LABELS[vistoria.periodo as keyof typeof PERIODO_LABELS] || vistoria.periodo}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {getLocalBadge(vistoria.local_tipo_manutencao)}
                  {vistoria.protecao_suspensa && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Suspensa
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {getStatusBadge(vistoria.status)}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onVerDetalhes?.(vistoria)}>
                      <Eye className="h-4 w-4 mr-2" />
                      Ver detalhes
                    </DropdownMenuItem>

                    {vistoria.status === 'pendente' && canManage && (
                      <DropdownMenuItem onClick={() => onAgendar?.(vistoria)}>
                        <Calendar className="h-4 w-4 mr-2" />
                        Agendar
                      </DropdownMenuItem>
                    )}

                    {['agendada', 'em_rota', 'em_andamento'].includes(vistoria.status) && (
                      <DropdownMenuItem onClick={() => onRegistrarResultado?.(vistoria)}>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        Registrar resultado
                      </DropdownMenuItem>
                    )}

                    {vistoria.status === 'agendada' && 
                     podeMarcarNaoCompareceu(vistoria.local_tipo_manutencao as LocalTipoManutencao) && 
                     canManage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onMarcarNaoCompareceu?.(vistoria)}
                          className="text-destructive"
                        >
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Não compareceu
                        </DropdownMenuItem>
                      </>
                    )}

                    {/* Status nao_compareceu - Permitir reagendar ou cancelar definitivamente */}
                    {vistoria.status === 'nao_compareceu' && canManage && (
                      <>
                        <DropdownMenuItem onClick={() => onAgendar?.(vistoria)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Reagendar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onCancelar?.(vistoria)}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar e Suspender Proteção
                        </DropdownMenuItem>
                      </>
                    )}

                    {!['concluida', 'aprovada', 'cancelada', 'nao_compareceu'].includes(vistoria.status) && canManage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => onCancelar?.(vistoria)}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancelar
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
