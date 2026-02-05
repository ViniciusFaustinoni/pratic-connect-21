import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

// Hook para buscar contrato por token (público) com polling inteligente e timeout
export function useContratoByToken(token: string | undefined) {
  const [pollingStartTime, setPollingStartTime] = useState<number | null>(null);
  const [isAutentiqueTimeout, setIsAutentiqueTimeout] = useState(false);
  
  const POLLING_TIMEOUT_MS = 90000; // 90 segundos de timeout (API Autentique pode demorar)
  
  const query = useQuery({
    queryKey: ['contrato-publico', token],
    queryFn: async () => {
      if (!token) return null;
      
      // Usar publicSupabase para garantir funcionamento em contexto público
      const { data, error } = await publicSupabase
        .from('contratos')
        .select(`
          *,
          planos:plano_id (nome, descricao),
          associados:associado_id (nome, email, telefone, cpf, status),
          leads:lead_id (nome, email, telefone, cpf)
        `)
        .eq('link_token', token)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Link inválido ou expirado');
      return data;
    },
    enabled: !!token,
    // Polling inteligente para múltiplos cenários - 10 segundos padrão
    refetchInterval: (queryState) => {
      const data = queryState.state.data;
      
      // Parar polling apenas quando contrato estiver finalizado
      if (data?.status === 'assinado' || data?.status === 'cancelado' || data?.status === 'ativo') {
        return false;
      }
      
      // Polling mais rápido enquanto aguarda autentique_url
      if (data?.adesao_paga && !data?.autentique_url && !isAutentiqueTimeout) {
        return 3000; // 3 segundos
      }
      
      // Polling padrão de 10 segundos para todos os outros casos
      // Isso garante que pagamentos e assinaturas sejam detectados automaticamente
      return 10000;
    },
  });

  // Controlar timeout do polling
  useEffect(() => {
    const data = query.data;
    
    // Iniciar contagem quando adesao_paga=true e autentique_url=null
    if (data?.adesao_paga && !data?.autentique_url && !pollingStartTime) {
      setPollingStartTime(Date.now());
      setIsAutentiqueTimeout(false);
    }
    
    // Se autentique_url aparecer, resetar
    if (data?.autentique_url && pollingStartTime) {
      setPollingStartTime(null);
      setIsAutentiqueTimeout(false);
    }
  }, [query.data, pollingStartTime]);

  // Checar timeout
  useEffect(() => {
    if (!pollingStartTime || isAutentiqueTimeout) return;
    
    const checkTimeout = () => {
      if (Date.now() - pollingStartTime > POLLING_TIMEOUT_MS) {
        setIsAutentiqueTimeout(true);
        console.warn('[useContratoByToken] Timeout ao aguardar autentique_url');
      }
    };
    
    const interval = setInterval(checkTimeout, 1000);
    return () => clearInterval(interval);
  }, [pollingStartTime, isAutentiqueTimeout]);

  // Função para tentar novamente
  const retryAutentiquePolling = () => {
    setPollingStartTime(Date.now());
    setIsAutentiqueTimeout(false);
    query.refetch();
  };

  return {
    ...query,
    isAutentiqueTimeout,
    retryAutentiquePolling,
  };
}

// Hook para gerar link do associado
export function useGerarLinkAssociado() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contratoId: string) => {
      // Atualizar contrato com link_gerado_em
      const { data, error } = await supabase
        .from('contratos')
        .update({
          link_gerado_em: new Date().toISOString(),
        })
        .eq('id', contratoId)
        .select('link_token')
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Contrato não encontrado ou sem permissão de acesso');
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'link_gerado',
        descricao: 'Link do associado gerado',
        dados: { link_token: data.link_token },
      });
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contratos'] });
      toast.success('Link gerado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao gerar link');
    },
  });
}

// Hook para selecionar tipo de vistoria
export function useSelecionarTipoVistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contratoId, tipoVistoria }: { contratoId: string; tipoVistoria: 'agendada' | 'autovistoria' }) => {
      const { error } = await supabase
        .from('contratos')
        .update({
          tipo_vistoria: tipoVistoria,
        })
        .eq('id', contratoId);
      
      if (error) throw error;
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'vistoria_tipo_selecionado',
        descricao: `Tipo de vistoria selecionado: ${tipoVistoria === 'agendada' ? 'Vistoria Agendada' : 'Autovistoria'}`,
        dados: { tipo_vistoria: tipoVistoria },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}

