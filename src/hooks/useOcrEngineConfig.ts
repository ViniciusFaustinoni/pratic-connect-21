import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OcrEngine = 'auto' | 'global' | 'mistral' | 'anthropic' | 'google';

export interface OcrEngineConfig {
  id: string;
  engine: OcrEngine;
  primary_model: string;
  secondary_model: string | null;
  dupla_leitura_tipos: string[];
  pdf_rasterizar: boolean;
  pdf_dpi: number;
  updated_at: string;
}

export const OCR_ENGINE_LABELS: Record<OcrEngine, string> = {
  auto: '🤖 Automático (recomendado) — escolhe o melhor método por documento',
  global: 'Provedor global do sistema',
  mistral: 'Mistral OCR (especializado em documentos)',
  anthropic: 'Anthropic Claude (Sonnet 4.5)',
  google: 'Google Gemini (2.5 Pro)',
};

export const OCR_ENGINE_MODELS: Record<Exclude<OcrEngine, 'global'>, { primary: string[]; secondary: string[] }> = {
  mistral:   { primary: ['mistral-ocr-latest'], secondary: ['pixtral-large-latest', 'claude-sonnet-4-5'] },
  anthropic: { primary: ['claude-sonnet-4-5', 'claude-opus-4-5'], secondary: ['claude-opus-4-5', 'claude-sonnet-4-5'] },
  google:    { primary: ['google/gemini-2.5-pro', 'google/gemini-2.5-flash'], secondary: ['google/gemini-2.5-pro'] },
};

export function useOcrEngineConfig() {
  return useQuery({
    queryKey: ['ocr-engine-config'],
    queryFn: async (): Promise<OcrEngineConfig | null> => {
      const { data, error } = await supabase.from('ocr_engine_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as OcrEngineConfig | null;
    },
  });
}

export function useUpdateOcrEngineConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<OcrEngineConfig>) => {
      const { data: existing } = await supabase.from('ocr_engine_config').select('id').limit(1).maybeSingle();
      if (existing?.id) {
        const { error } = await supabase.from('ocr_engine_config').update(patch).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ocr_engine_config').insert(patch as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ocr-engine-config'] });
      toast.success('Motor de OCR atualizado');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Falha ao salvar motor de OCR'),
  });
}
