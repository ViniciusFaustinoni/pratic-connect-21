import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AtribuirPrestadorModal } from '@/components/assistencia/AtribuirPrestadorModal';
import { supabase } from '@/integrations/supabase/client';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, Phone, MessageSquare, MapPin, Clock, User, Car, Star,
  Truck, AlertTriangle, MoreHorizontal, Key, Circle, Fuel, Battery,
  HelpCircle, UserPlus, RefreshCw, XCircle, AlertCircle, LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Configurações
const statusConfig: Record<string, { label: string; className: string }> = {
  aberto: { label: 'Aberto', className: 'bg-yellow-100 text-yellow-800' },
  aguardando_prestador: { label: 'Aguard. Prestador', className: 'bg-orange-100 text-orange-800' },
  prestador_despachado: { label: 'Despachado', className: 'bg-blue-100 text-blue-800' },
  prestador_a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
  em_atendimento: { label: 'Em Atendimento', className: 'bg-indigo-100 text-indigo-800' },
  concluido: { label: 'Concluído', className: 'bg-green-100 text-green-800' },
  cancelado_associado: { label: 'Canc. Associado', className: 'bg-red-100 text-red-800' },
  cancelado_sistema: { label: 'Canc. Sistema', className: 'bg-red-100 text-red-800' },
};

const tiposServico: Record<string, { icon: LucideIcon; label: string }> = {
  reboque: { icon: Truck, label: 'Reboque/Guincho' },
  chaveiro: { icon: Key, label: 'Chaveiro' },
  troca_pneu: { icon: Circle, label: 'Troca de Pneu' },
  pane_seca: { icon: Fuel, label: 'Pane Seca' },
  bateria: { icon: Battery, label: 'Bateria' },
  outro: { icon: HelpCircle, label: 'Outros' },
};

const canalConfig: Record<string, string> = {
  app: 'Aplicativo',
  whatsapp: 'WhatsApp',
  telefone: 'Telefone',
};

const statusAtendimentoConfig: Record<string, { label: string; className: string }> = {
  acionado: { label: 'Acionado', className: 'bg-blue-100 text-blue-800' },
  aceito: { label: 'Aceito', className: 'bg-green-100 text-green-800' },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-800' },
  a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800' },
  no_local: { label: 'No Local', className: 'bg-indigo-100 text-indigo-800' },
  em_andamento: { label: 'Em Andamento', className: 'bg-teal-100 text-teal-800' },
  concluido: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-800' },
  cancelado: { label: 'Cancelado', className: 'bg-gray-100 text-gray-800' },
};

