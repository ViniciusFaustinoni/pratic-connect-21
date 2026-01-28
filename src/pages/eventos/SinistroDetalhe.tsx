import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ArrowLeft, Phone, Mail, MessageCircle, MapPin, Calendar, 
  Car, ShieldAlert, ShieldX, Flame, CloudRain, Square, 
  HelpCircle, FileText, Clock, MoreHorizontal, Loader2,
  ExternalLink, Download, CheckCircle, XCircle, AlertCircle,
  User, FileCheck, FilePlus, Scale, Plus, Link as LinkIcon, Trash2,
  Bot, Wrench
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useDeleteSinistro } from '@/hooks/useSinistros';
import { ConfirmacaoExclusaoDialog } from '@/components/sinistros/ConfirmacaoExclusaoDialog';
import { ModalVincularProcesso } from '@/components/sinistros/ModalVincularProcesso';
import { SolicitarDocumentosSinistroDialog } from '@/components/sinistros/SolicitarDocumentosSinistroDialog';
import { AtualizarStatusModal } from '@/components/eventos/AtualizarStatusModal';
import { AgendarVistoriaModal } from '@/components/eventos/AgendarVistoriaModal';
import { EmitirParecerModal } from '@/components/eventos/EmitirParecerModal';
import { ConversaIADialog } from '@/components/sinistros/ConversaIADialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';

const statusConfig: Record<string, { label: string; class: string }> = {
  comunicado: { label: 'Comunicado', class: 'bg-yellow-100 text-yellow-800' },
  em_analise: { label: 'Em Análise', class: 'bg-blue-100 text-blue-800' },
  documentacao_pendente: { label: 'Doc. Pendente', class: 'bg-orange-100 text-orange-800' },
  aguardando_vistoria: { label: 'Aguard. Vistoria', class: 'bg-purple-100 text-purple-800' },
  em_vistoria: { label: 'Em Vistoria', class: 'bg-indigo-100 text-indigo-800' },
  aguardando_parecer: { label: 'Aguard. Parecer', class: 'bg-cyan-100 text-cyan-800' },
  aprovado: { label: 'Aprovado', class: 'bg-green-100 text-green-800' },
  negado: { label: 'Negado', class: 'bg-red-100 text-red-800' },
  em_regulacao: { label: 'Em Regulação', class: 'bg-amber-100 text-amber-800' },
  em_reparo: { label: 'Em Reparo', class: 'bg-teal-100 text-teal-800' },
  pago: { label: 'Pago', class: 'bg-emerald-100 text-emerald-800' },
  encerrado: { label: 'Encerrado', class: 'bg-gray-100 text-gray-800' },
  cancelado: { label: 'Cancelado', class: 'bg-slate-100 text-slate-800' },
  em_sindicancia: { label: 'Em Sindicância', class: 'bg-rose-100 text-rose-800' },
};

const tipoConfig: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: ShieldAlert },
  furto: { label: 'Furto', icon: ShieldX },
  incendio: { label: 'Incêndio', icon: Flame },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: CloudRain },
  vidros: { label: 'Vidros', icon: Square },
  outro: { label: 'Outro', icon: HelpCircle },
};

const documentoStatusConfig: Record<string, { label: string; class: string; icon: React.ComponentType<{ className?: string }> }> = {
  pendente: { label: 'Pendente', class: 'bg-yellow-100 text-yellow-800', icon: Clock },
  aprovado: { label: 'Aprovado', class: 'bg-green-100 text-green-800', icon: CheckCircle },
  reprovado: { label: 'Reprovado', class: 'bg-red-100 text-red-800', icon: XCircle },
};

const canalConfig: Record<string, string> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
  presencial: 'Presencial',
};

const formatDate = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
};

const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const formatCurrency = (value: number | null) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const handleWhatsApp = (phone: string | null) => {
  if (!phone) return;
  const cleaned = phone.replace(/\D/g, '');
  window.open(`https://wa.me/55${cleaned}`, '_blank');
};

