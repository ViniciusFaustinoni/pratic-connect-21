import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AIProvider = 'lovable' | 'openai' | 'anthropic';

export interface AIModelConfig {
  id: string;
  provider: AIProvider;
  model: string;
  updated_at: string;
  updated_by: string | null;
}

export const AI_PROVIDER_MODELS: Record<AIProvider, { value: string; label: string }[]> = {
  lovable: [
    { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash (preview) — padrão' },
    { value: 'google/gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
    { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'google/gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
    { value: 'openai/gpt-5.2', label: 'GPT-5.2 (via Lovable)' },
    { value: 'openai/gpt-5', label: 'GPT-5 (via Lovable)' },
    { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini (via Lovable)' },
    { value: 'openai/gpt-5-nano', label: 'GPT-5 Nano (via Lovable)' },
  ],
  openai: [
    { value: 'gpt-5.2', label: 'GPT-5.2 (mais recente)' },
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4o', label: 'GPT-4o (multimodal)' },
    { value: 'o4-mini', label: 'o4-mini (raciocínio)' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (mais recente)' },
    { value: 'claude-opus-4-1', label: 'Claude Opus 4.1' },
    { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (rápido)' },
    { value: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet' },
  ],
};

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  lovable: 'Lovable AI Gateway',
  openai: 'OpenAI (direto)',
  anthropic: 'Anthropic (direto)',
};

export function useAIModelConfig() {
  return useQuery({
    queryKey: ['ai-model-config'],
    queryFn: async (): Promise<AIModelConfig | null> => {
      const { data, error } = await supabase
        .from('ai_model_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as AIModelConfig | null;
    },
  });
}

export function useUpdateAIModelConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ provider, model }: { provider: AIProvider; model: string }) => {
      const { data: existing } = await supabase
        .from('ai_model_config')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('ai_model_config')
          .update({ provider, model })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_model_config')
          .insert({ provider, model });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-model-config'] });
      toast.success('Modelo de IA atualizado para todo o sistema');
    },
    onError: (e: any) => {
      toast.error(e?.message ?? 'Falha ao salvar modelo de IA');
    },
  });
}
