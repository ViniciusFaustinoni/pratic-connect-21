import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useConfigAtribuicaoManual() {
  return useQuery({
    queryKey: ['config-atribuicao-manual'],
    queryFn: async () => {
      const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'atribuicao_manual_rotas')
        .maybeSingle();
      return data?.valor === 'true';
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useServicosParaAtribuir() {
  return useQuery({
    queryKey: ['servicos-para-atribuir-manual'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('servicos')
        .select(`
          id, tipo, data_agendada, hora_agendada, periodo, bairro, cidade, logradouro, numero,
          permite_encaixe, status,
          associado:associados!servicos_associado_id_fkey(id, nome, telefone, whatsapp),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa, marca, modelo)
        `)
        .is('profissional_id', null)
        .in('status', ['pendente', 'agendada'])
        .gte('data_agendada', hoje)
        .order('data_agendada', { ascending: true })
        .order('hora_agendada', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });
}

async function reverseGeocodeBairro(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PraticConnect/1.0', 'Accept-Language': 'pt-BR' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const bairro = addr.suburb || addr.neighbourhood || addr.city_district || '';
    const cidade = addr.city || addr.town || addr.municipality || '';
    return [bairro, cidade].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function useVistoriadoresAtivos() {
  return useQuery({
    queryKey: ['vistoriadores-ativos-manual'],
    queryFn: async () => {
      const { data: localizacoes, error: locErr } = await supabase
        .from('vistoriadores_localizacao')
        .select('vistoriador_id, latitude, longitude, em_servico, updated_at')
        .eq('em_servico', true);

      if (locErr) throw locErr;
      if (!localizacoes || localizacoes.length === 0) return [];

      const ids = localizacoes.map(l => l.vistoriador_id);

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, nome, avatar_url, telefone')
        .in('id', ids);

      if (profErr) throw profErr;

      const hoje = new Date().toISOString().split('T')[0];
      const { data: servicosAtribuidos } = await supabase
        .from('servicos')
        .select('id, tipo, data_agendada, bairro, cidade, profissional_id, status')
        .in('profissional_id', ids)
        .gte('data_agendada', hoje)
        .in('status', ['agendada', 'em_andamento', 'em_rota']);

      // Reverse geocode sequencialmente (1/s Nominatim policy)
      const bairroMap: Record<string, string | null> = {};
      for (const loc of localizacoes) {
        if (loc.latitude && loc.longitude) {
          bairroMap[loc.vistoriador_id] = await reverseGeocodeBairro(loc.latitude, loc.longitude);
          if (localizacoes.indexOf(loc) < localizacoes.length - 1) {
            await sleep(1100);
          }
        }
      }

      return (profiles || []).map(p => {
        const loc = localizacoes.find(l => l.vistoriador_id === p.id);
        const tarefas = (servicosAtribuidos || []).filter(s => s.profissional_id === p.id);
        return {
          ...p,
          latitude: loc?.latitude,
          longitude: loc?.longitude,
          ultimaAtualizacao: loc?.updated_at,
          bairroAtual: bairroMap[p.id] || null,
          tarefas,
        };
      });
    },
    refetchInterval: 30000,
    staleTime: 25000,
  });
}

export function useAtribuirServicoManual() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ servicoId, profissionalId }: { servicoId: string; profissionalId: string }) => {
      // Update servico
      const { error } = await supabase
        .from('servicos')
        .update({
          profissional_id: profissionalId,
          status: 'agendada',
          atribuido_em: new Date().toISOString(),
        })
        .eq('id', servicoId);

      if (error) throw error;

      // Get servico + profissional data for WhatsApp notification
      const { data: servico } = await supabase
        .from('servicos')
        .select(`
          id, tipo, data_agendada, hora_agendada, bairro, cidade, logradouro, numero,
          associado:associados!servicos_associado_id_fkey(nome, telefone),
          veiculo:veiculos!servicos_veiculo_id_fkey(placa)
        `)
        .eq('id', servicoId)
        .single();

      const { data: profissional } = await supabase
        .from('profiles')
        .select('telefone, whatsapp, nome')
        .eq('id', profissionalId)
        .single();

      // Send WhatsApp template to vistoriador
      if (profissional?.telefone || profissional?.whatsapp) {
        try {
          const telefone = profissional.whatsapp || profissional.telefone;
          const assocData = servico?.associado as any;
          const veicData = servico?.veiculo as any;
          await supabase.functions.invoke('enviar-template-meta', {
            body: {
              telefone,
              template_name: 'servico_atribuido_v1',
              variaveis: {
                '1': profissional.nome || 'Técnico',
                '2': servico?.tipo || 'Serviço',
                '3': assocData?.nome || 'Cliente',
                '4': `${servico?.logradouro || ''} ${servico?.numero || ''}, ${servico?.bairro || ''} - ${servico?.cidade || ''}`.trim(),
                '5': servico?.data_agendada || '',
                '6': servico?.hora_agendada || 'A definir',
              },
            },
          });
        } catch (e) {
          console.error('Erro ao enviar template WhatsApp:', e);
        }
      }

      return servico;
    },
    onSuccess: () => {
      toast.success('Serviço atribuído com sucesso');
      qc.invalidateQueries({ queryKey: ['servicos-para-atribuir-manual'] });
      qc.invalidateQueries({ queryKey: ['vistoriadores-ativos-manual'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao atribuir serviço: ' + (err.message || ''));
    },
  });
}
