// deno-lint-ignore-file no-explicit-any
/**
 * DEPRECADA. Sempre responde 410.
 *
 * Inativar o veículo remoto NÃO libera o índice de placas da Hinova — a placa
 * permanece vinculada ao associado antigo mesmo com veículo + associado inativos.
 *
 * O caminho canônico para troca de titularidade na Hinova é
 * `POST /alterar/veiculo` (helper `alterarVeiculoHinova`), executado por:
 *   - `sga-hinova-sync` automaticamente quando há `solicitacoes_troca_titularidade`
 *     com status='efetivada' para a placa/chassi em conflito;
 *   - `oneoff-sga-liberar-placa-troca` para liberação manual.
 *
 * Ver memória `mem://logic/integrations/sga-alterar-veiculo-troca-titularidade`.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  return new Response(JSON.stringify({
    ok: false,
    deprecated: true,
    error: 'Edge function deprecada. Inativar veículo remoto não libera a placa na Hinova.',
    use_instead: {
      automatic: 'sga-hinova-sync (executa /alterar/veiculo quando detecta troca local efetivada)',
      manual: 'oneoff-sga-liberar-placa-troca',
    },
  }), {
    status: 410,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
