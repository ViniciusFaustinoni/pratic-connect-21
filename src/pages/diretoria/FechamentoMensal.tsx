import { useState } from 'react';
import { 
  Calendar, 
  Calculator, 
  FileCheck, 
  Send, 
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock,
  RefreshCw,
  Eye,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import {
  useFechamentosMensais,
  useExecutarFechamento,
  useCalcularRateio,
  useGerarFaturas,
  useCobrancasFechamento,
  useEnviarCobrancaWhatsApp,
  getNomeMes,
  getStatusLabel,
  getStatusColor,
  formatCurrency,
  type FechamentoMensal as FechamentoType,
} from '@/hooks/useFechamentoMensal';

// Componente para card de despesa por benefício
function DespesaBeneficioCard({ despesa }: { despesa: any }) {
  const beneficioLabels: Record<string, string> = {
    colisao: '🚗 Colisão',
    roubo_furto: '🔒 Roubo/Furto',
    incendio: '🔥 Incêndio',
    vidros: '🪟 Vidros',
    terceiros: '👥 Terceiros',
    assistencia: '🆘 Assistência',
    outros: '📦 Outros',
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/30">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{beneficioLabels[despesa.tipo_beneficio] || despesa.tipo_beneficio}</p>
          <p className="text-sm text-muted-foreground">{despesa.quantidade_eventos} eventos</p>
        </div>
        <div className="text-right">
          <p className="font-bold">{formatCurrency(despesa.valor_total)}</p>
          <p className="text-xs text-muted-foreground">
            {formatCurrency(despesa.valor_por_cota || 0)}/cota
          </p>
        </div>
      </div>
    </div>
  );
}

// Componente para card de fechamento
function FechamentoCard({ 
  fechamento, 
  isExpanded, 
  onToggle,
  onCalcularRateio,
  onAprovar,
  onGerarFaturas,
  onPreview,
  isCalculando,
  isGerando,
}: { 
  fechamento: FechamentoType;
  isExpanded: boolean;
  onToggle: () => void;
  onCalcularRateio: () => void;
  onAprovar: () => void;
  onGerarFaturas: () => void;
  onPreview: () => void;
  isCalculando: boolean;
  isGerando: boolean;
}) {
  const statusIcon = {
    aberto: <Clock className="w-4 h-4" />,
    fechado: <Calculator className="w-4 h-4" />,
    aprovado: <CheckCircle2 className="w-4 h-4" />,
    processado: <FileCheck className="w-4 h-4" />,
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="p-0 h-auto">
                  <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <div>
                <CardTitle className="text-lg">
                  {getNomeMes(fechamento.mes)} / {fechamento.ano}
                </CardTitle>
                <CardDescription>
                  {fechamento.total_associados_ativos} associados • {fechamento.total_cotas_ativas?.toFixed(0)} cotas
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getStatusColor(fechamento.status)}>
                {statusIcon[fechamento.status as keyof typeof statusIcon]}
                <span className="ml-1">{getStatusLabel(fechamento.status)}</span>
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent>
            <Separator className="mb-4" />
            
            {/* Resumo de valores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Despesas</p>
                <p className="text-lg font-bold">{formatCurrency(fechamento.total_despesas_rateio)}</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Tx. Admin</p>
                <p className="text-lg font-bold">{formatCurrency(fechamento.total_taxa_administrativa)}</p>
              </div>
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <p className="text-sm text-muted-foreground">Adicionais</p>
                <p className="text-lg font-bold">{formatCurrency(fechamento.total_adicionais)}</p>
              </div>
              <div className="text-center p-3 bg-primary/10 rounded-lg">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(fechamento.total_geral)}</p>
              </div>
            </div>

            {/* Despesas por benefício */}
            {fechamento.despesas_rateio && fechamento.despesas_rateio.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Despesas por Benefício</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {fechamento.despesas_rateio.map((despesa) => (
                    <DespesaBeneficioCard key={despesa.id} despesa={despesa} />
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="flex flex-wrap gap-2">
              {fechamento.status === 'fechado' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onCalcularRateio}
                    disabled={isCalculando}
                  >
                    {isCalculando ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Calculator className="w-4 h-4 mr-1" />}
                    Calcular Rateio
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={isCalculando}>
                        <CheckCircle2 className="w-4 h-4 mr-1" />
                        Aprovar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Aprovar Fechamento?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Ao aprovar, o rateio será calculado e bloqueado para edições.
                          Depois, você poderá gerar os boletos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onAprovar}>Aprovar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              
              {fechamento.status === 'aprovado' && (
                <>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={onPreview}
                    disabled={isGerando}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Preview Faturas
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" disabled={isGerando}>
                        {isGerando ? <RefreshCw className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
                        Gerar Boletos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Gerar Boletos?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Serão gerados boletos no ASAAS para todos os associados ativos.
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={onGerarFaturas}>Gerar Boletos</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              
              {fechamento.status === 'processado' && (
                <Button variant="outline" size="sm" onClick={onToggle}>
                  <FileCheck className="w-4 h-4 mr-1" />
                  Ver Cobranças
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// Componente para lista de cobranças geradas
function CobrancasGeradas({ fechamentoId }: { fechamentoId: string }) {
  const { data: cobrancas, isLoading } = useCobrancasFechamento(fechamentoId);
  const enviarWhatsApp = useEnviarCobrancaWhatsApp();

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!cobrancas || cobrancas.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma cobrança gerada</p>;
  }

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Associado</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Enviado</TableHead>
            <TableHead className="w-24">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cobrancas.slice(0, 10).map((cobranca: any) => (
            <TableRow key={cobranca.id}>
              <TableCell className="font-medium">{cobranca.associado?.nome}</TableCell>
              <TableCell>{formatCurrency(cobranca.valor)}</TableCell>
              <TableCell>
                <Badge variant={cobranca.status === 'PAID' ? 'default' : 'outline'}>
                  {cobranca.status}
                </Badge>
              </TableCell>
              <TableCell>
                {cobranca.enviada_whatsapp ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => enviarWhatsApp.mutate({ cobranca_id: cobranca.id })}
                  disabled={enviarWhatsApp.isPending || cobranca.enviada_whatsapp}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {cobrancas.length > 10 && (
        <p className="p-2 text-center text-sm text-muted-foreground">
          +{cobrancas.length - 10} cobranças
        </p>
      )}
    </div>
  );
}

// Página principal
export default function FechamentoMensal() {
  const { profile } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [anoFiltro] = useState(new Date().getFullYear());

  const { data: fechamentos, isLoading, refetch } = useFechamentosMensais(anoFiltro);
  const executarFechamento = useExecutarFechamento();
  const calcularRateio = useCalcularRateio();
  const gerarFaturas = useGerarFaturas();

  // Mês atual para novo fechamento
  const mesAtual = new Date().getMonth(); // 0-indexed, mês anterior
  const anoAtual = new Date().getFullYear();
  const mesReferencia = mesAtual === 0 ? 12 : mesAtual;
  const anoReferencia = mesAtual === 0 ? anoAtual - 1 : anoAtual;

  // Verificar se já existe fechamento do mês anterior
  const fechamentoAtual = fechamentos?.find(
    f => f.mes === mesReferencia && f.ano === anoReferencia
  );

  const handleNovoFechamento = () => {
    executarFechamento.mutate({ mes: mesReferencia, ano: anoReferencia });
  };

  const handleCalcularRateio = (fechamentoId: string) => {
    calcularRateio.mutate({ fechamento_id: fechamentoId });
  };

  const handleAprovar = (fechamentoId: string) => {
    calcularRateio.mutate({ 
      fechamento_id: fechamentoId, 
      aprovar: true,
      profile_id: profile?.id,
    });
  };

  const handleGerarFaturas = (fechamentoId: string) => {
    gerarFaturas.mutate({ fechamento_id: fechamentoId, enviar_whatsapp: false });
  };

  const handlePreview = (fechamentoId: string) => {
    gerarFaturas.mutate({ fechamento_id: fechamentoId, preview: true });
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6" />
            Fechamento Mensal
          </h1>
          <p className="text-muted-foreground">
            Sistema de cobrança pós-pago com rateio por cotas
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          {!fechamentoAtual || fechamentoAtual.status === 'aberto' ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={executarFechamento.isPending}>
                  <Calculator className="w-4 h-4 mr-1" />
                  Fechar {getNomeMes(mesReferencia)}/{anoReferencia}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Executar Fechamento?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso irá apurar todas as despesas de sinistros do mês de {getNomeMes(mesReferencia)}/{anoReferencia} 
                    e calcular o rateio por benefício.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleNovoFechamento}>
                    Executar Fechamento
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Badge variant="outline" className="py-2 px-3">
              {getNomeMes(mesReferencia)} já fechado
            </Badge>
          )}
        </div>
      </div>

      {/* Alerta informativo */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 py-4">
          <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800">Sistema Pós-Pago</p>
            <p className="text-blue-600">
              O fechamento apura despesas do mês anterior (dia 1 a 25). 
              Os boletos são gerados com vencimento no mês atual, cobrando pelo mês que o associado já usufruiu.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lista de fechamentos */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : fechamentos && fechamentos.length > 0 ? (
        <div className="space-y-4">
          {fechamentos.map((fechamento) => (
            <div key={fechamento.id}>
              <FechamentoCard
                fechamento={fechamento}
                isExpanded={expandedId === fechamento.id}
                onToggle={() => setExpandedId(expandedId === fechamento.id ? null : fechamento.id)}
                onCalcularRateio={() => handleCalcularRateio(fechamento.id)}
                onAprovar={() => handleAprovar(fechamento.id)}
                onGerarFaturas={() => handleGerarFaturas(fechamento.id)}
                onPreview={() => handlePreview(fechamento.id)}
                isCalculando={calcularRateio.isPending}
                isGerando={gerarFaturas.isPending}
              />
              
              {/* Mostrar cobranças se processado e expandido */}
              {fechamento.status === 'processado' && expandedId === fechamento.id && (
                <CobrancasGeradas fechamentoId={fechamento.id} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">Nenhum fechamento encontrado</p>
            <p className="text-muted-foreground mb-4">
              Clique no botão acima para iniciar o fechamento do mês
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
