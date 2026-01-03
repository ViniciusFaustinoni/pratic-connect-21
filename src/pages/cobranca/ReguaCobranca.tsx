import { useState, useEffect } from 'react';
import { Save, Plus, Trash2, MessageSquare, Smartphone, Mail, Phone, Pause, AlertTriangle, XCircle, Info, GripVertical } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Etapa {
  id: string;
  dias: number;
  acao: 'whatsapp' | 'sms' | 'email' | 'ligacao' | 'suspensao' | 'negativacao' | 'cancelamento';
  template?: string;
  ativa: boolean;
}

const acoes = [
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, cor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
  { value: 'sms', label: 'SMS', icon: Smartphone, cor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'email', label: 'E-mail', icon: Mail, cor: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' },
  { value: 'ligacao', label: 'Ligação', icon: Phone, cor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
  { value: 'suspensao', label: 'Suspensão', icon: Pause, cor: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300' },
  { value: 'negativacao', label: 'Negativação', icon: AlertTriangle, cor: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' },
  { value: 'cancelamento', label: 'Cancelamento', icon: XCircle, cor: 'bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-200' },
];

const templates = [
  { value: 'lembrete_vencimento', label: 'Lembrete de Vencimento' },
  { value: 'boleto_vence_hoje', label: 'Boleto Vence Hoje' },
  { value: 'boleto_vencido', label: 'Boleto Vencido' },
  { value: 'aviso_suspensao', label: 'Aviso de Suspensão' },
  { value: 'aviso_negativacao', label: 'Aviso de Negativação' },
  { value: 'aviso_cancelamento', label: 'Aviso de Cancelamento' },
];

const etapasPadrao: Etapa[] = [
  { id: crypto.randomUUID(), dias: -3, acao: 'whatsapp', template: 'lembrete_vencimento', ativa: true },
  { id: crypto.randomUUID(), dias: 0, acao: 'whatsapp', template: 'boleto_vence_hoje', ativa: true },
  { id: crypto.randomUUID(), dias: 3, acao: 'whatsapp', template: 'boleto_vencido', ativa: true },
  { id: crypto.randomUUID(), dias: 7, acao: 'ligacao', ativa: true },
  { id: crypto.randomUUID(), dias: 15, acao: 'sms', template: 'aviso_suspensao', ativa: true },
  { id: crypto.randomUUID(), dias: 30, acao: 'suspensao', ativa: true },
  { id: crypto.randomUUID(), dias: 60, acao: 'negativacao', ativa: true },
  { id: crypto.randomUUID(), dias: 90, acao: 'cancelamento', ativa: true },
];

const formatDias = (dias: number) => {
  if (dias < 0) return `D${dias}`;
  if (dias === 0) return 'D+0';
  return `D+${dias}`;
};

const getDiasColor = (dias: number) => {
  if (dias < 0) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
  if (dias === 0) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
  if (dias <= 7) return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
};

export default function ReguaCobranca() {
  const queryClient = useQueryClient();
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [novaEtapaOpen, setNovaEtapaOpen] = useState(false);
  const [novaEtapa, setNovaEtapa] = useState<Partial<Etapa>>({ dias: 0, acao: 'whatsapp', ativa: true });

  const { data: regua, isLoading } = useQuery({
    queryKey: ['regua-cobranca'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reguas_cobranca')
        .select('*')
        .eq('ativa', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (regua?.etapas) {
      setEtapas(regua.etapas as unknown as Etapa[]);
    } else if (!isLoading && !regua) {
      setEtapas(etapasPadrao);
    }
  }, [regua, isLoading]);

  const salvarRegua = useMutation({
    mutationFn: async () => {
      const id = regua?.id ?? crypto.randomUUID();
      const { error } = await supabase
        .from('reguas_cobranca')
        .upsert({
          id,
          nome: 'Régua Padrão',
          etapas: JSON.parse(JSON.stringify(etapas)),
          ativa: true,
          updated_at: new Date().toISOString()
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Régua salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['regua-cobranca'] });
    },
    onError: () => {
      toast.error('Erro ao salvar régua');
    }
  });

  const handleAddEtapa = () => {
    if (novaEtapa.dias === undefined || !novaEtapa.acao) return;
    
    const nova: Etapa = {
      id: crypto.randomUUID(),
      dias: novaEtapa.dias,
      acao: novaEtapa.acao as Etapa['acao'],
      template: novaEtapa.template,
      ativa: true
    };
    
    setEtapas(prev => [...prev, nova].sort((a, b) => a.dias - b.dias));
    setNovaEtapaOpen(false);
    setNovaEtapa({ dias: 0, acao: 'whatsapp', ativa: true });
  };

  const handleRemoveEtapa = (id: string) => {
    setEtapas(prev => prev.filter(e => e.id !== id));
  };

  const handleToggleEtapa = (id: string) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, ativa: !e.ativa } : e));
  };

  const handleChangeAcao = (id: string, acao: Etapa['acao']) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, acao } : e));
  };

  const handleChangeTemplate = (id: string, template: string) => {
    setEtapas(prev => prev.map(e => e.id === id ? { ...e, template: template || undefined } : e));
  };

  const getAcaoInfo = (acao: string) => acoes.find(a => a.value === acao) || acoes[0];
  const acoesMensagem = ['whatsapp', 'sms', 'email'];

  const etapasOrdenadas = [...etapas].sort((a, b) => a.dias - b.dias);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Régua de Cobrança</h1>
          <p className="text-muted-foreground">Configure o fluxo automatizado de cobrança</p>
        </div>
        <Button onClick={() => salvarRegua.mutate()} disabled={salvarRegua.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Salvar Configuração
        </Button>
      </div>

      {/* Alerta Explicativo */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Como funciona:</strong> Configure as ações automáticas baseadas no vencimento.
          <br />
          <span className="text-blue-600 dark:text-blue-400">Dias negativos (D-3)</span> = antes do vencimento |{' '}
          <span className="text-yellow-600 dark:text-yellow-400">D+0</span> = dia do vencimento |{' '}
          <span className="text-red-600 dark:text-red-400">Dias positivos (D+7)</span> = após vencimento
        </AlertDescription>
      </Alert>

      {/* Timeline Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Linha do Tempo</CardTitle>
          <CardDescription>Visualização do fluxo de cobrança</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div className="flex items-center overflow-x-auto pb-4 gap-2">
              {etapasOrdenadas.map((etapa, idx) => {
                const acaoInfo = getAcaoInfo(etapa.acao);
                const Icon = acaoInfo.icon;
                return (
                  <div key={etapa.id} className="flex items-center">
                    {idx > 0 && <div className="w-8 h-0.5 bg-border" />}
                    <div className={`flex flex-col items-center min-w-[80px] ${!etapa.ativa ? 'opacity-40' : ''}`}>
                      <Badge className={getDiasColor(etapa.dias)}>
                        {formatDias(etapa.dias)}
                      </Badge>
                      <div className={`mt-2 p-2 rounded-full ${acaoInfo.cor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className="text-xs mt-1 text-muted-foreground">{acaoInfo.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Etapas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Etapas Configuradas</CardTitle>
            <CardDescription>{etapas.length} etapas no fluxo</CardDescription>
          </div>
          <Button onClick={() => setNovaEtapaOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Etapa
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {etapasOrdenadas.map((etapa) => {
            const acaoInfo = getAcaoInfo(etapa.acao);
            const Icon = acaoInfo.icon;
            const mostraTemplate = acoesMensagem.includes(etapa.acao);

            return (
              <div
                key={etapa.id}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border ${
                  !etapa.ativa ? 'opacity-50 bg-muted/50' : 'bg-card'
                }`}
              >
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  <Badge className={getDiasColor(etapa.dias)}>
                    {formatDias(etapa.dias)}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 flex-1">
                  <div className={`p-1.5 rounded ${acaoInfo.cor}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <Select
                    value={etapa.acao}
                    onValueChange={(v) => handleChangeAcao(etapa.id, v as Etapa['acao'])}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {acoes.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {mostraTemplate && (
                  <Select
                    value={etapa.template || ''}
                    onValueChange={(v) => handleChangeTemplate(etapa.id, v)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Selecionar template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex items-center gap-3 ml-auto">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={etapa.ativa}
                      onCheckedChange={() => handleToggleEtapa(etapa.id)}
                    />
                    <span className="text-xs text-muted-foreground">
                      {etapa.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEtapa(etapa.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {etapas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma etapa configurada. Clique em "Adicionar Etapa" para começar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Adicionar Etapa */}
      <Dialog open={novaEtapaOpen} onOpenChange={setNovaEtapaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Etapa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Dias (relativo ao vencimento)</Label>
              <Input
                type="number"
                value={novaEtapa.dias ?? 0}
                onChange={(e) => setNovaEtapa(prev => ({ ...prev, dias: parseInt(e.target.value) || 0 }))}
                placeholder="Ex: -3 (antes) ou 7 (depois)"
              />
              <p className="text-xs text-muted-foreground">
                Use valores negativos para ações antes do vencimento
              </p>
            </div>

            <div className="space-y-2">
              <Label>Ação</Label>
              <Select
                value={novaEtapa.acao}
                onValueChange={(v) => setNovaEtapa(prev => ({ ...prev, acao: v as Etapa['acao'] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a ação" />
                </SelectTrigger>
                <SelectContent>
                  {acoes.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      <div className="flex items-center gap-2">
                        <a.icon className="h-4 w-4" />
                        {a.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {novaEtapa.acao && acoesMensagem.includes(novaEtapa.acao) && (
              <div className="space-y-2">
                <Label>Template de Mensagem</Label>
                <Select
                  value={novaEtapa.template || ''}
                  onValueChange={(v) => setNovaEtapa(prev => ({ ...prev, template: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovaEtapaOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddEtapa}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
