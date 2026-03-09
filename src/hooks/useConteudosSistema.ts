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

function useConfiguracaoNumero(chave: string, fallback: number) {
  return useConfiguracao(chave, (v) => parseFloat(v) || fallback, fallback);
}

function useConfiguracaoTexto(chave: string, fallback: string) {
  return useConfiguracao(chave, (v) => v, fallback);
}

function useConfiguracaoJson<T>(chave: string, fallback: T) {
  return useConfiguracao(chave, (v) => {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }, fallback);
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
