import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import {
  calcularCotacao,
  gerarTokenCotacao,
  formatarMoeda,
  type CalculoCotacaoParams,
  type ResultadoCotacao,
  type Categoria,
} from '@/config/pricing';

export interface DadosCotacaoAvancada {
  // Lead
  leadId?: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteEmail?: string;
  
  // Veículo
  veiculoMarca?: string;
  veiculoModelo?: string;
  veiculoAno?: number;
  veiculoPlaca?: string;
  veiculoCombustivel?: string;
  valorFipe: number;
  
  // Localização
  cidade: string;
  
  // Cotação
  categoria: Categoria;
  usoAplicativo: boolean;
  linhaPreco: 'SELECT' | 'SELECT_ONE';
  desagio: number;
  adicionais: {
    vidros: boolean;
    carroReserva: boolean;
    guinchoIlimitado: boolean;
    rastreamento: boolean;
  };
}

export interface CotacaoSalva {
  id: string;
  numero: string;
  token_publico: string;
  linkPublico: string;
  cotacao: ResultadoCotacao;
}

export function useCotacaoAvancada() {
  const queryClient = useQueryClient();

  const calcular = (params: CalculoCotacaoParams): ResultadoCotacao => {
    return calcularCotacao(params);
  };

  const salvarCotacaoMutation = useMutation({
    mutationFn: async (dados: DadosCotacaoAvancada): Promise<CotacaoSalva> => {
      const cotacao = calcular({
        valorFipe: dados.valorFipe,
        cidade: dados.cidade,
        combustivel: dados.veiculoCombustivel || 'Gasolina',
        categoria: dados.categoria,
        usoAplicativo: dados.usoAplicativo,
        linhaPreco: dados.linhaPreco,
        desagio: dados.desagio,
        adicionaisSelecionados: dados.adicionais,
      });

      const token = gerarTokenCotacao();

      // Buscar plano correspondente à categoria
      const categoriaParaPlano: Record<Categoria, string> = {
        BASIC: 'BASICO',
        PREMIUM: 'TOTAL',
        EXCLUSIVE: 'PREMIUM',
      };
      
      const { data: plano } = await supabase
        .from('planos')
        .select('id')
        .eq('codigo', categoriaParaPlano[dados.categoria])
        .single();

      if (!plano?.id) {
        throw new Error('Plano não encontrado para a categoria selecionada');
      }

      const valorMensal = cotacao.precoFinal.mensal;
      const valorTotalMensal = valorMensal + cotacao.valorAdicionais;

      const cotacaoData = {
        numero: '', // Será gerado pelo trigger
        lead_id: dados.leadId || null,
        plano_id: plano.id,
        status: 'pendente' as Database['public']['Enums']['status_cotacao'],
        
        // Veículo
        veiculo_marca: dados.veiculoMarca || null,
        veiculo_modelo: dados.veiculoModelo || null,
        veiculo_ano: dados.veiculoAno || null,
        veiculo_placa: dados.veiculoPlaca || null,
        veiculo_combustivel: dados.veiculoCombustivel || null,
        valor_fipe: dados.valorFipe,
        
        // Cotação avançada
        regiao: cotacao.regiao,
        categoria: cotacao.categoria,
        combustivel: cotacao.combustivel,
        uso_aplicativo: dados.usoAplicativo,
        desagio_aplicado: dados.desagio,
        
        // Valores - usando nomes corretos das colunas
        valor_adesao: cotacao.precoFinal.adesao,
        valor_cota: valorMensal,
        valor_total_mensal: valorTotalMensal,
        taxa_administrativa: 0,
        valor_rastreamento: 0,
        valor_adesao_original: cotacao.precoBase.adesao,
        valor_mensal_original: cotacao.precoBase.mensal,
        
        // Adicionais e extras
        adicionais_selecionados: dados.adicionais,
        cidade: dados.cidade,
        token_publico: token,
        dados_extras: {
          linhaPreco: dados.linhaPreco,
          valorAdicionais: cotacao.valorAdicionais,
          adicionaisNomes: cotacao.detalhes.adicionaisSelecionados,
          faixaFipe: cotacao.faixaFipe,
          calculadoEm: new Date().toISOString(),
          clienteNome: dados.clienteNome,
          clienteTelefone: dados.clienteTelefone,
          clienteEmail: dados.clienteEmail,
        },
      };

      const { data: cotacaoSalva, error } = await supabase
        .from('cotacoes')
        .insert(cotacaoData)
        .select()
        .single();

      if (error) throw error;

      // Atualizar lead se existir
      if (dados.leadId) {
        await supabase
          .from('leads')
          .update({
            etapa: 'cotacao_enviada',
            updated_at: new Date().toISOString(),
          })
          .eq('id', dados.leadId);
      }

      const linkPublico = `${window.location.origin}/cotacao/${token}`;

      return {
        id: cotacaoSalva.id,
        numero: cotacaoSalva.numero,
        token_publico: token,
        linkPublico,
        cotacao,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cotacoes'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Cotação gerada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar cotação: ${error.message}`);
    },
  });

  const gerarMensagemWhatsApp = (
    dados: DadosCotacaoAvancada,
    cotacao: ResultadoCotacao,
    linkPublico: string
  ): string => {
    const veiculo = `${dados.veiculoMarca || ''} ${dados.veiculoModelo || ''} ${dados.veiculoAno || ''}`.trim();
    const primeiroNome = dados.clienteNome?.split(' ')[0] || 'Cliente';

    return `🚗 *PRATIC - Proteção Veicular*

Olá ${primeiroNome}! 

Preparamos uma cotação especial para você:

📋 *Veículo:* ${veiculo || 'Não informado'}
💰 *Valor FIPE:* ${formatarMoeda(dados.valorFipe)}

📦 *Plano ${cotacao.categoria}*
${cotacao.detalhes.descricaoCategoria}

💵 *Adesão:* ${formatarMoeda(cotacao.precoFinal.adesao)}
💳 *Mensalidade:* ${formatarMoeda(cotacao.precoFinal.mensal)}

${dados.usoAplicativo ? '⚠️ _Cotação para uso em aplicativo (Uber, 99, etc)_\n' : ''}
${cotacao.detalhes.adicionaisSelecionados.length > 0 ? `✨ *Adicionais inclusos:* ${cotacao.detalhes.adicionaisSelecionados.join(', ')}\n` : ''}

🔗 *Clique no link abaixo para ver sua cotação:*
${linkPublico}

Qualquer dúvida, estou à disposição! 😊`;
  };

  const abrirWhatsApp = async (dados: DadosCotacaoAvancada) => {
    try {
      const result = await salvarCotacaoMutation.mutateAsync(dados);
      const mensagem = gerarMensagemWhatsApp(dados, result.cotacao, result.linkPublico);
      const telefone = dados.clienteTelefone?.replace(/\D/g, '');

      if (telefone) {
        const urlWhatsApp = `https://wa.me/55${telefone}?text=${encodeURIComponent(mensagem)}`;
        window.open(urlWhatsApp, '_blank');
      } else {
        toast.error('Telefone não informado');
      }

      return result;
    } catch (error) {
      console.error('Erro ao abrir WhatsApp:', error);
      throw error;
    }
  };

  const copiarLink = async (dados: DadosCotacaoAvancada) => {
    try {
      const result = await salvarCotacaoMutation.mutateAsync(dados);
      await navigator.clipboard.writeText(result.linkPublico);
      toast.success('Link copiado para a área de transferência!');
      return result;
    } catch (error) {
      console.error('Erro ao copiar link:', error);
      throw error;
    }
  };

  return {
    calcular,
    salvarCotacao: salvarCotacaoMutation.mutateAsync,
    abrirWhatsApp,
    copiarLink,
    isLoading: salvarCotacaoMutation.isPending,
    formatarMoeda,
  };
}
