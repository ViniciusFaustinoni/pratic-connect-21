import { useState, useMemo } from 'react';
import { Search, Download, Phone, MessageSquare, Handshake, X, Eye, Users, DollarSign, Clock, Calculator } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface Filters {
  faixa: string;
  busca: string;
  ordenar: string;
}

interface Inadimplente {
  id: string;
  nome: string;
  cpf: string;
  telefone: string;
  whatsapp: string | null;
  email: string;
  status: string;
  boletos: any[];
  valorTotal: number;
  vencimentoMaisAntigo: string;
  diasAtraso: number;
  qtdBoletos: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpfParcial = (cpf: string) => {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.***.**${clean.slice(8, 9)}-${clean.slice(9)}`;
};

const getDiasAtrasoBadge = (dias: number) => {
  if (dias <= 30) return 'bg-yellow-100 text-yellow-800';
  if (dias <= 60) return 'bg-orange-100 text-orange-800';
  if (dias <= 90) return 'bg-red-100 text-red-800';
  return 'bg-red-200 text-red-900';
};

const openWhatsApp = (numero: string) => {
  const limpo = numero.replace(/\D/g, '');
  const url = `https://wa.me/55${limpo}`;
  window.open(url, '_blank');
};

const InadimplentesList = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>({
    faixa: 'todos',
    busca: '',
    ordenar: 'dias'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const { data: inadimplentes, isLoading } = useQuery({
    queryKey: ['inadimplentes', filters],
    queryFn: async () => {
      const { data: cobrancas } = await supabase
        .from('cobrancas')
        .select(`
          id, valor_final, data_vencimento,
          associado:associados!inner(
            id, nome, cpf, telefone, whatsapp, email, status
          )
        `)
        .eq('status', 'vencido')
        .lt('data_vencimento', new Date().toISOString().split('T')[0])
        .order('data_vencimento');

      const agrupado = new Map<string, any>();
      cobrancas?.forEach((c: any) => {
        const assocId = c.associado.id;
        if (!agrupado.has(assocId)) {
          agrupado.set(assocId, {
            ...c.associado,
            boletos: [],
            valorTotal: 0,
            vencimentoMaisAntigo: c.data_vencimento
          });
        }
        const assoc = agrupado.get(assocId);
        assoc.boletos.push(c);
        assoc.valorTotal += c.valor_final || 0;
        if (c.data_vencimento < assoc.vencimentoMaisAntigo) {
          assoc.vencimentoMaisAntigo = c.data_vencimento;
        }
      });

      const lista: Inadimplente[] = Array.from(agrupado.values()).map(a => ({
        ...a,
        diasAtraso: Math.floor((new Date().getTime() - new Date(a.vencimentoMaisAntigo).getTime()) / (1000 * 60 * 60 * 24)),
        qtdBoletos: a.boletos.length
      }));

      let resultado = lista;

      if (filters.faixa && filters.faixa !== 'todos') {
        resultado = resultado.filter(a => {
          if (filters.faixa === 'ate30') return a.diasAtraso <= 30;
          if (filters.faixa === '31a60') return a.diasAtraso > 30 && a.diasAtraso <= 60;
          if (filters.faixa === '61a90') return a.diasAtraso > 60 && a.diasAtraso <= 90;
          if (filters.faixa === 'acima90') return a.diasAtraso > 90;
          return true;
        });
      }

      if (filters.busca) {
        const termo = filters.busca.toLowerCase();
        resultado = resultado.filter(a =>
          a.nome.toLowerCase().includes(termo) ||
          a.cpf?.includes(termo)
        );
      }

      return resultado.sort((a, b) => {
        if (filters.ordenar === 'valor') return b.valorTotal - a.valorTotal;
        if (filters.ordenar === 'dias') return b.diasAtraso - a.diasAtraso;
        return a.nome.localeCompare(b.nome);
      });
    }
  });

  const { data: ultimosContatos } = useQuery({
    queryKey: ['ultimos-contatos-inadimplentes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_contatos')
        .select('associado_id, created_at')
        .order('created_at', { ascending: false });

      const mapa = new Map<string, string>();
      data?.forEach(c => {
        if (!mapa.has(c.associado_id)) {
          mapa.set(c.associado_id, c.created_at);
        }
      });
      return mapa;
    }
  });

  const resumo = useMemo(() => {
    if (!inadimplentes || inadimplentes.length === 0) {
      return { total: 0, valorTotal: 0, mediaDias: 0, ticketMedio: 0 };
    }
    const total = inadimplentes.length;
    const valorTotal = inadimplentes.reduce((acc, a) => acc + a.valorTotal, 0);
    const mediaDias = Math.round(inadimplentes.reduce((acc, a) => acc + a.diasAtraso, 0) / total);
    const ticketMedio = valorTotal / total;
    return { total, valorTotal, mediaDias, ticketMedio };
  }, [inadimplentes]);

  const paginatedData = useMemo(() => {
    if (!inadimplentes) return [];
    const start = (currentPage - 1) * itemsPerPage;
    return inadimplentes.slice(start, start + itemsPerPage);
  }, [inadimplentes, currentPage]);

  const totalPages = Math.ceil((inadimplentes?.length || 0) / itemsPerPage);

  const clearFilters = () => {
    setFilters({ faixa: 'todos', busca: '', ordenar: 'dias' });
    setCurrentPage(1);
  };

  const getUltimoContato = (associadoId: string) => {
    const data = ultimosContatos?.get(associadoId);
    if (!data) return 'Nunca';
    return format(new Date(data), 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inadimplentes</h1>
          <p className="text-muted-foreground">Associados com boletos em atraso</p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Lista
        </Button>
      </div>

      {/* Cards Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Users className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Inadimplentes</p>
                <p className="text-2xl font-bold">{resumo.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <DollarSign className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total em Atraso</p>
                <p className="text-2xl font-bold">{formatCurrency(resumo.valorTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Média de Dias em Atraso</p>
                <p className="text-2xl font-bold">{resumo.mediaDias} dias</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calculator className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket Médio</p>
                <p className="text-2xl font-bold">{formatCurrency(resumo.ticketMedio)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={filters.busca}
                onChange={(e) => {
                  setFilters(f => ({ ...f, busca: e.target.value }));
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>

            <Select
              value={filters.faixa}
              onValueChange={(value) => {
                setFilters(f => ({ ...f, faixa: value }));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Faixa de Atraso" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Faixas</SelectItem>
                <SelectItem value="ate30">Até 30 dias</SelectItem>
                <SelectItem value="31a60">31-60 dias</SelectItem>
                <SelectItem value="61a90">61-90 dias</SelectItem>
                <SelectItem value="acima90">+90 dias</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.ordenar}
              onValueChange={(value) => setFilters(f => ({ ...f, ordenar: value }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dias">Dias de atraso</SelectItem>
                <SelectItem value="valor">Valor</SelectItem>
                <SelectItem value="nome">Nome</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Associado</TableHead>
                <TableHead>Telefone/WhatsApp</TableHead>
                <TableHead className="text-center">Boletos</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead className="text-center">Dias em Atraso</TableHead>
                <TableHead>Último Contato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-8 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-32 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum inadimplente encontrado
                  </TableCell>
                </TableRow>
              ) : (
                paginatedData.map((inadimplente) => (
                  <TableRow key={inadimplente.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{inadimplente.nome}</p>
                        <p className="text-sm text-muted-foreground">{formatCpfParcial(inadimplente.cpf)}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a
                        href={`tel:${inadimplente.telefone}`}
                        className="text-primary hover:underline"
                      >
                        {inadimplente.telefone}
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{inadimplente.qtdBoletos}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(inadimplente.valorTotal)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={getDiasAtrasoBadge(inadimplente.diasAtraso)}>
                        {inadimplente.diasAtraso} dias
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {getUltimoContato(inadimplente.id)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/cobranca/inadimplentes/${inadimplente.id}`)}
                          title="Ver detalhes"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          title="Ligar"
                        >
                          <a href={`tel:${inadimplente.telefone}`}>
                            <Phone className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openWhatsApp(inadimplente.whatsapp || inadimplente.telefone)}
                          title="WhatsApp"
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/cobranca/acordos/novo?associado=${inadimplente.id}`)}
                          title="Novo acordo"
                        >
                          <Handshake className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                {inadimplentes?.length || 0} registros encontrados
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InadimplentesList;