export default function SinistroDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modalVincularOpen, setModalVincularOpen] = useState(false);
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [modalVistoriaOpen, setModalVistoriaOpen] = useState(false);
  const [modalParecerOpen, setModalParecerOpen] = useState(false);
  const [modalExcluirOpen, setModalExcluirOpen] = useState(false);
  const [modalConversaOpen, setModalConversaOpen] = useState(false);
  const [modalSolicitarDocsOpen, setModalSolicitarDocsOpen] = useState(false);

  const { isDiretor } = usePermissions();
  const deleteSinistro = useDeleteSinistro();

  const { data: sinistro, isLoading } = useQuery({
    queryKey: ['sinistro', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(
            id, nome, cpf, telefone, whatsapp, email,
            logradouro, numero, bairro, cidade, uf
          ),
          veiculo:veiculos(
            id, placa, marca, modelo, ano_modelo, cor, 
            chassi, valor_fipe, codigo_fipe, renavam
          ),
          analista:profiles!sinistros_analista_id_fkey(id, nome)
        `)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: historico } = useQuery({
    queryKey: ['sinistro-historico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_historico')
        .select(`*, usuario:profiles!sinistro_historico_usuario_id_fkey(nome)`)
        .eq('sinistro_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: documentos } = useQuery({
    queryKey: ['sinistro-documentos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sinistro_documentos')
        .select('*')
        .eq('sinistro_id', id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query para processos vinculados ao sinistro
  const { data: processosVinculados = [] } = useQuery({
    queryKey: ['processos-sinistro', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select(`
          id, numero, numero_processo, tipo, natureza, status, fase, vara, comarca,
          advogado:advogados(id, nome)
        `)
        .eq('sinistro_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Query para buscar solicitação IA vinculada ao sinistro
  const { data: solicitacaoIA } = useQuery({
    queryKey: ['sinistro-solicitacao-ia', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select('*')
        .eq('resultado_id', id!)
        .eq('tipo', 'sinistro')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query para buscar mensagens do chat relacionadas
  const { data: mensagensChat } = useQuery({
    queryKey: ['sinistro-chat-mensagens', sinistro?.associado_id, solicitacaoIA?.created_at],
    queryFn: async () => {
      if (!sinistro?.associado_id) return [];
      
      // Buscar mensagens do associado antes e após a criação da solicitação
      const solicitacaoDate = solicitacaoIA?.created_at 
        ? new Date(solicitacaoIA.created_at) 
        : new Date();
      
      // Intervalo de 24 horas antes da solicitação
      const startDate = new Date(solicitacaoDate);
      startDate.setHours(startDate.getHours() - 24);
      
      const { data, error } = await supabase
        .from('chat_mensagens_ia')
        .select('*')
        .eq('associado_id', sinistro.associado_id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', solicitacaoDate.toISOString())
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!sinistro?.associado_id && !!solicitacaoIA,
  });

  // Extrair descrição original do cliente das mensagens
  const descricaoCliente = useMemo(() => {
    if (!mensagensChat || mensagensChat.length === 0) return null;
    
    // Buscar mensagens do usuário que parecem descrições (maiores que 20 caracteres)
    const mensagensUsuario = mensagensChat
      .filter(m => m.role === 'user')
      .filter(m => {
        const content = m.content?.toLowerCase() || '';
        // Filtrar respostas curtas como "sim", "não", "ok", "já", etc.
        return content.length > 20 && 
          !content.match(/^(sim|não|nao|ok|já|ja|certo|isso|entendi|blz|beleza)\.?$/);
      })
      .map(m => m.content);
      
    return mensagensUsuario.length > 0 ? mensagensUsuario.join('\n\n') : null;
  }, [mensagensChat]);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-40" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!sinistro) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Sinistro não encontrado</h2>
        <Button onClick={() => navigate('/eventos/sinistros')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || HelpCircle;
  const statusInfo = statusConfig[sinistro.status] || { label: sinistro.status, class: 'bg-gray-100 text-gray-800' };

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/dashboard">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/eventos/sinistros">Sinistros</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{sinistro.protocolo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/eventos/sinistros')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sinistro.protocolo}</h1>
            <p className="text-sm text-muted-foreground">
              Aberto em {formatDateTime(sinistro.created_at)}
            </p>
          </div>
          <Badge className={`${statusInfo.class} text-sm px-3 py-1`}>
            {statusInfo.label}
          </Badge>
        </div>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => setModalStatusOpen(true), 0);
            }}>
              <FileCheck className="h-4 w-4 mr-2" />
              Atualizar Status
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => setModalVistoriaOpen(true), 0);
            }}>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Vistoria
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => setModalParecerOpen(true), 0);
            }}>
              <FileText className="h-4 w-4 mr-2" />
              Emitir Parecer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {['aprovado', 'em_regulacao', 'em_reparo'].includes(sinistro.status) && (
              <DropdownMenuItem onClick={() => navigate(`/oficina/ordens-servico?novo=true&sinistro_id=${id}`)}>
                <Wrench className="h-4 w-4 mr-2" />
                Criar Ordem de Serviço
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => navigate(`/juridico/processos/novo?sinistro_id=${id}`)}>
              <Scale className="h-4 w-4 mr-2" />
              Criar Processo Jurídico
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => setModalVincularOpen(true), 0);
            }}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Vincular Processo Existente
            </DropdownMenuItem>
            {isDiretor && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={(e) => {
                    e.preventDefault();
                    setTimeout(() => setModalExcluirOpen(true), 0);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Sinistro
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações do Sinistro */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TipoIcon className="h-5 w-5" />
                Informações do Sinistro
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tipo</p>
                  <div className="flex items-center gap-2 font-medium">
                    <TipoIcon className="h-4 w-4" />
                    {tipoConfig[sinistro.tipo]?.label || sinistro.tipo}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data da Ocorrência</p>
                  <p className="font-medium">{formatDateTime(sinistro.data_ocorrencia)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Local</p>
                <div className="flex items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {sinistro.local_ocorrencia ? (
                    <>
                      {sinistro.local_ocorrencia}
                      {sinistro.cidade_ocorrencia && `, ${sinistro.cidade_ocorrencia}`}
                      {sinistro.estado_ocorrencia && `/${sinistro.estado_ocorrencia}`}
                    </>
                  ) : (
                    '-'
                  )}
                </div>
              </div>

              {sinistro.local_descricao && (
                <div>
                  <p className="text-sm text-muted-foreground">Descrição do Local</p>
                  <p className="font-medium">{sinistro.local_descricao}</p>
                </div>
              )}

              <Separator />

              {/* Descrição do Sinistro - Expandida com IA e Cliente */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    Descrição (Resumo IA)
                  </p>
                  <div className="bg-muted/50 p-3 rounded-lg mt-1">
                    <p className="font-medium whitespace-pre-wrap">
                      {sinistro.descricao || '-'}
                    </p>
                  </div>
                </div>

                {descricaoCliente && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Texto Original do Cliente
                    </p>
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg mt-1 border border-blue-200 dark:border-blue-800">
                      <p className="font-medium whitespace-pre-wrap text-blue-900 dark:text-blue-100">
                        {descricaoCliente}
                      </p>
                    </div>
                  </div>
                )}

                {mensagensChat && mensagensChat.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setModalConversaOpen(true)}
                    className="mt-2"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Ver Conversa com IA ({mensagensChat.length} mensagens)
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nº B.O.</p>
                  <p className="font-medium">{sinistro.bo_numero || 'Não informado'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Canal de Abertura</p>
                  <p className="font-medium">{canalConfig[sinistro.canal] || sinistro.canal}</p>
                </div>
              </div>

              {sinistro.bo_arquivo_url && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Arquivo B.O.</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href={sinistro.bo_arquivo_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visualizar B.O.
                    </a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle>Valores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tipo de Dano (Parcial / Perda Total) */}
              {sinistro.valor_fipe && sinistro.valor_fipe > 0 && (
                <div className="pb-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Classificação do Dano</p>
                      <p className="font-medium">
                        {sinistro.tipo_dano === 'perda_total' 
                          ? 'Perda Total (≥75% do FIPE)' 
                          : sinistro.tipo_dano === 'parcial' 
                            ? 'Dano Parcial (<75% do FIPE)'
                            : 'Não classificado'}
                      </p>
                    </div>
                    <Badge variant={sinistro.tipo_dano === 'perda_total' ? 'destructive' : 'secondary'}>
                      {sinistro.tipo_dano === 'perda_total' ? 'Perda Total' : sinistro.tipo_dano === 'parcial' ? 'Parcial' : 'Pendente'}
                    </Badge>
                  </div>
                  {sinistro.valor_fipe && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      Limite para Dano Parcial: {formatCurrency(sinistro.valor_fipe * 0.75)}
                    </div>
                  )}
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor FIPE</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(sinistro.valor_fipe)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Participação</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(sinistro.valor_participacao)}
                  </p>
                  <p className="text-xs text-muted-foreground">Dedutível do associado</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Indenização</p>
                  <p className="text-xl font-bold text-blue-600">
                    {formatCurrency(sinistro.valor_indenizacao)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Pago</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatCurrency(sinistro.valor_pago)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parecer (se existir) */}
          {sinistro.parecer && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Parecer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Analista</p>
                    <p className="font-medium">{sinistro.analista?.nome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data do Parecer</p>
                    <p className="font-medium">{formatDateTime(sinistro.data_parecer)}</p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Parecer</p>
                  <p className="whitespace-pre-wrap">{sinistro.parecer}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Associado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Associado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Nome</p>
                <p className="font-medium">{sinistro.associado?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CPF</p>
                <p className="font-medium">{sinistro.associado?.cpf || '-'}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{sinistro.associado?.telefone || '-'}</p>
                </div>
                {sinistro.associado?.telefone && (
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{sinistro.associado?.email || '-'}</p>
              </div>
              {(sinistro.associado?.logradouro || sinistro.associado?.cidade) && (
                <div>
                  <p className="text-sm text-muted-foreground">Endereço</p>
                  <p className="font-medium">
                    {sinistro.associado.logradouro}
                    {sinistro.associado.numero && `, ${sinistro.associado.numero}`}
                    {sinistro.associado.bairro && ` - ${sinistro.associado.bairro}`}
                    <br />
                    {sinistro.associado.cidade}
                    {sinistro.associado.uf && `/${sinistro.associado.uf}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">
                  {sinistro.veiculo?.marca} {sinistro.veiculo?.modelo} {sinistro.veiculo?.ano_modelo}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Placa</p>
                  <p className="font-medium">{sinistro.veiculo?.placa || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cor</p>
                  <p className="font-medium">{sinistro.veiculo?.cor || '-'}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Chassi</p>
                <p className="font-medium">{sinistro.veiculo?.chassi || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">RENAVAM</p>
                <p className="font-medium">{sinistro.veiculo?.renavam || '-'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Valor FIPE Atual</p>
                <p className="text-lg font-bold text-primary">
                  {formatCurrency(sinistro.veiculo?.valor_fipe)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setModalSolicitarDocsOpen(true)}
              >
                <FilePlus className="h-4 w-4 mr-2" />
                Solicitar
              </Button>
            </CardHeader>
            <CardContent>
              {documentos && documentos.length > 0 ? (
                <div className="space-y-3">
                  {documentos.map((doc) => {
                    const docStatus = documentoStatusConfig[doc.status || 'pendente'];
                    const DocIcon = docStatus?.icon || Clock;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-2 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{doc.nome_arquivo || doc.tipo}</p>
                            <Badge className={`${docStatus?.class} text-xs`}>
                              <DocIcon className="h-3 w-3 mr-1" />
                              {docStatus?.label}
                            </Badge>
                          </div>
                        </div>
                        {doc.arquivo_url && (
                          <Button variant="ghost" size="icon" asChild>
                            <a href={doc.arquivo_url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum documento anexado
                </p>
              )}
            </CardContent>
          </Card>

          {/* Processos Jurídicos */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Processos Jurídicos
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setModalVincularOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Vincular
              </Button>
            </CardHeader>
            <CardContent>
              {processosVinculados.length > 0 ? (
                <div className="space-y-3">
                  {processosVinculados.map((processo) => (
                    <div 
                      key={processo.id} 
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/juridico/processos/${processo.id}`)}
                    >
                      <div>
                        <p className="font-medium">{processo.numero_processo || processo.numero || 'Sem número'}</p>
                        <p className="text-sm text-muted-foreground">
                          {processo.tipo} • {processo.vara || 'Vara não definida'}
                        </p>
                      </div>
                      <Badge variant="outline">{processo.status || 'Ativo'}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum processo vinculado</p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setModalVincularOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Vincular Processo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline do Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Atualizações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historico && historico.length > 0 ? (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-6">
                {historico.map((item, index) => {
                  const statusAnterior = item.status_anterior ? statusConfig[item.status_anterior] : null;
                  const statusNovo = statusConfig[item.status_novo] || { label: item.status_novo, class: 'bg-gray-100 text-gray-800' };
                  
                  return (
                    <div key={item.id} className="relative pl-10">
                      <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-primary border-2 border-background" />
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-muted-foreground">
                            {formatDateTime(item.created_at)}
                          </p>
                          {item.usuario?.nome && (
                            <p className="text-sm text-muted-foreground">
                              Por: {item.usuario.nome}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {statusAnterior && (
                            <>
                              <Badge className={statusAnterior.class}>{statusAnterior.label}</Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                          <Badge className={statusNovo.class}>{statusNovo.label}</Badge>
                        </div>
                        {item.observacao && (
                          <p className="mt-2 text-sm">{item.observacao}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma atualização registrada
            </p>
          )}
        </CardContent>
      </Card>

      {/* Modal para Vincular Processo */}
      <ModalVincularProcesso
        sinistroId={id!}
        open={modalVincularOpen}
        onOpenChange={setModalVincularOpen}
      />

      {/* Modal Atualizar Status */}
      <AtualizarStatusModal
        open={modalStatusOpen}
        onClose={() => setModalStatusOpen(false)}
        sinistro={sinistro ? {
          id: sinistro.id,
          protocolo: sinistro.protocolo,
          status: sinistro.status
        } : null}
      />

      {/* Modal Agendar Vistoria */}
      <AgendarVistoriaModal
        open={modalVistoriaOpen}
        onClose={() => setModalVistoriaOpen(false)}
        sinistro={sinistro ? {
          id: sinistro.id,
          protocolo: sinistro.protocolo,
          status: sinistro.status,
          associado_id: sinistro.associado_id,
          veiculo_id: sinistro.veiculo_id
        } : null}
      />

      {/* Modal Emitir Parecer */}
      <EmitirParecerModal
        open={modalParecerOpen}
        onClose={() => setModalParecerOpen(false)}
        sinistro={sinistro ? {
          id: sinistro.id,
          protocolo: sinistro.protocolo,
          status: sinistro.status,
          tipo: sinistro.tipo,
          valor_fipe: sinistro.valor_fipe,
          veiculo: sinistro.veiculo ? {
            placa: sinistro.veiculo.placa || '',
            marca: sinistro.veiculo.marca || '',
            modelo: sinistro.veiculo.modelo || ''
          } : null
        } : null}
      />

      {/* Modal Excluir Sinistro (apenas diretor) */}
      {isDiretor && sinistro && (
        <ConfirmacaoExclusaoDialog
          open={modalExcluirOpen}
          onOpenChange={setModalExcluirOpen}
          protocolo={sinistro.protocolo}
          onConfirm={async (motivo) => {
            await deleteSinistro.mutateAsync({ sinistroId: id!, motivo });
            navigate('/eventos/sinistros');
          }}
        />
      )}

      {/* Modal Conversa IA */}
      <ConversaIADialog
        open={modalConversaOpen}
        onOpenChange={setModalConversaOpen}
        mensagens={mensagensChat || []}
        associadoNome={sinistro?.associado?.nome}
        dataConversa={solicitacaoIA?.created_at || mensagensChat?.[0]?.created_at}
      />

      {/* Modal Solicitar Documentos */}
      {sinistro && (
        <SolicitarDocumentosSinistroDialog
          open={modalSolicitarDocsOpen}
          onOpenChange={setModalSolicitarDocsOpen}
          sinistroId={sinistro.id}
          protocolo={sinistro.protocolo}
          statusAtual={sinistro.status}
        />
      )}
    </div>
  );
}