// Hook para criar vistoria agendada (e também criar instalação para o módulo de rotas)
export function useCriarVistoriaAgendada() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      contratoId, 
      dataAgendada, 
      horarioAgendado,
      veiculoId,
      associadoId,
      endereco,
    }: { 
      contratoId: string; 
      dataAgendada: string; 
      horarioAgendado: string;
      veiculoId?: string;
      associadoId: string;
      endereco?: {
        cep?: string;
        logradouro?: string;
        numero?: string;
        bairro?: string;
        cidade?: string;
        uf?: string;
      };
    }) => {
      if (!associadoId) {
        throw new Error('Associado não vinculado ao contrato. Entre em contato com a associação.');
      }
      
      // Criar vistoria
      const { data: vistoria, error: vistoriaError } = await supabase
        .from('vistorias')
        .insert({
          associado_id: associadoId,
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          data_agendada: dataAgendada,
          horario_agendado: horarioAgendado,
          modalidade: 'presencial',
          status: 'pendente',
          tipo: 'instalacao' as any, // Instalação (anteriormente "entrada")
        })
        .select()
        .single();
      
      if (vistoriaError) throw vistoriaError;
      
      // Determinar período baseado no horário
      const hora = parseInt(horarioAgendado.split(':')[0], 10);
      let periodo: 'manha' | 'tarde' | 'noite' = 'manha';
      if (hora >= 12 && hora < 18) {
        periodo = 'tarde';
      } else if (hora >= 18) {
        periodo = 'noite';
      }
      
      // Criar instalação para integrar com módulo de rotas/monitoramento
      // Isso permite que a vistoria presencial apareça no painel de rotas
      const { error: instalacaoError } = await supabase
        .from('instalacoes')
        .insert({
          associado_id: associadoId,
          veiculo_id: veiculoId || null,
          data_agendada: dataAgendada,
          hora_agendada: horarioAgendado,
          periodo: periodo,
          status: 'agendada',
          observacoes: `Vistoria presencial - Contrato: ${contratoId}`,
          cep: endereco?.cep,
          logradouro: endereco?.logradouro,
          numero: endereco?.numero,
          bairro: endereco?.bairro,
          cidade: endereco?.cidade,
          uf: endereco?.uf,
        });
      
      if (instalacaoError) {
        console.error('[useCriarVistoriaAgendada] Erro ao criar instalação para rotas:', instalacaoError);
        // Não falhar a operação principal, apenas logar
      }
      
      // Atualizar contrato com dados do agendamento (persistir para detectar após reload)
      const { error: contratoUpdateError } = await supabase
        .from('contratos')
        .update({
          vistoria_completa_data_agendada: dataAgendada,
          vistoria_completa_horario_agendado: horarioAgendado,
          vistoria_completa_endereco_cep: endereco?.cep || null,
          vistoria_completa_endereco_logradouro: endereco?.logradouro || null,
          vistoria_completa_endereco_numero: endereco?.numero || null,
          vistoria_completa_endereco_bairro: endereco?.bairro || null,
          vistoria_completa_endereco_cidade: endereco?.cidade || null,
          vistoria_completa_endereco_estado: endereco?.uf || null,
          vistoria_id: vistoria.id,
        })
        .eq('id', contratoId);
      
      if (contratoUpdateError) {
        console.error('[useCriarVistoriaAgendada] Erro ao atualizar contrato:', contratoUpdateError);
        // Não falhar a operação principal, apenas logar
      }
      
      // Registrar no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'vistoria_agendada',
        descricao: `Vistoria agendada para ${dataAgendada} às ${horarioAgendado}`,
        dados: { vistoria_id: vistoria.id, data: dataAgendada, horario: horarioAgendado },
      });
      
      return vistoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
      queryClient.invalidateQueries({ queryKey: ['instalacoes'] });
      queryClient.invalidateQueries({ queryKey: ['rotas'] });
      toast.success('Vistoria agendada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao agendar vistoria');
    },
  });
}

// Hook para criar autovistoria (ou reutilizar existente)
export function useCriarAutovistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      contratoId, 
      veiculoId,
      associadoId,
      latitude,
      longitude,
    }: { 
      contratoId: string; 
      veiculoId?: string;
      associadoId: string;
      latitude?: number;
      longitude?: number;
    }) => {
      if (!associadoId) {
        throw new Error('Associado não vinculado ao contrato. Entre em contato com a associação.');
      }
      
      // Verificar se já existe autovistoria pendente para este contrato
      const { data: existingVistoria } = await supabase
        .from('vistorias')
        .select('*')
        .eq('contrato_id', contratoId)
        .eq('modalidade', 'autovistoria')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Se já existe, atualizar coordenadas se fornecidas e retornar
      if (existingVistoria) {
        console.log('[useCriarAutovistoria] Reutilizando vistoria existente:', existingVistoria.id);
        
        // Atualizar coordenadas se fornecidas e ainda não existem
        if (latitude && longitude && !existingVistoria.endereco_latitude) {
          await supabase
            .from('vistorias')
            .update({
              endereco_latitude: latitude,
              endereco_longitude: longitude,
            })
            .eq('id', existingVistoria.id);
        }
        
        return existingVistoria;
      }
      
      // Criar nova vistoria com coordenadas
      const { data: vistoria, error: vistoriaError } = await supabase
        .from('vistorias')
        .insert({
          associado_id: associadoId,
          veiculo_id: veiculoId,
          contrato_id: contratoId,
          modalidade: 'autovistoria',
          status: 'pendente',
          tipo: 'instalacao' as any, // Instalação (anteriormente "entrada")
          endereco_latitude: latitude || null,
          endereco_longitude: longitude || null,
        })
        .select()
        .single();
      
      if (vistoriaError) throw vistoriaError;
      
      // Registrar no histórico do contrato
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'autovistoria_iniciada',
        descricao: 'Autovistoria iniciada pelo associado',
        dados: { 
          vistoria_id: vistoria.id,
          coordenadas: latitude && longitude ? { latitude, longitude } : null,
        },
      });
      
      return vistoria;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}

