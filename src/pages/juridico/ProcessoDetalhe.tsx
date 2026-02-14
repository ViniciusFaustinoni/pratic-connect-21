import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, Scale, FileText, Clock, Calendar, DollarSign, 
  User, MoreVertical, Plus, Download, ExternalLink,
  AlertTriangle, CheckCircle, Gavel, MapPin, Phone, Mail
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuSeparator, DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { useProcesso } from '@/hooks/useProcessos';
import { useProcessosPrazos } from '@/hooks/useProcessosPrazos';
import { useAuth } from '@/contexts/AuthContext';
import { 
  TIPO_PROCESSO_LABELS, NATUREZA_PROCESSO_LABELS, STATUS_PROCESSO_LABELS,
  STATUS_PROCESSO_COLORS, FASE_PROCESSO_LABELS, RITO_PROCESSO_LABELS,
  TIPO_ANDAMENTO_LABELS, PRIORIDADE_LABELS, PRIORIDADE_COLORS,
  STATUS_PRAZO_LABELS, STATUS_PRAZO_COLORS, TIPO_AUDIENCIA_LABELS,
  STATUS_AUDIENCIA_LABELS, STATUS_AUDIENCIA_COLORS, TIPO_CUSTA_LABELS,
  STATUS_CUSTA_LABELS, STATUS_CUSTA_COLORS, TIPO_DOCUMENTO_PROCESSO_LABELS,
  PARTE_CONTRARIA_TIPO_LABELS, INSTANCIA_LABELS,
  DECISAO_PROCESSO_EXTERNO_LABELS, TIPOS_EVENTO,
  type DecisaoProcessoExterno,
} from '@/types/juridico';

import { NovoAndamentoModal } from '@/components/juridico/NovoAndamentoModal';
import { NovaAudienciaModal } from '@/components/juridico/NovaAudienciaModal';
import { UploadDocumentoModal } from '@/components/juridico/UploadDocumentoModal';
import { NovoPrazoModal } from '@/components/juridico/NovoPrazoModal';
import { NovaCustaModal } from '@/components/juridico/NovaCustaModal';

const naturezaConfig: Record<string, string> = {
  autor: 'bg-green-100 text-green-800',
  reu: 'bg-red-100 text-red-800',
  terceiro_interessado: 'bg-blue-100 text-blue-800',
  assistente: 'bg-purple-100 text-purple-800',
};

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (date: string | null | undefined) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTime = (date: string | null | undefined) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const getDiasRestantes = (dataFim: string) => {
  const dias = differenceInDays(new Date(dataFim), new Date());
  if (dias < 0) return { label: `${Math.abs(dias)} atrasado(s)`, class: 'bg-destructive text-destructive-foreground' };
  if (dias === 0) return { label: 'Hoje', class: 'bg-destructive text-destructive-foreground' };
  if (dias === 1) return { label: 'Amanhã', class: 'bg-orange-500 text-white' };
  if (dias <= 3) return { label: `${dias} dias`, class: 'bg-yellow-500 text-white' };
  return { label: `${dias} dias`, class: 'bg-muted text-muted-foreground' };
};

// Map decisão to processo status
const DECISAO_STATUS_MAP: Record<DecisaoProcessoExterno, string> = {
  procedente: 'encerrado_procedente',
  improcedente: 'encerrado_improcedente',
  acordo_judicial: 'acordo',
  acordo_extrajudicial: 'acordo',
  sentenca_favoravel: 'encerrado_improcedente',
  sentenca_desfavoravel: 'encerrado_procedente',
  recurso_interposto: 'ativo',
  arquivado: 'arquivado',
};

