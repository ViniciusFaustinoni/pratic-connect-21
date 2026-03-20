import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface RecusarVeiculoData {
  vistoriaId: string;
  instalacaoId?: string;
  veiculoId: string;
  associadoId: string;
  motivo: string;
  observacoes: string;
  fotosRecusa: File[];
}

interface AprovarVeiculoData {
  vistoriaId: string;
  instalacaoId?: string;
  veiculoId: string;
  associadoId: string;
  hodometro: number;
  observacoes?: string;
}

// Hook para aprovar veículo na vistoria completa
export function useAprovarVeiculoVistoria() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: AprovarVeiculoData) => {
      const agora = new Date().toISOString();

      // 1. Atualizar veículo como ativo (SEM cobertura_total — aguarda aprovação do monitoramento)
      const { error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'ativo',
          updated_at: agora,
        })
        .eq('id', data.veiculoId);

      if (veiculoError) throw veiculoError;

      // 2. Atualizar associado para em_analise (aguarda aprovação do monitoramento)
      const { error: associadoError } = await supabase
        .from('associados')
        .update({ 
          status: 'em_analise',
          updated_at: agora,
        })
        .eq('id', data.associadoId);

      if (associadoError) throw associadoError;

      // 3. Atualizar vistoria como aprovada
      const { error: vistoriaError } = await supabase
        .from('vistorias')
        .update({ 
          status: 'aprovada',
          km_atual: data.hodometro,
          observacoes: data.observacoes,
          updated_at: agora,
        })
        .eq('id', data.vistoriaId);

      if (vistoriaError) throw vistoriaError;

      // 4. Concluir instalação se existir
      if (data.instalacaoId) {
        const { error: instalacaoError } = await supabase
          .from('instalacoes')
          .update({ 
            status: 'concluida',
            concluida_em: agora,
          })
          .eq('id', data.instalacaoId);

        if (instalacaoError) throw instalacaoError;
      }

      // 5. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'veiculo_aprovado',
        descricao: 'Instalação concluída — aguardando aprovação do monitoramento',
        dados_novos: { 
          vistoria_id: data.vistoriaId,
          instalacao_id: data.instalacaoId, 
          veiculo_id: data.veiculoId,
          cobertura_total: true,
          hodometro: data.hodometro,
        },
        usuario_id: profile?.id,
      });

      // 6. Propagar conclusão para cotações/contratos
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('cotacao_id, contrato_id, veiculos:veiculo_id(placa)')
        .eq('id', data.vistoriaId)
        .single();

      if (vistoriaData?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ 
            status_contratacao: 'ativo',
            vistoria_concluida_em: agora,
          })
          .eq('id', vistoriaData.cotacao_id);
      }

      if (vistoriaData?.contrato_id) {
        await supabase
          .from('contratos')
          .update({ 
            status: 'ativo',
            vistoria_concluida_em: agora,
          })
          .eq('id', vistoriaData.contrato_id);
      }

      // 7. Gerar laudo de vistoria em PDF (async, não bloqueia aprovação)
      const veiculoData = vistoriaData?.veiculos as any;
      if (veiculoData?.placa) {
        // Chamar edge function para gerar PDF em background
        supabase.functions.invoke('gerar-laudo-vistoria', {
          body: {
            vistoriaId: data.vistoriaId,
            associadoId: data.associadoId,
            veiculoId: data.veiculoId,
            contratoId: vistoriaData?.contrato_id,
            placa: veiculoData.placa,
          }
        }).catch(err => console.warn('Erro ao gerar laudo (não crítico):', err));
      }

      // 8. Notificar cliente sobre cobertura total ativada
      if (data.associadoId && data.instalacaoId) {
        supabase.functions.invoke('notificar-cliente', {
          body: {
            tipo: 'cobertura_total_ativada',
            associado_id: data.associadoId,
            dados: { 
              placa: veiculoData?.placa || 'N/A',
              marca: veiculoData?.marca || '',
              modelo: veiculoData?.modelo || '',
            }
          }
        }).catch(err => console.warn('Erro ao notificar cliente (não crítico):', err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['associados'] });
      toast.success('Veículo aprovado com sucesso! Proteção 360º ativada.');
    },
    onError: (error) => {
      console.error('Erro ao aprovar veículo:', error);
      toast.error('Erro ao aprovar veículo');
    },
  });
}

