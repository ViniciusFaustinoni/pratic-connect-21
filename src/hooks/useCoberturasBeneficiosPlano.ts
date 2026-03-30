import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PlanItem {
  id: string;
  nome: string;
  tipo: 'cobertura' | 'beneficio';
  codigo: string | null;
  categoria?: string | null;
}

// Mapeamento de código de cobertura → tipo de sinistro do sistema
export const COBERTURA_TO_TIPO_SINISTRO: Record<string, string> = {
  'COB-COL': 'colisao',
  'COB-RF': 'roubo',
  'COB-FUR': 'furto',
  'COB-INC': 'incendio',
  'COB-FN': 'fenomeno_natural',
  'COB-VID': 'vidros',
  'COB-VAN': 'vandalismo',
  'COB-TER': 'terceiros',
};

// Mapeamento inverso: tipo de sinistro → código de cobertura
export const TIPO_SINISTRO_TO_COBERTURA: Record<string, string> = Object.fromEntries(
  Object.entries(COBERTURA_TO_TIPO_SINISTRO).map(([k, v]) => [v, k])
);

// Mapeamento de benefício → tipo de serviço de assistência
export const BENEFICIO_TO_TIPO_SERVICO: Record<string, string> = {
  'reboque': 'reboque',
  'guincho': 'reboque',
  'chaveiro': 'chaveiro',
  'troca de pneu': 'troca_pneu',
  'pane seca': 'pane_seca',
  'bateria': 'bateria',
  'pane elétrica': 'pane_eletrica',
};

function matchBeneficioToTipoServico(beneficioNome: string): string | null {
  const lower = beneficioNome.toLowerCase();
  for (const [key, value] of Object.entries(BENEFICIO_TO_TIPO_SERVICO)) {
    if (lower.includes(key)) return value;
  }
  return null;
}

export function useCoberturasBeneficiosPlano(associadoId: string | null | undefined) {
  return useQuery({
    queryKey: ['coberturas-beneficios-plano', associadoId],
    queryFn: async (): Promise<{ coberturas: PlanItem[]; beneficios: PlanItem[]; planoId: string | null }> => {
      if (!associadoId) return { coberturas: [], beneficios: [], planoId: null };

      // 1. Get plano_id from associado
      const { data: associado } = await supabase
        .from('associados')
        .select('plano_id')
        .eq('id', associadoId)
        .single();

      const planoId = associado?.plano_id;
      if (!planoId) return { coberturas: [], beneficios: [], planoId: null };

      // 2. Fetch coberturas via planos_coberturas
      const { data: planoCoberturas } = await supabase
        .from('planos_coberturas')
        .select('cobertura_id, coberturas(id, nome, codigo, tipo)')
        .eq('plano_id', planoId);

      const coberturas: PlanItem[] = (planoCoberturas || [])
        .filter((pc: any) => pc.coberturas)
        .map((pc: any) => ({
          id: pc.coberturas.id,
          nome: pc.coberturas.nome,
          tipo: 'cobertura' as const,
          codigo: pc.coberturas.codigo,
        }));

      // 3. Fetch benefícios via planos_beneficios
      const { data: planoBeneficios } = await supabase
        .from('planos_beneficios')
        .select('beneficio_id, benefits(id, name, category)')
        .eq('plano_id', planoId);

      const beneficios: PlanItem[] = (planoBeneficios || [])
        .filter((pb: any) => pb.benefits)
        .map((pb: any) => ({
          id: pb.benefits.id,
          nome: pb.benefits.name,
          tipo: 'beneficio' as const,
          codigo: null,
          categoria: pb.benefits.category,
        }));

      return { coberturas, beneficios, planoId };
    },
    enabled: !!associadoId,
  });
}

// Helper: convert plan coberturas to sinistro type options
export function coberturasToSinistroOptions(coberturas: PlanItem[]) {
  const options: { value: string; label: string; coberturaId: string }[] = [];

  for (const cob of coberturas) {
    const tipoSinistro = cob.codigo ? COBERTURA_TO_TIPO_SINISTRO[cob.codigo] : null;
    if (tipoSinistro) {
      options.push({ value: tipoSinistro, label: cob.nome, coberturaId: cob.id });
    }
    // Special case: COB-RF maps to both roubo and furto
    if (cob.codigo === 'COB-RF') {
      options.push({ value: 'furto', label: 'Furto', coberturaId: cob.id });
    }
  }

  // Always add "outro" as fallback
  if (!options.find(o => o.value === 'outro')) {
    options.push({ value: 'outro', label: 'Outro', coberturaId: '' });
  }

  return options;
}

// Helper: convert plan beneficios to assistência service type options
export function beneficiosToServicoOptions(beneficios: PlanItem[]) {
  const options: { value: string; label: string; beneficioId: string }[] = [];
  const addedValues = new Set<string>();

  for (const ben of beneficios) {
    // Check if benefit name maps to a service type
    const tipoServico = matchBeneficioToTipoServico(ben.nome);
    if (tipoServico && !addedValues.has(tipoServico)) {
      options.push({ value: tipoServico, label: ben.nome, beneficioId: ben.id });
      addedValues.add(tipoServico);
    }
  }

  // If "Assistência 24h" is a benefit, add all standard service types
  const hasAssistencia24h = beneficios.some(b => b.nome.toLowerCase().includes('assistência 24h') || b.nome.toLowerCase().includes('assistencia 24h'));
  if (hasAssistencia24h) {
    const standardTypes = [
      { value: 'reboque', label: 'Reboque/Guincho' },
      { value: 'chaveiro', label: 'Chaveiro' },
      { value: 'troca_pneu', label: 'Troca de Pneu' },
      { value: 'pane_seca', label: 'Pane Seca' },
      { value: 'bateria', label: 'Bateria' },
    ];
    for (const st of standardTypes) {
      if (!addedValues.has(st.value)) {
        options.push({ ...st, beneficioId: beneficios.find(b => b.nome.toLowerCase().includes('assistência 24h') || b.nome.toLowerCase().includes('assistencia 24h'))?.id || '' });
        addedValues.add(st.value);
      }
    }
  }

  // Always add "outro" as fallback
  if (!addedValues.has('outro')) {
    options.push({ value: 'outro', label: 'Outros', beneficioId: '' });
  }

  return options;
}
