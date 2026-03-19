import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ============================================
// Hook genérico para buscar configurações do banco
// ============================================

function useConfiguracao<T>(chave: string, parse: (val: string) => T, fallback: T) {
  return useQuery({
    queryKey: ['configuracao', chave],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', chave)
        .single();

      if (error || !data?.valor) return fallback;
      return parse(data.valor);
    },
    staleTime: 1000 * 60 * 10, // 10 minutos
  });
}

export function useConfiguracaoNumero(chave: string, fallback: number) {
  return useConfiguracao(chave, (v) => parseFloat(v) || fallback, fallback);
}

function useConfiguracaoTexto(chave: string, fallback: string) {
  return useConfiguracao(chave, (v) => v, fallback);
}

export function useConfiguracaoJson<T>(chave: string, fallback: T) {
  return useConfiguracao(chave, (v) => {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }, fallback);
}

const MARCAS_ACEITAS_MOTOS_DEFAULT = ['Honda', 'Yamaha', 'Shineray', 'BMW', 'Haojue', 'Suzuki'];

export function useMarcasAceitasMotos() {
  return useConfiguracaoJson<string[]>('marcas_aceitas_motos', MARCAS_ACEITAS_MOTOS_DEFAULT);
}

// ============================================
// Contatos
// ============================================

export interface Contatos {
  cadastro: string;
  comercial: string;
  assistencia: string;
}

