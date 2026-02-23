import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { NovoPrestadorModal } from '@/components/assistencia/NovoPrestadorModal';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  ArrowLeft, Phone, MessageSquare, MapPin, Star, Pencil,
  Ban, Clock, Truck, CheckCircle, Mail, Building2, CreditCard, DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Prestador {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
  email: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  estado: string;
  tipos_servico: string[] | null;
  tipos_reboque: string[] | null;
  raio_atendimento_km: number | null;
  cidades_atendidas: string[] | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  pix_tipo: string | null;
  pix_chave: string | null;
  nota_media: number | null;
  total_atendimentos: number | null;
  total_avaliacoes: number | null;
  status: string | null;
  disponivel: boolean | null;
  created_at: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  inativo: { label: 'Inativo', className: 'bg-muted text-muted-foreground' },
  suspenso: { label: 'Suspenso', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  bloqueado: { label: 'Bloqueado', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
};

const tiposServicoConfig: Record<string, string> = {
  reboque: 'Reboque / Guincho',
  pane_seca: 'Pane Seca',
  socorro_mecanico: 'Socorro Mecânico',
  socorro_eletrico: 'Socorro Elétrico',
  troca_pneu: 'Troca de Pneu',
  chaveiro: 'Chaveiro',
  bateria: 'Bateria',
  taxi: 'Táxi / Transporte',
  hospedagem: 'Hospedagem',
  outro: 'Outros',
};

const tiposReboqueConfig: Record<string, string> = {
  leve: 'Leves',
  utilitario: 'Utilitários',
  pesado: 'Pesados',
};

const statusAtendimentoConfig: Record<string, { label: string; className: string }> = {
  acionado: { label: 'Acionado', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  aceito: { label: 'Aceito', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  recusado: { label: 'Recusado', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  a_caminho: { label: 'A Caminho', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  no_local: { label: 'No Local', className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400' },
  em_andamento: { label: 'Em Andamento', className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400' },
  concluido: { label: 'Concluído', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelado: { label: 'Cancelado', className: 'bg-muted text-muted-foreground' },
};

const formatCNPJ = (cnpj: string) => {
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};

const formatCPF = (cpf: string) => {
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatPhone = (phone: string) => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }
  return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
};

const formatCurrency = (value: number | null) => {
  if (value === null || value === undefined) return '-';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
};

export default function PrestadorDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: prestador, isLoading } = useQuery({
    queryKey: ['prestador', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores_assistencia')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as Prestador;
    },
    enabled: !!id,
  });

  const { data: valoresPrestador } = useQuery({
    queryKey: ['prestador-valores', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prestadores_assistencia_valores' as any)
        .select('*')
        .eq('prestador_id', id!)
        .eq('ativo', true)
        .order('tipo_servico');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!id,
  });

  const { data: atendimentos } = useQuery({
    queryKey: ['prestador-atendimentos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia_atendimentos')
        .select(`
          *,
          chamado:chamados_assistencia(
            protocolo, tipo_servico,
            associado:associados(nome)
          )
        `)
        .eq('prestador_id', id!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: estatisticas } = useQuery({
    queryKey: ['prestador-estatisticas', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chamados_assistencia_atendimentos')
        .select('status, hora_acionamento, hora_chegada')
        .eq('prestador_id', id!);
      if (error) throw error;
      
      const total = data.length;
      const aceitos = data.filter(a => a.status !== 'recusado').length;
      const taxaAceite = total > 0 ? (aceitos / total) * 100 : 0;
      
      const comChegada = data.filter(a => a.hora_acionamento && a.hora_chegada);
      let tempoMedioChegada = 0;
      if (comChegada.length > 0) {
        const totalMinutos = comChegada.reduce((acc, a) => {
          const acionamento = new Date(a.hora_acionamento!);
          const chegada = new Date(a.hora_chegada!);
          return acc + differenceInMinutes(chegada, acionamento);
        }, 0);
        tempoMedioChegada = Math.round(totalMinutos / comChegada.length);
      }
      
      return { total, taxaAceite, tempoMedioChegada };
    },
    enabled: !!id,
  });

  const toggleDisponivel = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('prestadores_assistencia')
        .update({ disponivel: !prestador?.disponivel })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestador', id] });
      toast.success(prestador?.disponivel ? 'Marcado como indisponível' : 'Marcado como disponível');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('prestadores_assistencia')
        .update({ status: newStatus })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prestador', id] });
      toast.success('Status atualizado');
    },
  });

  const handleWhatsApp = (phone: string | null) => {
    if (!phone) return;
    const cleaned = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${cleaned}`, '_blank');
  };

  const handleCall = (phone: string | null) => {
    if (!phone) return;
    window.location.href = `tel:${phone}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!prestador) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Truck className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Prestador não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/assistencia/prestadores')}>
          Voltar para lista
        </Button>
      </div>
    );
  }

  const endereco = [
    prestador.logradouro,
    prestador.numero,
    prestador.bairro,
    prestador.cidade,
    prestador.estado,
    prestador.cep,
  ].filter(Boolean).join(', ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/assistencia/prestadores')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {prestador.nome_fantasia || prestador.razao_social}
            </h1>
            {prestador.nome_fantasia && (
              <p className="text-muted-foreground">{prestador.razao_social}</p>
            )}
          </div>
          <Badge className={statusConfig[prestador.status || 'ativo']?.className}>
            {statusConfig[prestador.status || 'ativo']?.label}
          </Badge>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Disponível</span>
            <Switch
              checked={prestador.disponivel || false}
              onCheckedChange={() => toggleDisponivel.mutate()}
            />
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Ações</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateStatus.mutate('suspenso')}>
                <Ban className="mr-2 h-4 w-4" />
                Suspender
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => updateStatus.mutate('bloqueado')}
                className="text-destructive"
              >
                <Ban className="mr-2 h-4 w-4" />
                Bloquear
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dados Cadastrais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Dados Cadastrais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Razão Social</p>
                  <p className="font-medium">{prestador.razao_social}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nome Fantasia</p>
                  <p className="font-medium">{prestador.nome_fantasia || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">CNPJ/CPF</p>
                  <p className="font-medium">
                    {prestador.cnpj 
                      ? formatCNPJ(prestador.cnpj) 
                      : prestador.cpf 
                        ? formatCPF(prestador.cpf) 
                        : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{prestador.email || '-'}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex flex-wrap gap-2">
                {prestador.telefone && (
                  <Button variant="outline" size="sm" onClick={() => handleCall(prestador.telefone)}>
                    <Phone className="mr-2 h-4 w-4" />
                    {formatPhone(prestador.telefone)}
                  </Button>
                )}
                {prestador.whatsapp && (
                  <Button variant="outline" size="sm" onClick={() => handleWhatsApp(prestador.whatsapp)}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    WhatsApp
                  </Button>
                )}
                {prestador.email && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${prestador.email}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </a>
                  </Button>
                )}
              </div>
              
              <Separator />
              
              <div>
                <p className="text-sm text-muted-foreground mb-1">Endereço</p>
                <p className="font-medium flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  {endereco || 'Endereço não informado'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Dados Bancários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Dados Bancários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Banco</p>
                  <p className="font-medium">{prestador.banco || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Agência / Conta</p>
                  <p className="font-medium">
                    {prestador.agencia && prestador.conta 
                      ? `${prestador.agencia} / ${prestador.conta}` 
                      : '-'
                    }
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-muted-foreground">Chave PIX</p>
                  <p className="font-medium">
                    {prestador.pix_chave 
                      ? `${prestador.pix_tipo?.toUpperCase() || 'PIX'}: ${prestador.pix_chave}` 
                      : '-'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Valores */}
          {valoresPrestador && valoresPrestador.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Tabela de Valores
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serviço</TableHead>
                      <TableHead className="text-right">Saída</TableHead>
                      <TableHead className="text-right">Km</TableHead>
                      <TableHead className="text-right">Fixo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {valoresPrestador.map((v: any) => {
                      const servicoLabel = tiposServicoConfig[v.tipo_servico] || v.tipo_servico;
                      const reboqueLabel = v.tipo_reboque ? tiposReboqueConfig[v.tipo_reboque] || v.tipo_reboque : null;
                      return (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">
                            {servicoLabel}
                            {reboqueLabel && <span className="text-muted-foreground text-xs ml-1">({reboqueLabel})</span>}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(v.valor_saida)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(v.valor_km)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(v.valor_fixo)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Últimos Atendimentos */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Atendimentos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atendimentos?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Nenhum atendimento registrado
                      </TableCell>
                    </TableRow>
                  )}
                  {atendimentos?.map((atendimento: any) => (
                    <TableRow 
                      key={atendimento.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/assistencia/chamados/${atendimento.chamado_id}`)}
                    >
                      <TableCell className="font-medium">
                        {atendimento.chamado?.protocolo || '-'}
                      </TableCell>
                      <TableCell>
                        {tiposServicoConfig[atendimento.chamado?.tipo_servico] || atendimento.chamado?.tipo_servico}
                      </TableCell>
                      <TableCell>
                        {atendimento.chamado?.associado?.nome || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusAtendimentoConfig[atendimento.status]?.className || 'bg-muted'}>
                          {statusAtendimentoConfig[atendimento.status]?.label || atendimento.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(atendimento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 */}
        <div className="space-y-6">
          {/* Estatísticas */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Truck className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas?.total || prestador.total_atendimentos || 0}</p>
                  <p className="text-sm text-muted-foreground">Total de Atendimentos</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas?.taxaAceite.toFixed(0) || 0}%</p>
                  <p className="text-sm text-muted-foreground">Taxa de Aceite</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{estatisticas?.tempoMedioChegada || 0} min</p>
                  <p className="text-sm text-muted-foreground">Tempo Médio de Chegada</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                  <Star className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <p className="text-2xl font-bold">{prestador.nota_media?.toFixed(1) || '0.0'}</p>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i}
                          className={`h-4 w-4 ${i < Math.round(prestador.nota_media || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}`} 
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Média de Avaliação ({prestador.total_avaliacoes || 0} avaliações)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tipos de Serviço */}
          <Card>
            <CardHeader>
              <CardTitle>Tipos de Serviço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {prestador.tipos_servico?.map((tipo) => (
                  <Badge key={tipo} variant="secondary">
                    {tiposServicoConfig[tipo] || tipo}
                  </Badge>
                ))}
                {(!prestador.tipos_servico || prestador.tipos_servico.length === 0) && (
                  <p className="text-sm text-muted-foreground">Nenhum tipo cadastrado</p>
                )}
              </div>

              {/* Tipos de Reboque */}
              {prestador.tipos_reboque && prestador.tipos_reboque.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Tipos de Reboque</p>
                    <div className="flex flex-wrap gap-2">
                      {prestador.tipos_reboque.map((tipo) => (
                        <Badge key={tipo} variant="outline">
                          {tiposReboqueConfig[tipo] || tipo}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Área de Atuação */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Área de Atuação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Cidade Base</p>
                <p className="font-medium">{prestador.cidade}/{prestador.estado}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Raio de Atendimento</p>
                <p className="font-medium">{prestador.raio_atendimento_km || 50} km</p>
              </div>
              {prestador.cidades_atendidas && prestador.cidades_atendidas.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Cidades Atendidas</p>
                  <div className="flex flex-wrap gap-1">
                    {prestador.cidades_atendidas.map((cidade) => (
                      <Badge key={cidade} variant="outline" className="text-xs">
                        {cidade}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de edição */}
      <NovoPrestadorModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        prestador={prestador}
      />
    </div>
  );
}
