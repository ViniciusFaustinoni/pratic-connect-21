import { useState, useMemo } from 'react';
import { AlertTriangle, Check, Download, Clock, DollarSign, Search, ShieldAlert, TrendingDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays, differenceInBusinessDays } from 'date-fns';
import { BaixarNegativacaoModal } from '@/components/cobranca/BaixarNegativacaoModal';
import { ConfirmarNegativacaoModal } from '@/components/cobranca/ConfirmarNegativacaoModal';
import { ptBR } from 'date-fns/locale';

interface Negativacao {
  id: string;
  associado_id: string;
  cobranca_id: string | null;
  orgao: string;
  valor: number;
  data_divida: string;
  status: string;
  data_negativacao: string | null;
  data_baixa: string | null;
  protocolo_envio: string | null;
  protocolo_baixa: string | null;
  motivo_baixa: string | null;
  associado: {
    nome: string;
    cpf: string;
  };
}

interface Candidato {
  id: string;
  valor_final: number;
  data_vencimento: string;
  associado: {
    id: string;
    nome: string;
    cpf: string;
  };
}

const VALOR_MINIMO_NEGATIVACAO = 200;

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const formatCPF = (cpf: string) => {
  return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '';
};

const getStatusBadge = (status: string) => {
  const map: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
    enviado: { label: 'Enviado', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
    negativado: { label: 'Negativado', className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
    baixado: { label: 'Baixado', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  };
  return map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
};

export default function Negativacao() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('negativados');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidatos, setSelectedCandidatos] = useState<string[]>([]);
  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [negativacaoSelecionada, setNegativacaoSelecionada] = useState<Negativacao | null>(null);
  const [orgaoLote, setOrgaoLote] = useState('SPC');
  const [confirmarLoteOpen, setConfirmarLoteOpen] = useState(false);

  // Negativações
  const { data: negativacoes = [] } = useQuery({
    queryKey: ['negativacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negativacoes')
        .select(`*, associado:associados(nome, cpf)`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Negativacao[];
    }
  });

  // Candidatos (30+ dias)
  const { data: candidatos = [] } = useQuery({
    queryKey: ['candidatos-negativacao'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      const { data, error } = await supabase
        .from('cobrancas')
        .select(`id, valor_final, data_vencimento, associado:associados!inner(id, nome, cpf)`)
        .eq('status', 'vencido')
        .lt('data_vencimento', dataLimite.toISOString().split('T')[0])
        .limit(100);
      if (error) throw error;
      return data as Candidato[];
    }
  });

  // Contatos por associado (para validação de pré-requisitos)
  const { data: contatosPorAssociado } = useQuery({
    queryKey: ['contatos-por-associado-neg'],
    queryFn: async () => {
      const { data } = await supabase
        .from('cobranca_contatos')
        .select('associado_id, tipo')
        .in('tipo', ['whatsapp', 'ligacao']);
      const mapa = new Map<string, { whatsapp: boolean; ligacao: boolean }>();
      data?.forEach(c => {
        if (!mapa.has(c.associado_id)) mapa.set(c.associado_id, { whatsapp: false, ligacao: false });
        const entry = mapa.get(c.associado_id)!;
        if (c.tipo === 'whatsapp') entry.whatsapp = true;
        if (c.tipo === 'ligacao') entry.ligacao = true;
      });
      return mapa;
    }
  });

  // Stats
  const stats = useMemo(() => {
    const negativadosAtivos = negativacoes.filter(n => n.status === 'negativado');
    const pendentes = negativacoes.filter(n => n.status === 'pendente' || n.status === 'enviado');
    const baixados = negativacoes.filter(n => n.status === 'baixado');

    // Baixas pendentes: negativados cujo associado já pagou (simplificado: verificar se existem negativados sem data_baixa)
    const baixasPendentes = negativacoes.filter(n => n.status === 'negativado' && !n.data_baixa);

    // Baixas pendentes há mais de 3 dias úteis
    const hoje = new Date();
    const baixasUrgentes = baixasPendentes.filter(n => {
      if (!n.data_negativacao) return false;
      return differenceInBusinessDays(hoje, new Date(n.data_negativacao)) > 3;
    });

    // Negativados que pagaram este mês (baixados no mês)
    const inicioMes = format(new Date(), 'yyyy-MM-01');
    const pagaramMes = baixados.filter(n => n.data_baixa && n.data_baixa >= inicioMes).length;

    return {
      pendentes: pendentes.length,
      negativados: negativadosAtivos.length,
      baixados: baixados.length,
      valorTotal: negativadosAtivos.reduce((acc, n) => acc + (n.valor || 0), 0),
      baixasPendentes: baixasPendentes.length,
      baixasUrgentes: baixasUrgentes.length,
      pagaramMes,
    };
  }, [negativacoes]);

  // Validação de pré-requisitos
  const validarPreRequisitos = (associadoId: string, valor: number, diasAtraso: number) => {
    const erros: string[] = [];
    if (diasAtraso < 30) erros.push(`Dias de atraso: ${diasAtraso} (mínimo 30)`);
    if (valor < VALOR_MINIMO_NEGATIVACAO) erros.push(`Valor: ${formatCurrency(valor)} (mínimo ${formatCurrency(VALOR_MINIMO_NEGATIVACAO)})`);
    const contatos = contatosPorAssociado?.get(associadoId);
    if (!contatos?.whatsapp && !contatos?.ligacao) erros.push('Nenhum contato registrado (WhatsApp ou ligação)');
    return erros;
  };

  // Mutations
  const negativar = useMutation({
    mutationFn: async ({ associadoId, cobrancaId, valor, orgao }: { associadoId: string; cobrancaId: string; valor: number; orgao: string }) => {
      const user = await supabase.auth.getUser();
      const { error } = await supabase.from('negativacoes').insert({
        associado_id: associadoId, cobranca_id: cobrancaId, orgao, valor,
        data_divida: new Date().toISOString().split('T')[0], status: 'pendente', enviado_por: user.data.user?.id
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Negativação registrada'); queryClient.invalidateQueries({ queryKey: ['negativacoes'] }); queryClient.invalidateQueries({ queryKey: ['candidatos-negativacao'] }); },
    onError: () => { toast.error('Erro ao registrar negativação'); }
  });

  const negativarLote = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      const selecionados = candidatos.filter(c => selectedCandidatos.includes(c.id));
      const inserts = selecionados.map(c => ({
        associado_id: c.associado.id, cobranca_id: c.id, orgao: orgaoLote, valor: c.valor_final,
        data_divida: new Date().toISOString().split('T')[0], status: 'pendente', enviado_por: user.data.user?.id
      }));
      const { error } = await supabase.from('negativacoes').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => { toast.success(`${selectedCandidatos.length} negativações registradas`); setSelectedCandidatos([]); setConfirmarLoteOpen(false); queryClient.invalidateQueries({ queryKey: ['negativacoes'] }); queryClient.invalidateQueries({ queryKey: ['candidatos-negativacao'] }); },
    onError: () => { toast.error('Erro ao registrar negativações em lote'); }
  });

  const handleOpenBaixa = (neg: Negativacao) => { setNegativacaoSelecionada(neg); setBaixaModalOpen(true); };
  const handleCloseBaixa = () => { setBaixaModalOpen(false); setNegativacaoSelecionada(null); };
  const toggleCandidato = (id: string) => setSelectedCandidatos(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  const toggleAllCandidatos = () => setSelectedCandidatos(prev => prev.length === candidatos.length ? [] : candidatos.map(c => c.id));

  const filteredNegativacoes = (status: string[]) =>
    negativacoes.filter(n => status.includes(n.status)).filter(n =>
      !searchTerm || n.associado?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) || n.associado?.cpf?.includes(searchTerm)
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Negativação</h1>
          <p className="text-muted-foreground">Gestão de SPC/Serasa</p>
        </div>
      </div>

      {/* Alerta de prazo legal */}
      {stats.baixasUrgentes > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>⚠️ Risco Legal — Baixas Pendentes</AlertTitle>
          <AlertDescription>
            {stats.baixasUrgentes} baixa(s) pendente(s) há mais de 3 dias úteis. A lei obriga a baixar em 5 dias úteis após pagamento. Risco de multa.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards KPI — 6 cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900"><Clock className="h-5 w-5 text-yellow-800 dark:text-yellow-300" /></div>
              <div><p className="text-sm text-muted-foreground">Pendentes</p><p className="text-2xl font-bold">{stats.pendentes}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900"><AlertTriangle className="h-5 w-5 text-red-800 dark:text-red-300" /></div>
              <div><p className="text-sm text-muted-foreground">Negativados</p><p className="text-2xl font-bold">{stats.negativados}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900"><Check className="h-5 w-5 text-green-800 dark:text-green-300" /></div>
              <div><p className="text-sm text-muted-foreground">Baixados</p><p className="text-2xl font-bold">{stats.baixados}</p></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
              <div><p className="text-sm text-muted-foreground">Valor Total</p><p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p></div>
            </div>
          </CardContent>
        </Card>
        {/* Novo: Baixas Pendentes */}
        <Card className={stats.baixasPendentes > 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stats.baixasPendentes > 0 ? 'bg-red-100 dark:bg-red-900' : 'bg-muted'}`}>
                <Download className={`h-5 w-5 ${stats.baixasPendentes > 0 ? 'text-red-800 dark:text-red-300' : 'text-muted-foreground'}`} />
              </div>
              <div><p className="text-sm text-muted-foreground">Baixas Pend.</p><p className="text-2xl font-bold">{stats.baixasPendentes}</p></div>
            </div>
          </CardContent>
        </Card>
        {/* Novo: Pagaram no Mês */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900"><TrendingDown className="h-5 w-5 text-emerald-800 dark:text-emerald-300" /></div>
              <div><p className="text-sm text-muted-foreground">Pagaram Mês</p><p className="text-2xl font-bold">{stats.pagaramMes}</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CPF..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="negativados">Negativados</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="candidatos">Candidatos{candidatos.length > 0 && <Badge variant="secondary" className="ml-2">{candidatos.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="baixados">Baixados</TabsTrigger>
        </TabsList>

        {/* Tab: Negativados */}
        <TabsContent value="negativados">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Associado</TableHead><TableHead>CPF</TableHead><TableHead>Órgão</TableHead><TableHead>Valor</TableHead><TableHead>Data</TableHead><TableHead>Protocolo</TableHead><TableHead className="text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredNegativacoes(['negativado']).map((neg) => (
                  <TableRow key={neg.id}>
                    <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                    <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                    <TableCell><Badge variant="outline">{neg.orgao}</Badge></TableCell>
                    <TableCell>{formatCurrency(neg.valor)}</TableCell>
                    <TableCell>{neg.data_negativacao && format(new Date(neg.data_negativacao), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell>{neg.protocolo_envio || '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => handleOpenBaixa(neg)}><Download className="h-4 w-4 mr-1" />Baixar</Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredNegativacoes(['negativado']).length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma negativação encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Tab: Pendentes */}
        <TabsContent value="pendentes">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Associado</TableHead><TableHead>CPF</TableHead><TableHead>Órgão</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Data Dívida</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredNegativacoes(['pendente', 'enviado']).map((neg) => {
                  const status = getStatusBadge(neg.status);
                  return (
                    <TableRow key={neg.id}>
                      <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                      <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                      <TableCell><Badge variant="outline">{neg.orgao}</Badge></TableCell>
                      <TableCell>{formatCurrency(neg.valor)}</TableCell>
                      <TableCell><Badge className={status.className}>{status.label}</Badge></TableCell>
                      <TableCell>{neg.data_divida && format(new Date(neg.data_divida), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    </TableRow>
                  );
                })}
                {filteredNegativacoes(['pendente', 'enviado']).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma negativação pendente</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Tab: Candidatos com validação */}
        <TabsContent value="candidatos">
          <Card><CardContent className="pt-6">
            <TooltipProvider>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"><Checkbox checked={selectedCandidatos.length === candidatos.length && candidatos.length > 0} onCheckedChange={toggleAllCandidatos} /></TableHead>
                  <TableHead>Associado</TableHead><TableHead>CPF</TableHead><TableHead>Valor Dívida</TableHead><TableHead>Dias Atraso</TableHead><TableHead>Pré-Req.</TableHead><TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {candidatos.map((cand) => {
                    const diasAtraso = differenceInDays(new Date(), new Date(cand.data_vencimento));
                    const erros = validarPreRequisitos(cand.associado.id, cand.valor_final, diasAtraso);
                    const aprovado = erros.length === 0;
                    return (
                      <TableRow key={cand.id}>
                        <TableCell><Checkbox checked={selectedCandidatos.includes(cand.id)} onCheckedChange={() => toggleCandidato(cand.id)} /></TableCell>
                        <TableCell className="font-medium">{cand.associado?.nome}</TableCell>
                        <TableCell>{formatCPF(cand.associado?.cpf)}</TableCell>
                        <TableCell>{formatCurrency(cand.valor_final)}</TableCell>
                        <TableCell><Badge variant="destructive">{diasAtraso} dias</Badge></TableCell>
                        <TableCell>
                          {aprovado ? (
                            <Badge className="bg-green-100 text-green-800">✓ OK</Badge>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="secondary" className="cursor-help">✗ {erros.length} pendência(s)</Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <ul className="text-xs space-y-1">
                                  {erros.map((e, i) => <li key={i}>• {e}</li>)}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="destructive" disabled={!aprovado || negativar.isPending}
                            onClick={() => negativar.mutate({ associadoId: cand.associado.id, cobrancaId: cand.id, valor: cand.valor_final, orgao: 'SPC' })}>
                            <AlertTriangle className="h-4 w-4 mr-1" />Negativar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {candidatos.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum candidato a negativação</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </CardContent></Card>

          {selectedCandidatos.length > 0 && (
            <Card className="mt-4"><CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="font-medium">{selectedCandidatos.length} selecionado(s)</span>
                <div className="flex items-center gap-3">
                  <Select value={orgaoLote} onValueChange={setOrgaoLote}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SPC">SPC</SelectItem><SelectItem value="Serasa">Serasa</SelectItem><SelectItem value="Ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="destructive" onClick={() => setConfirmarLoteOpen(true)} disabled={negativarLote.isPending}>
                    <AlertTriangle className="h-4 w-4 mr-2" />Negativar Selecionados
                  </Button>
                </div>
              </div>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* Tab: Baixados */}
        <TabsContent value="baixados">
          <Card><CardContent className="pt-6">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Associado</TableHead><TableHead>CPF</TableHead><TableHead>Órgão</TableHead><TableHead>Valor</TableHead><TableHead>Data Baixa</TableHead><TableHead>Motivo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filteredNegativacoes(['baixado']).map((neg) => (
                  <TableRow key={neg.id}>
                    <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                    <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                    <TableCell><Badge variant="outline">{neg.orgao}</Badge></TableCell>
                    <TableCell>{formatCurrency(neg.valor)}</TableCell>
                    <TableCell>{neg.data_baixa && format(new Date(neg.data_baixa), 'dd/MM/yyyy', { locale: ptBR })}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{neg.motivo_baixa || '-'}</TableCell>
                  </TableRow>
                ))}
                {filteredNegativacoes(['baixado']).length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma negativação baixada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <BaixarNegativacaoModal open={baixaModalOpen} onClose={handleCloseBaixa} negativacao={negativacaoSelecionada} />
      <ConfirmarNegativacaoModal open={confirmarLoteOpen} onClose={() => setConfirmarLoteOpen(false)} onConfirm={() => negativarLote.mutate()}
        quantidade={selectedCandidatos.length} valorTotal={candidatos.filter(c => selectedCandidatos.includes(c.id)).reduce((acc, c) => acc + (c.valor_final || 0), 0)} isPending={negativarLote.isPending} />
    </div>
  );
}
