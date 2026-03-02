import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Calculator, Save, AlertTriangle, History, Car, Bike, Truck, Gauge,
  DollarSign, CalendarDays, Play
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const RATEIO_KEYS = [
  'atuarial_valor_por_cota',
  'rateio_multiplicador_passeio',
  'rateio_multiplicador_aplicativo',
  'rateio_multiplicador_diesel',
  'rateio_multiplicador_moto',
  'rateio_taxa_administrativa',
  'rateio_dia_fechamento',
  'rateio_dia_vencimento',
];

const LABELS: Record<string, string> = {
  atuarial_valor_por_cota: 'Valor Base da Cota',
  rateio_multiplicador_passeio: 'Multiplicador Passeio',
  rateio_multiplicador_aplicativo: 'Multiplicador Aplicativo',
  rateio_multiplicador_diesel: 'Multiplicador Diesel',
  rateio_multiplicador_moto: 'Multiplicador Moto',
  rateio_taxa_administrativa: 'Taxa Administrativa',
  rateio_dia_fechamento: 'Dia de Fechamento',
  rateio_dia_vencimento: 'Dia de Vencimento',
};

type ConfigMap = Record<string, string>;

export default function RateioConfig() {
  const { profile } = useAuth();
  const { isDiretor, isDesenvolvedor } = usePermissions();
  const queryClient = useQueryClient();

  const [editValues, setEditValues] = useState<ConfigMap>({});
  const [confirmDialog, setConfirmDialog] = useState<{ key: string; value: string } | null>(null);

  // Simulator state
  const [simFipe, setSimFipe] = useState('');
  const [simTipo, setSimTipo] = useState('passeio');

  // Fetch all rateio configs
  const { data: configs, isLoading } = useQuery({
    queryKey: ['rateio-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', RATEIO_KEYS);
      if (error) throw error;
      const map: ConfigMap = {};
      data?.forEach(c => { map[c.chave] = c.valor || ''; });
      return map;
    },
  });

  // Fetch history using raw query since table is new and not in generated types
  const { data: historico } = useQuery({
    queryKey: ['rateio-historico'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_rateio_historico' as any);
      // Fallback: direct query via REST
      if (error) {
        // Use fetch as workaround for missing types
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/configuracoes_historico?chave=in.(${RATEIO_KEYS.join(',')})&order=alterado_em.desc&limit=50&select=*,profiles:alterado_por(nome)`,
          {
            headers: {
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
          }
        );
        if (!res.ok) return [];
        return res.json();
      }
      return data;
    },
  });

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const oldValue = configs?.[key] || '';
      
      const { error: updateError } = await supabase
        .from('configuracoes')
        .update({ valor: value })
        .eq('chave', key);
      if (updateError) throw updateError;

      // Insert history via REST since table not in types
      const session = (await supabase.auth.getSession()).data.session;
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/configuracoes_historico`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chave: key,
            valor_anterior: oldValue,
            valor_novo: value,
            alterado_por: profile?.id,
          }),
        }
      );
    },
    onSuccess: (_, { key }) => {
      queryClient.invalidateQueries({ queryKey: ['rateio-configs'] });
      queryClient.invalidateQueries({ queryKey: ['rateio-historico'] });
      setEditValues(prev => { const n = { ...prev }; delete n[key]; return n; });
      toast.success(`${LABELS[key] || key} atualizado com sucesso`);
    },
    onError: (err) => {
      toast.error('Erro ao salvar: ' + (err as Error).message);
    },
  });

  // Simulator calculations
  const simResult = useMemo(() => {
    const fipe = parseFloat(simFipe) || 0;
    const valorCota = parseFloat(getValue('atuarial_valor_por_cota')) || 5000;
    const multKey = `rateio_multiplicador_${simTipo}`;
    const multiplicador = parseFloat(getValue(multKey)) || 1.0;
    const taxa = parseFloat(getValue('rateio_taxa_administrativa')) || 0;

    if (fipe <= 0) return null;

    const cotas = Math.ceil(fipe / valorCota);
    const cotasAjustadas = cotas * multiplicador;

    return { cotas, multiplicador, cotasAjustadas, taxa, fipe, valorCota };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simFipe, simTipo, editValues, configs]);

  // Access control - after all hooks
  if (!isDiretor && !isDesenvolvedor) {
    return <Navigate to="/configuracoes/meu-perfil" replace />;
  }

  function getValue(key: string) {
    return editValues[key] ?? configs?.[key] ?? '';
  }

  function hasChange(key: string) {
    return key in editValues && editValues[key] !== (configs?.[key] ?? '');
  }

  const handleChange = (key: string, value: string) => {
    setEditValues(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    const value = editValues[key];
    if (value === undefined) return;

    if (key === 'atuarial_valor_por_cota') {
      const n = parseFloat(value);
      if (isNaN(n) || n <= 0) { toast.error('Valor base deve ser maior que zero'); return; }
    }
    if (key.startsWith('rateio_multiplicador_')) {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0.5 || n > 5.0) { toast.error('Multiplicador deve estar entre 0,5 e 5,0'); return; }
    }
    if (key === 'rateio_taxa_administrativa') {
      const n = parseFloat(value);
      if (isNaN(n) || n < 0) { toast.error('Taxa não pode ser negativa'); return; }
    }
    if (key === 'rateio_dia_fechamento' || key === 'rateio_dia_vencimento') {
      const n = parseInt(value);
      if (isNaN(n) || n < 1 || n > 28) { toast.error('Dia deve ser entre 1 e 28'); return; }
    }

    if (key === 'atuarial_valor_por_cota') {
      setConfirmDialog({ key, value });
      return;
    }

    saveMutation.mutate({ key, value });
  };

  const confirmSave = () => {
    if (confirmDialog) {
      saveMutation.mutate(confirmDialog);
      setConfirmDialog(null);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando configurações...</div>;
  }

  const SaveButton = ({ configKey }: { configKey: string }) => (
    <Button
      size="sm"
      onClick={() => handleSave(configKey)}
      disabled={!hasChange(configKey) || saveMutation.isPending}
      className="shrink-0"
    >
      <Save className="h-4 w-4 mr-1" />
      Salvar
    </Button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6" />
          Configuração do Rateio
        </h1>
        <p className="text-muted-foreground mt-1">
          Parâmetros que definem o cálculo de rateio mensal entre os associados
        </p>
      </div>

      {/* Valor Base da Cota */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Valor Base da Cota
          </CardTitle>
          <CardDescription>
            Define quantas cotas cada veículo representa. Ex: se R$ 20.000, um veículo FIPE de R$ 40.000 = 2 cotas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label>Valor em R$</Label>
              <Input
                type="number"
                min="1"
                step="1000"
                value={getValue('atuarial_valor_por_cota')}
                onChange={(e) => handleChange('atuarial_valor_por_cota', e.target.value)}
              />
            </div>
            <SaveButton configKey="atuarial_valor_por_cota" />
          </div>
          {hasChange('atuarial_valor_por_cota') && (
            <p className="text-sm text-destructive mt-2 flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              Alterar o valor base afeta o cálculo de TODOS os associados
            </p>
          )}
        </CardContent>
      </Card>

      {/* Multiplicadores */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-5 w-5" />
            Multiplicadores por Tipo de Veículo
          </CardTitle>
          <CardDescription>
            Fatores que multiplicam o número de cotas conforme o tipo de veículo. Valores entre 0,5 e 5,0.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'rateio_multiplicador_passeio', icon: Car, label: 'Passeio' },
              { key: 'rateio_multiplicador_aplicativo', icon: Car, label: 'Aplicativo (Uber/99)' },
              { key: 'rateio_multiplicador_diesel', icon: Truck, label: 'Diesel' },
              { key: 'rateio_multiplicador_moto', icon: Bike, label: 'Moto' },
            ].map(({ key, icon: Icon, label }) => (
              <div key={key} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="flex items-center gap-1">
                    <Icon className="h-4 w-4" />
                    {label}
                  </Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="5.0"
                    step="0.1"
                    value={getValue(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
                <SaveButton configKey={key} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Taxa Administrativa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Taxa Administrativa Mensal
          </CardTitle>
          <CardDescription>
            Valor fixo cobrado de todos os associados, separado do rateio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label>Valor em R$</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={getValue('rateio_taxa_administrativa')}
                onChange={(e) => handleChange('rateio_taxa_administrativa', e.target.value)}
              />
            </div>
            <SaveButton configKey="rateio_taxa_administrativa" />
          </div>
        </CardContent>
      </Card>

      {/* Dia de Fechamento e Vencimento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            Datas de Fechamento e Vencimento
          </CardTitle>
          <CardDescription>
            Defina o dia do mês para fechamento do rateio e vencimento dos boletos (1 a 28).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: 'rateio_dia_fechamento', label: 'Dia de Fechamento' },
              { key: 'rateio_dia_vencimento', label: 'Dia de Vencimento' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-end gap-2">
                <div className="flex-1">
                  <Label>{label}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    value={getValue(key)}
                    onChange={(e) => handleChange(key, e.target.value)}
                  />
                </div>
                <SaveButton configKey={key} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Simulador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Play className="h-5 w-5" />
            Simulador de Impacto
          </CardTitle>
          <CardDescription>
            Teste o impacto das configurações atuais/editadas em um veículo hipotético.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <Label>Valor FIPE (R$)</Label>
              <Input
                type="number"
                min="0"
                step="1000"
                placeholder="Ex: 50000"
                value={simFipe}
                onChange={(e) => setSimFipe(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de Veículo</Label>
              <Select value={simTipo} onValueChange={setSimTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passeio">Passeio</SelectItem>
                  <SelectItem value="aplicativo">Aplicativo (Uber/99)</SelectItem>
                  <SelectItem value="diesel">Diesel</SelectItem>
                  <SelectItem value="moto">Moto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {simResult && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Valor FIPE</p>
                  <p className="text-lg font-bold">
                    {simResult.fipe.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cotas Base</p>
                  <p className="text-lg font-bold">{simResult.cotas}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Multiplicador</p>
                  <p className="text-lg font-bold">×{simResult.multiplicador.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cotas Ajustadas</p>
                  <p className="text-lg font-bold text-primary">{simResult.cotasAjustadas.toFixed(1)}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center mt-2">
                + Taxa administrativa de {parseFloat(getValue('rateio_taxa_administrativa') || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} por mês
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Histórico de Alterações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!historico?.length ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma alteração registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Anterior</TableHead>
                    <TableHead>Novo</TableHead>
                    <TableHead>Alterado por</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h: any) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{LABELS[h.chave] || h.chave}</TableCell>
                      <TableCell>{h.valor_anterior || '—'}</TableCell>
                      <TableCell>{h.valor_novo}</TableCell>
                      <TableCell>{h.profiles?.nome || '—'}</TableCell>
                      <TableCell>
                        {format(new Date(h.alterado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={!!confirmDialog} onOpenChange={() => setConfirmDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar alteração
            </AlertDialogTitle>
            <AlertDialogDescription>
              Atenção: alterar o valor base da cota afeta o cálculo de <strong>TODOS</strong> os associados no próximo fechamento.
              Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSave}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
