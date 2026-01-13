import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Car, FileText, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { DocumentDropzone } from '@/components/cadastro/DocumentDropzone';
import { DadosExtraidos } from '@/components/cadastro/DadosExtraidos';
import { useExtrairDadosDocumentos, type DadosCliente, type DadosEndereco, type DadosVeiculo } from '@/hooks/useExtrairDadosDocumentos';

export default function CadastroComplementar() {
  const { cotacaoId } = useParams<{ cotacaoId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Estados para dados extraídos
  const [dadosCliente, setDadosCliente] = useState<DadosCliente | null>(null);
  const [dadosEndereco, setDadosEndereco] = useState<DadosEndereco | null>(null);
  const [dadosVeiculo, setDadosVeiculo] = useState<DadosVeiculo | null>(null);
  const [camposFaltantes, setCamposFaltantes] = useState<string[]>([]);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [urlsDocumentos, setUrlsDocumentos] = useState<string[]>([]);

  // Hook de extração
  const extrairDados = useExtrairDadosDocumentos();

  // Buscar cotação
  const { data: cotacao, isLoading: isLoadingCotacao } = useQuery({
    queryKey: ['cotacao', cotacaoId],
    queryFn: async () => {
      if (!cotacaoId) throw new Error('ID da cotação não informado');
      
      const { data, error } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!cotacaoId,
  });

  // Carregar dados extras se já existirem
  useEffect(() => {
    if (cotacao) {
      const dadosExtras = cotacao.dados_extras as Record<string, unknown> | null;
      
      if (dadosExtras) {
        const clienteSalvo = dadosExtras.cliente as DadosCliente | undefined;
        const enderecoSalvo = dadosExtras.endereco as DadosEndereco | undefined;
        const veiculoSalvo = dadosExtras.veiculo_complementar as DadosVeiculo | undefined;
        
        if (clienteSalvo) setDadosCliente(clienteSalvo);
        if (enderecoSalvo) setDadosEndereco(enderecoSalvo);
        if (veiculoSalvo) setDadosVeiculo(veiculoSalvo);
      }
    }
  }, [cotacao]);

  // Handler quando arquivos são uploaded
  const handleFilesUploaded = useCallback(async (urls: string[]) => {
    // Adicionar às URLs existentes
    const novasUrls = [...urlsDocumentos, ...urls];
    setUrlsDocumentos(novasUrls);

    // Processar com IA
    try {
      toast.info('Analisando documentos com IA...');
      
      const resultado = await extrairDados.mutateAsync({ urls: novasUrls });
      
      // Atualizar dados extraídos
      if (resultado.dados_consolidados) {
        if (resultado.dados_consolidados.cliente) {
          setDadosCliente(prev => ({
            ...prev,
            ...resultado.dados_consolidados.cliente,
          }));
        }
        if (resultado.dados_consolidados.endereco) {
          setDadosEndereco(prev => ({
            ...prev,
            ...resultado.dados_consolidados.endereco,
          }));
        }
        if (resultado.dados_consolidados.veiculo) {
          setDadosVeiculo(prev => ({
            ...prev,
            ...resultado.dados_consolidados.veiculo,
          }));
        }
      }
      
      setCamposFaltantes(resultado.campos_faltantes || []);
      setAvisos(resultado.avisos || []);
      
      toast.success('Documentos analisados com sucesso!');
    } catch (error) {
      console.error('Erro ao extrair dados:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao processar documentos');
    }
  }, [urlsDocumentos, extrairDados]);

  // Verificar se pode continuar
  const podeContuniar = useCallback(() => {
    if (!dadosCliente?.nome || !dadosCliente?.cpf || !dadosCliente?.data_nascimento) {
      return false;
    }
    if (!dadosEndereco?.cep || !dadosEndereco?.logradouro || !dadosEndereco?.numero || 
        !dadosEndereco?.bairro || !dadosEndereco?.cidade || !dadosEndereco?.estado) {
      return false;
    }
    if (!dadosVeiculo?.chassi) {
      return false;
    }
    return true;
  }, [dadosCliente, dadosEndereco, dadosVeiculo]);

  // Mutation para salvar dados
  const salvarDados = useMutation({
    mutationFn: async () => {
      if (!cotacaoId || !cotacao) throw new Error('Cotação não encontrada');
      if (!podeContuniar()) throw new Error('Preencha todos os campos obrigatórios');

      const dadosExtrasAtuais = (cotacao.dados_extras as Record<string, unknown>) || {};
      
      const dadosExtrasNovos = {
        ...dadosExtrasAtuais,
        cliente: {
          nome: dadosCliente?.nome,
          cpf: dadosCliente?.cpf,
          data_nascimento: dadosCliente?.data_nascimento,
          rg: dadosCliente?.rg || null,
          email: null, // Será preenchido manualmente ou em outra etapa
          telefone: null, // Será preenchido manualmente ou em outra etapa
          nome_mae: dadosCliente?.nome_mae || null,
          cnh_numero: dadosCliente?.cnh_numero || null,
          cnh_categoria: dadosCliente?.cnh_categoria || null,
          cnh_validade: dadosCliente?.cnh_validade || null,
        },
        endereco: {
          cep: dadosEndereco?.cep,
          logradouro: dadosEndereco?.logradouro,
          numero: dadosEndereco?.numero,
          complemento: dadosEndereco?.complemento || null,
          bairro: dadosEndereco?.bairro,
          cidade: dadosEndereco?.cidade,
          estado: dadosEndereco?.estado,
        },
        veiculo_complementar: {
          chassi: dadosVeiculo?.chassi,
          renavam: dadosVeiculo?.renavam || null,
          cor: dadosVeiculo?.cor || null,
          combustivel: dadosVeiculo?.combustivel || null,
          placa: dadosVeiculo?.placa || null,
        },
        documentos_urls: urlsDocumentos,
      };

      const { error } = await supabase
        .from('cotacoes')
        .update({
          cidade: dadosEndereco?.cidade || null,
          combustivel: dadosVeiculo?.combustivel || null,
          dados_extras: dadosExtrasNovos,
          status: 'aceita',
        })
        .eq('id', cotacaoId);

      if (error) throw error;
      
      return cotacaoId;
    },
    onSuccess: (id) => {
      toast.success('Dados salvos com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['cotacao', id] });
      navigate(`/vendas/gerar-contrato/${id}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao salvar dados:', error);
      toast.error(`Erro ao salvar dados: ${error.message}`);
    },
  });

  // Formatar valor FIPE
  const formatarValorFipe = (valor: number | null | undefined) => {
    if (!valor) return 'N/A';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // Extrair dados do plano do dados_extras
  const dadosExtras = cotacao?.dados_extras as Record<string, unknown> | null;
  const planoNome = (dadosExtras?.plano_nome as string) || 'Plano não definido';
  const valorMensal = cotacao?.valor_total_mensal || 0;
  const valorAdesao = cotacao?.valor_adesao || 0;

  if (isLoadingCotacao) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!cotacao) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Cotação não encontrada</p>
        <Button onClick={() => navigate('/vendas/cotacao')}>
          Voltar para Cotador
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/vendas/cotacao')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">ENVIAR DOCUMENTAÇÃO</h1>
              <p className="text-sm text-muted-foreground">
                Envie os documentos e os dados serão preenchidos automaticamente
              </p>
            </div>
          </div>
          <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            Etapa 1 de 3
          </span>
        </div>

        {/* Card Resumo da Cotação */}
        <Card className="bg-slate-800 text-white border-0">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Car className="h-5 w-5 text-blue-400" />
              <span>
                {cotacao.veiculo_marca} {cotacao.veiculo_modelo} {cotacao.veiculo_ano}
                {cotacao.veiculo_placa && ` • ${cotacao.veiculo_placa}`}
                {cotacao.valor_fipe && ` • FIPE: ${formatarValorFipe(cotacao.valor_fipe)}`}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-green-400" />
              <span>
                {planoNome} • {formatarValorFipe(valorMensal)}/mês • Adesão: {formatarValorFipe(valorAdesao)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Zona de Upload */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">📎 Upload de Documentos</h2>
            <DocumentDropzone 
              onFilesUploaded={handleFilesUploaded}
              isProcessing={extrairDados.isPending}
              disabled={salvarDados.isPending}
            />
          </CardContent>
        </Card>

        {/* Dados Extraídos */}
        <div>
          <h2 className="text-lg font-semibold mb-4">📋 Dados Extraídos</h2>
          <DadosExtraidos
            cliente={dadosCliente}
            endereco={dadosEndereco}
            veiculo={dadosVeiculo}
            camposFaltantes={camposFaltantes}
            avisos={avisos}
          />
        </div>

        {/* Footer */}
        <div className="flex justify-between pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/vendas/cotacao')}
          >
            Cancelar
          </Button>
          <Button 
            onClick={() => salvarDados.mutate()}
            disabled={!podeContuniar() || salvarDados.isPending || extrairDados.isPending}
          >
            {salvarDados.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Continuar para Contrato →'
            )}
          </Button>
        </div>

        {/* Helper text */}
        {!podeContuniar() && (dadosCliente || dadosEndereco || dadosVeiculo) && (
          <p className="text-sm text-center text-muted-foreground">
            ⚠️ Envie documentos adicionais para preencher os campos obrigatórios faltantes
          </p>
        )}
      </div>
    </div>
  );
}
