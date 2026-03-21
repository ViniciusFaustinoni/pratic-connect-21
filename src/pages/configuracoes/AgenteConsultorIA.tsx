import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Bot, Settings, MessageSquare, Globe, Save, Eye, ExternalLink, Copy,
  Users, Phone, Clock, Send, UserCheck, Loader2, Image as ImageIcon
} from 'lucide-react';

// ─── Tab 1: Planos do Agente ──────────────────────────────────────────────
function AbaPlanos() {
  const queryClient = useQueryClient();

  const { data: planos, isLoading } = useQuery({
    queryKey: ['planos-agente-ia'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('planos')
        .select('id, nome, ativo, visivel_landing, disponivel_agente, agente_descricao, imagem_landing_url')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  const updatePlano = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      const { error } = await (supabase as any)
        .from('planos')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planos-agente-ia'] });
      toast.success('Plano atualizado');
    },
    onError: () => toast.error('Erro ao atualizar plano'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {planos?.map((plano) => (
        <Card key={plano.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{plano.nome}</CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`lp-${plano.id}`} className="text-xs text-muted-foreground">Landing Page</Label>
                  <Switch
                    id={`lp-${plano.id}`}
                    checked={plano.visivel_landing ?? false}
                    onCheckedChange={(v) => updatePlano.mutate({ id: plano.id, field: 'visivel_landing', value: v })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ag-${plano.id}`} className="text-xs text-muted-foreground">Agente IA</Label>
                  <Switch
                    id={`ag-${plano.id}`}
                    checked={plano.disponivel_agente ?? false}
                    onCheckedChange={(v) => updatePlano.mutate({ id: plano.id, field: 'disponivel_agente', value: v })}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Descrição para o Agente</Label>
              <Textarea
                placeholder="Instruções de como o agente deve apresentar este plano..."
                defaultValue={plano.agente_descricao ?? ''}
                onBlur={(e) => {
                  if (e.target.value !== (plano.agente_descricao ?? '')) {
                    updatePlano.mutate({ id: plano.id, field: 'agente_descricao', value: e.target.value });
                  }
                }}
                className="mt-1 text-sm"
                rows={2}
              />
            </div>
            {plano.imagem_landing_url && (
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <a href={plano.imagem_landing_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  Ver imagem atual
                </a>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
      {(!planos || planos.length === 0) && (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum plano ativo encontrado.</p>
      )}
    </div>
  );
}

// ─── Tab 2: Comportamento ─────────────────────────────────────────────────
function AbaComportamento() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [localValues, setLocalValues] = useState<Record<string, string>>({});

  const { data: configs, isLoading } = useQuery({
    queryKey: ['agente-ia-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agente_ia_config')
        .select('*')
        .order('chave');
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((c: any) => { map[c.chave] = c.valor; });
      return map;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async ({ chave, valor }: { chave: string; valor: string }) => {
      const { error } = await supabase
        .from('agente_ia_config')
        .update({ valor, updated_by: user?.id })
        .eq('chave', chave);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agente-ia-config'] });
      toast.success('Configuração salva');
    },
    onError: () => toast.error('Erro ao salvar'),
  });

  const getValue = (key: string) => localValues[key] ?? configs?.[key] ?? '';
  const setValue = (key: string, val: string) => setLocalValues(prev => ({ ...prev, [key]: val }));
  const save = (key: string) => {
    const val = localValues[key];
    if (val !== undefined && val !== configs?.[key]) {
      saveConfig.mutate({ chave: key, valor: val });
    }
  };

  const foraHorario = getValue('responder_fora_horario') === 'true';
  const followupAtivo = getValue('followup_ativo') === 'true';

  let followups: { horas: number; mensagem: string }[] = [];
  try { followups = JSON.parse(getValue('followup_config') || '[]'); } catch { followups = []; }

  let dadosOpcionais: Record<string, boolean> = {};
  try { dadosOpcionais = JSON.parse(getValue('dados_cotacao_opcionais') || '{}'); } catch { /* ignore */ }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Identidade */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> Identidade e Tom</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Nome do Agente</Label>
            <Input value={getValue('nome_agente')} onChange={(e) => setValue('nome_agente', e.target.value)} onBlur={() => save('nome_agente')} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Apresentação Inicial</Label>
            <Textarea value={getValue('apresentacao_inicial')} onChange={(e) => setValue('apresentacao_inicial', e.target.value)} onBlur={() => save('apresentacao_inicial')} className="mt-1" rows={4} />
          </div>
          <div>
            <Label className="text-xs">Instruções Gerais de Comportamento</Label>
            <Textarea value={getValue('instrucoes_comportamento')} onChange={(e) => setValue('instrucoes_comportamento', e.target.value)} onBlur={() => save('instrucoes_comportamento')} className="mt-1" rows={4} />
          </div>
        </CardContent>
      </Card>

      {/* Horário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Horário de Atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Responder 24h (fora do horário comercial)</Label>
            <Switch
              checked={foraHorario}
              onCheckedChange={(v) => {
                setValue('responder_fora_horario', v ? 'true' : 'false');
                saveConfig.mutate({ chave: 'responder_fora_horario', valor: v ? 'true' : 'false' });
              }}
            />
          </div>
          {!foraHorario && (
            <>
              <div>
                <Label className="text-xs">Horário Comercial (JSON)</Label>
                <Textarea value={getValue('horario_comercial')} onChange={(e) => setValue('horario_comercial', e.target.value)} onBlur={() => save('horario_comercial')} className="mt-1 font-mono text-xs" rows={3} />
              </div>
              <div>
                <Label className="text-xs">Mensagem Fora do Horário</Label>
                <Textarea value={getValue('mensagem_fora_horario')} onChange={(e) => setValue('mensagem_fora_horario', e.target.value)} onBlur={() => save('mensagem_fora_horario')} className="mt-1" rows={3} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fluxo de Cotação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><Send className="h-4 w-4" /> Fluxo de Cotação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs font-medium mb-2 block">Dados coletados para cotação</Label>
            <div className="space-y-2 text-sm">
              {['Nome completo', 'Telefone', 'Marca e modelo', 'Ano do modelo', 'CEP / Cidade'].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <Switch checked disabled className="opacity-60" />
                  <span className="text-muted-foreground">{item} <Badge variant="outline" className="text-[10px] ml-1">Obrigatório</Badge></span>
                </div>
              ))}
              {Object.entries(dadosOpcionais).map(([key, enabled]) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => {
                      const updated = { ...dadosOpcionais, [key]: v };
                      const json = JSON.stringify(updated);
                      setValue('dados_cotacao_opcionais', json);
                      saveConfig.mutate({ chave: 'dados_cotacao_opcionais', valor: json });
                    }}
                  />
                  <span>{key === 'cpf' ? 'CPF' : key === 'uso_veiculo' ? 'Uso do veículo' : 'Cor do veículo'}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs">Mensagem ao enviar link de cotação</Label>
            <Textarea value={getValue('mensagem_link_cotacao')} onChange={(e) => setValue('mensagem_link_cotacao', e.target.value)} onBlur={() => save('mensagem_link_cotacao')} className="mt-1" rows={4} />
          </div>
        </CardContent>
      </Card>

      {/* Follow-up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Follow-up Automático</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Ativar follow-up automático</Label>
            <Switch
              checked={followupAtivo}
              onCheckedChange={(v) => {
                setValue('followup_ativo', v ? 'true' : 'false');
                saveConfig.mutate({ chave: 'followup_ativo', valor: v ? 'true' : 'false' });
              }}
            />
          </div>
          {followupAtivo && followups.map((fu, idx) => (
            <div key={idx} className="border rounded-lg p-3 space-y-2">
              <Label className="text-xs font-medium">Follow-up {idx + 1}</Label>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Após</Label>
                <Input
                  type="number"
                  className="w-20 h-8 text-sm"
                  value={fu.horas}
                  onChange={(e) => {
                    const updated = [...followups];
                    updated[idx] = { ...updated[idx], horas: parseInt(e.target.value) || 0 };
                    const json = JSON.stringify(updated);
                    setValue('followup_config', json);
                  }}
                  onBlur={() => {
                    const val = localValues['followup_config'];
                    if (val) saveConfig.mutate({ chave: 'followup_config', valor: val });
                  }}
                />
                <Label className="text-xs text-muted-foreground">horas</Label>
              </div>
              <Textarea
                value={fu.mensagem}
                onChange={(e) => {
                  const updated = [...followups];
                  updated[idx] = { ...updated[idx], mensagem: e.target.value };
                  const json = JSON.stringify(updated);
                  setValue('followup_config', json);
                }}
                onBlur={() => {
                  const val = localValues['followup_config'];
                  if (val) saveConfig.mutate({ chave: 'followup_config', valor: val });
                }}
                className="text-sm"
                rows={2}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab 3: Contatos ──────────────────────────────────────────────────────
function AbaContatos() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [selectedTelefone, setSelectedTelefone] = useState<string | null>(null);

  const { data: contatos, isLoading } = useQuery({
    queryKey: ['agente-ia-contatos', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('agente_ia_contatos')
        .select('*')
        .order('ultima_interacao', { ascending: false, nullsFirst: false });
      if (statusFilter !== 'todos') query = query.eq('status', statusFilter);
      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: mensagens } = useQuery({
    queryKey: ['agente-ia-conversa', selectedTelefone],
    queryFn: async () => {
      if (!selectedTelefone) return [];
      const { data, error } = await supabase
        .from('whatsapp_fila_ia')
        .select('*')
        .eq('telefone', selectedTelefone)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedTelefone,
  });

  const assumirConversa = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('agente_ia_contatos')
        .update({ status: 'atendimento_humano' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agente-ia-contatos'] });
      toast.success('Conversa assumida');
    },
  });

  const statusColors: Record<string, string> = {
    em_conversa: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    cotacao_enviada: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
    followup_ativo: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    convertido: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    encerrado: 'bg-muted text-muted-foreground',
    atendimento_humano: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  };

  const statusLabels: Record<string, string> = {
    em_conversa: 'Em conversa',
    cotacao_enviada: 'Cotação enviada',
    followup_ativo: 'Follow-up',
    convertido: 'Convertido',
    encerrado: 'Encerrado',
    atendimento_humano: 'Atend. humano',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="em_conversa">Em conversa</SelectItem>
            <SelectItem value="cotacao_enviada">Cotação enviada</SelectItem>
            <SelectItem value="followup_ativo">Follow-up ativo</SelectItem>
            <SelectItem value="convertido">Convertido</SelectItem>
            <SelectItem value="encerrado">Encerrado</SelectItem>
            <SelectItem value="atendimento_humano">Atend. humano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Última interação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contatos?.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome || '—'}</TableCell>
                  <TableCell className="text-sm">{c.telefone}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[c.status] || ''}>
                      {statusLabels[c.status] || c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.ultima_interacao ? format(new Date(c.ultima_interacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTelefone(c.telefone)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                    </Button>
                    {c.status !== 'atendimento_humano' && c.status !== 'encerrado' && (
                      <Button size="sm" variant="outline" onClick={() => assumirConversa.mutate(c.id)}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Assumir
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!contatos || contatos.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum contato encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!selectedTelefone} onOpenChange={() => setSelectedTelefone(null)}>
        <DialogContent className="max-w-lg max-h-[70vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Conversa — {selectedTelefone}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            {mensagens?.map((m: any) => (
              <div
                key={m.id}
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  m.direcao === 'enviada'
                    ? 'ml-auto bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="whitespace-pre-wrap">{m.mensagem || m.resposta_ia || '(sem conteúdo)'}</p>
                <p className="text-[10px] mt-1 opacity-60">
                  {m.created_at ? format(new Date(m.created_at), 'HH:mm', { locale: ptBR }) : ''}
                </p>
              </div>
            ))}
            {(!mensagens || mensagens.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma mensagem encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Tab 4: Landing Page ──────────────────────────────────────────────────
function AbaLandingPage() {
  const fullUrl = `${window.location.origin}/planos`;

  const copyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Input value={fullUrl} readOnly className="flex-1 text-sm" />
        <Button variant="outline" size="sm" onClick={copyLink}>
          <Copy className="h-4 w-4 mr-1" /> Copiar
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/planos" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" /> Abrir
          </a>
        </Button>
      </div>
      <div className="border rounded-lg overflow-hidden" style={{ height: '70vh' }}>
        <iframe
          src="/planos"
          className="w-full h-full"
          title="Preview da Landing Page"
        />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function AgenteConsultorIA() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Bot className="h-5 w-5" /> Agente Consultor IA
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure o agente de vendas automatizado que opera no WhatsApp.
        </p>
      </div>

      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="planos" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" /> Planos
          </TabsTrigger>
          <TabsTrigger value="comportamento" className="gap-1.5">
            <Bot className="h-3.5 w-3.5" /> Comportamento
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Contatos
          </TabsTrigger>
          <TabsTrigger value="landing" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Landing Page
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planos"><AbaPlanos /></TabsContent>
        <TabsContent value="comportamento"><AbaComportamento /></TabsContent>
        <TabsContent value="contatos"><AbaContatos /></TabsContent>
        <TabsContent value="landing"><AbaLandingPage /></TabsContent>
      </Tabs>
    </div>
  );
}
