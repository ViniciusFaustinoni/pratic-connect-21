import { useEffect, useState } from 'react';
import { Save, Loader2, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useConfiguracoesAll, CONFIGURACOES_ALL_KEY } from '@/hooks/useConfiguracoesAll';

const CHAVE_CARRO = 'operacional_fipe_minimo_rastreador';
const CHAVE_MOTO = 'operacional_fipe_minimo_rastreador_moto';

function formatBRL(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
}

export default function Sistema() {
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    itensPorPagina: '20',
    formatoData: 'dd/MM/yyyy',
    notificacoesSom: true,
    autoLogout: '30',
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 1000));
    toast.success('Configurações salvas!');
    setSaving(false);
  };

  // ---- Rastreador / FIPE mínima ----
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: configMap, isLoading: loadingFipe } = useConfiguracoesAll();
  const fipeCarroAtual = Number(configMap?.[CHAVE_CARRO]) || 30000;
  const fipeMotoAtual = Number(configMap?.[CHAVE_MOTO]) || 9000;

  const [fipeCarro, setFipeCarro] = useState<string>('');
  const [fipeMoto, setFipeMoto] = useState<string>('');

  useEffect(() => {
    if (!loadingFipe) {
      setFipeCarro(String(fipeCarroAtual));
      setFipeMoto(String(fipeMotoAtual));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingFipe, fipeCarroAtual, fipeMotoAtual]);

  const { mutateAsync: salvarFipe, isPending: salvandoFipe } = useMutation({
    mutationFn: async ({ carro, moto }: { carro: number; moto: number }) => {
      const updates = [
        { chave: CHAVE_CARRO, valor: String(carro) },
        { chave: CHAVE_MOTO, valor: String(moto) },
      ];
      for (const u of updates) {
        const { error } = await supabase
          .from('configuracoes')
          .update({ valor: u.valor, updated_at: new Date().toISOString(), updated_by: profile?.id })
          .eq('chave', u.chave);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONFIGURACOES_ALL_KEY });
      toast.success('Limites de FIPE atualizados');
    },
    onError: (err: any) => {
      console.error('[Sistema] erro ao salvar FIPE:', err);
      toast.error('Erro ao salvar limites de FIPE');
    },
  });

  const handleSalvarFipe = async () => {
    const carro = Number(fipeCarro);
    const moto = Number(fipeMoto);
    if (!Number.isFinite(carro) || carro <= 0) {
      toast.error('Informe um valor válido para Carros');
      return;
    }
    if (!Number.isFinite(moto) || moto <= 0) {
      toast.error('Informe um valor válido para Motos');
      return;
    }
    await salvarFipe({ carro: Math.round(carro), moto: Math.round(moto) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Sistema</h1>
        <p className="text-sm text-muted-foreground">Preferências gerais do sistema</p>
      </div>

      {/* Rastreador / FIPE mínima */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="w-5 h-5 text-primary" />
            Rastreador — FIPE mínima para dispensa
          </CardTitle>
          <CardDescription>
            Veículos com FIPE <strong>abaixo</strong> destes valores dispensam a instalação do rastreador
            (passam por vistoria sem instalação). Veículos <strong>Diesel sempre</strong> exigem rastreador, independente da FIPE.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fipe-carro">Carros — limite mínimo (R$)</Label>
              <Input
                id="fipe-carro"
                type="number"
                min={0}
                step={1000}
                value={fipeCarro}
                onChange={(e) => setFipeCarro(e.target.value)}
                disabled={loadingFipe || salvandoFipe}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Atual: {formatBRL(fipeCarroAtual)} — abaixo disso, carro dispensa rastreador.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="fipe-moto">Motos — limite mínimo (R$)</Label>
              <Input
                id="fipe-moto"
                type="number"
                min={0}
                step={500}
                value={fipeMoto}
                onChange={(e) => setFipeMoto(e.target.value)}
                disabled={loadingFipe || salvandoFipe}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Atual: {formatBRL(fipeMotoAtual)} — abaixo disso, moto dispensa rastreador.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSalvarFipe} disabled={loadingFipe || salvandoFipe}>
              {salvandoFipe ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar limites
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preferências */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Preferências</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Itens por página</Label>
              <Select value={config.itensPorPagina} onValueChange={(v) => setConfig({ ...config, itensPorPagina: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 itens</SelectItem>
                  <SelectItem value="20">20 itens</SelectItem>
                  <SelectItem value="50">50 itens</SelectItem>
                  <SelectItem value="100">100 itens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Formato de data</Label>
              <Select value={config.formatoData} onValueChange={(v) => setConfig({ ...config, formatoData: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dd/MM/yyyy">DD/MM/AAAA</SelectItem>
                  <SelectItem value="MM/dd/yyyy">MM/DD/AAAA</SelectItem>
                  <SelectItem value="yyyy-MM-dd">AAAA-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Logout automático</Label>
              <Select value={config.autoLogout} onValueChange={(v) => setConfig({ ...config, autoLogout: v })}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                  <SelectItem value="0">Nunca</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg border border-border/50">
            <div>
              <p className="font-medium">Som de notificações</p>
              <p className="text-sm text-muted-foreground">Tocar som ao receber notificações</p>
            </div>
            <Switch
              checked={config.notificacoesSom}
              onCheckedChange={(v) => setConfig({ ...config, notificacoesSom: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
