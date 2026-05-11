import { supabase } from '@/integrations/supabase/client';
import type { AssociadoSearchResult } from './useAssociadoSearch';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v);

/**
 * Garante um UUID local de associado a partir de um resultado da busca.
 * Se o resultado vier do SGA (origem_sga=true), importa o associado para a base
 * local via edge function `importar-associado-sga` e retorna o UUID gerado.
 *
 * Lança erro descritivo quando não for possível resolver.
 */
export async function resolverAssociadoLocalId(
  associado: AssociadoSearchResult,
): Promise<string> {
  // Já é UUID válido — base local
  if (isUuid(associado.id)) return associado.id;

  // SGA-only: precisa importar para obter UUID local
  const cpf = (associado.cpf || '').replace(/\D/g, '');
  if (!cpf || cpf.length !== 11) {
    throw new Error('Associado sem CPF válido para importação do SGA.');
  }

  const { data, error } = await supabase.functions.invoke(
    'importar-associado-sga',
    { body: { cpf } },
  );

  if (error) {
    throw new Error(
      `Falha ao importar associado do SGA: ${error.message || 'erro desconhecido'}`,
    );
  }
  const localId = data?.associado_id;
  if (!isUuid(localId)) {
    throw new Error('Importação do SGA não retornou um identificador válido.');
  }
  return localId;
}
