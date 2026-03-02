import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Bell, Search, Send, AlertTriangle, Clock, CheckCircle2, Users, RefreshCw, History, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Inadimplente {
  id: string;
  associado_id: string;
  associado_nome: string;
  placa: string;
  valor: number;
  data_vencimento: string;
  dias_atraso: number;
  boleto_url: string | null;
  pix_copia_cola: string | null;
  status: string;
}

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  created_at: string;
  lida: boolean;
}

interface MensagemWhatsApp {
  id: string;
  mensagem: string;
  status: string;
  created_at: string;
  direcao: string;
}

function calcularDiasAtraso(dataVencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = parseISO(dataVencimento);
  venc.setHours(0, 0, 0, 0);
  return differenceInDays(hoje, venc);
}

function getFaixaAtraso(dias: number): string {
  if (dias <= 5) return '1-5';
  if (dias <= 15) return '6-15';
  if (dias <= 29) return '16-29';
  return '30+';
}

export default function NotificacoesCobranca() {
  const queryClient = useQueryClient();
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroFaixa, setFiltroFaixa] = useState('todos');
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [associadoSelecionado, setAssociadoSelecionado] = useState<{ id: string; nome: string } | null>(null);
  const [reenviando, setReenviando] = useState<string | null>(null);

  // Buscar fechamento mais recente
  const { data: fechamento } = useQuery({
    queryKey: ['fechamento-notificacoes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('fechamentos_mensais')
        .select('*')
        .in('status', ['aprovado', 'processado'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Buscar resumo de notificações do fechamento
  const { data: resumo } = useQuery({
    queryKey: ['resumo-notificacoes', fechamento?.id],
    queryFn: async () => {
      if (!fechamento?.id) return { notificados: 0, erros: 0, total: 0 };
      
      const { data: cobrancas } = await supabase
        .from('asaas_cobrancas')
        .select('notificacao_enviada, enviada_whatsapp')
        .eq('fechamento_id', fechamento.id)
        .not('asaas_id', 'like', 'LOCAL-%');

      const total = cobrancas?.length || 0;
      const notificados = cobrancas?.filter(c => c.notificacao_enviada).length || 0;
      const erros = cobrancas?.filter(c => c.notificacao_enviada && !c.enviada_whatsapp).length || 0;

      return { notificados, erros, total };
    },
    enabled: !!fechamento?.id,
  });

  // Buscar cobranças vencidas (inadimplentes)
  const { data: inadimplentesRaw } = useQuery({
    queryKey: ['inadimplentes-notificacoes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('asaas_cobrancas')
        .select(`
          id,
          associado_id,
          valor,
          data_vencimento,
          boleto_url,
          pix_copia_cola,
          status,
          associados:associado_id (nome),
          veiculos:veiculo_id (placa)
        `)
        .eq('status', 'OVERDUE')
        .not('asaas_id', 'like', 'LOCAL-%')
        .order('data_vencimento', { ascending: true });
      return data || [];
    },
  });

  const inadimplentes: Inadimplente[] = (inadimplentesRaw || []).map((c: any) => ({
    id: c.id,
    associado_id: c.associado_id,
    associado_nome: c.associados?.nome || '—',
    placa: c.veiculos?.placa || '—',
    valor: c.valor,
    data_vencimento: c.data_vencimento,
    dias_atraso: calcularDiasAtraso(c.data_vencimento),
    boleto_url: c.boleto_url,
    pix_copia_cola: c.pix_copia_cola,
    status: c.status,
  }));

  // Contagem por faixa
  const faixas = {
    '1-5': inadimplentes.filter(i => i.dias_atraso >= 1 && i.dias_atraso <= 5).length,
    '6-15': inadimplentes.filter(i => i.dias_atraso >= 6 && i.dias_atraso <= 15).length,
    '16-29': inadimplentes.filter(i => i.dias_atraso >= 16 && i.dias_atraso <= 29).length,
    '30+': inadimplentes.filter(i => i.dias_atraso >= 30).length,
  };

  // Filtros
  const inadimFiltrados = inadimplentes.filter(i => {
    const matchNome = !filtroNome ||
      i.associado_nome.toLowerCase().includes(filtroNome.toLowerCase()) ||
      i.placa.toLowerCase().includes(filtroNome.toLowerCase());
    const matchFaixa = filtroFaixa === 'todos' || getFaixaAtraso(i.dias_atraso) === filtroFaixa;
    return matchNome && matchFaixa;
  });

  // Histórico de notificações do associado
  const { data: historicoNotificacoes } = useQuery({
    queryKey: ['historico-notificacoes', associadoSelecionado?.id],
    queryFn: async () => {
      if (!associadoSelecionado?.id) return [];
      
      // Buscar user_id do associado
      const { data: assoc } = await supabase
        .from('associados')
        .select('user_id')
        .eq('id', associadoSelecionado.id)
        .single();

      if (!assoc?.user_id) return [];

      const { data } = await supabase
        .from('notificacoes')
        .select('id, titulo, mensagem, tipo, created_at, lida')
        .eq('user_id', assoc.user_id)
        .in('tipo', ['boleto', 'cobranca', 'info', 'alerta'])
        .order('created_at', { ascending: false })
        .limit(20);

      return (data || []) as Notificacao[];
    },
    enabled: !!associadoSelecionado?.id && historicoAberto,
  });

  const { data: historicoWhatsApp } = useQuery({
    queryKey: ['historico-whatsapp', associadoSelecionado?.id],
    queryFn: async () => {
      if (!associadoSelecionado?.id) return [];

      const { data } = await supabase
        .from('whatsapp_mensagens')
        .select('id, mensagem, status, created_at, direcao')
        .eq('referencia_tipo', 'cobranca')
        .order('created_at', { ascending: false })
        .limit(20);

      return (data || []) as MensagemWhatsApp[];
    },
    enabled: !!associadoSelecionado?.id && historicoAberto,
  });

  // Reenviar boleto individual
  const reenviarBoleto = useCallback(async (inadimplente: Inadimplente) => {
    setReenviando(inadimplente.id);
    try {
      // Buscar dados do associado
      const { data: assoc } = await supabase
        .from('associados')
        .select('nome, email, telefone, whatsapp, user_id')
        .eq('id', inadimplente.associado_id)
        .single();

      if (!assoc) throw new Error('Associado não encontrado');

      const nome = assoc.nome?.split(' ')[0] || 'Associado';
      const valorFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(inadimplente.valor);
      const dataFmt = format(parseISO(inadimplente.data_vencimento), 'dd/MM/yyyy');

      const mensagem = `📋 *Reenvio de Boleto*

Olá ${nome}! 👋

Reenviamos seu boleto pendente.

💰 *Valor:* ${valorFmt}
📅 *Vencimento:* ${dataFmt}
${inadimplente.pix_copia_cola ? `\n💠 *PIX Copia e Cola:*\n\`${inadimplente.pix_copia_cola}\`\n` : ''}
${inadimplente.boleto_url ? `📄 *Boleto:* ${inadimplente.boleto_url}\n` : ''}
Regularize para manter seus benefícios ativos! 🙏`;

      // Enviar WhatsApp
      const telefone = assoc.whatsapp || assoc.telefone;
      if (telefone) {
        const telFmt = telefone.replace(/\D/g, '');
        const telFinal = telFmt.startsWith('55') ? telFmt : `55${telFmt}`;
        
        await supabase.functions.invoke('whatsapp-send-text', {
          body: { telefone: telFinal, mensagem },
        });

        await supabase.from('whatsapp_mensagens').insert({
          telefone: telFinal,
          mensagem,
          tipo: 'text',
          direcao: 'saida',
          status: 'enviada',
          referencia_tipo: 'cobranca',
          referencia_id: inadimplente.id,
        });
      }

      // Enviar Email
      if (assoc.email) {
        await supabase.functions.invoke('send-email', {
          body: {
            template: 'boleto-gerado',
            to: assoc.email,
            data: {
              nome: assoc.nome,
              valor: valorFmt,
              dataVencimento: dataFmt,
              boletoUrl: inadimplente.boleto_url,
              pixCopiaCola: inadimplente.pix_copia_cola,
            },
          },
        });
      }

      toast.success(`Boleto reenviado para ${assoc.nome}`);
    } catch (err: any) {
      toast.error(`Erro ao reenviar: ${err.message}`);
    } finally {
      setReenviando(null);
    }
  }, []);

  const abrirHistorico = (associadoId: string, associadoNome: string) => {
    setAssociadoSelecionado({ id: associadoId, nome: associadoNome });
    setHistoricoAberto(true);
  };

  const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notificações de Cobrança</h1>
        <p className="text-muted-foreground">Gestão de notificações e régua de cobrança</p>
      </div>

      {/* Painel de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <p className="text-xs text-muted-foreground">Notificados</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{resumo?.notificados || 0}</p>
            <p className="text-xs text-muted-foreground">de {resumo?.total || 0} boletos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Com Erro</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{resumo?.erros || 0}</p>
            <p className="text-xs text-muted-foreground">falha no envio</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-amber-600" />
              <p className="text-xs text-muted-foreground">Inadimplentes</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{inadimplentes.length}</p>
            <p className="text-xs text-muted-foreground">cobranças vencidas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-4 w-4 text-primary" />
              <p className="text-xs text-muted-foreground">Referência</p>
            </div>
            <p className="text-lg font-bold">
              {fechamento ? `${MESES[fechamento.mes]}/${fechamento.ano}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Faixas de Atraso */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Inadimplentes por Faixa de Atraso</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card 
            className={`cursor-pointer transition-colors ${filtroFaixa === '1-5' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroFaixa(filtroFaixa === '1-5' ? 'todos' : '1-5')}
          >
            <CardContent className="pt-3 pb-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">1-5 dias</p>
              <p className="text-3xl font-bold text-amber-500">{faixas['1-5']}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${filtroFaixa === '6-15' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroFaixa(filtroFaixa === '6-15' ? 'todos' : '6-15')}
          >
            <CardContent className="pt-3 pb-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">6-15 dias</p>
              <p className="text-3xl font-bold text-orange-500">{faixas['6-15']}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${filtroFaixa === '16-29' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroFaixa(filtroFaixa === '16-29' ? 'todos' : '16-29')}
          >
            <CardContent className="pt-3 pb-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">16-29 dias</p>
              <p className="text-3xl font-bold text-red-500">{faixas['16-29']}</p>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-colors ${filtroFaixa === '30+' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setFiltroFaixa(filtroFaixa === '30+' ? 'todos' : '30+')}
          >
            <CardContent className="pt-3 pb-2 px-4 text-center">
              <p className="text-sm text-muted-foreground">30+ dias</p>
              <p className="text-3xl font-bold text-red-700">{faixas['30+']}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Lista de Inadimplentes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Lista de Inadimplentes</h2>
          <div className="flex gap-2">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome ou placa..."
                value={filtroNome}
                onChange={e => setFiltroNome(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filtroFaixa} onValueChange={setFiltroFaixa}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas faixas</SelectItem>
                <SelectItem value="1-5">1-5 dias</SelectItem>
                <SelectItem value="6-15">6-15 dias</SelectItem>
                <SelectItem value="16-29">16-29 dias</SelectItem>
                <SelectItem value="30+">30+ dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Associado</TableHead>
                  <TableHead>Placa</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Dias Atraso</TableHead>
                  <TableHead>Próxima Ação</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inadimFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {inadimplentes.length === 0 ? 'Nenhum inadimplente encontrado 🎉' : 'Nenhum resultado para o filtro aplicado'}
                    </TableCell>
                  </TableRow>
                ) : (
                  inadimFiltrados.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">
                        <button
                          className="text-left hover:underline text-primary"
                          onClick={() => abrirHistorico(i.associado_id, i.associado_nome)}
                        >
                          {i.associado_nome}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{i.placa}</TableCell>
                      <TableCell className="text-right">
                        R$ {i.valor.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={
                          i.dias_atraso <= 5 ? 'outline' :
                          i.dias_atraso <= 15 ? 'secondary' :
                          'destructive'
                        }>
                          {i.dias_atraso}d
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {i.dias_atraso < 5 ? 'Lembrete D+5' :
                           i.dias_atraso < 7 ? 'Suspensão automática' :
                           i.dias_atraso < 30 ? 'Cobrança ativa' :
                           'Candidato SPC'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reenviarBoleto(i)}
                            disabled={reenviando === i.id}
                          >
                            {reenviando === i.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Send className="h-3 w-3" />
                            )}
                            <span className="ml-1 hidden sm:inline">Reenviar</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => abrirHistorico(i.associado_id, i.associado_nome)}
                          >
                            <History className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Histórico */}
      <Dialog open={historicoAberto} onOpenChange={setHistoricoAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico — {associadoSelecionado?.nome}</DialogTitle>
            <DialogDescription>Notificações e mensagens enviadas para este associado</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <Bell className="h-4 w-4" /> Notificações do Sistema
              </h3>
              {(historicoNotificacoes || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma notificação encontrada</p>
              ) : (
                <div className="space-y-2">
                  {(historicoNotificacoes || []).map(n => (
                    <div key={n.id} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{n.titulo}</span>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(n.created_at), "dd/MM/yy HH:mm")}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">{n.mensagem}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </h3>
              {(historicoWhatsApp || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma mensagem encontrada</p>
              ) : (
                <div className="space-y-2">
                  {(historicoWhatsApp || []).map(m => (
                    <div key={m.id} className="border rounded p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <Badge variant={m.status === 'enviada' ? 'default' : 'destructive'} className="text-xs">
                          {m.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(parseISO(m.created_at), "dd/MM/yy HH:mm")}
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs whitespace-pre-line line-clamp-3">
                        {m.mensagem}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