// Hook para recusar veículo na vistoria completa (com fotos)
export function useRecusarVeiculoVistoria() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (data: RecusarVeiculoData) => {
      const agora = new Date().toISOString();
      const fotosUrls: string[] = [];

      // 1. Upload das fotos de recusa (se houver)
      for (const foto of data.fotosRecusa) {
        const fileExt = foto.name.split('.').pop();
        const fileName = `recusa/${data.vistoriaId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('vistoria-fotos')
          .upload(fileName, foto);

        if (!uploadError) {
          const { data: publicUrl } = supabase.storage
            .from('vistoria-fotos')
            .getPublicUrl(fileName);
          fotosUrls.push(publicUrl.publicUrl);
        }
      }

      // 2. Atualizar veículo como RECUSADO
      const { data: veiculoData, error: veiculoError } = await supabase
        .from('veiculos')
        .update({ 
          status: 'recusado',
          motivo_recusa_veiculo: data.observacoes,
          recusado_por: profile?.id,
          recusado_em: agora,
          updated_at: agora,
        })
        .eq('id', data.veiculoId)
        .select('placa, chassi')
        .single();

      if (veiculoError) throw veiculoError;

      // 3. Atualizar vistoria como reprovada
      const { error: vistoriaError } = await supabase
        .from('vistorias')
        .update({ 
          status: 'reprovada',
          observacoes: data.observacoes,
          fotos_recusa: fotosUrls.length > 0 ? fotosUrls : null,
          updated_at: agora,
        })
        .eq('id', data.vistoriaId);

      if (vistoriaError) throw vistoriaError;

      // 4. Cancelar instalação se existir
      if (data.instalacaoId) {
        await supabase
          .from('instalacoes')
          .update({ 
            status: 'cancelada',
            observacoes: `Veículo recusado: ${data.motivo}`,
          })
          .eq('id', data.instalacaoId);
      }

      // 5. Buscar e atualizar serviço vinculado para aparecer na fila de recusas
      const { data: servicoVinculado } = await supabase
        .from('servicos')
        .select('id')
        .eq('veiculo_id', data.veiculoId)
        .in('status', ['agendada', 'em_andamento', 'em_rota'] as any)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (servicoVinculado) {
        await supabase
          .from('servicos')
          .update({
            status: 'em_analise',
            decisao_instalador: 'negado',
            ressalvas_instalador: data.motivo,
            fotos_ressalva: fotosUrls,
            observacoes: `Veículo negado pelo instalador - pendente análise interna: ${data.motivo}`,
            updated_at: agora,
          })
          .eq('id', servicoVinculado.id);
      }

      // 6. Registrar no histórico
      await supabase.from('associados_historico').insert({
        associado_id: data.associadoId,
        tipo: 'veiculo_recusado',
        descricao: `Veículo recusado pelo técnico - encaminhado para análise interna: ${data.motivo}`,
        dados_novos: { 
          vistoria_id: data.vistoriaId,
          instalacao_id: data.instalacaoId, 
          veiculo_id: data.veiculoId,
          motivo: data.motivo,
          observacoes: data.observacoes,
          fotos_recusa: fotosUrls,
          servico_id: servicoVinculado?.id,
          status_encaminhamento: 'pendente_analise',
        },
        usuario_id: profile?.id,
      });

      // 7. Propagar status na cotação
      const { data: vistoriaData } = await supabase
        .from('vistorias')
        .select('cotacao_id')
        .eq('id', data.vistoriaId)
        .single();

      if (vistoriaData?.cotacao_id) {
        await supabase
          .from('cotacoes')
          .update({ status_contratacao: 'veiculo_recusado' })
          .eq('id', vistoriaData.cotacao_id);
      }

      // NOTA: Ações destrutivas (blacklist, cancelar contrato, suspender associado)
      // são agora responsabilidade do ANALISTA na fila de recusas, não automáticas.
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['veiculos'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
      queryClient.invalidateQueries({ queryKey: ['tarefa-atual-servico'] });
      queryClient.invalidateQueries({ queryKey: ['recusas-instalador'] });
      queryClient.invalidateQueries({ queryKey: ['recusas-instalador-count'] });
      queryClient.invalidateQueries({ queryKey: ['servicos'] });
      toast.success('Veículo recusado. Encaminhado para análise interna.');

      // Disparar busca da próxima tarefa (fire-and-forget)
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          supabase.functions.invoke('atribuir-proxima-tarefa', {
            body: {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            },
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
          });
        },
        () => {
          supabase.functions.invoke('atribuir-proxima-tarefa').then(() => {
            queryClient.invalidateQueries({ queryKey: ['tarefa-atual'] });
          });
        }
      );

      // Dispara notificação WhatsApp amigável para o associado (fire-and-forget)
      import('@/utils/orientacoesRecusa').then(({ getOrientacoesRecusa }) => {
        supabase.from('veiculos').select('placa').eq('id', variables.veiculoId).single()
          .then(({ data: veiculo }) => {
            const placa = veiculo?.placa || '';
            const orientacoes = getOrientacoesRecusa(variables.motivo);
            supabase.functions.invoke('notificar-cliente', {
              body: {
                tipo: 'veiculo_negado_orientacoes',
                associado_id: variables.associadoId,
                dados: {
                  placa,
                  orientacoes_resolucao: orientacoes,
                },
              },
            });
          });
      });
    },
    onError: (error) => {
      console.error('Erro ao recusar veículo:', error);
      toast.error('Erro ao recusar veículo');
    },
  });
}

// Hook para upload de vídeo 360 (substitui vídeo existente)
export function useUploadVideo360() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { vistoriaId: string; file: File }) => {
      // Buscar vídeo existente para deletar
      const { data: vistoria } = await supabase
        .from('vistorias')
        .select('video_360_url')
        .eq('id', data.vistoriaId)
        .single();

      // Se existir vídeo anterior, deletar do storage
      if (vistoria?.video_360_url) {
        const urlParts = vistoria.video_360_url.split('/vistoria-videos/');
        if (urlParts[1]) {
          const filePath = urlParts[1];
          await supabase.storage.from('vistoria-videos').remove([filePath]);
        }
      }

      const fileExt = data.file.name.split('.').pop();
      const fileName = `${data.vistoriaId}/video_360_${Date.now()}.${fileExt}`;

      // Upload para bucket de vídeos
      const { error: uploadError } = await supabase.storage
        .from('vistoria-videos')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('vistoria-videos')
        .getPublicUrl(fileName);

      // Atualizar vistoria com URL do vídeo
      const { error: updateError } = await supabase
        .from('vistorias')
        .update({ video_360_url: publicUrl.publicUrl })
        .eq('id', data.vistoriaId);

      if (updateError) throw updateError;

      return publicUrl.publicUrl;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa-servico'] });
      toast.success('Vídeo 360° enviado com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao enviar vídeo:', error);
      toast.error('Erro ao enviar vídeo');
    },
  });
}

// Hook para upload de foto com flag visivel_cliente (substitui foto existente do mesmo tipo)
export function useUploadFotoVistoriaCompleta() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { 
      vistoriaId: string; 
      tipo: string; 
      file: File;
      visivelCliente?: boolean;
    }) => {
      // VALIDAÇÃO: Verificar se a vistoria existe antes de qualquer operação
      const { data: vistoriaExiste, error: vistoriaCheckError } = await supabase
        .from('vistorias')
        .select('id')
        .eq('id', data.vistoriaId)
        .maybeSingle();

      if (vistoriaCheckError || !vistoriaExiste) {
        console.error('[Upload Foto] Vistoria não encontrada:', data.vistoriaId, vistoriaCheckError);
        throw new Error('Vistoria não encontrada. Recarregue a página e tente novamente.');
      }

      // Primeiro, verificar se já existe uma foto desse tipo para essa vistoria
      const { data: fotoExistente } = await supabase
        .from('vistoria_fotos')
        .select('id, arquivo_url')
        .eq('vistoria_id', data.vistoriaId)
        .eq('tipo', data.tipo)
        .maybeSingle();

      // Fazer upload do novo arquivo ANTES de deletar o antigo (evitar perda)
      const fileExt = data.file.name.split('.').pop();
      const fileName = `${data.vistoriaId}/${data.tipo}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('vistoria-fotos')
        .upload(fileName, data.file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: publicUrl } = supabase.storage
        .from('vistoria-fotos')
        .getPublicUrl(fileName);

      // Se existir foto antiga, deletar do storage e da tabela DEPOIS do upload
      if (fotoExistente) {
        const urlParts = fotoExistente.arquivo_url.split('/vistoria-fotos/');
        if (urlParts[1]) {
          await supabase.storage.from('vistoria-fotos').remove([urlParts[1]]);
        }
        await supabase.from('vistoria_fotos').delete().eq('id', fotoExistente.id);
      }

      // Inserir novo registro na tabela com retry em caso de FK error
      let result: any = null;
      const insertPayload = {
        vistoria_id: data.vistoriaId,
        tipo: data.tipo,
        arquivo_url: publicUrl.publicUrl,
        visivel_cliente: data.visivelCliente ?? true,
      };

      const { data: insertResult, error: insertError } = await supabase
        .from('vistoria_fotos')
        .insert(insertPayload)
        .select()
        .single();

      if (insertError) {
        // FK violation (23503) - vistoria pode ter sido recriada, tentar revalidar
        if (insertError.code === '23503') {
          console.warn('[Upload Foto] FK violation, revalidando vistoria...', insertError);
          
          // Revalidar existência da vistoria
          const { data: recheck } = await supabase
            .from('vistorias')
            .select('id')
            .eq('id', data.vistoriaId)
            .maybeSingle();

          if (!recheck) {
            throw new Error('Vistoria foi removida. Recarregue a página para continuar.');
          }

          // Retry uma vez
          const { data: retryResult, error: retryError } = await supabase
            .from('vistoria_fotos')
            .insert(insertPayload)
            .select()
            .single();

          if (retryError) throw retryError;
          result = retryResult;
        } else {
          throw insertError;
        }
      } else {
        result = insertResult;
      }

      // Se for foto do odômetro, chamar OCR para identificar quilometragem
      let ocrResult = null;
      if (data.tipo === 'odometro') {
        try {
          const { data: ocrData, error: ocrError } = await supabase.functions.invoke('odometro-ocr', {
            body: { 
              url: publicUrl.publicUrl, 
              vistoriaId: data.vistoriaId
            }
          });
          
          if (!ocrError && ocrData) {
            ocrResult = ocrData;
            console.log('OCR do odômetro:', ocrData);
          }
        } catch (e) {
          console.warn('OCR do odômetro falhou (não crítico):', e);
        }
      }

      return { ...result, ocrResult };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa'] });
      queryClient.invalidateQueries({ queryKey: ['vistoria-completa-servico'] });
    },
    onError: (error) => {
      console.error('Erro ao fazer upload:', error);
      toast.error('Erro ao enviar foto');
    },
  });
}