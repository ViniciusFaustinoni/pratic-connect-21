import { useState, useEffect, useCallback } from 'react';
import { useConfigLimitesVeiculo } from '@/hooks/useConfigLimitesVeiculo';
import { useRestricoesAbsolutas } from '@/hooks/useConteudosSistema';
import { useDetectarTipoVeiculo } from '@/hooks/useDetectarTipoVeiculo';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, AlertTriangle, Loader2, Car, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlacaInput } from '@/components/inputs/MaskedInputs';
import { useFipe } from '@/hooks/useFipe';
import { buscarVeiculoPorPlaca } from '@/hooks/useVeiculos';
import type { DadosNovoVeiculo } from '@/types/substituicao';
import { cn } from '@/lib/utils';

interface VeiculoAntigo {
  placa: string;
  modelo: string;
  marca: string;
  valor_fipe: number;
}

interface StepNovoVeiculoProps {
  veiculoAntigo: VeiculoAntigo;
  associadoId: string;
  substituicaoId: string | null;
  dadosNovoVeiculo: Partial<DadosNovoVeiculo>;
  setDadosNovoVeiculo: (dados: Partial<DadosNovoVeiculo>) => void;
  onNext: (veiculoNovoId?: string) => void;
  onBack: () => void;
  onIniciarSubstituicao: () => Promise<string>;
}

const CORES = ['Branco', 'Preto', 'Prata', 'Vermelho', 'Azul', 'Cinza', 'Outro'];
const COMBUSTIVEIS = ['Flex', 'Gasolina', 'Diesel', 'Elétrico', 'Híbrido'];
const PLATAFORMAS = ['Uber', '99', 'iFood', 'Outro'];