export function useContatos() {
  return useQuery({
    queryKey: ['configuracoes', 'contatos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['contato_cadastro', 'contato_comercial', 'contato_assistencia', 'assistencia_telefone_central']);

      if (error) throw error;

      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        cadastro: map.contato_cadastro || '21 98393-4083',
        comercial: map.contato_comercial || '21 99129-6732',
        assistencia: map.contato_assistencia || map.assistencia_telefone_central || '0800 980 0001',
      } as Contatos;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// Glossário
// ============================================

export interface TermoGlossario {
  termo: string;
  definicao: string;
}

export function useGlossario() {
  return useConfiguracaoJson<TermoGlossario[]>('glossario_consultor', []);
}

// ============================================
// Regras Importantes
// ============================================

export interface RegraImportante {
  titulo: string;
  icone: string;
  itens: string[];
}

export function useRegrasImportantes() {
  return useConfiguracaoJson<RegraImportante[]>('regras_importantes', []);
}

// ============================================
// Cotas e Taxas
// ============================================

export interface CotasTaxas {
  categoria: string;
  percentual: string;
  minimo: string;
  comDesagio?: string;
  minimoDesagio?: string;
}

export function useCotasTaxas() {
  return useConfiguracaoJson<CotasTaxas[]>('cotas_taxas', []);
}

// ============================================
// Taxas de Procedimentos
// ============================================

export interface TaxaProcedimento {
  procedimento: string;
  taxa: string;
}

export function useTaxasProcedimentos() {
  return useConfiguracaoJson<TaxaProcedimento[]>('taxas_procedimentos', []);
}

// ============================================
// Veículos Aceitos
// ============================================

export function useVeiculosAceitos() {
  return useConfiguracaoJson<Record<string, string[]>>('veiculos_aceitos', {});
}

export function useMotosAceitas() {
  return useConfiguracaoJson<Record<string, string>>('motos_aceitas', {});
}

// ============================================
// Taxa de Substituição
// ============================================

export function useTaxaSubstituicao() {
  return useConfiguracaoNumero('taxa_substituicao', 50);
}

// ============================================
// Taxas fallback (para cálculo de mensalidade quando tabelas_preco não tem valor)
// ============================================

export function useTaxaFallbackCarro() {
  return useConfiguracaoNumero('taxa_fallback_carro', 0.025);
}

export function useTaxaFallbackMoto() {
  return useConfiguracaoNumero('taxa_fallback_moto', 0.03);
}

// ============================================
// Decomposição da mensalidade
// ============================================

export interface DecomposicaoMensalidade {
  cota: number;
  admin: number;
  rastreamento: number;
  assistencia: number;
}

// ============================================
// Categorias de Veículo
// ============================================

export interface CategoriaVeiculo {
  value: string;
  label: string;
}

export function useCategoriasVeiculo() {
  return useConfiguracaoJson<CategoriaVeiculo[]>('categorias_veiculo', [
    { value: 'chassi_remarcado', label: 'Chassi remarcado' },
    { value: 'placa_vermelha', label: 'Placa vermelha' },
    { value: 'aplicativo', label: 'Veículo utilizado para aplicativos de transporte' },
    { value: 'leilao', label: 'Veículo proveniente de leilão' },
    { value: 'ressarcimento_integral', label: 'Veículo que já teve ressarcimento integral' },
    { value: 'ex_taxi', label: 'Ex-táxi' },
    { value: 'taxi', label: 'Táxi' },
    { value: 'nenhuma', label: 'Nenhuma das opções' },
  ]);
}

// ============================================
// Observações por Categoria
// ============================================

export function useObservacoesCategoria() {
  return useConfiguracaoJson<Record<string, string>>('observacoes_categoria', {});
}

// ============================================
// Template WhatsApp Cotação
// ============================================

export function useTemplateWhatsappCotacao() {
  return useConfiguracaoTexto('template_whatsapp_cotacao', '✨ *Benefícios exclusivos PRATIC:*\n• Cobertura 100% da tabela FIPE\n• Sem análise de perfil\n• Aprovação em até 24h\n• App exclusivo para associados');
}

// ============================================
// Decomposição da Mensalidade
// ============================================

export function useConfigDecomposicao() {
  return useQuery({
    queryKey: ['configuracoes', 'decomposicao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['decomposicao_cota', 'decomposicao_admin', 'decomposicao_rastreamento', 'decomposicao_assistencia']);

      if (error) throw error;

      const map = Object.fromEntries((data || []).map(d => [d.chave, parseFloat(d.valor) || 0]));
      return {
        cota: map.decomposicao_cota || 0.60,
        admin: map.decomposicao_admin || 0.25,
        rastreamento: map.decomposicao_rastreamento || 0.10,
        assistencia: map.decomposicao_assistencia || 0.05,
      } as DecomposicaoMensalidade;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// Defaults de Cota de Participação
// ============================================

export function useCotaParticipacaoDefault() {
  return useConfiguracaoNumero('cota_participacao_default', 6);
}

export function useCotaMinimaDefault() {
  return useConfiguracaoNumero('cota_minima_default', 1200);
}

// ============================================
// Multa Rastreador
// ============================================

export function useMultaRastreador() {
  return useConfiguracaoNumero('multa_rastreador', 400);
}

// ============================================
// Taxas de Adesão e Procedimentos
// ============================================

export function useTaxaAdesaoPercentual() {
  return useConfiguracaoNumero('taxa_adesao_percentual_fipe', 1);
}

export function useTaxaAdesaoMinimoVolante() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante', 100);
}

export function useTaxaAdesaoMinimoVolanteInterno() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante_interno', 150);
}

export function useTaxaAdesaoMinimoVolanteExterno() {
  return useConfiguracaoNumero('taxa_adesao_minimo_volante_externo', 50);
}

export function useTaxaAdesaoMinimoBase() {
  return useConfiguracaoNumero('taxa_adesao_minimo_base', 100);
}

export function useTaxaRepasseVolante() {
  return useConfiguracaoNumero('taxa_repasse_volante', 50);
}

export function useTaxaRepasseVolanteExterno() {
  return useConfiguracaoNumero('taxa_repasse_volante_externo', 50);
}

export function useTaxaSubstituicaoPlaca() {
  return useConfiguracaoNumero('taxa_substituicao_placa', 50);
}

export function useTaxaTrocaTitularidade() {
  return useConfiguracaoNumero('taxa_troca_titularidade', 50);
}

export function useTaxaRevistoria() {
  return useConfiguracaoNumero('taxa_revistoria', 50);
}

// ============================================
// Carência
// ============================================

export function useCarenciaDiasPadrao() {
  return useConfiguracaoNumero('carencia_dias_padrao', 120);
}

// ============================================
// Defaults de Cota Deságio (Aplicativo)
// ============================================

export function useCotaDesagioDefault() {
  return useConfiguracaoNumero('cota_desagio_default', 8);
}

export function useCotaMinimaDesagioDefault() {
  return useConfiguracaoNumero('cota_minima_desagio_default', 2000);
}

// ============================================
// Defaults do Form de Plano
// ============================================

export function useCoberturaFipeDefault() {
  return useConfiguracaoNumero('cobertura_fipe_default', 100);
}

export function useAnoMinimoDefault() {
  return useConfiguracaoNumero('ano_minimo_default', 2005);
}

// ============================================
// Fatores de Risco
// ============================================

export function useFatorVeiculoAntigo() {
  return useConfiguracaoNumero('fator_veiculo_antigo', 1.15);
}

export function useFatorUsoTrabalho() {
  return useConfiguracaoNumero('fator_uso_trabalho', 1.20);
}

// ============================================
// Combustíveis
// ============================================

export interface CombustivelOption {
  value: string;
  label: string;
}

export function useCombustiveis() {
  return useConfiguracaoJson<CombustivelOption[]>('combustiveis', [
    { value: 'flex', label: 'Flex (Gasolina/Etanol)' },
    { value: 'gasolina', label: 'Gasolina' },
    { value: 'etanol', label: 'Etanol' },
    { value: 'diesel', label: 'Diesel' },
    { value: 'eletrico', label: 'Elétrico' },
    { value: 'hibrido', label: 'Híbrido' },
    { value: 'gnv', label: 'GNV' },
  ]);
}

// ============================================
// Marcas e Modelos Fallback
// ============================================

export function useMarcasModelosFallback() {
  return useConfiguracaoJson<Record<string, string[]>>('marcas_modelos_fallback', {});
}

// ============================================
// Estimativa FIPE Config
// ============================================

export function useEstimativaFipeBase() {
  return useConfiguracaoNumero('estimativa_fipe_base', 35000);
}

export function useEstimativaFipeDepreciacao() {
  return useConfiguracaoNumero('estimativa_fipe_depreciacao', 0.06);
}

export function useEstimativaFipeAjusteMarca() {
  return useConfiguracaoJson<Record<string, number>>('estimativa_fipe_ajuste_marca', {
    Toyota: 1.3, Honda: 1.25, Hyundai: 1.15, Volkswagen: 1.1, Chevrolet: 1.05,
    Fiat: 1.0, Renault: 0.95, Nissan: 1.1, Jeep: 1.4, Ford: 1.0,
  });
}

// ============================================
// Exceções e Autorizações
// ============================================

export interface FaixaVendaExcecao {
  min: number;
  max: number | null;
  permitidas: number;
}

export function useExcecaoFaixasVendas() {
  return useConfiguracaoJson<FaixaVendaExcecao[]>('excecao_faixas_vendas', [
    { min: 0, max: 9, permitidas: 0 },
    { min: 10, max: 19, permitidas: 1 },
    { min: 20, max: 29, permitidas: 2 },
    { min: 30, max: null, permitidas: 3 },
  ]);
}

export function useExcecaoFipeMaxCarro() {
  return useConfiguracaoNumero('excecao_fipe_max_carro', 120000);
}

export function useExcecaoFipeMaxMoto() {
  return useConfiguracaoNumero('excecao_fipe_max_moto', 27000);
}

export interface RestricoesAbsolutas {
  mudanca_linha: boolean;
  depreciacao_cobertura_100: boolean;
  blindado_absoluta: boolean;
}

export function useRestricoesAbsolutas() {
  return useQuery({
    queryKey: ['configuracoes', 'restricoes-absolutas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('chave, valor')
        .in('chave', ['restricao_mudanca_linha', 'restricao_depreciacao_cobertura_100', 'restricao_blindado_absoluta']);
      if (error) throw error;
      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        mudanca_linha: map.restricao_mudanca_linha !== 'false',
        depreciacao_cobertura_100: map.restricao_depreciacao_cobertura_100 !== 'false',
        blindado_absoluta: map.restricao_blindado_absoluta !== 'false',
      } as RestricoesAbsolutas;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// Migração (lê de comissoes_parametros)
// ============================================

export interface MigracaoConfig {
  comprovantes: number;
  prazo_horas: number;
  canal: string;
  isentar_carencia: boolean;
  prazo_max_comprovante_meses: number;
}

export function useMigracaoConfig() {
  return useQuery({
    queryKey: ['comissoes-parametros', 'migracao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_parametros')
        .select('chave, valor')
        .in('chave', [
          'migracao_comprovantes_exigidos',
          'migracao_prazo_resposta_horas',
          'migracao_canal_oficial',
          'migracao_isentar_carencia',
          'migracao_prazo_max_comprovante_meses',
        ]);

      if (error) throw error;

      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        comprovantes: parseInt(map.migracao_comprovantes_exigidos) || 3,
        prazo_horas: parseInt(map.migracao_prazo_resposta_horas) || 48,
        canal: map.migracao_canal_oficial || 'e-mail',
        isentar_carencia: map.migracao_isentar_carencia === 'true',
        prazo_max_comprovante_meses: parseInt(map.migracao_prazo_max_comprovante_meses) || 3,
      } as MigracaoConfig;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// Prazo de Reativação (lê de comissoes_parametros)
// ============================================

export function usePrazoReativacaoDias() {
  return useQuery({
    queryKey: ['comissoes-parametros', 'prazo_reativacao_dias'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_parametros')
        .select('valor')
        .eq('chave', 'prazo_reativacao_dias')
        .maybeSingle();

      if (error) throw error;
      return parseInt(data?.valor || '120') || 120;
    },
    staleTime: 1000 * 60 * 10,
  });
}

// ============================================
// Prazos de Inadimplência (lê de comissoes_parametros)
// ============================================

export interface InadimplenciaPrazos {
  prazoSemRevistoria: number;
  prazoRevistoria: number;
  prazoNovaAdesao: number;
}

export function useInadimplenciaPrazos() {
  return useQuery({
    queryKey: ['comissoes-parametros', 'inadimplencia-prazos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comissoes_parametros')
        .select('chave, valor')
        .in('chave', [
          'inadimplencia_prazo_sem_revistoria',
          'inadimplencia_prazo_revistoria',
          'inadimplencia_prazo_nova_adesao',
        ]);

      if (error) throw error;

      const map = Object.fromEntries((data || []).map(d => [d.chave, d.valor]));
      return {
        prazoSemRevistoria: parseInt(map.inadimplencia_prazo_sem_revistoria) || 30,
        prazoRevistoria: parseInt(map.inadimplencia_prazo_revistoria) || 90,
        prazoNovaAdesao: parseInt(map.inadimplencia_prazo_nova_adesao) || 180,
      } as InadimplenciaPrazos;
    },
    staleTime: 1000 * 60 * 10,
  });
}
