import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserAvatar } from '@/components/UserAvatar';
import { 
  Calendar, 
  Calculator, 
  CheckCircle, 
  DollarSign, 
  Plus,
  Play,
  Loader2,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Campanha, Comissao } from '@/types/comissoes';
import { TIPO_COMISSAO_LABELS } from '@/types/comissoes';
import { PermissionGate } from '@/components/PermissionGate';

interface ComissoesFechamentoTabProps {
  mes: number;
  ano: number;
  campanha: Campanha | null;
  comissoesPendentes: Comissao[];
  comissoesAprovadas: Comissao[];
  onCriarCampanha: () => void;
  onExecutarFechamento: () => void;
  onAprovar: (id: string) => void;
  onAprovarLote: (ids: string[]) => void;
  onMarcarPaga: (id: string) => void;
  isExecutingFechamento: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const statusLabels: Record<string, { label: string; color: string }> = {
  aberta: { label: 'Aberta', color: 'bg-blue-100 text-blue-800' },
  em_apuracao: { label: 'Em Apuração', color: 'bg-yellow-100 text-yellow-800' },
  fechada: { label: 'Fechada', color: 'bg-green-100 text-green-800' },
  paga: { label: 'Paga', color: 'bg-emerald-100 text-emerald-800' },
};

interface StepProps {
  number: number;
  title: string;
  icon: React.ReactNode;
  isActive: boolean;
  isCompleted: boolean;
}

function Step({ number, title, icon, isActive, isCompleted }: StepProps) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border transition-colors ${
      isActive ? 'bg-primary/5 border-primary' : 
      isCompleted ? 'bg-green-50 border-green-200' : 'bg-muted/50'
    }`}>
      <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
        isCompleted ? 'bg-green-500 text-white' :
        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {isCompleted ? <Check className="h-5 w-5" /> : icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Etapa {number}</p>
        <p className="font-medium">{title}</p>
      </div>
    </div>
  );
}

export function ComissoesFechamentoTab({
  mes,
  ano,
  campanha,
  comissoesPendentes,
  comissoesAprovadas,
  onCriarCampanha,
  onExecutarFechamento,
  onAprovar,
  onAprovarLote,
  onMarcarPaga,
  isExecutingFechamento,
}: ComissoesFechamentoTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState(() => {
    if (!campanha) return 1;
    if (campanha.status === 'aberta') return 2;
    if (comissoesPendentes.length > 0) return 3;
    return 4;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(comissoesPendentes.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(i => i !== id));
    }
  };

  const handleAprovarSelecionados = () => {
    if (selectedIds.length > 0) {
      onAprovarLote(selectedIds);
      setSelectedIds([]);
    }
  };

  const steps = [
    { title: 'Campanha', icon: <Calendar className="h-5 w-5" /> },
    { title: 'Cálculo', icon: <Calculator className="h-5 w-5" /> },
    { title: 'Aprovação', icon: <CheckCircle className="h-5 w-5" /> },
    { title: 'Pagamento', icon: <DollarSign className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Stepper visual */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((step, index) => (
          <Step
            key={step.title}
            number={index + 1}
            title={step.title}
            icon={step.icon}
            isActive={currentStep === index + 1}
            isCompleted={currentStep > index + 1}
          />
        ))}
      </div>

      {/* Etapa 1: Campanha */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Campanha {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!campanha ? (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                Nenhuma campanha criada para este período
              </p>
              <PermissionGate permission={['isDiretor', 'isGerente']} mode="any">
                <Button onClick={onCriarCampanha}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Campanha
                </Button>
              </PermissionGate>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{campanha.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(campanha.data_inicio), 'dd/MM/yyyy', { locale: ptBR })} - {' '}
                    {format(new Date(campanha.data_fim), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                </div>
                <Badge className={statusLabels[campanha.status]?.color || ''}>
                  {statusLabels[campanha.status]?.label || campanha.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">1ª Fase Pagamento</p>
                  <p className="font-medium">
                    {campanha.data_pagamento_1a_fase 
                      ? format(new Date(campanha.data_pagamento_1a_fase), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Apuração Boletos</p>
                  <p className="font-medium">
                    {campanha.data_apuracao_boletos 
                      ? format(new Date(campanha.data_apuracao_boletos), 'dd/MM/yyyy', { locale: ptBR })
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vendas Confirmadas</p>
                  <p className="font-medium">{campanha.total_vendas_confirmadas || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total Comissões</p>
                  <p className="font-medium">{formatCurrency(campanha.total_comissoes_geradas || 0)}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Etapa 2: Cálculo */}
      {campanha && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              Executar Fechamento Mensal
            </CardTitle>
            <CardDescription>
              Calcula todas as comissões do mês: adesão, recorrente, produção, ranking e bônus
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isExecutingFechamento ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Processando vendedores...</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
            ) : (
              <PermissionGate permission={['isDiretor', 'isGerente']} mode="any">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button>
                      <Play className="h-4 w-4 mr-2" />
                      Executar Fechamento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar Fechamento Mensal</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá calcular todas as comissões do mês {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })}.
                        Isso inclui bonificação sobre adesões, recorrente, produção, classificação, crescimento e recorde.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={onExecutarFechamento}>
                        Executar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGate>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etapa 3: Aprovação */}
      {campanha && comissoesPendentes.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Comissões Pendentes de Aprovação ({comissoesPendentes.length})
              </CardTitle>
              <PermissionGate permission={['isDiretor', 'isGerente']} mode="any">
                <div className="flex gap-2">
                  {selectedIds.length > 0 && (
                    <Button size="sm" onClick={handleAprovarSelecionados}>
                      Aprovar {selectedIds.length} Selecionadas
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onAprovarLote(comissoesPendentes.map(c => c.id))}
                  >
                    Aprovar Todas
                  </Button>
                </div>
              </PermissionGate>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.length === comissoesPendentes.length && comissoesPendentes.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoesPendentes.slice(0, 10).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(c.id)}
                        onCheckedChange={(checked) => handleSelect(c.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={c.vendedor?.avatar_url}
                          name={c.vendedor?.nome || ''}
                          size="sm"
                        />
                        <span className="truncate max-w-[150px]">
                          {c.vendedor?.nome || 'Desconhecido'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPO_COMISSAO_LABELS[c.tipo_comissao as keyof typeof TIPO_COMISSAO_LABELS] || c.tipo_comissao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(c.valor_total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <PermissionGate permission={['isDiretor', 'isGerente']} mode="any">
                        <Button size="sm" variant="ghost" onClick={() => onAprovar(c.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {comissoesPendentes.length > 10 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Exibindo 10 de {comissoesPendentes.length} comissões pendentes
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Etapa 4: Pagamento */}
      {campanha && comissoesAprovadas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Comissões Aprovadas Aguardando Pagamento ({comissoesAprovadas.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Aprovado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comissoesAprovadas.slice(0, 10).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <UserAvatar
                          src={c.vendedor?.avatar_url}
                          name={c.vendedor?.nome || ''}
                          size="sm"
                        />
                        <span className="truncate max-w-[150px]">
                          {c.vendedor?.nome || 'Desconhecido'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TIPO_COMISSAO_LABELS[c.tipo_comissao as keyof typeof TIPO_COMISSAO_LABELS] || c.tipo_comissao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(c.valor_total)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.aprovado_em 
                        ? format(new Date(c.aprovado_em), 'dd/MM HH:mm', { locale: ptBR })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <PermissionGate permission={['isDiretor', 'isGerente']} mode="any">
                        <Button size="sm" variant="outline" onClick={() => onMarcarPaga(c.id)}>
                          <DollarSign className="h-4 w-4 mr-1" />
                          Marcar Paga
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
