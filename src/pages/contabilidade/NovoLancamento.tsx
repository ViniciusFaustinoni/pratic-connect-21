import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, FileText, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PartidasEditor, Partida } from '@/components/contabilidade';
import { useCriarLancamento } from '@/hooks/useContabilidade';
import { cn } from '@/lib/utils';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export default function NovoLancamento() {
  const navigate = useNavigate();
  const criarLancamento = useCriarLancamento();

  const [formData, setFormData] = useState({
    data_lancamento: new Date().toISOString().split('T')[0],
    data_competencia: new Date().toISOString().split('T')[0],
    historico: '',
    complemento: '',
    documento_tipo: '',
    documento_numero: '',
  });

  const [partidas, setPartidas] = useState<Partida[]>([
    { id: crypto.randomUUID(), conta_id: '', tipo: 'debito', valor: 0 },
    { id: crypto.randomUUID(), conta_id: '', tipo: 'credito', valor: 0 },
  ]);

  // Cálculos de totais
  const totalDebito = partidas
    .filter((p) => p.tipo === 'debito' && p.valor > 0)
    .reduce((sum, p) => sum + p.valor, 0);
  const totalCredito = partidas
    .filter((p) => p.tipo === 'credito' && p.valor > 0)
    .reduce((sum, p) => sum + p.valor, 0);
  const diferenca = totalDebito - totalCredito;
  const balanceado = Math.abs(diferenca) < 0.01;

  const handleSubmit = async (status: 'rascunho' | 'ativo') => {
    // Validações
    if (!formData.historico.trim()) {
      return;
    }

    if (partidas.length < 2) {
      return;
    }

    const partidasValidas = partidas.filter((p) => p.conta_id && p.valor > 0);
    if (partidasValidas.length < 2) {
      return;
    }

    if (status === 'ativo' && !balanceado) {
      return;
    }

    try {
      await criarLancamento.mutateAsync({
        ...formData,
        status,
        partidas: partidasValidas.map((p) => ({
          conta_id: p.conta_id,
          tipo: p.tipo,
          valor: p.valor,
        })),
      });
      navigate('/contabilidade/lancamentos');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Lançamento</h1>
          <p className="text-muted-foreground">
            Registre um novo lançamento contábil
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Info */}
          <Card>
            <CardHeader>
              <CardTitle>Informações do Lançamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="data_lancamento">Data do Lançamento</Label>
                  <Input
                    id="data_lancamento"
                    type="date"
                    value={formData.data_lancamento}
                    onChange={(e) => setFormData({ ...formData, data_lancamento: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_competencia">Data de Competência</Label>
                  <Input
                    id="data_competencia"
                    type="date"
                    value={formData.data_competencia}
                    onChange={(e) => setFormData({ ...formData, data_competencia: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="historico">Histórico *</Label>
                <Textarea
                  id="historico"
                  value={formData.historico}
                  onChange={(e) => setFormData({ ...formData, historico: e.target.value })}
                  placeholder="Descreva o lançamento..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Textarea
                  id="complemento"
                  value={formData.complemento}
                  onChange={(e) => setFormData({ ...formData, complemento: e.target.value })}
                  placeholder="Informações adicionais (opcional)"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Partidas */}
          <Card>
            <CardHeader>
              <CardTitle>Partidas (Débito/Crédito)</CardTitle>
            </CardHeader>
            <CardContent>
              <PartidasEditor partidas={partidas} onChange={setPartidas} />
            </CardContent>
          </Card>

          {/* Resumo de Balanceamento */}
          <Card className="border-2 border-dashed">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex flex-wrap gap-6">
                  <div>
                    <span className="text-sm text-muted-foreground">Total Débito</span>
                    <p className="text-xl font-bold">{formatCurrency(totalDebito)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Total Crédito</span>
                    <p className="text-xl font-bold">{formatCurrency(totalCredito)}</p>
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Diferença</span>
                    <p className={cn('text-xl font-bold', diferenca !== 0 && 'text-destructive')}>
                      {formatCurrency(Math.abs(diferenca))}
                    </p>
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg font-medium',
                    balanceado
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                  )}
                >
                  {balanceado ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
                  {balanceado ? 'Balanceado' : 'Não Balanceado'}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Document Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="documento_tipo">Tipo</Label>
                <Select
                  value={formData.documento_tipo}
                  onValueChange={(v) => setFormData({ ...formData, documento_tipo: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                    <SelectItem value="recibo">Recibo</SelectItem>
                    <SelectItem value="contrato">Contrato</SelectItem>
                    <SelectItem value="comprovante">Comprovante</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="documento_numero">Número</Label>
                <Input
                  id="documento_numero"
                  value={formData.documento_numero}
                  onChange={(e) => setFormData({ ...formData, documento_numero: e.target.value })}
                  placeholder="Número do documento"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <Button
                className="w-full"
                onClick={() => handleSubmit('ativo')}
                disabled={criarLancamento.isPending || !balanceado}
              >
                <Save className="h-4 w-4 mr-2" />
                {criarLancamento.isPending ? 'Salvando...' : 'Confirmar Lançamento'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSubmit('rascunho')}
                disabled={criarLancamento.isPending}
              >
                Salvar como Rascunho
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate(-1)}
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
