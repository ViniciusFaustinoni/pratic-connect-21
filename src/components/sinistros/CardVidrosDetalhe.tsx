import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Square, Wrench, Receipt, Upload, CheckCircle, 
  AlertTriangle, Loader2, ExternalLink, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CardVidrosDetalheProps {
  sinistro: {
    id: string;
    peca_danificada?: string | null;
    opcao_reparo?: string | null;
    valor_reembolso?: number | null;
    nf_reembolso_url?: string | null;
    valor_fipe?: number | null;
    status: string;
    veiculo?: { marca?: string } | null;
    fluxo_simplificado?: boolean | null;
  };
}

const PECAS_VIDROS = [
  'Parabrisa',
  'Vidro traseiro',
  'Vidro lateral dianteiro esquerdo',
  'Vidro lateral dianteiro direito',
  'Vidro lateral traseiro esquerdo',
  'Vidro lateral traseiro direito',
  'Farol esquerdo',
  'Farol direito',
  'Lanterna esquerda',
  'Lanterna direita',
  'Espelho retrovisor esquerdo',
  'Espelho retrovisor direito',
];

const OBSERVACOES_PECAS: Record<string, string> = {
  'Farol esquerdo': 'Apenas a peça é fornecida. Instalação por conta do associado.',
  'Farol direito': 'Apenas a peça é fornecida. Instalação por conta do associado.',
  'Lanterna esquerda': 'Apenas a peça é fornecida. Instalação por conta do associado.',
  'Lanterna direita': 'Apenas a peça é fornecida. Instalação por conta do associado.',
  'Espelho retrovisor esquerdo': 'Apenas o espelho é fornecido. Se o suporte estiver quebrado, é por conta do associado.',
  'Espelho retrovisor direito': 'Apenas o espelho é fornecido. Se o suporte estiver quebrado, é por conta do associado.',
};