// Hook para upload de foto da autovistoria (com persistência em vistoria_fotos)
export function useUploadFotoAutovistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      vistoriaId, 
      fotoId, 
      file,
      contratoId,
    }: { 
      vistoriaId: string; 
      fotoId: string; 
      file: File;
      contratoId: string;
    }) => {
      const fileName = `vistorias/${vistoriaId}/${fotoId}_${Date.now()}.${file.name.split('.').pop()}`;
      
      // Upload do arquivo
      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(fileName, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Obter URL pública
      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(fileName);
      
      const publicUrl = urlData.publicUrl;
      
      // Persistir/atualizar em vistoria_fotos (upsert por vistoria_id + tipo)
      const { error: fotoDbError } = await supabase
        .from('vistoria_fotos')
        .upsert(
          { vistoria_id: vistoriaId, tipo: fotoId, arquivo_url: publicUrl },
          { onConflict: 'vistoria_id,tipo' }
        );
      
      if (fotoDbError) {
        console.error('Erro ao salvar foto no banco:', fotoDbError);
        throw fotoDbError;
      }
      
      // Se for foto do odômetro, extrair quilometragem via IA
      let kmExtraido: number | null = null;
      if (fotoId === 'odometro') {
        try {
          const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('odometro-ocr', {
            body: { url: publicUrl, vistoriaId }
          });
          
          if (!ocrError && ocrResult?.km && ocrResult.confianca >= 0.7) {
            kmExtraido = ocrResult.km;
            console.log('KM extraído do odômetro:', kmExtraido);
          }
        } catch (error) {
          console.error('Erro ao extrair km do odômetro:', error);
        }
      }
      
      // Se for foto do chassi, validar via IA
      let chassiValidacao: { chassi: string | null; validacao: 'confere' | 'diverge' | 'ilegivel' | null; confianca: number } | null = null;
      if (fotoId === 'chassi') {
        try {
          const { data: ocrResult, error: ocrError } = await supabase.functions.invoke('chassi-ocr', {
            body: { url: publicUrl, vistoriaId }
          });
          
          if (!ocrError && ocrResult) {
            chassiValidacao = {
              chassi: ocrResult.chassi,
              validacao: ocrResult.validacao,
              confianca: ocrResult.confianca,
            };
            console.log('[Autovistoria] Chassi OCR resultado:', chassiValidacao);
            
            // Alertar usuário se divergir
            if (ocrResult.validacao === 'diverge') {
              console.warn('[Autovistoria] CHASSI DIVERGENTE DETECTADO!');
            }
          }
        } catch (error) {
          console.error('Erro ao validar chassi:', error);
        }
      }
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'autovistoria_foto_enviada',
        descricao: `Foto enviada: ${fotoId}${kmExtraido ? ` (KM: ${kmExtraido.toLocaleString('pt-BR')})` : ''}${chassiValidacao?.validacao ? ` [Chassi: ${chassiValidacao.validacao}]` : ''}`,
        dados: { 
          vistoria_id: vistoriaId, 
          foto_id: fotoId, 
          url: publicUrl,
          km_extraido: kmExtraido,
          chassi_validacao: chassiValidacao,
        },
      });
      
      return { fotoId, url: publicUrl, kmExtraido, chassiValidacao };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
      queryClient.invalidateQueries({ queryKey: ['autovistoria-fotos'] });
      queryClient.invalidateQueries({ queryKey: ['autovistoria-existente'] });
    },
  });
}

