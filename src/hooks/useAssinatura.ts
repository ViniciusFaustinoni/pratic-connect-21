import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AssinaturaTipo = 'instalacao' | 'vistoria' | 'servico';

export function useSaveAssinatura() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      signatureBlob,
      tipo = 'instalacao', // default para retrocompatibilidade
      // Parâmetro legado - mantido por compatibilidade
      instalacaoId,
    }: {
      id?: string;
      signatureBlob: Blob;
      tipo?: AssinaturaTipo;
      instalacaoId?: string; // legado
    }) => {
      // Suporte a parâmetro legado
      const entityId = id || instalacaoId;
      if (!entityId) throw new Error('ID obrigatório');

      // 1. Upload para storage bucket 'assinaturas'
      const fileName = `${entityId}/assinatura_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('assinaturas')
        .upload(fileName, signatureBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // 2. Obter URL pública
      const { data: urlData } = supabase.storage
        .from('assinaturas')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 3. Salvar na tabela correta baseado no tipo
      if (tipo === 'vistoria') {
        // Para vistorias: salvar como foto na tabela vistoria_fotos
        const { error } = await supabase
          .from('vistoria_fotos')
          .insert({
            vistoria_id: entityId,
            tipo: 'assinatura_cliente',
            arquivo_url: publicUrl,
            visivel_cliente: true,
          });
        if (error) throw error;
      } else if (tipo === 'servico') {
        // Para serviços unificados: salvar na tabela servicos
        const { error } = await supabase
          .from('servicos')
          .update({ assinatura_cliente_url: publicUrl })
          .eq('id', entityId);
        if (error) throw error;
        
        // Buscar dados do serviço para salvar assinatura em vistoria_fotos e gerar laudo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const servicoInfoResult = await (supabase as any)
          .from('servicos')
          .select('contrato_id, veiculo_id')
          .eq('id', entityId)
          .single();
        const servicoInfo = servicoInfoResult?.data as { contrato_id: string | null; veiculo_id: string | null } | null;
        
        if (servicoInfo?.contrato_id) {
          // Buscar vistoria vinculada ao mesmo contrato
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const vistoriaResult = await (supabase as any)
            .from('vistorias')
            .select('id')
            .eq('contrato_id', servicoInfo.contrato_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          const vistoriaData = vistoriaResult?.data as { id: string } | null;
          
          if (vistoriaData?.id) {
            // Salvar assinatura em vistoria_fotos
            await supabase.from('vistoria_fotos').insert({
              vistoria_id: vistoriaData.id,
              tipo: 'assinatura_cliente',
              arquivo_url: publicUrl,
              visivel_cliente: true,
            });
            console.log('Assinatura salva em vistoria_fotos:', vistoriaData.id);
            
            // Buscar dados do veículo e associado para gerar laudo
            if (servicoInfo.veiculo_id) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const veiculoResult = await (supabase as any)
                .from('veiculos')
                .select('placa, associado_id')
                .eq('id', servicoInfo.veiculo_id)
                .single();
              const veiculoData = veiculoResult?.data as { placa: string | null; associado_id: string | null } | null;
              
              if (veiculoData?.placa && veiculoData?.associado_id) {
                // Gerar laudo de vistoria em background (não bloqueia)
                console.log('Gerando laudo após assinatura para vistoria:', vistoriaData.id);
                supabase.functions.invoke('gerar-laudo-vistoria', {
                  body: {
                    vistoriaId: vistoriaData.id,
                    associadoId: veiculoData.associado_id,
                    veiculoId: servicoInfo.veiculo_id,
                    contratoId: servicoInfo.contrato_id,
                    placa: veiculoData.placa,
                  }
                }).then(res => {
                  if (res.error) {
                    console.error('Laudo: erro ao gerar após assinatura:', res.error);
                  } else {
                    console.log('Laudo gerado com sucesso após assinatura:', res.data);
                  }
                });
              }
            }
          }
        }
      } else {
        // Instalação (legado): salvar na tabela instalacoes
        const { error } = await supabase
          .from('instalacoes')
          .update({ assinatura_cliente_url: publicUrl })
          .eq('id', entityId);
        if (error) throw error;
      }

      return publicUrl;
    },
    onSuccess: (_, variables) => {
      const entityId = variables.id || variables.instalacaoId;
      queryClient.invalidateQueries({ queryKey: ['instalacao-detalhes', entityId] });
      queryClient.invalidateQueries({ queryKey: ['instalador-instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['servico-detalhes', entityId] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa', entityId] });
      queryClient.invalidateQueries({ queryKey: ['propostas-pendentes'] });
    },
  });
}
