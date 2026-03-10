import { useState, useMemo, useCallback } from 'react';
import { useConfiguracaoNumero } from '@/hooks/useConteudosSistema';
import { ArrowLeft, Phone, MessageSquare, Mail, Handshake, AlertCircle, User, Car, Clock, DollarSign, MoreVertical, AlertTriangle, Ban, Save, FileText, Plus, Gavel, UserX, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, useNavigate } from 'react-router-dom';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { RegistrarContatoModal } from '@/components/cobranca/RegistrarContatoModal';
import { TimelineUnificada } from '@/components/cobranca/TimelineUnificada';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatCpf = (cpf: string) => {
  const clean = cpf?.replace(/\D/g, '') || '';
  if (clean.length !== 11) return cpf;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
};

const formatTelefone = (tel: string) => {
  const clean = tel?.replace(/\D/g, '') || '';
  if (clean.length === 11) return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  if (clean.length === 10) return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  return tel;
};

const getDiasAtrasoBadge = (dias: number) => {
  if (dias <= 5) return 'bg-blue-100 text-blue-800';
  if (dias <= 30) return 'bg-yellow-100 text-yellow-800';
  if (dias <= 60) return 'bg-orange-100 text-orange-800';
  if (dias <= 90) return 'bg-red-100 text-red-800';
  return 'bg-red-200 text-red-900';
};

const getAcordoStatusBadge = (status: string) => {
  const map: Record<string, string> = {
    'ativo': 'bg-blue-100 text-blue-800',
    'quitado': 'bg-green-100 text-green-800',
    'quebrado': 'bg-red-100 text-red-800',
    'cancelado': 'bg-gray-100 text-gray-600',
  };
  return map[status] || 'bg-gray-100 text-gray-600';
};

const openWhatsApp = (numero: string) => {
  const limpo = numero?.replace(/\D/g, '') || '';
  window.open(`https://wa.me/55${limpo}`, '_blank');
};

/** Calcula valor atualizado: principal + multa + juros pro rata (valores do banco) */
const calcValorAtualizado = (valor: number, diasAtraso: number, percMulta: number, percJuros: number) => {
  const multa = valor * percMulta;
  const juros = valor * percJuros * (diasAtraso / 30);
  return valor + multa + juros;
};

const InadimplenteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedBoletos, setSelectedBoletos] = useState<string[]>([]);
  const [anotacao, setAnotacao] = useState('');
  const [contatoModalOpen, setContatoModalOpen] = useState(false);
  const { data: percMulta = 0.02 } = useConfiguracaoNumero('multa_inadimplencia', 0.02);
  const { data: percJuros = 0.01 } = useConfiguracaoNumero('juros_mes_inadimplencia', 0.01);

  const { data: associado, isLoading: loadingAssociado } = useQuery({
    queryKey: ['associado-cobranca', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('associados').select(`*, veiculos(id, placa, marca, modelo)`).eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id
  });

  const { data: cobrancas, isLoading: loadingCobrancas } = useQuery({
    queryKey: ['cobrancas-inadimplente', id],
    queryFn: async () => {
      const { data } = await supabase.from('cobrancas').select('*').eq('associado_id', id).eq('status', 'vencido').order('data_vencimento');
      return data || [];
    },
    enabled: !!id
  });

  const { data: acordos } = useQuery({
    queryKey: ['acordos-associado', id],
    queryFn: async () => {
      const { data } = await supabase.from('acordos').select('*').eq('associado_id', id).order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!id
  });

  const resumo = useMemo(() => {
    if (!cobrancas || cobrancas.length === 0) return { diasMaximo: 0, qtdBoletos: 0, valorTotal: 0, valorAtualizado: 0 };
    const hoje = new Date();
    let diasMaximo = 0, valorTotal = 0, valorAtualizado = 0;
    cobrancas.forEach(c => {
      const dias = differenceInDays(hoje, new Date(c.data_vencimento));
      if (dias > diasMaximo) diasMaximo = dias;
      valorTotal += c.valor_final || 0;
      valorAtualizado += calcValorAtualizado(c.valor_final || 0, dias, percMulta, percJuros);
    });
    return { diasMaximo, qtdBoletos: cobrancas.length, valorTotal, valorAtualizado };
  }, [cobrancas]);

  const toggleBoleto = (boletoId: string) => {
    setSelectedBoletos(prev => prev.includes(boletoId) ? prev.filter(id => id !== boletoId) : [...prev, boletoId]);
  };

  const valorSelecionado = useMemo(() => {
    if (!cobrancas) return 0;
    return cobrancas.filter(c => selectedBoletos.includes(c.id)).reduce((acc, c) => acc + (c.valor_final || 0), 0);
  }, [cobrancas, selectedBoletos]);

  if (loadingAssociado || loadingCobrancas) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><Skeleton className="h-96" /><Skeleton className="h-96" /><Skeleton className="h-96" /></div>
      </div>
    );
  }

  if (!associado) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Associado não encontrado</p>
        <Button variant="outline" onClick={() => navigate('/cobranca/inadimplentes')} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/cobranca/inadimplentes')}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{associado.nome}</h1>
              <Badge variant="destructive">Inadimplente</Badge>
            </div>
            <p className="text-muted-foreground">{formatCpf(associado.cpf)}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><MoreVertical className="h-4 w-4 mr-2" />Ações</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><a href={`tel:${associado.telefone}`}><Phone className="h-4 w-4 mr-2" />Ligar</a></DropdownMenuItem>
            <DropdownMenuItem onClick={() => openWhatsApp(associado.whatsapp || associado.telefone)}><MessageSquare className="h-4 w-4 mr-2" />WhatsApp</DropdownMenuItem>
            <DropdownMenuItem asChild><a href={`mailto:${associado.email}`}><Mail className="h-4 w-4 mr-2" />E-mail</a></DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={selectedBoletos.length === 0} onClick={() => navigate(`/cobranca/acordos/novo?associado=${id}&boletos=${selectedBoletos.join(',')}`)}>
              <Handshake className="h-4 w-4 mr-2" />Criar Acordo
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Funcionalidade de 2ª via em desenvolvimento')}>
              <Receipt className="h-4 w-4 mr-2" />Gerar 2ª Via
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive"><AlertCircle className="h-4 w-4 mr-2" />Negativar</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Encaminhamento ao jurídico em desenvolvimento')}>
              <Gavel className="h-4 w-4 mr-2" />Encaminhar Jurídico
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.info('Exclusão do quadro requer aprovação da diretoria')}>
              <UserX className="h-4 w-4 mr-2" />Excluir do Quadro
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Alerta sem contato */}
      {resumo.diasMaximo > 15 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Boleto mais antigo com {resumo.diasMaximo} dias de atraso
          </AlertDescription>
        </Alert>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1 — Dados */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4" />Dados do Associado</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Nome:</span><p className="font-medium">{associado.nome}</p></div>
              <div><span className="text-muted-foreground">CPF:</span><p className="font-medium">{formatCpf(associado.cpf)}</p></div>
              <div className="flex items-center justify-between">
                <div><span className="text-muted-foreground">Telefone:</span><p className="font-medium">{formatTelefone(associado.telefone)}</p></div>
                <Button variant="ghost" size="icon" asChild><a href={`tel:${associado.telefone}`}><Phone className="h-4 w-4" /></a></Button>
              </div>
              {associado.whatsapp && (
                <div className="flex items-center justify-between">
                  <div><span className="text-muted-foreground">WhatsApp:</span><p className="font-medium">{formatTelefone(associado.whatsapp)}</p></div>
                  <Button variant="ghost" size="icon" onClick={() => openWhatsApp(associado.whatsapp)}><MessageSquare className="h-4 w-4" /></Button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div><span className="text-muted-foreground">E-mail:</span><p className="font-medium truncate max-w-[180px]">{associado.email}</p></div>
                <Button variant="ghost" size="icon" asChild><a href={`mailto:${associado.email}`}><Mail className="h-4 w-4" /></a></Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Car className="h-4 w-4" />Veículo(s)</CardTitle></CardHeader>
            <CardContent>
              {associado.veiculos && associado.veiculos.length > 0 ? (
                <div className="space-y-2">
                  {associado.veiculos.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between text-sm">
                      <span className="font-mono font-medium">{v.placa}</span>
                      <span className="text-muted-foreground">{v.marca} {v.modelo}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Nenhum veículo cadastrado</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" />Situação Financeira</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Dias em atraso (máx):</span>
                <Badge className={getDiasAtrasoBadge(resumo.diasMaximo)}>{resumo.diasMaximo} dias</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Boletos vencidos:</span>
                <Badge variant="secondary">{resumo.qtdBoletos}</Badge>
              </div>
              <Separator />
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Valor Original</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(resumo.valorTotal)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Valor Atualizado (multa + juros)</p>
                <p className="text-xl font-bold">{formatCurrency(resumo.valorAtualizado)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 2 — Boletos + Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Boletos em Atraso</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Ref.</TableHead>
                    <TableHead className="text-right">Original</TableHead>
                    <TableHead className="text-right">Atualizado</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cobrancas && cobrancas.length > 0 ? (
                    cobrancas.map(c => {
                      const dias = differenceInDays(new Date(), new Date(c.data_vencimento));
                      const atualizado = calcValorAtualizado(c.valor_final || 0, dias, percMulta, percJuros);
                      return (
                        <TableRow key={c.id}>
                          <TableCell><Checkbox checked={selectedBoletos.includes(c.id)} onCheckedChange={() => toggleBoleto(c.id)} /></TableCell>
                          <TableCell className="text-sm">{c.referencia_mes?.toString().padStart(2, '0')}/{c.referencia_ano}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(c.valor_final)}</TableCell>
                          <TableCell className="text-right text-sm font-medium text-destructive">{formatCurrency(atualizado)}</TableCell>
                          <TableCell className="text-center"><Badge className={getDiasAtrasoBadge(dias)} variant="secondary">{dias}</Badge></TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Nenhum boleto vencido</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
            {selectedBoletos.length > 0 && (
              <CardFooter className="bg-muted/50 border-t">
                <div className="w-full flex items-center justify-between text-sm">
                  <span>{selectedBoletos.length} boleto(s) selecionado(s)</span>
                  <span className="font-medium">{formatCurrency(valorSelecionado)}</span>
                </div>
              </CardFooter>
            )}
          </Card>

          {/* Timeline Unificada */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" />Timeline de Cobrança</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setContatoModalOpen(true)}><Plus className="h-4 w-4 mr-1" />Registrar Contato</Button>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <TimelineUnificada associadoId={id || ''} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3 — Ações */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Ações de Cobrança</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" asChild><a href={`tel:${associado.telefone}`}><Phone className="h-4 w-4 mr-2" />Ligar Agora</a></Button>
              <Button variant="outline" className="w-full" onClick={() => openWhatsApp(associado.whatsapp || associado.telefone)}><MessageSquare className="h-4 w-4 mr-2" />Enviar WhatsApp</Button>
              <Button variant="outline" className="w-full" asChild><a href={`mailto:${associado.email}`}><Mail className="h-4 w-4 mr-2" />Enviar E-mail</a></Button>
              <Button variant="outline" className="w-full" disabled={selectedBoletos.length === 0} onClick={() => navigate(`/cobranca/acordos/novo?associado=${id}&boletos=${selectedBoletos.join(',')}`)}>
                <Handshake className="h-4 w-4 mr-2" />Criar Acordo {selectedBoletos.length > 0 && `(${selectedBoletos.length})`}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => toast.info('2ª via com multa e juros em desenvolvimento')}>
                <Receipt className="h-4 w-4 mr-2" />Gerar 2ª Via
              </Button>
              <Separator />
              <Button variant="outline" className="w-full text-destructive hover:text-destructive"><Ban className="h-4 w-4 mr-2" />Negativar</Button>
              <Button variant="outline" className="w-full" onClick={() => toast.info('Encaminhamento ao jurídico em desenvolvimento')}>
                <Gavel className="h-4 w-4 mr-2" />Encaminhar Jurídico
              </Button>
              <Button variant="outline" className="w-full" onClick={() => toast.info('Exclusão requer aprovação da diretoria')}>
                <UserX className="h-4 w-4 mr-2" />Excluir do Quadro
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Handshake className="h-4 w-4" />Acordos</CardTitle></CardHeader>
            <CardContent>
              {acordos && acordos.length > 0 ? (
                <div className="space-y-3">
                  {acordos.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted" onClick={() => navigate(`/cobranca/acordos/${a.id}`)}>
                      <div>
                        <p className="font-medium">{a.numero || `#${a.id.slice(0, 8)}`}</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(a.valor_acordo)} em {a.qtd_parcelas}x</p>
                      </div>
                      <Badge className={getAcordoStatusBadge(a.status)} variant="secondary">{a.status}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-4">Nenhum acordo registrado</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Anotações</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Textarea placeholder="Observações gerais..." value={anotacao} onChange={(e) => setAnotacao(e.target.value)} rows={4} />
              <Button variant="outline" className="w-full" onClick={() => toast.info('Funcionalidade em desenvolvimento')}><Save className="h-4 w-4 mr-2" />Salvar Anotação</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <RegistrarContatoModal open={contatoModalOpen} onClose={() => setContatoModalOpen(false)} associadoId={id || ''} />
    </div>
  );
};

export default InadimplenteDetalhe;