export default function ProcessoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('resumo');
  
  // Modal states
  const [novoAndamentoOpen, setNovoAndamentoOpen] = useState(false);
  const [novaAudienciaOpen, setNovaAudienciaOpen] = useState(false);
  const [uploadDocumentoOpen, setUploadDocumentoOpen] = useState(false);
  const [novoPrazoOpen, setNovoPrazoOpen] = useState(false);
  const [novaCustaOpen, setNovaCustaOpen] = useState(false);

  // Decisão states
  const [decisaoSelecionada, setDecisaoSelecionada] = useState<string>('');
  const [decisaoValor, setDecisaoValor] = useState('');
  const [decisaoParcelas, setDecisaoParcelas] = useState('');
  const [decisaoObs, setDecisaoObs] = useState('');
  const [decisaoPrazoRecurso, setDecisaoPrazoRecurso] = useState('');

  const { processo, andamentos, audiencias, documentos, custas, isLoading } = useProcesso(id);
  const { prazos, cumprirPrazo, cancelarPrazo, isCumprindo } = useProcessosPrazos({ processo_id: id });

  const prazosPendentes = useMemo(() => 
    (prazos || []).filter(p => p.status === 'pendente'),
    [prazos]
  );

  const prazosUrgentes = useMemo(() => 
    prazosPendentes.filter(p => {
      const dias = differenceInDays(new Date(p.data_fim), new Date());
      return dias <= 7;
    }),
    [prazosPendentes]
  );

  const totaisCustas = useMemo(() => {
    const pendente = (custas || [])
      .filter(c => c.status === 'pendente' || c.status === 'vencido')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    const pago = (custas || [])
      .filter(c => c.status === 'pago')
      .reduce((acc, c) => acc + (c.valor || 0), 0);
    return { pendente, pago };
  }, [custas]);

  const isProcessoExterno = useMemo(() => {
    if (!processo) return false;
    return !TIPOS_EVENTO.includes(processo.tipo as any) || !processo.sinistro_id;
  }, [processo]);

  // Mutation para alterar status do processo
  const alterarStatusMutation = useMutation({
    mutationFn: async (novoStatus: string) => {
      const { error } = await supabase
        .from('processos')
        .update({ status: novoStatus, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
      toast.success('Status do processo atualizado!');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  // Mutation para registrar decisão
  const registrarDecisaoMutation = useMutation({
    mutationFn: async () => {
      const decisao = decisaoSelecionada as DecisaoProcessoExterno;
      const novoStatus = DECISAO_STATUS_MAP[decisao] || 'ativo';
      const valor = decisaoValor ? parseFloat(decisaoValor.replace(/\./g, '').replace(',', '.')) : null;
      const parcelas = decisaoParcelas ? parseInt(decisaoParcelas) : null;

      const { error } = await supabase
        .from('processos')
        .update({
          decisao: decisaoSelecionada,
          decisao_observacoes: decisaoObs || null,
          decisao_valor: valor,
          decisao_parcelas: parcelas,
          decisao_prazo_recurso: decisaoPrazoRecurso || null,
          decisao_registrada_em: new Date().toISOString(),
          decisao_registrada_por: user?.id,
          status: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;

      // Registrar andamento
      await supabase.from('processos_andamentos').insert({
        processo_id: id,
        data: new Date().toISOString().split('T')[0],
        descricao: `Decisão registrada: ${DECISAO_PROCESSO_EXTERNO_LABELS[decisao]}${decisaoObs ? `. ${decisaoObs}` : ''}`,
        tipo: 'decisao',
        registrado_por: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processos'] });
      queryClient.invalidateQueries({ queryKey: ['juridico-stats'] });
      toast.success('Decisão registrada com sucesso!');
      setDecisaoSelecionada('');
      setDecisaoValor('');
      setDecisaoParcelas('');
      setDecisaoObs('');
      setDecisaoPrazoRecurso('');
    },
    onError: (e: Error) => toast.error('Erro: ' + e.message),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!processo) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Scale className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Processo não encontrado</h2>
        <Button variant="link" onClick={() => navigate('/juridico/processos')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/juridico/processos')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Processo {processo.numero}</h1>
              <Badge className={STATUS_PROCESSO_COLORS[processo.status as keyof typeof STATUS_PROCESSO_COLORS] || ''}>
                {STATUS_PROCESSO_LABELS[processo.status as keyof typeof STATUS_PROCESSO_LABELS] || processo.status}
              </Badge>
              {processo.prioridade && processo.prioridade !== 'normal' && (
                <Badge className={PRIORIDADE_COLORS[processo.prioridade as keyof typeof PRIORIDADE_COLORS] || ''}>
                  {PRIORIDADE_LABELS[processo.prioridade as keyof typeof PRIORIDADE_LABELS] || processo.prioridade}
                </Badge>
              )}
            </div>
            {processo.numero_processo && (
              <p className="text-muted-foreground mt-1">CNJ: {processo.numero_processo}</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                {TIPO_PROCESSO_LABELS[processo.tipo as keyof typeof TIPO_PROCESSO_LABELS] || processo.tipo}
              </Badge>
              <Badge className={naturezaConfig[processo.natureza] || 'bg-muted'}>
                {NATUREZA_PROCESSO_LABELS[processo.natureza as keyof typeof NATUREZA_PROCESSO_LABELS] || processo.natureza}
              </Badge>
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => navigate(`/juridico/processos/${id}/editar`)}>
              Editar Processo
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => alterarStatusMutation.mutate('suspenso')}>
              Suspender Processo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alterarStatusMutation.mutate('arquivado')}>
              Arquivar Processo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => alterarStatusMutation.mutate('encerrado')} className="text-destructive">
              Encerrar Processo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alerta de Prazos Urgentes */}
      {prazosUrgentes.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Este processo tem {prazosUrgentes.length} prazo(s) próximo(s) do vencimento!
            </span>
            <Button variant="link" className="text-destructive-foreground p-0 h-auto" onClick={() => setActiveTab('prazos')}>
              Ver prazos
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="andamentos">Andamentos</TabsTrigger>
          <TabsTrigger value="prazos">
            Prazos
            {prazosPendentes.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 justify-center">
                {prazosPendentes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audiencias">Audiências</TabsTrigger>
          <TabsTrigger value="decisao">Decisão</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="custas">Custas</TabsTrigger>
        </TabsList>

        {/* Tab Resumo */}
        <TabsContent value="resumo" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Dados do Processo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Dados do Processo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Número Interno</p>
                  <p className="font-medium">{processo.numero}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Número CNJ</p>
                  <p className="font-medium">{processo.numero_processo || '-'}</p>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">Rito</p>
                  <p className="font-medium">{RITO_PROCESSO_LABELS[processo.rito as keyof typeof RITO_PROCESSO_LABELS] || processo.rito || '-'}</p>
                </div>
                {processo.instancia && (
                  <div>
                    <p className="text-sm text-muted-foreground">Instância</p>
                    <p className="font-medium">{INSTANCIA_LABELS[processo.instancia as keyof typeof INSTANCIA_LABELS] || processo.instancia}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Tribunal / Comarca / Vara</p>
                  <p className="font-medium">
                    {[processo.tribunal, processo.comarca, processo.vara].filter(Boolean).join(' / ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data Distribuição</p>
                  <p className="font-medium">{formatDate(processo.data_distribuicao)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Fase Atual</p>
                  <Badge variant="outline">
                    {FASE_PROCESSO_LABELS[processo.fase as keyof typeof FASE_PROCESSO_LABELS] || processo.fase || '-'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Partes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Partes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {processo.parte_contraria_nome && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Parte Contrária</p>
                      <p className="font-medium">{processo.parte_contraria_nome}</p>
                      {processo.parte_contraria_tipo && (
                        <Badge variant="outline" className="mt-1">
                          {PARTE_CONTRARIA_TIPO_LABELS[processo.parte_contraria_tipo as keyof typeof PARTE_CONTRARIA_TIPO_LABELS] || processo.parte_contraria_tipo}
                        </Badge>
                      )}
                      {processo.parte_contraria_cpf_cnpj && (
                        <p className="text-sm text-muted-foreground mt-1">{processo.parte_contraria_cpf_cnpj}</p>
                      )}
                    </div>
                    {processo.parte_contraria_telefone && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={`tel:${processo.parte_contraria_telefone}`}>
                            <Phone className="h-3 w-3 mr-1" />
                            {processo.parte_contraria_telefone}
                          </a>
                        </Button>
                      </div>
                    )}
                    {(processo.parte_contraria_advogado || processo.parte_contraria_oab) && (
                      <div>
                        <p className="text-sm text-muted-foreground">Advogado da Parte</p>
                        <p className="font-medium">{processo.parte_contraria_advogado || '-'}</p>
                        {processo.parte_contraria_oab && (
                          <p className="text-sm text-muted-foreground">OAB: {processo.parte_contraria_oab}</p>
                        )}
                      </div>
                    )}
                    <Separator />
                  </>
                )}
                {processo.associado && (
                  <div>
                    <p className="text-sm text-muted-foreground">Associado Vinculado</p>
                    <Link 
                      to={`/cadastro/associados/${processo.associado.id}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {processo.associado.nome}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
                {processo.sinistro && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sinistro Vinculado</p>
                    <Link 
                      to={`/eventos/sinistros/${processo.sinistro.id}`}
                      className="font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {processo.sinistro.protocolo}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Valores */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Valor da Causa</p>
                  <p className="font-medium text-lg">{formatCurrency(processo.valor_causa)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Condenação</p>
                  <p className="font-medium text-lg">{formatCurrency(processo.valor_condenacao)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Acordo</p>
                  <p className="font-medium text-lg">{formatCurrency(processo.valor_acordo)}</p>
                </div>
              </CardContent>
            </Card>

            {/* Advogado Responsável */}
            {processo.advogado && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gavel className="h-4 w-4" />
                    Advogado Responsável
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="font-medium">{processo.advogado.nome}</p>
                    {processo.advogado.oab && (
                      <p className="text-sm text-muted-foreground">
                        OAB: {processo.advogado.oab}
                        {processo.advogado.oab_estado && `/${processo.advogado.oab_estado}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {processo.advogado.telefone && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`tel:${processo.advogado.telefone}`}>
                          <Phone className="h-3 w-3 mr-1" />
                          Ligar
                        </a>
                      </Button>
                    )}
                    {processo.advogado.email && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`mailto:${processo.advogado.email}`}>
                          <Mail className="h-3 w-3 mr-1" />
                          Email
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Objeto e Observações */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Objeto e Observações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Objeto</p>
                  <p className="whitespace-pre-wrap">{processo.objeto || '-'}</p>
                </div>
                {processo.observacoes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-wrap">{processo.observacoes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Andamentos */}
        <TabsContent value="andamentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Andamentos Processuais</h3>
            <Button onClick={() => setNovoAndamentoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Andamento
            </Button>
          </div>

          {andamentos && andamentos.length > 0 ? (
            <div className="relative pl-8">
              {andamentos.map((andamento, index) => (
                <div 
                  key={andamento.id} 
                  className={`relative pb-6 ${index !== andamentos.length - 1 ? 'border-l-2 border-muted' : ''}`}
                  style={{ marginLeft: '-1px' }}
                >
                  <div className="absolute left-[-8px] top-0 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                  <div className="pl-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(andamento.data)}
                        </p>
                        <Badge variant="outline" className="mt-1">
                          {TIPO_ANDAMENTO_LABELS[andamento.tipo as keyof typeof TIPO_ANDAMENTO_LABELS] || andamento.tipo}
                        </Badge>
                        <p className="mt-2">{andamento.descricao}</p>
                        {andamento.gera_prazo && andamento.prazo_data && (
                          <p className="text-sm text-yellow-600 mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Gerou prazo: {andamento.prazo_descricao} - {formatDate(andamento.prazo_data)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum andamento registrado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Prazos */}
        <TabsContent value="prazos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Prazos</h3>
            <Button onClick={() => setNovoPrazoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Prazo
            </Button>
          </div>

          {prazos && prazos.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Dias</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prazos.map((prazo) => {
                    const diasInfo = getDiasRestantes(prazo.data_fim);
                    return (
                      <TableRow key={prazo.id}>
                        <TableCell className="font-medium">{prazo.descricao}</TableCell>
                        <TableCell>{formatDate(prazo.data_inicio)}</TableCell>
                        <TableCell>{formatDate(prazo.data_fim)}</TableCell>
                        <TableCell>
                          <Badge className={diasInfo.class}>{diasInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={PRIORIDADE_COLORS[prazo.prioridade as keyof typeof PRIORIDADE_COLORS] || ''}>
                            {PRIORIDADE_LABELS[prazo.prioridade as keyof typeof PRIORIDADE_LABELS] || prazo.prioridade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_PRAZO_COLORS[prazo.status as keyof typeof STATUS_PRAZO_COLORS] || ''}>
                            {STATUS_PRAZO_LABELS[prazo.status as keyof typeof STATUS_PRAZO_LABELS] || prazo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {prazo.status === 'pendente' && (
                            <div className="flex gap-1">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => cumprirPrazo({ id: prazo.id })}
                                disabled={isCumprindo}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum prazo registrado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Audiências */}
        <TabsContent value="audiencias" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Audiências</h3>
            <Button onClick={() => setNovaAudienciaOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Audiência
            </Button>
          </div>

          {audiencias && audiencias.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {audiencias.map((audiencia) => (
                <Card key={audiencia.id}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex gap-2">
                        <Badge className={STATUS_AUDIENCIA_COLORS[audiencia.status as keyof typeof STATUS_AUDIENCIA_COLORS] || ''}>
                          {STATUS_AUDIENCIA_LABELS[audiencia.status as keyof typeof STATUS_AUDIENCIA_LABELS] || audiencia.status}
                        </Badge>
                        <Badge variant="outline">
                          {TIPO_AUDIENCIA_LABELS[audiencia.tipo as keyof typeof TIPO_AUDIENCIA_LABELS] || audiencia.tipo}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {formatDateTime(audiencia.data_hora)}
                    </p>
                    {audiencia.local && (
                      <p className="text-muted-foreground flex items-center gap-1 mt-1">
                        <MapPin className="h-4 w-4" />
                        {audiencia.local}
                      </p>
                    )}
                    {audiencia.link_videoconferencia && (
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2"
                        onClick={() => window.open(audiencia.link_videoconferencia, '_blank')}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Acessar Videoconferência
                      </Button>
                    )}
                    {audiencia.resultado && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-sm font-medium">Resultado:</p>
                        <p className="text-sm">{audiencia.resultado}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma audiência agendada
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Decisão */}
        <TabsContent value="decisao" className="space-y-4">
          <h3 className="text-lg font-semibold">Registrar Decisão</h3>

          {processo.decisao ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Decisão Registrada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Decisão</p>
                  <Badge className="bg-primary text-primary-foreground">
                    {DECISAO_PROCESSO_EXTERNO_LABELS[processo.decisao as keyof typeof DECISAO_PROCESSO_EXTERNO_LABELS] || processo.decisao}
                  </Badge>
                </div>
                {processo.decisao_valor && (
                  <div>
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="font-medium text-lg">{formatCurrency(processo.decisao_valor)}</p>
                  </div>
                )}
                {processo.decisao_parcelas && (
                  <div>
                    <p className="text-sm text-muted-foreground">Parcelas</p>
                    <p className="font-medium">{processo.decisao_parcelas}x</p>
                  </div>
                )}
                {processo.decisao_prazo_recurso && (
                  <div>
                    <p className="text-sm text-muted-foreground">Prazo para Recurso</p>
                    <p className="font-medium">{formatDate(processo.decisao_prazo_recurso)}</p>
                  </div>
                )}
                {processo.decisao_observacoes && (
                  <div>
                    <p className="text-sm text-muted-foreground">Observações</p>
                    <p className="whitespace-pre-wrap">{processo.decisao_observacoes}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Registrada em</p>
                  <p className="font-medium">{formatDateTime(processo.decisao_registrada_em)}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 space-y-6">
                <RadioGroup value={decisaoSelecionada} onValueChange={setDecisaoSelecionada}>
                  {Object.entries(DECISAO_PROCESSO_EXTERNO_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <RadioGroupItem value={key} id={`decisao-${key}`} />
                      <Label htmlFor={`decisao-${key}`} className="cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>

                {/* Campos condicionais */}
                {['procedente', 'acordo_judicial', 'acordo_extrajudicial', 'sentenca_desfavoravel'].includes(decisaoSelecionada) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Valor (R$)</Label>
                      <Input 
                        placeholder="0,00" 
                        value={decisaoValor} 
                        onChange={(e) => setDecisaoValor(e.target.value)} 
                      />
                    </div>
                    {['acordo_judicial', 'acordo_extrajudicial'].includes(decisaoSelecionada) && (
                      <div className="space-y-2">
                        <Label>Parcelas</Label>
                        <Input 
                          type="number" 
                          placeholder="1" 
                          value={decisaoParcelas} 
                          onChange={(e) => setDecisaoParcelas(e.target.value)} 
                        />
                      </div>
                    )}
                  </div>
                )}

                {decisaoSelecionada === 'sentenca_desfavoravel' && (
                  <div className="space-y-2">
                    <Label>Prazo para Recurso</Label>
                    <Input 
                      type="date" 
                      value={decisaoPrazoRecurso} 
                      onChange={(e) => setDecisaoPrazoRecurso(e.target.value)} 
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    placeholder="Detalhes da decisão..." 
                    value={decisaoObs} 
                    onChange={(e) => setDecisaoObs(e.target.value)} 
                  />
                </div>

                <Button 
                  onClick={() => registrarDecisaoMutation.mutate()}
                  disabled={!decisaoSelecionada || registrarDecisaoMutation.isPending}
                >
                  Registrar Decisão
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Documentos */}
        <TabsContent value="documentos" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Documentos</h3>
            <Button onClick={() => setUploadDocumentoOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Upload Documento
            </Button>
          </div>

          {documentos && documentos.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {documentos.map((doc) => (
                <Card key={doc.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.nome}</p>
                        <Badge variant="outline" className="mt-1">
                          {TIPO_DOCUMENTO_PROCESSO_LABELS[doc.tipo as keyof typeof TIPO_DOCUMENTO_PROCESSO_LABELS] || doc.tipo}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                      {doc.arquivo_url && (
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => window.open(doc.arquivo_url, '_blank')}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhum documento anexado
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Custas */}
        <TabsContent value="custas" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Custas e Honorários</h3>
            <Button onClick={() => setNovaCustaOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Custa
            </Button>
          </div>

          {/* Resumo de Custas */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-4">
                <p className="text-sm text-yellow-800">Total Pendente</p>
                <p className="text-2xl font-bold text-yellow-900">{formatCurrency(totaisCustas.pendente)}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-4">
                <p className="text-sm text-green-800">Total Pago</p>
                <p className="text-2xl font-bold text-green-900">{formatCurrency(totaisCustas.pago)}</p>
              </CardContent>
            </Card>
          </div>

          {custas && custas.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custas.map((custa) => (
                    <TableRow key={custa.id}>
                      <TableCell>
                        <Badge variant="outline">
                          {TIPO_CUSTA_LABELS[custa.tipo as keyof typeof TIPO_CUSTA_LABELS] || custa.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{custa.descricao || '-'}</TableCell>
                      <TableCell className="font-medium">{formatCurrency(custa.valor)}</TableCell>
                      <TableCell>{formatDate(custa.data_vencimento)}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_CUSTA_COLORS[custa.status as keyof typeof STATUS_CUSTA_COLORS] || ''}>
                          {STATUS_CUSTA_LABELS[custa.status as keyof typeof STATUS_CUSTA_LABELS] || custa.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {custa.comprovante_url ? (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => window.open(custa.comprovante_url, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nenhuma custa registrada
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <NovoAndamentoModal
        open={novoAndamentoOpen}
        onClose={() => setNovoAndamentoOpen(false)}
        processoId={id!}
      />
      <NovaAudienciaModal
        open={novaAudienciaOpen}
        onClose={() => setNovaAudienciaOpen(false)}
        processoId={id!}
      />
      <UploadDocumentoModal
        open={uploadDocumentoOpen}
        onClose={() => setUploadDocumentoOpen(false)}
        processoId={id!}
      />
      <NovoPrazoModal
        open={novoPrazoOpen}
        onClose={() => setNovoPrazoOpen(false)}
        processoId={id!}
      />
      <NovaCustaModal
        open={novaCustaOpen}
        onClose={() => setNovaCustaOpen(false)}
        processoId={id!}
      />
    </div>
  );
}