// Hook para buscar autovistoria existente com fotos (para reidratar estado após refresh)
export function useAutovistoriaExistente(contratoId: string | undefined) {
  return useQuery({
    queryKey: ['autovistoria-existente', contratoId],
    queryFn: async () => {
      if (!contratoId) return null;
      
      // Buscar autovistoria pendente mais recente para este contrato
      const { data: vistoria, error } = await supabase
        .from('vistorias')
        .select(`
          *,
          fotos:vistoria_fotos(tipo, arquivo_url)
        `)
        .eq('contrato_id', contratoId)
        .eq('modalidade', 'autovistoria')
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found, que é aceitável
        console.error('Erro ao buscar autovistoria existente:', error);
      }
      
      return vistoria || null;
    },
    enabled: !!contratoId,
    staleTime: 30000, // 30 segundos
  });
}

// Hook para gerar link Autentique via token público
export function useGerarAutentiqueByToken() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (contratoToken: string) => {
      const { data, error } = await supabase.functions.invoke('autentique-create-by-token', {
        body: { contratoToken },
      });
      
      if (error) throw error;
      
      if (!data?.success) {
        // Propagar erro com código específico
        const err = new Error(data?.error || 'Erro ao gerar link de assinatura') as Error & { code?: string };
        err.code = data?.error_code || 'UNKNOWN_ERROR';
        throw err;
      }
      
      return data as { success: boolean; signatureLink: string; message: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
    },
  });
}

// Hook para finalizar autovistoria (atualizar status para 'em_analise')
export function useFinalizarAutovistoria() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ vistoriaId }: { vistoriaId: string }) => {
      const { error } = await supabase
        .from('vistorias')
        .update({ 
          status: 'em_analise',
          updated_at: new Date().toISOString()
        })
        .eq('id', vistoriaId);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vistorias'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-metricas'] });
      queryClient.invalidateQueries({ queryKey: ['autovistoria-existente'] });
    },
  });
}

// Interface para agendar instalação no fluxo de contrato
export interface AgendarInstalacaoContratoParams {
  contratoId: string;
  dataAgendada: string;
  horarioAgendado: string;
  endereco: {
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    cidade: string;
    estado: string;
  };
  responsavel: {
    euMesmo: boolean;
    nome?: string;
    telefone?: string;
  };
}

// Hook para agendar instalação após autovistoria no fluxo de contrato
export function useAgendarInstalacaoContrato() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ contratoId, dataAgendada, horarioAgendado, endereco, responsavel }: AgendarInstalacaoContratoParams) => {
      // Geocodificar endereço em background
      let latitude: number | null = null;
      let longitude: number | null = null;
      
      try {
        const { data, error } = await supabase.functions.invoke('geocode-endereco', {
          body: {
            logradouro: endereco.logradouro,
            numero: endereco.numero,
            bairro: endereco.bairro,
            cidade: endereco.cidade,
            uf: endereco.estado,
            cep: endereco.cep,
          }
        });
        
        if (!error && data?.latitude && data?.longitude) {
          latitude = data.latitude;
          longitude = data.longitude;
        }
      } catch (err) {
        console.warn('Erro ao geocodificar endereço:', err);
      }
      
      // Atualizar contrato com dados de agendamento
      const { error } = await supabase
        .from('contratos')
        .update({
          vistoria_completa_data_agendada: dataAgendada,
          vistoria_completa_horario_agendado: horarioAgendado,
          vistoria_completa_endereco_cep: endereco.cep,
          vistoria_completa_endereco_logradouro: endereco.logradouro,
          vistoria_completa_endereco_numero: endereco.numero,
          vistoria_completa_endereco_bairro: endereco.bairro,
          vistoria_completa_endereco_cidade: endereco.cidade,
          vistoria_completa_endereco_estado: endereco.estado,
          vistoria_completa_responsavel_eu_mesmo: responsavel.euMesmo,
          vistoria_completa_responsavel_nome: responsavel.nome || null,
          vistoria_completa_responsavel_telefone: responsavel.telefone || null,
          vistoria_endereco_latitude: latitude,
          vistoria_endereco_longitude: longitude,
        })
        .eq('id', contratoId);
      
      if (error) throw error;
      
      // Registrar no histórico
      await supabase.from('contratos_historico').insert({
        contrato_id: contratoId,
        evento: 'instalacao_agendada',
        descricao: `Instalação agendada para ${dataAgendada} às ${horarioAgendado}`,
        dados: {
          data: dataAgendada,
          horario: horarioAgendado,
          endereco: `${endereco.logradouro}, ${endereco.numero} - ${endereco.bairro}`,
        },
      });
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contrato-publico'] });
      queryClient.invalidateQueries({ queryKey: ['vistorias-mapa'] });
      toast.success('Instalação agendada com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao agendar instalação');
    },
  });
}

// Gerar URL do link do associado
export function getAssociadoLinkUrl(token: string): string {
  const baseUrl = window.location.origin;
  return `${baseUrl}/associado/${token}`;
}
