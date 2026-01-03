import { useState } from 'react';
import { AlertTriangle, Check, X, Download, Clock, DollarSign, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
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
  const [motivoBaixa, setMotivoBaixa] = useState('');
  const [protocoloBaixa, setProtocoloBaixa] = useState('');
  const [orgaoLote, setOrgaoLote] = useState('SPC');

  // Query: Negativações
  const { data: negativacoes = [], isLoading: loadingNegativacoes } = useQuery({
    queryKey: ['negativacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('negativacoes')
        .select(`
          *,
          associado:associados(nome, cpf)
        `)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Negativacao[];
    }
  });

  // Query: Candidatos a negativação (vencidos há mais de 60 dias)
  const { data: candidatos = [], isLoading: loadingCandidatos } = useQuery({
    queryKey: ['candidatos-negativacao'],
    queryFn: async () => {
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - 60);
      
      const { data, error } = await supabase
        .from('cobrancas')
        .select(`
          id, valor_final, data_vencimento,
          associado:associados!inner(id, nome, cpf)
        `)
        .eq('status', 'vencido')
        .lt('data_vencimento', dataLimite.toISOString().split('T')[0])
        .limit(100);
      
      if (error) throw error;
      return data as Candidato[];
    }
  });

  // Stats
  const stats = {
    pendentes: negativacoes.filter(n => n.status === 'pendente' || n.status === 'enviado').length,
    negativados: negativacoes.filter(n => n.status === 'negativado').length,
    baixados: negativacoes.filter(n => n.status === 'baixado').length,
    valorTotal: negativacoes.filter(n => n.status === 'negativado').reduce((acc, n) => acc + (n.valor || 0), 0),
  };

  // Mutation: Negativar
  const negativar = useMutation({
    mutationFn: async ({ associadoId, cobrancaId, valor, orgao }: { associadoId: string; cobrancaId: string; valor: number; orgao: string }) => {
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('negativacoes')
        .insert({
          associado_id: associadoId,
          cobranca_id: cobrancaId,
          orgao: orgao,
          valor: valor,
          data_divida: new Date().toISOString().split('T')[0],
          status: 'pendente',
          enviado_por: user.data.user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Negativação registrada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['negativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['candidatos-negativacao'] });
    },
    onError: () => {
      toast.error('Erro ao registrar negativação');
    }
  });

  // Mutation: Negativar em Lote
  const negativarLote = useMutation({
    mutationFn: async () => {
      const user = await supabase.auth.getUser();
      const candidatosSelecionados = candidatos.filter(c => selectedCandidatos.includes(c.id));
      
      const inserts = candidatosSelecionados.map(c => ({
        associado_id: c.associado.id,
        cobranca_id: c.id,
        orgao: orgaoLote,
        valor: c.valor_final,
        data_divida: new Date().toISOString().split('T')[0],
        status: 'pendente',
        enviado_por: user.data.user?.id
      }));
      
      const { error } = await supabase.from('negativacoes').insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${selectedCandidatos.length} negativações registradas`);
      setSelectedCandidatos([]);
      queryClient.invalidateQueries({ queryKey: ['negativacoes'] });
      queryClient.invalidateQueries({ queryKey: ['candidatos-negativacao'] });
    },
    onError: () => {
      toast.error('Erro ao registrar negativações em lote');
    }
  });

  // Mutation: Baixar Negativação
  const baixarNegativacao = useMutation({
    mutationFn: async () => {
      if (!negativacaoSelecionada) return;
      
      const user = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('negativacoes')
        .update({
          status: 'baixado',
          data_baixa: new Date().toISOString(),
          protocolo_baixa: protocoloBaixa || null,
          motivo_baixa: motivoBaixa,
          baixado_por: user.data.user?.id
        })
        .eq('id', negativacaoSelecionada.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Negativação baixada com sucesso');
      setBaixaModalOpen(false);
      setNegativacaoSelecionada(null);
      setMotivoBaixa('');
      setProtocoloBaixa('');
      queryClient.invalidateQueries({ queryKey: ['negativacoes'] });
    },
    onError: () => {
      toast.error('Erro ao baixar negativação');
    }
  });

  const handleOpenBaixa = (neg: Negativacao) => {
    setNegativacaoSelecionada(neg);
    setBaixaModalOpen(true);
  };

  const toggleCandidato = (id: string) => {
    setSelectedCandidatos(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleAllCandidatos = () => {
    if (selectedCandidatos.length === candidatos.length) {
      setSelectedCandidatos([]);
    } else {
      setSelectedCandidatos(candidatos.map(c => c.id));
    }
  };

  const filteredNegativacoes = (status: string[]) => {
    return negativacoes
      .filter(n => status.includes(n.status))
      .filter(n => 
        !searchTerm || 
        n.associado?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.associado?.cpf?.includes(searchTerm)
      );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Negativação</h1>
          <p className="text-muted-foreground">Gestão de SPC/Serasa</p>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold">{stats.pendentes}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Negativados</p>
                <p className="text-2xl font-bold">{stats.negativados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Baixados</p>
                <p className="text-2xl font-bold">{stats.baixados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.valorTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou CPF..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="negativados">Negativados</TabsTrigger>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="candidatos">
            Candidatos
            {candidatos.length > 0 && (
              <Badge variant="secondary" className="ml-2">{candidatos.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="baixados">Baixados</TabsTrigger>
        </TabsList>

        {/* Tab: Negativados */}
        <TabsContent value="negativados">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Protocolo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNegativacoes(['negativado']).map((neg) => (
                    <TableRow key={neg.id}>
                      <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                      <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{neg.orgao}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(neg.valor)}</TableCell>
                      <TableCell>
                        {neg.data_negativacao && format(new Date(neg.data_negativacao), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell>{neg.protocolo_envio || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleOpenBaixa(neg)}>
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredNegativacoes(['negativado']).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma negativação encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pendentes */}
        <TabsContent value="pendentes">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data Dívida</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNegativacoes(['pendente', 'enviado']).map((neg) => {
                    const status = getStatusBadge(neg.status);
                    return (
                      <TableRow key={neg.id}>
                        <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                        <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{neg.orgao}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(neg.valor)}</TableCell>
                        <TableCell>
                          <Badge className={status.className}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {neg.data_divida && format(new Date(neg.data_divida), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredNegativacoes(['pendente', 'enviado']).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma negativação pendente
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Candidatos */}
        <TabsContent value="candidatos">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedCandidatos.length === candidatos.length && candidatos.length > 0}
                        onCheckedChange={toggleAllCandidatos}
                      />
                    </TableHead>
                    <TableHead>Associado</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Valor Dívida</TableHead>
                    <TableHead>Dias Atraso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidatos.map((cand) => {
                    const diasAtraso = differenceInDays(new Date(), new Date(cand.data_vencimento));
                    return (
                      <TableRow key={cand.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedCandidatos.includes(cand.id)}
                            onCheckedChange={() => toggleCandidato(cand.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{cand.associado?.nome}</TableCell>
                        <TableCell>{formatCPF(cand.associado?.cpf)}</TableCell>
                        <TableCell>{formatCurrency(cand.valor_final)}</TableCell>
                        <TableCell>
                          <Badge variant="destructive">{diasAtraso} dias</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => negativar.mutate({
                              associadoId: cand.associado.id,
                              cobrancaId: cand.id,
                              valor: cand.valor_final,
                              orgao: 'SPC'
                            })}
                            disabled={negativar.isPending}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Negativar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {candidatos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum candidato a negativação
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Footer Lote */}
          {selectedCandidatos.length > 0 && (
            <Card className="mt-4">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <span className="font-medium">
                    {selectedCandidatos.length} selecionado(s)
                  </span>
                  <div className="flex items-center gap-3">
                    <Select value={orgaoLote} onValueChange={setOrgaoLote}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SPC">SPC</SelectItem>
                        <SelectItem value="Serasa">Serasa</SelectItem>
                        <SelectItem value="Ambos">Ambos</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      onClick={() => negativarLote.mutate()}
                      disabled={negativarLote.isPending}
                    >
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Negativar Selecionados
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Baixados */}
        <TabsContent value="baixados">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Associado</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Órgão</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Data Baixa</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNegativacoes(['baixado']).map((neg) => (
                    <TableRow key={neg.id}>
                      <TableCell className="font-medium">{neg.associado?.nome}</TableCell>
                      <TableCell>{formatCPF(neg.associado?.cpf)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{neg.orgao}</Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(neg.valor)}</TableCell>
                      <TableCell>
                        {neg.data_baixa && format(new Date(neg.data_baixa), 'dd/MM/yyyy', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{neg.motivo_baixa || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredNegativacoes(['baixado']).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma negativação baixada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal Baixar Negativação */}
      <Dialog open={baixaModalOpen} onOpenChange={setBaixaModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Baixar Negativação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {negativacaoSelecionada && (
              <div className="p-3 rounded-lg bg-muted">
                <p className="font-medium">{negativacaoSelecionada.associado?.nome}</p>
                <p className="text-sm text-muted-foreground">
                  CPF: {formatCPF(negativacaoSelecionada.associado?.cpf)} | 
                  Valor: {formatCurrency(negativacaoSelecionada.valor)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo da Baixa</Label>
              <Select value={motivoBaixa} onValueChange={setMotivoBaixa}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pagamento">Pagamento Efetuado</SelectItem>
                  <SelectItem value="acordo">Acordo Realizado</SelectItem>
                  <SelectItem value="cancelamento">Cancelamento do Contrato</SelectItem>
                  <SelectItem value="erro">Erro de Cadastro</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Protocolo de Baixa (opcional)</Label>
              <Input
                value={protocoloBaixa}
                onChange={(e) => setProtocoloBaixa(e.target.value)}
                placeholder="Número do protocolo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaModalOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => baixarNegativacao.mutate()}
              disabled={!motivoBaixa || baixarNegativacao.isPending}
            >
              Confirmar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
