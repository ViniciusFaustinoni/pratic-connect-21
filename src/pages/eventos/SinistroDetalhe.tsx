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
  User, FileCheck, FilePlus
} from 'lucide-react';
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal className="h-4 w-4 mr-2" />
              Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <FileCheck className="h-4 w-4 mr-2" />
              Atualizar Status
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Calendar className="h-4 w-4 mr-2" />
              Agendar Vistoria
            </DropdownMenuItem>
            <DropdownMenuItem>
              <FileText className="h-4 w-4 mr-2" />
              Emitir Parecer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleWhatsApp(sinistro.associado?.whatsapp || sinistro.associado?.telefone)}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar WhatsApp
            </DropdownMenuItem>
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

              <div>
                <p className="text-sm text-muted-foreground">Descrição do Sinistro</p>
                <p className="font-medium whitespace-pre-wrap">{sinistro.descricao || '-'}</p>
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
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Valor FIPE</p>
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(sinistro.valor_fipe)}
                  </p>
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
              <Button variant="outline" size="sm">
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
    </div>
  );
}
