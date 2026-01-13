import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useGerarContrato } from '@/hooks/useContratos';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, User, CreditCard, Mail, Phone, MapPin, 
  Car, Hash, DollarSign, Star, CheckCircle, 
  AlertTriangle, Loader2, FileSignature 
} from 'lucide-react';
import { toast } from 'sonner';

interface DadosExtras {
  plano_codigo?: string;
  plano_nome?: string;
  plano_linha?: string;
  plano_nivel?: string;
  coberturas?: string[];
  cliente?: {
    nome: string;
    cpf: string;
    email: string;
    telefone: string;
    data_nascimento: string;
    rg?: string;
  };
  endereco?: {
    logradouro: string;
    numero: string;
    complemento?: string;
    bairro: string;
    cidade: string;
    estado: string;
    cep: string;
  };
  veiculo_complementar?: {
    chassi: string;
    renavam?: string;
    cor?: string;
    combustivel?: string;
  };
}

export default function GerarContrato() {
  const { cotacaoId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const gerarContrato = useGerarContrato();
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: cotacao, isLoading } = useQuery({
    queryKey: ['cotacao-gerar-contrato', cotacaoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*, plano:planos(*)')
        .eq('id', cotacaoId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
  });

  const dadosExtras = cotacao?.dados_extras as DadosExtras | null;

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const enderecoCompleto = dadosExtras?.endereco
    ? `${dadosExtras.endereco.logradouro}, ${dadosExtras.endereco.numero}${
        dadosExtras.endereco.complemento ? ` - ${dadosExtras.endereco.complemento}` : ''
      } - ${dadosExtras.endereco.bairro}, ${dadosExtras.endereco.cidade}/${dadosExtras.endereco.estado}`
    : null;

  const veiculoDescricao = cotacao
    ? `${cotacao.veiculo_marca || ''} ${cotacao.veiculo_modelo || ''} ${cotacao.veiculo_ano || ''}`.trim()
    : '';

  const dadosCompletos = !!(
    dadosExtras?.cliente?.nome &&
    dadosExtras?.cliente?.cpf &&
    dadosExtras?.cliente?.email &&
    dadosExtras?.endereco?.logradouro &&
    dadosExtras?.veiculo_complementar?.chassi
  );

  // Status 'aceita' significa que já foi aceita e pode ser convertida
  const cotacaoJaConvertida = cotacao?.status === 'aceita' && false; // Permitir gerar contrato de cotações aceitas

  const handleGerarContrato = async () => {
    if (!cotacao || !profile?.user_id) {
      toast.error('Dados incompletos para gerar contrato');
      return;
    }

    if (!dadosCompletos) {
      toast.error('Por favor, complete todos os dados antes de gerar o contrato');
      navigate(`/vendas/cadastro-complementar/${cotacaoId}`);
      return;
    }

    setIsProcessing(true);

    try {
      const resultado = await gerarContrato.mutateAsync({
        cotacaoId: cotacao.id,
        vendedorId: profile.user_id,
      });

      toast.success('Contrato gerado com sucesso!');
      navigate(`/vendas/contrato-enviado/${resultado.id}`);
    } catch (error) {
      console.error('Erro ao gerar contrato:', error);
      toast.error('Erro ao gerar contrato. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!cotacao) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Cotação não encontrada.</AlertDescription>
        </Alert>
        <Button 
          variant="outline" 
          onClick={() => navigate('/vendas/cotacoes')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Cotações
        </Button>
      </div>
    );
  }

  const coberturas = dadosExtras?.coberturas || [];

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/vendas/cadastro-complementar/${cotacaoId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold">GERAR CONTRATO</h1>
        </div>
        <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
          Etapa 2 de 3
        </span>
      </div>

      {/* Card Contratante + Veículo */}
      <Card>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Coluna Contratante */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">CONTRATANTE</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{dadosExtras?.cliente?.nome || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                  <span>{dadosExtras?.cliente?.cpf || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <span>{dadosExtras?.cliente?.email || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <span>{dadosExtras?.cliente?.telefone || '-'}</span>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <span className="text-sm">{enderecoCompleto || '-'}</span>
                </div>
              </div>
            </div>

            {/* Coluna Veículo */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b pb-2">VEÍCULO</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Car className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium">{veiculoDescricao || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <span>Placa: {cotacao.veiculo_placa || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Hash className="h-5 w-5 text-muted-foreground" />
                  <span>Chassi: {dadosExtras?.veiculo_complementar?.chassi || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-muted-foreground" />
                  <span>FIPE: {formatCurrency(cotacao.valor_fipe)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card Plano Selecionado */}
      <Card className="bg-slate-800 text-white border-0">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            <h3 className="text-xl font-bold">
              {dadosExtras?.plano_nome || cotacao.plano?.nome || 'Plano Selecionado'}
            </h3>
          </div>

          {/* Coberturas */}
          {coberturas.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {coberturas.slice(0, 9).map((cobertura, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-white/90">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span>{cobertura}</span>
                </div>
              ))}
              {coberturas.length > 9 && (
                <div className="flex items-center gap-2 text-sm text-white/70">
                  <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                  <span>+{coberturas.length - 9} coberturas adicionais</span>
                </div>
              )}
            </div>
          )}

          {/* Valores */}
          <div className="bg-slate-700/50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-white/60 uppercase">Adesão</p>
              <p className="text-lg font-bold">{formatCurrency(cotacao.valor_adesao)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase">Mensalidade</p>
              <p className="text-lg font-bold">{formatCurrency(cotacao.valor_total_mensal)}</p>
            </div>
            <div>
              <p className="text-xs text-white/60 uppercase">Dia Vencimento</p>
              <p className="text-lg font-bold">Todo dia 10</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerta de Confirmação */}
      <Alert className="bg-amber-50 border-amber-200 text-amber-800">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <AlertDescription className="text-amber-700">
          Ao continuar, um contrato será gerado e enviado para assinatura digital via Autentique. 
          O cliente receberá o link por WhatsApp e E-mail.
        </AlertDescription>
      </Alert>

      {/* Dados Incompletos Warning */}
      {!dadosCompletos && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription>
            Dados incompletos. Por favor, volte e complete todos os campos obrigatórios antes de gerar o contrato.
          </AlertDescription>
        </Alert>
      )}

      {/* Cotação já convertida Warning */}
      {cotacaoJaConvertida && (
        <Alert variant="destructive">
          <AlertTriangle className="h-5 w-5" />
          <AlertDescription>
            Esta cotação já foi convertida em contrato e não pode ser processada novamente.
          </AlertDescription>
        </Alert>
      )}

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/vendas/cadastro-complementar/${cotacaoId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar e Editar
        </Button>
        <Button
          size="lg"
          onClick={handleGerarContrato}
          disabled={isProcessing || !dadosCompletos || cotacaoJaConvertida}
          className="min-w-[200px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Gerando contrato...
            </>
          ) : (
            <>
              <FileSignature className="h-4 w-4 mr-2" />
              Gerar e Enviar Contrato
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
