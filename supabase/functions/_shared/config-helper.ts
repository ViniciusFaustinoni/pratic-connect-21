/**
 * Helper centralizado para leitura de configurações numéricas
 * da tabela `configuracoes` no Supabase.
 *
 * Uso em edge functions:
 *   import { getConfiguracaoNumero } from '../_shared/config-helper.ts';
 *   const prazo = await getConfiguracaoNumero(supabase, 'prazo_link_evento_horas', 72);
 */
export async function getConfiguracaoNumero(
  supabase: any,
  chave: string,
  fallback: number,
): Promise<number> {
  try {
    const { data } = await supabase
      .from('configuracoes')
      .select('valor')
      .eq('chave', chave)
      .maybeSingle();
    if (data?.valor != null) {
      const parsed = parseFloat(data.valor);
      return isNaN(parsed) ? fallback : parsed;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
