import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Filter, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Helpers de tipo e origem
function getTipoBadge(assunto: string, tipo?: string) {
  if (tipo === 'sindicancia_fraude' || /fraude/i.test(assunto)) return { label: 'Fraude', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  if (/carta de cancelamento/i.test(assunto)) return { label: 'Carta Cancel.', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
  if (/encaminhamento jur[ií]dico/i.test(assunto)) return { label: 'Questão Legal', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' };
  if (/indeniza[çc][ãa]o/i.test(assunto)) return { label: 'Indenização', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' };
  if (/alagamento|inc[êe]ndio/i.test(assunto)) return { label: 'Análise Técnica', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
  return { label: 'Outro', className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' };
}

function getOrigem(departamento?: string, assunto?: string, tipo?: string) {
  if (tipo === 'sindicancia_fraude' || tipo === 'sindicancia_complexa') return { label: 'Sindicância', className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' };
  if (departamento === 'eventos' && /sindic[aâ]ncia/i.test(assunto || '')) return { label: 'Sindicância', className: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' };
  if (departamento === 'eventos' && /encaminhamento/i.test(assunto || '')) return { label: 'Encaminhamento', className: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300' };
  if (departamento === 'analise_interna') return { label: 'Análise Interna', className: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-300' };
  return { label: 'Direto', className: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400' };
}

const prioridadeBadge: Record<string, string> = {
  urgente: 'bg-red-500 text-white',
  alta: 'bg-orange-500 text-white',
  media: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  baixa: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const statusBadge: Record<string, string> = {
  pendente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  em_analise: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  respondida: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  arquivada: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  ativo: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  suspenso: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

const statusLabels: Record<string, string> = {
  pendente: 'Pendente',
  em_analise: 'Em Análise',
  respondida: 'Respondida',
  arquivada: 'Arquivada',
  ativo: 'Ativo',
  suspenso: 'Suspenso',
};

interface CasoUnificado {
  id: string;
  _source: 'consulta' | 'processo';
  numero?: string;
  assunto: string;
  tipo?: string;
  departamento?: string;
  sinistro_id?: string;
  protocolo_evento?: string;
  associado_nome?: string;
  placa?: string;
  advogado_nome?: string;
  prioridade?: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

export default function CasosJuridicosList() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterPrioridade, setFilterPrioridade] = useState('todos');

  // Buscar consultas jurídicas com sinistro_id
  const { data: consultas = [], isLoading: loadingConsultas } = useQuery({
    queryKey: ['casos-juridicos-consultas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consultas_juridicas')
        .select(`
          id, assunto, departamento, sinistro_id, prioridade, status, created_at, updated_at,
          sinistro:sinistros!consultas_juridicas_sinistro_id_fkey(protocolo, associado_id, veiculo_id,
            associado:associados!sinistros_associado_id_fkey(nome),
            veiculo:veiculos!sinistros_veiculo_id_fkey(placa)
          ),
          respondido_usuario:profiles!consultas_juridicas_respondido_por_fkey(nome)
        `)
        .not('sinistro_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((c: any) => ({
        id: c.id,
        _source: 'consulta' as const,
        assunto: c.assunto,
        departamento: c.departamento,
        sinistro_id: c.sinistro_id,
        protocolo_evento: c.sinistro?.protocolo,
        associado_nome: c.sinistro?.associado?.nome,
        placa: c.sinistro?.veiculo?.placa,
        advogado_nome: c.respondido_usuario?.nome,
        prioridade: c.prioridade,
        status: c.status,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    },
  });

  // Buscar processos com sinistro_id
  const { data: processos = [], isLoading: loadingProcessos } = useQuery({
    queryKey: ['casos-juridicos-processos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processos')
        .select(`
          id, numero, tipo, status, created_at, updated_at, sinistro_id,
          sinistro:sinistros(protocolo, associado_id, veiculo_id,
            associado:associados!sinistros_associado_id_fkey(nome),
            veiculo:veiculos!sinistros_veiculo_id_fkey(placa)
          )
        `)
        .not('sinistro_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.id,
        _source: 'processo' as const,
        numero: p.numero,
        assunto: p.tipo || '',
        tipo: p.tipo,
        sinistro_id: p.sinistro_id,
        protocolo_evento: p.sinistro?.protocolo,
        associado_nome: p.sinistro?.associado?.nome,
        placa: p.sinistro?.veiculo?.placa,
        prioridade: 'alta',
        status: p.status,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }));
    },
  });

  // Combinar e filtrar
  const casosUnificados = useMemo(() => {
    const todos: CasoUnificado[] = [...consultas, ...processos];

    // Ordenar: urgentes primeiro, depois por data
    const prioridadeOrder: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
    todos.sort((a, b) => {
      const pa = prioridadeOrder[a.prioridade || 'media'] ?? 2;
      const pb = prioridadeOrder[b.prioridade || 'media'] ?? 2;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return todos.filter(caso => {
      if (filterStatus !== 'todos' && caso.status !== filterStatus) return false;
      if (filterPrioridade !== 'todos' && caso.prioridade !== filterPrioridade) return false;
      if (filterTipo !== 'todos') {
        const badge = getTipoBadge(caso.assunto, caso.tipo);
        if (badge.label !== filterTipo) return false;
      }
      if (search) {
        const s = search.toLowerCase();
        const match = [caso.numero, caso.assunto, caso.associado_nome, caso.placa, caso.protocolo_evento]
          .filter(Boolean)
          .some(v => v!.toLowerCase().includes(s));
        if (!match) return false;
      }
      return true;
    });
  }, [consultas, processos, filterStatus, filterTipo, filterPrioridade, search]);

  const isLoading = loadingConsultas || loadingProcessos;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Casos Jurídicos</h1>
        <p className="text-muted-foreground">Casos originados de eventos e sindicâncias</p>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, nome, placa..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_analise">Em Análise</SelectItem>
                <SelectItem value="respondida">Respondida</SelectItem>
                <SelectItem value="arquivada">Arquivada</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="suspenso">Suspenso</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Tipos</SelectItem>
                <SelectItem value="Fraude">Fraude</SelectItem>
                <SelectItem value="Carta Cancel.">Carta Cancel.</SelectItem>
                <SelectItem value="Questão Legal">Questão Legal</SelectItem>
                <SelectItem value="Indenização">Indenização</SelectItem>
                <SelectItem value="Análise Técnica">Análise Técnica</SelectItem>
                <SelectItem value="Outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : casosUnificados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Briefcase className="h-12 w-12 mb-4 opacity-40" />
              <p>Nenhum caso jurídico encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caso</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Associado</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Advogado</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dias</TableHead>
                  <TableHead>Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {casosUnificados.map(caso => {
                  const tipoBadge = getTipoBadge(caso.assunto, caso.tipo);
                  const origemBadge = getOrigem(caso.departamento, caso.assunto, caso.tipo);
                  const diasAberto = differenceInDays(new Date(), new Date(caso.created_at));
                  const linkDetalhe = `/juridico/casos/${caso.id}`;

                  return (
                    <TableRow key={`${caso._source}-${caso.id}`}>
                      <TableCell>
                        <Link to={linkDetalhe} className="text-primary hover:underline font-medium text-sm">
                          {caso.numero || caso.assunto.slice(0, 25) + '...'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge className={tipoBadge.className}>{tipoBadge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={origemBadge.className}>{origemBadge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{caso.associado_nome || '-'}</TableCell>
                      <TableCell className="text-sm font-mono">{caso.placa || '-'}</TableCell>
                      <TableCell>
                        {caso.sinistro_id ? (
                          <Link to={`/eventos/sinistros/${caso.sinistro_id}`} className="text-primary hover:underline text-sm">
                            {caso.protocolo_evento || 'Ver'}
                          </Link>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{caso.advogado_nome || '-'}</TableCell>
                      <TableCell>
                        <Badge className={prioridadeBadge[caso.prioridade || 'media'] || ''}>
                          {caso.prioridade ? caso.prioridade.charAt(0).toUpperCase() + caso.prioridade.slice(1) : 'Média'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadge[caso.status] || ''}>
                          {statusLabels[caso.status] || caso.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{diasAberto}d</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {caso.updated_at ? format(new Date(caso.updated_at), 'dd/MM/yy', { locale: ptBR }) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
