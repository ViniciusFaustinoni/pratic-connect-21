import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Square, Wrench, Receipt, Upload, CheckCircle, 
  AlertTriangle, Loader2, ExternalLink 
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
  };
}

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
  const [valorTotal, setValorTotal] = useState<string>(sinistro.valor_reembolso ? String(Math.round((sinistro.valor_reembolso / 0.6) * 100) / 100) : '');
  const [uploading, setUploading] = useState(false);

  const peca = sinistro.peca_danificada;
  const opcao = sinistro.opcao_reparo;
  const observacao = peca ? OBSERVACOES_PECAS[peca] : null;

  const valorTotalNum = parseFloat(valorTotal) || 0;
  const valorPratic = valorTotalNum * 0.6;
  const valorAssociado = valorTotalNum * 0.4;

  const updateReembolso = useMutation({
    mutationFn: async ({ valor, nfUrl }: { valor?: number; nfUrl?: string }) => {
      const updateData: any = {};
      if (valor !== undefined) updateData.valor_reembolso = valor;
      if (nfUrl !== undefined) updateData.nf_reembolso_url = nfUrl;
      
      const { error } = await supabase
        .from('sinistros')
        .update(updateData)
        .eq('id', sinistro.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistro', sinistro.id] });
      toast.success('Dados atualizados!');
    },
    onError: () => toast.error('Erro ao atualizar dados'),
  });

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

      await updateReembolso.mutateAsync({ nfUrl: urlData.publicUrl });
    } catch (err) {
      console.error('Erro no upload da NF:', err);
      toast.error('Erro ao enviar nota fiscal');
    } finally {
      setUploading(false);
    }
  };

  const handleSalvarValor = () => {
    if (valorTotalNum <= 0) return;
    updateReembolso.mutate({ valor: valorPratic });
  };

  if (!peca) return null;

  return (
    <Card className="border-blue-500/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Square className="h-5 w-5" />
          Vidros e Faróis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Peça danificada */}
        <div>
          <p className="text-xs text-muted-foreground">Peça Danificada</p>
          <p className="font-medium text-sm">{peca}</p>
        </div>

        {/* Observação sobre peças específicas */}
        {observacao && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800">{observacao}</p>
          </div>
        )}

        {/* Opção de reparo */}
        <div>
          <p className="text-xs text-muted-foreground">Opção de Reparo</p>
          <Badge variant="outline" className="mt-1">
            {opcao === 'via_pratic' ? (
              <><Wrench className="h-3 w-3 mr-1" /> Via Pratic (60/40)</>
            ) : (
              <><Receipt className="h-3 w-3 mr-1" /> Reembolso (60%)</>
            )}
          </Badge>
        </div>

        <Separator />

        {/* Via Pratic */}
        {opcao === 'via_pratic' && (
          <div className="space-y-3">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pratic paga:</span>
                <span className="font-medium text-green-600">60%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Associado paga:</span>
                <span className="font-medium">40% (no ato da instalação)</span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/fornecedores?especialidade=Vidros+e+Far%C3%B3is')}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Buscar Auto Center Credenciado
            </Button>
          </div>
        )}

        {/* Reembolso */}
        {opcao === 'reembolso' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Valor Total da Peça (R$)</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className="text-sm"
                />
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleSalvarValor}
                  disabled={valorTotalNum <= 0 || updateReembolso.isPending}
                >
                  {updateReembolso.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Salvar'}
                </Button>
              </div>
            </div>

            {valorTotalNum > 0 && (
              <div className="text-xs space-y-1 p-2 bg-muted rounded-md">
                <div className="flex justify-between">
                  <span>Valor total:</span>
                  <span className="font-medium">{formatCurrency(valorTotalNum)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Reembolso (60%):</span>
                  <span className="font-medium">{formatCurrency(valorPratic)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Associado (40%):</span>
                  <span className="font-medium">{formatCurrency(valorAssociado)}</span>
                </div>
              </div>
            )}

            <Separator />

            {/* Upload NF */}
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