// Funções utilitárias
const formatDateTime = (date: string | null) => {
  if (!date) return '-';
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

const handleWhatsApp = (phone: string | null | undefined) => {
  if (!phone) return;
  const cleaned = phone.replace(/\D/g, '');
  window.open(`https://wa.me/55${cleaned}`, '_blank');
};

const handleCall = (phone: string | null | undefined) => {
  if (!phone) return;
  const cleaned = phone.replace(/\D/g, '');
  window.location.href = `tel:+55${cleaned}`;
};

const getTempoEspera = (dataAbertura: string) => {
  return differenceInMinutes(new Date(), new Date(dataAbertura));
};

export default function ChamadoDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [modalPrestador, setModalPrestador] = useState(false);

  // Query: Dados do Chamado
  const { data: chamado, isLoading } = useQuery({
    queryKey: ['chamado', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone, whatsapp, email, status),
          veiculo:veiculos(id, placa, marca, modelo, ano_modelo, cor),
          atendente:profiles!chamados_assistencia_atendente_id_fkey(id, nome),
          prestador:prestadores_assistencia!chamados_assistencia_prestador_id_fkey(
            id, razao_social, nome_fantasia, telefone, whatsapp
          )
        `)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query: Histórico do Chamado
  const { data: historico } = useQuery({
    queryKey: ['chamado-historico', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia_historico')
        .select(`
          *,
          usuario:profiles!chamados_assistencia_historico_usuario_id_fkey(nome)
        `)
        .eq('chamado_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Query: Atendimentos do Chamado
  const { data: atendimentos } = useQuery({
    queryKey: ['chamado-atendimentos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia_atendimentos')
        .select(`
          *,
          prestador:prestadores_assistencia(id, razao_social, telefone, whatsapp)
        `)
        .eq('chamado_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Not Found state
  if (!chamado) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <AlertCircle className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Chamado não encontrado</h2>
        <Button onClick={() => navigate('/assistencia/chamados')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const TipoIcon = tiposServico[chamado.tipo_servico]?.icon || HelpCircle;
  const status = statusConfig[chamado.status] || { label: chamado.status, className: '' };

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
              <Link to="/assistencia/chamados">Chamados</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{chamado.protocolo}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/assistencia/chamados')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{chamado.protocolo}</h1>
            <p className="text-sm text-muted-foreground">
              Aberto em {formatDateTime(chamado.data_abertura)}
            </p>
          </div>
          <Badge className={`${status.className} text-sm px-3 py-1`}>
            {status.label}
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
            <DropdownMenuItem onClick={() => setModalPrestador(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Atribuir Prestador
            </DropdownMenuItem>
            <DropdownMenuItem>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Status
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600">
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar Chamado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alerta de tempo */}
      {chamado.status === 'aberto' && getTempoEspera(chamado.data_abertura) > 30 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção!</strong> Chamado aguardando há {getTempoEspera(chamado.data_abertura)} minutos.
            Priorize o atendimento imediatamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Grid principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Informações do Chamado */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TipoIcon className="h-5 w-5" />
                Informações do Chamado
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Protocolo</p>
                  <p className="font-mono font-medium">{chamado.protocolo}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Serviço</p>
                  <div className="flex items-center gap-2 font-medium">
                    <TipoIcon className="h-4 w-4" />
                    {tiposServico[chamado.tipo_servico]?.label || chamado.tipo_servico}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data/Hora</p>
                  <p className="font-medium">{formatDateTime(chamado.data_abertura)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Canal</p>
                  <p className="font-medium">{canalConfig[chamado.canal] || chamado.canal}</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground">Descrição</p>
                <p className="font-medium whitespace-pre-wrap">{chamado.descricao || 'Não informado'}</p>
              </div>

              {chamado.atendente && (
                <div>
                  <p className="text-sm text-muted-foreground">Atendente Responsável</p>
                  <p className="font-medium">{chamado.atendente.nome}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Localização */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Localização
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Endereço de Origem</p>
                <p className="font-medium">
                  {chamado.origem_logradouro || chamado.origem_endereco || 'Não informado'}
                  {chamado.origem_cidade && `, ${chamado.origem_cidade}`}
                  {chamado.origem_uf && `/${chamado.origem_uf}`}
                </p>
                {chamado.origem_lat && chamado.origem_lng && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordenadas: {chamado.origem_lat}, {chamado.origem_lng}
                  </p>
                )}
              </div>

              {(chamado.destino_logradouro || chamado.destino_endereco) && (
                <div>
                  <p className="text-sm text-muted-foreground">Endereço de Destino</p>
                  <p className="font-medium">
                    {chamado.destino_logradouro || chamado.destino_endereco}
                    {chamado.destino_cidade && `, ${chamado.destino_cidade}`}
                    {chamado.destino_uf && `/${chamado.destino_uf}`}
                  </p>
                </div>
              )}

              {/* Placeholder para mapa */}
              <div className="h-40 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MapPin className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Visualização de mapa (em breve)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card: Prestador */}
          {(chamado.prestador || chamado.prestador_nome) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Prestador
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">
                    {chamado.prestador?.razao_social || chamado.prestador?.nome_fantasia || chamado.prestador_nome}
                  </p>
                </div>

                <div className="flex gap-2">
                  {(chamado.prestador?.telefone || chamado.prestador_telefone) && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCall(chamado.prestador?.telefone || chamado.prestador_telefone)}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Ligar
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600"
                        onClick={() =>
                          handleWhatsApp(
                            chamado.prestador?.whatsapp || chamado.prestador?.telefone || chamado.prestador_telefone
                          )
                        }
                      >
                        <MessageSquare className="h-4 w-4 mr-2" />
                        WhatsApp
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card: Atendimentos */}
          {atendimentos && atendimentos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Atendimentos
                  <Badge variant="secondary">{atendimentos.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {atendimentos.map((atend) => (
                    <div key={atend.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">
                          {atend.prestador?.razao_social || 'Prestador não identificado'}
                        </span>
                        <Badge className={statusAtendimentoConfig[atend.status || '']?.className}>
                          {statusAtendimentoConfig[atend.status || '']?.label || atend.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                        {atend.hora_acionamento && (
                          <div>Acionado: {format(new Date(atend.hora_acionamento), 'HH:mm')}</div>
                        )}
                        {atend.hora_aceite && (
                          <div>Aceito: {format(new Date(atend.hora_aceite), 'HH:mm')}</div>
                        )}
                        {atend.hora_chegada && (
                          <div>Chegou: {format(new Date(atend.hora_chegada), 'HH:mm')}</div>
                        )}
                        {atend.hora_conclusao && (
                          <div>Concluído: {format(new Date(atend.hora_conclusao), 'HH:mm')}</div>
                        )}
                      </div>
                      {atend.motivo_recusa && (
                        <p className="mt-2 text-sm text-red-600">
                          <strong>Motivo recusa:</strong> {atend.motivo_recusa}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Card: Associado */}
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
                <p className="font-medium">{chamado.associado?.nome || '-'}</p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                  <p className="font-medium">{chamado.associado?.telefone || '-'}</p>
                </div>
                {chamado.associado?.telefone && (
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon" onClick={() => handleCall(chamado.associado?.telefone)}>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleWhatsApp(chamado.associado?.whatsapp || chamado.associado?.telefone)}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline">{chamado.associado?.status || '-'}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Card: Veículo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Car className="h-5 w-5" />
                Veículo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Placa</p>
                <p className="font-mono font-bold text-lg">{chamado.veiculo?.placa || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Modelo</p>
                <p className="font-medium">
                  {chamado.veiculo?.marca} {chamado.veiculo?.modelo}
                  {chamado.veiculo?.ano_modelo && ` (${chamado.veiculo.ano_modelo})`}
                </p>
              </div>
              {chamado.veiculo?.cor && (
                <div>
                  <p className="text-sm text-muted-foreground">Cor</p>
                  <p className="font-medium">{chamado.veiculo.cor}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Avaliação */}
          {chamado.status === 'concluido' && chamado.avaliacao_nota && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Avaliação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star
                      key={i}
                      className={`h-5 w-5 ${
                        i <= (chamado.avaliacao_nota || 0)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                  <span className="font-bold text-lg">{chamado.avaliacao_nota}</span>
                </div>
                {chamado.avaliacao_comentario && (
                  <p className="text-sm italic text-muted-foreground">
                    "{chamado.avaliacao_comentario}"
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Card: Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historico && historico.length > 0 ? (
                <div className="relative space-y-4">
                  {historico.map((item, index) => (
                    <div key={item.id} className="relative pl-6">
                      {/* Linha vertical */}
                      {index < historico.length - 1 && (
                        <div className="absolute left-[9px] top-6 h-full w-0.5 bg-border" />
                      )}
                      {/* Dot */}
                      <div className="absolute left-0 top-1.5 h-[18px] w-[18px] rounded-full border-2 border-primary bg-background" />

                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {statusConfig[item.status_novo]?.label || item.status_novo}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(item.created_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {item.usuario?.nome && ` • ${item.usuario.nome}`}
                        </p>
                        {item.observacao && <p className="text-sm mt-1">{item.observacao}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum histórico registrado
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal Atribuir Prestador */}
      <AtribuirPrestadorModal
        open={modalPrestador}
        onClose={() => setModalPrestador(false)}
        chamado={chamado}
      />
    </div>
  );
}