export function StepNovoVeiculo({
  veiculoAntigo,
  associadoId,
  substituicaoId,
  dadosNovoVeiculo,
  setDadosNovoVeiculo,
  onNext,
  onBack,
  onIniciarSubstituicao,
}: StepNovoVeiculoProps) {
  const fipe = useFipe();
  const { data: limites } = useConfigLimitesVeiculo();
  const { data: restricoes } = useRestricoesAbsolutas();
  const { tipoVeiculo: tipoAntigo } = useDetectarTipoVeiculo(veiculoAntigo.marca, veiculoAntigo.modelo);
  const { tipoVeiculo: tipoNovo } = useDetectarTipoVeiculo(dadosNovoVeiculo.marca, dadosNovoVeiculo.modelo);
  const [placaExiste, setPlacaExiste] = useState(false);
  const [verificandoPlaca, setVerificandoPlaca] = useState(false);
  const [consultandoFipe, setConsultandoFipe] = useState(false);
  const [criandoVeiculo, setCriandoVeiculo] = useState(false);
  const [chassi, setChassi] = useState('');
  const [renavam, setRenavam] = useState('');

  const dados = dadosNovoVeiculo;

  const tiposDiferentes = !!(dados.marca && dados.modelo && tipoAntigo !== tipoNovo);
  const restricaoMudancaLinhaAtiva = restricoes?.mudanca_linha !== false;
  const bloqueioMudancaLinha = tiposDiferentes && restricaoMudancaLinhaAtiva;

  const updateDados = (partial: Partial<DadosNovoVeiculo>) => {
    setDadosNovoVeiculo({ ...dados, ...partial });
  };

  // Verificar placa quando completa
  useEffect(() => {
    const placa = dados.placa?.replace(/[^a-zA-Z0-9]/g, '') || '';
    if (placa.length >= 7) {
      setVerificandoPlaca(true);
      buscarVeiculoPorPlaca(placa)
        .then((v) => setPlacaExiste(!!v))
        .catch(() => setPlacaExiste(false))
        .finally(() => setVerificandoPlaca(false));
    } else {
      setPlacaExiste(false);
    }
  }, [dados.placa]);

  const handleConsultarFipe = async () => {
    if (!dados.placa || dados.placa.replace(/[^a-zA-Z0-9]/g, '').length < 7) return;
    setConsultandoFipe(true);
    try {
      const result = await fipe.getByPlaca(dados.placa.replace(/[^a-zA-Z0-9]/g, ''));
      if (result.success && result.vehicleData) {
        const vd = result.vehicleData;
        updateDados({
          marca: vd.marca,
          modelo: vd.modelo || vd.marca_modelo,
          ano_fabricacao: vd.ano ? parseInt(vd.ano) : undefined,
          ano_modelo: vd.ano ? parseInt(vd.ano) : undefined,
          cor: vd.cor || dados.cor,
          combustivel: vd.combustivel || dados.combustivel,
          codigo_fipe: result.fipeData?.codigo || '',
          valor_fipe: result.fipeData?.valor || 0,
        });
        if (vd.chassi) setChassi(vd.chassi);
        if (vd.renavam) setRenavam(vd.renavam);
      }
    } catch {
      // error handled by useFipe
    } finally {
      setConsultandoFipe(false);
    }
  };

  const fipeConsultada = !!dados.valor_fipe && dados.valor_fipe > 0;
  const camposObrigatorios = dados.placa && dados.marca && dados.modelo && dados.cor && dados.combustivel && fipeConsultada && !dados.blindado;

  // Criar veículo no banco e avançar
  const handleCriarVeiculoEAvancar = useCallback(async () => {
    if (!camposObrigatorios) return;
    setCriandoVeiculo(true);
    try {
      // Garantir que a substituição existe
      let substId = substituicaoId;
      if (!substId) {
        substId = await onIniciarSubstituicao();
      }

      // Criar veículo com status em_analise
      const { data: novoVeiculo, error } = await supabase
        .from('veiculos')
        .insert({
          associado_id: associadoId,
          placa: dados.placa!,
          marca: dados.marca!,
          modelo: dados.modelo!,
          ano_fabricacao: dados.ano_fabricacao || null,
          ano_modelo: dados.ano_modelo || null,
          cor: dados.cor,
          combustivel: dados.combustivel,
          codigo_fipe: dados.codigo_fipe || null,
          valor_fipe: dados.valor_fipe || 0,
          uso_aplicativo: dados.uso_aplicativo || false,
          plataforma_app: dados.plataforma_app || null,
          blindado: dados.blindado || false,
          status: 'em_analise',
          ativo: false,
          principal: false,
          substituicao_id: substId,
        } as any)
        .select('id')
        .single();

      if (error) throw error;

      // Atualizar substituição com dados do novo veículo
      await supabase
        .from('substituicoes_veiculo')
        .update({
          veiculo_novo_id: novoVeiculo.id,
          veiculo_novo_placa: dados.placa,
          veiculo_novo_modelo: `${dados.marca || ''} ${dados.modelo || ''}`.trim(),
          veiculo_novo_fipe: dados.valor_fipe || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', substId);

      onNext(novoVeiculo.id);
    } catch (err) {
      toast.error('Erro ao salvar veículo: ' + (err as Error).message);
    } finally {
      setCriandoVeiculo(false);
    }
  }, [dados, camposObrigatorios, associadoId, substituicaoId, onIniciarSubstituicao, onNext]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const diferencaFipe = fipeConsultada ? (dados.valor_fipe || 0) - veiculoAntigo.valor_fipe : 0;

  return (
    <div className="space-y-6">
      {/* Placa + Consulta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Car className="h-5 w-5" />
            Dados do Novo Veículo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Placa *</Label>
              <PlacaInput
                value={dados.placa || ''}
                onChange={(v) => updateDados({ placa: v })}
              />
              {verificandoPlaca && <p className="text-xs text-muted-foreground">Verificando...</p>}
              {placaExiste && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">Esta placa já está cadastrada no sistema</AlertDescription>
                </Alert>
              )}
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleConsultarFipe}
                disabled={!dados.placa || dados.placa.replace(/[^a-zA-Z0-9]/g, '').length < 7 || consultandoFipe}
                className="w-full"
              >
                {consultandoFipe ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Consultar FIPE
              </Button>
            </div>
          </div>

          {fipe.error && (
            <Alert variant="destructive">
              <AlertDescription className="text-xs">{fipe.error}</AlertDescription>
            </Alert>
          )}

          {/* Dados preenchidos */}
          {fipeConsultada && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Marca</Label>
                <p className="text-sm font-medium">{dados.marca}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Modelo</Label>
                <p className="text-sm font-medium">{dados.modelo}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Ano</Label>
                <p className="text-sm font-medium">{dados.ano_modelo || '-'}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Código FIPE</Label>
                <p className="text-sm font-medium">{dados.codigo_fipe || '-'}</p>
              </div>
              <div className="space-y-1 col-span-2">
                <Label className="text-xs text-muted-foreground">Valor FIPE</Label>
                <p className="text-sm font-semibold text-primary">{formatCurrency(dados.valor_fipe || 0)}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados adicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados Adicionais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Cor *</Label>
              <Select value={dados.cor || ''} onValueChange={(v) => updateDados({ cor: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CORES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Combustível *</Label>
              <Select value={dados.combustivel || ''} onValueChange={(v) => updateDados({ combustivel: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {COMBUSTIVEIS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Chassi</Label>
              <Input value={chassi} onChange={(e) => setChassi(e.target.value)} placeholder="Chassi" />
            </div>
            <div className="space-y-2">
              <Label>Renavam</Label>
              <Input value={renavam} onChange={(e) => setRenavam(e.target.value)} placeholder="Renavam" />
            </div>
          </div>

          {/* Uso aplicativo */}
          <div className="mt-6 pt-4 border-t space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={dados.blindado || false}
                onCheckedChange={(v) => updateDados({ blindado: v })}
              />
              <Label>Veículo blindado?</Label>
            </div>

            {dados.blindado && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Veículos blindados NÃO são aceitos no processo de substituição de placa. Esta é uma restrição absoluta sem exceção.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={dados.uso_aplicativo || false}
                onCheckedChange={(v) => updateDados({ uso_aplicativo: v, plataforma_app: v ? dados.plataforma_app : undefined })}
              />
              <Label>É veículo de aplicativo?</Label>
            </div>
            {dados.uso_aplicativo && (
              <div className="space-y-2 max-w-xs">
                <Label>Plataforma</Label>
                <Select value={dados.plataforma_app || ''} onValueChange={(v) => updateDados({ plataforma_app: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {PLATAFORMAS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Card comparativo */}
      {fipeConsultada && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comparativo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground"></th>
                    <th className="text-left py-2 px-4 font-medium">Veículo Antigo</th>
                    <th className="text-left py-2 px-4 font-medium">Veículo Novo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Modelo</td>
                    <td className="py-2 px-4">{veiculoAntigo.marca} {veiculoAntigo.modelo}</td>
                    <td className="py-2 px-4">{dados.marca} {dados.modelo}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Placa</td>
                    <td className="py-2 px-4 uppercase">{veiculoAntigo.placa}</td>
                    <td className="py-2 px-4 uppercase">{dados.placa}</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 pr-4 text-muted-foreground">Valor FIPE</td>
                    <td className="py-2 px-4">{formatCurrency(veiculoAntigo.valor_fipe)}</td>
                    <td className="py-2 px-4">{formatCurrency(dados.valor_fipe || 0)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 text-muted-foreground">Diferença FIPE</td>
                    <td className="py-2 px-4">—</td>
                    <td className={cn('py-2 px-4 font-semibold', diferencaFipe > 0 ? 'text-red-600' : 'text-green-600')}>
                      {diferencaFipe > 0 ? '+' : ''}{formatCurrency(diferencaFipe)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {(dados.valor_fipe || 0) > (limites?.fipeLimiteAutorizacao ?? 120000) && (
              <Alert className="mt-4 border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-xs">
                  Veículo acima de R$ {(limites?.fipeLimiteAutorizacao ?? 120000).toLocaleString('pt-BR')} requer autorização especial da diretoria por email.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>Voltar</Button>
        <Button onClick={handleCriarVeiculoEAvancar} disabled={!camposObrigatorios || placaExiste || criandoVeiculo}>
          {criandoVeiculo && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Próximo
        </Button>
      </div>
    </div>
  );
}
