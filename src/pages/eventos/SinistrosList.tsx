import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { NovoSinistroModal } from '@/components/eventos/NovoSinistroModal';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertCircle,
  AlertTriangle,
  Car,
  ShieldAlert,
  ShieldX,
  Flame,
  CloudRain,
  Square,
  HelpCircle,
  Eye,
  Plus,
  Search,
  ClipboardCheck,
  Bot,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Status configuration
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

// Tipo configuration
const tipoConfig: Record<string, { label: string; icon: React.ElementType }> = {
  colisao: { label: 'Colisão', icon: Car },
  roubo: { label: 'Roubo', icon: ShieldAlert },
  furto: { label: 'Furto', icon: ShieldX },
  incendio: { label: 'Incêndio', icon: Flame },
  fenomeno_natural: { label: 'Fenômeno Natural', icon: CloudRain },
  vidros: { label: 'Vidros', icon: Square },
  outro: { label: 'Outro', icon: HelpCircle },
};

interface Filters {
  busca: string;
  status: string;
  tipo: string;
}

export default function SinistrosList() {
  const navigate = useNavigate();
  const { isDiretor } = usePermissions();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    busca: '',
    status: 'todos',
    tipo: 'todos',
  });

  // Query principal
  const { data: sinistros, isLoading } = useQuery({
    queryKey: ['sinistros', filters],
    queryFn: async () => {
      let query = supabase
        .from('sinistros')
        .select(`
          *,
          associado:associados(id, nome, cpf, telefone),
          veiculo:veiculos(id, placa, marca, modelo, ano_modelo, valor_fipe)
        `)
        .order('created_at', { ascending: false });

      if (filters.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status as any);
      }
      if (filters.tipo && filters.tipo !== 'todos') {
        query = query.eq('tipo', filters.tipo as any);
      }
      if (filters.busca) {
        query = query.or(`protocolo.ilike.%${filters.busca}%`);
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Query para contadores
  const { data: contadores } = useQuery({
    queryKey: ['sinistros-contadores'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sinistros').select('status');
      if (error) throw error;

      return {
        comunicado: data.filter((s) => s.status === 'comunicado').length,
        em_analise: data.filter((s) => s.status === 'em_analise').length,
        aguardando_vistoria: data.filter((s) => s.status === 'aguardando_vistoria').length,
        aprovado: data.filter((s) => s.status === 'aprovado').length,
        negado: data.filter((s) => s.status === 'negado').length,
      };
    },
  });

  // Query para pendências IA (solicitações de sinistro aguardando aprovação)
  const { data: pendenciasIA } = useQuery({
    queryKey: ['sinistros-pendencias-ia'],
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from('chat_solicitacoes_ia')
        .select('id, tipo, dados, created_at, associado:associados!chat_solicitacoes_ia_associado_id_fkey(nome)', { count: 'exact' })
        .eq('status', 'pendente')
        .eq('tipo', 'sinistro')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return { items: data || [], count: count || 0 };
    },
  });

  const formatCurrency = (value: number | null) => {
    if (!value) return '-';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestão de Sinistros</h1>
          <p className="text-muted-foreground">Gerencie todos os sinistros da associação</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Registrar Sinistro
        </Button>
      </div>

      <NovoSinistroModal 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSuccess={(sinistro) => navigate(`/eventos/sinistros/${sinistro.id}`)}
      />

      {/* Alerta de Pendências IA */}
      {pendenciasIA && pendenciasIA.count > 0 && (
        <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <Bot className="h-8 w-8 text-amber-600" />
              <div>
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  {pendenciasIA.count} sinistro(s) aguardando aprovação via IA
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Solicitações geradas via WhatsApp/App precisam ser aprovadas
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              className="border-amber-500 text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/50"
              onClick={() => navigate('/diretoria/solicitacoes-ia')}
            >
              <Bot className="mr-2 h-4 w-4" />
              Revisar Solicitações
            </Button>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Comunicados</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {(contadores?.comunicado || 0) + (pendenciasIA?.count || 0)}
                </p>
                {pendenciasIA && pendenciasIA.count > 0 && (
                  <p className="text-xs text-amber-600">
                    (+{pendenciasIA.count} via IA)
                  </p>
                )}
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Em Análise</p>
                <p className="text-2xl font-bold text-blue-600">
                  {contadores?.em_analise || 0}
                </p>
              </div>
              <Search className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aguard. Vistoria</p>
                <p className="text-2xl font-bold text-purple-600">
                  {contadores?.aguardando_vistoria || 0}
                </p>
              </div>
              <Eye className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold text-green-600">
                  {contadores?.aprovado || 0}
                </p>
              </div>
              <ShieldAlert className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Negados</p>
                <p className="text-2xl font-bold text-red-600">
                  {contadores?.negado || 0}
                </p>
              </div>
              <ShieldX className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por protocolo..."
                className="pl-9"
                value={filters.busca}
                onChange={(e) => setFilters({ ...filters, busca: e.target.value })}
              />
            </div>

            <Select
              value={filters.tipo}
              onValueChange={(value) => setFilters({ ...filters, tipo: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                <SelectItem value="colisao">Colisão</SelectItem>
                <SelectItem value="roubo">Roubo</SelectItem>
                <SelectItem value="furto">Furto</SelectItem>
                <SelectItem value="incendio">Incêndio</SelectItem>
                <SelectItem value="fenomeno_natural">Fenômeno Natural</SelectItem>
                <SelectItem value="vidros">Vidros</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => setFilters({ ...filters, status: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="comunicado">Comunicado</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="documentacao_pendente">Doc. Pendente</SelectItem>
                <SelectItem value="aguardando_vistoria">Aguard. Vistoria</SelectItem>
                <SelectItem value="aprovado">Aprovado</SelectItem>
                <SelectItem value="negado">Negado</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="encerrado">Encerrado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Associado</TableHead>
                <TableHead>Veículo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor FIPE</TableHead>
                <TableHead className="w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : sinistros && sinistros.length > 0 ? (
                sinistros.map((sinistro) => {
                  const TipoIcon = tipoConfig[sinistro.tipo]?.icon || HelpCircle;
                  const statusInfo = statusConfig[sinistro.status] || statusConfig.comunicado;
                  const tipoInfo = tipoConfig[sinistro.tipo] || { label: sinistro.tipo };

                  return (
                    <TableRow key={sinistro.id}>
                      <TableCell className="font-mono font-medium">
                        {sinistro.protocolo}
                      </TableCell>
                      <TableCell>{formatDate(sinistro.data_ocorrencia)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{sinistro.associado?.nome || '-'}</p>
                          <p className="text-xs text-muted-foreground">
                            {sinistro.associado?.cpf || '-'}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {sinistro.veiculo?.marca} {sinistro.veiculo?.modelo}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {sinistro.veiculo?.placa} • {sinistro.veiculo?.ano_modelo}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <TipoIcon className="h-4 w-4 text-muted-foreground" />
                          <span>{tipoInfo.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className={statusInfo.class} variant="secondary">
                            {statusInfo.label}
                          </Badge>
                          {sinistro.alerta_recem_ativado && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Recém-ativado
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(sinistro.veiculo?.valor_fipe || sinistro.valor_fipe)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {isDiretor && (sinistro.status === 'comunicado' || sinistro.status === 'em_analise') && (
                            <Button
                              variant="default"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => navigate(`/eventos/sinistros/${sinistro.id}/analisar`)}
                              title="Analisar"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/eventos/sinistros/${sinistro.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="h-8 w-8 text-muted-foreground" />
                      <p className="text-muted-foreground">Nenhum sinistro encontrado</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
