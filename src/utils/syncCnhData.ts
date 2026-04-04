import { supabase } from '@/integrations/supabase/client';

/**
 * Syncs CNH data extracted from OCR to the associados table.
 * Only updates fields that are NULL in the associado record.
 */
export async function syncCnhDataToAssociado(
  associadoId: string,
  ocrDados: Record<string, string | undefined>
): Promise<void> {
  if (!associadoId || !ocrDados) return;

  // Map OCR fields to associado fields
  const cnhNumero = ocrDados.numero_registro || ocrDados.rg;
  const cnhCategoria = ocrDados.categoria;
  const cnhValidade = ocrDados.validade;

  if (!cnhNumero && !cnhCategoria && !cnhValidade) return;

  try {
    // Fetch current values to only update NULLs
    const { data: associado } = await supabase
      .from('associados')
      .select('cnh_numero, cnh_categoria, cnh_validade')
      .eq('id', associadoId)
      .single();

    if (!associado) return;

    const updates: Record<string, string> = {};

    if (!associado.cnh_numero && cnhNumero) {
      updates.cnh_numero = cnhNumero;
    }
    if (!associado.cnh_categoria && cnhCategoria) {
      updates.cnh_categoria = cnhCategoria;
    }
    if (!associado.cnh_validade && cnhValidade) {
      updates.cnh_validade = cnhValidade;
    }

    if (Object.keys(updates).length === 0) return;

    await supabase
      .from('associados')
      .update(updates)
      .eq('id', associadoId);

    console.log('CNH data synced to associado:', associadoId, updates);
  } catch (error) {
    console.error('Error syncing CNH data:', error);
    // Don't throw — this is a background sync, shouldn't break the main flow
  }
}