const formatCurrency = (value: number | null | undefined) => {
  if (!value) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function CardVidrosDetalhe({ sinistro }: CardVidrosDetalheProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [valorTotal, setValorTotal] = useState<string>(sinistro.valor_reembolso ? String(Math.round((sinistro.valor_reembolso / 0.6) * 100) / 100) : '');
  const [uploading, setUploading] = useState(false);
  const [selectedPeca, setSelectedPeca] = useState<string>(sinistro.peca_danificada || '');
  const [selectedOpcao, setSelectedOpcao] = useState<string>(sinistro.opcao_reparo || '');
  const [salvando, setSalvando] = useState(false);

  const peca = sinistro.peca_danificada || selectedPeca;
  const opcao = sinistro.opcao_reparo || selectedOpcao;
  const observacao = peca ? OBSERVACOES_PECAS[peca] : null;

  const valorTotalNum = parseFloat(valorTotal) || 0;
  const valorPratic = valorTotalNum * 0.6;
  const valorAssociado = valorTotalNum * 0.4;

  // Determinar etapa atual baseada no status
  const etapaAtual = sinistro.status === 'em_analise' ? 1 
    : ['aprovado', 'em_reparo'].includes(sinistro.status) ? 2 
    : sinistro.status === 'concluido' ? 3 : 0;

  const updateSinistro = useMutation({
    mutationFn: async (updateData: Record<string, any>) => {
      const { error } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', sinistro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
    },
  });

  const handleAprovarReparo = async () => {
    if (!peca || !opcao) {
      toast.error('Selecione a peça danificada e a opção de reparo');
      return;
    }
    setSalvando(true);
    try {
      // Salvar peça e opção, mudar status para aprovado
      await updateSinistro.mutateAsync({
        peca_danificada: peca,
        opcao_reparo: opcao,
        status: 'aprovado',
      });

      // Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'em_analise',
        status_novo: 'aprovado',
        usuario_id: user?.id,
        observacao: `Reparo de vidros aprovado - Peça: ${peca} - Via: ${opcao === 'via_pratic' ? 'Auto Center Credenciado' : 'Reembolso'}`,
      });

      toast.success('Reparo aprovado com sucesso!');
    } catch {
      toast.error('Erro ao aprovar reparo');
    } finally {
      setSalvando(false);
    }
  };

  const handleConcluir = async () => {
    if (valorTotalNum <= 0) {
      toast.error('Informe o valor total');
      return;
    }
    if (opcao === 'reembolso' && !sinistro.nf_reembolso_url) {
      toast.error('Envie a nota fiscal antes de concluir');
      return;
    }
    setSalvando(true);
    try {
      await updateSinistro.mutateAsync({
        valor_reembolso: valorPratic,
        status: 'concluido',
      });

      // Gerar conta a pagar
      const descricaoConta = opcao === 'via_pratic'
        ? `Vidros - ${peca} - Auto Center (60% Pratic)`
        : `Vidros - ${peca} - Reembolso (60% Pratic)`;

      await supabase.from('contas_pagar').insert({
        fornecedor_nome: opcao === 'via_pratic' ? 'Auto Center Credenciado' : 'Reembolso Associado',
        valor: valorPratic,
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        data_emissao: new Date().toISOString().split('T')[0],
        status: 'pendente',
        categoria: 'sinistros',
        referencia_tipo: 'sinistro',
        referencia_id: sinistro.id,
        observacao: `${descricaoConta} - Valor total: ${formatCurrency(valorTotalNum)} | Pratic (60%): ${formatCurrency(valorPratic)} | Associado (40%): ${formatCurrency(valorAssociado)}`,
      });

      // Registrar histórico
      await supabase.from('sinistro_historico').insert({
        sinistro_id: sinistro.id,
        status_anterior: 'aprovado',
        status_novo: 'concluido',
        usuario_id: user?.id,
        observacao: `Sinistro de vidros concluído - Valor total: ${formatCurrency(valorTotalNum)} | Pratic: ${formatCurrency(valorPratic)} | Associado: ${formatCurrency(valorAssociado)}`,
      });

      toast.success('Sinistro de vidros concluído!');
    } catch {
      toast.error('Erro ao concluir sinistro');
    } finally {
      setSalvando(false);
    }
  };

  const handleUploadNF = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `sinistros/${sinistro.id}/nf_reembolso.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(path, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(path);

      await updateSinistro.mutateAsync({ nf_reembolso_url: urlData.publicUrl });
      toast.success('Nota fiscal enviada!');
    } catch (err) {
      console.error('Erro no upload da NF:', err);
      toast.error('Erro ao enviar nota fiscal');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="border-blue-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Square className="h-5 w-5" />
          Vidros e Faróis — Fluxo Simplificado
        </CardTitle>
        {sinistro.fluxo_simplificado && (
          <Badge variant="outline" className="w-fit text-xs bg-blue-50 text-blue-700 border-blue-200">
            Sem vistoria presencial
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant={etapaAtual >= 1 ? 'default' : 'secondary'} className="text-xs">1. Análise</Badge>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant={etapaAtual >= 2 ? 'default' : 'secondary'} className="text-xs">2. Conclusão</Badge>
          {etapaAtual >= 3 && (
            <>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <Badge className="bg-green-100 text-green-800 text-xs">✓ Concluído</Badge>
            </>
          )}
        </div>

        <Separator />

        {/* ===== ETAPA 1: ANÁLISE ===== */}
        {etapaAtual === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Etapa 1 — Análise da Peça</p>

            {/* Selecionar peça */}
            {!sinistro.peca_danificada && (
              <div className="space-y-2">
                <Label className="text-xs">Peça Danificada</Label>
                <Select value={selectedPeca} onValueChange={setSelectedPeca}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a peça" />
                  </SelectTrigger>
                  <SelectContent>
                    {PECAS_VIDROS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {sinistro.peca_danificada && (
              <div>
                <p className="text-xs text-muted-foreground">Peça Danificada</p>
                <p className="font-medium text-sm">{sinistro.peca_danificada}</p>
              </div>
            )}

            {/* Observação sobre peças específicas */}
            {observacao && peca && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">{observacao}</p>
              </div>
            )}

            {/* Opção de reparo */}
            {!sinistro.opcao_reparo && (
              <div className="space-y-2">
                <Label className="text-xs">Opção de Reparo</Label>
                <Select value={selectedOpcao} onValueChange={setSelectedOpcao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a opção" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="via_pratic">
                      <span className="flex items-center gap-2">
                        <Wrench className="h-3 w-3" /> Via Auto Center Credenciado (60/40)
                      </span>
                    </SelectItem>
                    <SelectItem value="reembolso">
                      <span className="flex items-center gap-2">
                        <Receipt className="h-3 w-3" /> Reembolso (60%)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Resumo 60/40 */}
            {(opcao || selectedOpcao) && (
              <div className="text-xs space-y-1 p-2 bg-muted rounded-md">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pratic paga:</span>
                  <span className="font-medium text-green-600">60%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Associado paga:</span>
                  <span className="font-medium">40%</span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!peca || !opcao || salvando}
              onClick={handleAprovarReparo}
            >
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Aprovar Reparo
            </Button>
          </div>
        )}

        {/* ===== ETAPA 2: CONCLUSÃO ===== */}
        {etapaAtual === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">Etapa 2 — Conclusão</p>

            {/* Info peça e opção */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Peça</p>
                <p className="font-medium text-sm">{peca}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Via</p>
                <Badge variant="outline" className="mt-0.5">
                  {opcao === 'via_pratic' ? (
                    <><Wrench className="h-3 w-3 mr-1" /> Auto Center</>
                  ) : (
                    <><Receipt className="h-3 w-3 mr-1" /> Reembolso</>
                  )}
                </Badge>
              </div>
            </div>

            {observacao && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800">{observacao}</p>
              </div>
            )}

            <Separator />

            {/* Valor total */}
            <div className="space-y-2">
              <Label className="text-xs">Valor Total da Peça (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className="text-sm"
              />
            </div>

            {valorTotalNum > 0 && (
              <div className="text-xs space-y-1 p-2 bg-muted rounded-md">
                <div className="flex justify-between">
                  <span>Valor total:</span>
                  <span className="font-medium">{formatCurrency(valorTotalNum)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Pratic (60%):</span>
                  <span className="font-medium">{formatCurrency(valorPratic)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Associado (40%):</span>
                  <span className="font-medium">{formatCurrency(valorAssociado)}</span>
                </div>
              </div>
            )}

            {/* Via Auto Center: buscar credenciado */}
            {opcao === 'via_pratic' && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate('/fornecedores?especialidade=Vidros+e+Far%C3%B3is')}
              >
                <Wrench className="h-4 w-4 mr-2" />
                Buscar Auto Center Credenciado
              </Button>
            )}

            {/* Reembolso: upload NF */}
            {opcao === 'reembolso' && (
              <div className="space-y-2">
                <Label className="text-xs">Nota Fiscal DANFE</Label>
                {sinistro.nf_reembolso_url ? (
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      NF Enviada
                    </Badge>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={sinistro.nf_reembolso_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleUploadNF}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={uploading}
                    />
                    <Button variant="outline" size="sm" className="w-full" disabled={uploading}>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      {uploading ? 'Enviando...' : 'Enviar NF DANFE'}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Button
              className="w-full"
              disabled={valorTotalNum <= 0 || (opcao === 'reembolso' && !sinistro.nf_reembolso_url) || salvando}
              onClick={handleConcluir}
            >
              {salvando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Concluir Sinistro
            </Button>
          </div>
        )}

        {/* ===== CONCLUÍDO ===== */}
        {etapaAtual >= 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-sm text-green-800">Sinistro de vidros concluído</p>
                <p className="text-xs text-green-700">
                  Peça: {peca} | {opcao === 'via_pratic' ? 'Via Auto Center' : 'Reembolso'}
                </p>
              </div>
            </div>

            {sinistro.valor_reembolso && (
              <div className="text-xs space-y-1 p-2 bg-muted rounded-md">
                <div className="flex justify-between text-green-600">
                  <span>Valor Pratic (60%):</span>
                  <span className="font-medium">{formatCurrency(sinistro.valor_reembolso)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
