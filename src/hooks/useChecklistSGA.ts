import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ChecklistStatus = 'ok' | 'faltando' | 'risco';

export interface ChecklistSGAItem {
  campo: string;
  label: string;
  status: ChecklistStatus;
  valor?: string | null;
  detalhe?: string;
  secao: 'associado' | 'veiculo' | 'sistema';
  critico?: boolean;
}

export interface ChecklistSGAResult {
  itens: ChecklistSGAItem[];
  contadores: { ok: number; faltando: number; risco: number; total: number };
  pronto: boolean;
  isLoading: boolean;
}

function validarCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const nums = cpf.replace(/\D/g, '');
  return nums.length === 11;
}

export function useChecklistSGA(veiculoId: string, associadoId: string): ChecklistSGAResult {
  const { data, isLoading } = useQuery({
    queryKey: ['checklist-sga', veiculoId, associadoId],
    queryFn: async () => {
      const [veiculoRes, associadoRes, contratoRes, credenciaisRes, mapeamentosRes] = await Promise.all([
        supabase.from('veiculos').select('placa, chassi, renavam, cor, combustivel, ano_modelo, codigo_fipe, valor_fipe, marca, modelo').eq('id', veiculoId).single(),
        supabase.from('associados').select('nome, cpf, rg, data_nascimento, email, telefone, whatsapp, cep, logradouro, numero, bairro, cidade, uf, dia_vencimento').eq('id', associadoId).single(),
        supabase.from('contratos').select('vendedor_id, veiculo_categoria').eq('veiculo_id', veiculoId).eq('associado_id', associadoId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('integracoes_credenciais').select('configurado, teste_sucesso').eq('integracao', 'hinova').maybeSingle(),
        supabase.from('hinova_mapeamentos').select('tipo, codigo_local').eq('ativo', true),
      ]);

      const veiculo = veiculoRes.data;
      const associado = associadoRes.data;
      const contrato = contratoRes.data;
      const credenciais = credenciaisRes.data;
      const mapeamentos = mapeamentosRes.data || [];

      // Buscar codigo_sga_voluntario do vendedor
      let codigoVoluntario: string | null = null;
      if (contrato?.vendedor_id) {
        const { data: vendedor } = await supabase
          .from('profiles')
          .select('codigo_sga_voluntario')
          .eq('id', contrato.vendedor_id)
          .single();
        codigoVoluntario = vendedor?.codigo_sga_voluntario || null;
      }

      // Verificar mapeamentos
      const coresDisponiveis = mapeamentos.filter(m => m.tipo === 'cor').map(m => m.codigo_local.toLowerCase());
      const combustiveisDisponiveis = mapeamentos.filter(m => m.tipo === 'combustivel').map(m => m.codigo_local.toLowerCase());

      const itens: ChecklistSGAItem[] = [];

      // === ASSOCIADO ===
      const addAssociado = (campo: string, label: string, valor: unknown, critico = false, detalhe?: string) => {
        const preenchido = valor !== null && valor !== undefined && String(valor).trim() !== '';
        itens.push({
          campo, label, secao: 'associado', critico,
          status: preenchido ? 'ok' : (critico ? 'faltando' : 'risco'),
          valor: preenchido ? String(valor) : null,
          detalhe: preenchido ? undefined : (detalhe || `${label} não preenchido`),
        });
      };

      addAssociado('nome', 'Nome', associado?.nome);
      
      // CPF — validação de formato
      const cpfValido = validarCPF(associado?.cpf);
      itens.push({
        campo: 'cpf', label: 'CPF', secao: 'associado', critico: true,
        status: cpfValido ? 'ok' : (associado?.cpf ? 'risco' : 'faltando'),
        valor: associado?.cpf || null,
        detalhe: !associado?.cpf ? 'CPF não preenchido' : (!cpfValido ? 'CPF com formato inválido (esperado 11 dígitos)' : undefined),
      });

      addAssociado('telefone', 'Telefone', associado?.telefone);
      addAssociado('email', 'E-mail', associado?.email);
      addAssociado('rg', 'RG', associado?.rg, false, 'RG não preenchido — será enviado vazio ao SGA');
      addAssociado('data_nascimento', 'Data de Nascimento', associado?.data_nascimento, false, 'Data de nascimento ausente — campo formatado vazio no SGA');
      addAssociado('cep', 'CEP', associado?.cep, false, 'Endereço incompleto — CEP faltando');
      addAssociado('logradouro', 'Logradouro', associado?.logradouro, false, 'Endereço incompleto');
      addAssociado('bairro', 'Bairro', associado?.bairro, false, 'Endereço incompleto');
      addAssociado('cidade', 'Cidade', associado?.cidade, false, 'Endereço incompleto');
      addAssociado('uf', 'UF', associado?.uf, false, 'Endereço incompleto');
      addAssociado('dia_vencimento', 'Dia de Vencimento', associado?.dia_vencimento);

      // === VEÍCULO ===
      const addVeiculo = (campo: string, label: string, valor: unknown, critico = false, detalhe?: string) => {
        const preenchido = valor !== null && valor !== undefined && String(valor).trim() !== '';
        itens.push({
          campo, label, secao: 'veiculo', critico,
          status: preenchido ? 'ok' : (critico ? 'faltando' : 'risco'),
          valor: preenchido ? String(valor) : null,
          detalhe: preenchido ? undefined : (detalhe || `${label} não preenchido`),
        });
      };

      addVeiculo('placa', 'Placa', veiculo?.placa);
      addVeiculo('chassi', 'Chassi', veiculo?.chassi, true, 'Chassi ausente — bloqueia envio ao SGA');
      addVeiculo('renavam', 'Renavam', veiculo?.renavam, true, 'Renavam ausente — bloqueia envio ao SGA');
      addVeiculo('marca', 'Marca', veiculo?.marca);
      addVeiculo('modelo', 'Modelo', veiculo?.modelo);
      addVeiculo('ano_modelo', 'Ano Modelo', veiculo?.ano_modelo);
      addVeiculo('codigo_fipe', 'Código FIPE', veiculo?.codigo_fipe);
      addVeiculo('valor_fipe', 'Valor FIPE', veiculo?.valor_fipe);

      // Cor — verificar mapeamento
      const corPreenchida = veiculo?.cor && String(veiculo.cor).trim() !== '';
      const corMapeada = corPreenchida && coresDisponiveis.includes(String(veiculo.cor).toLowerCase());
      itens.push({
        campo: 'cor', label: 'Cor (mapeamento Hinova)', secao: 'veiculo',
        status: corMapeada ? 'ok' : (corPreenchida ? 'risco' : 'faltando'),
        valor: veiculo?.cor || null,
        detalhe: !corPreenchida
          ? 'Cor não preenchida — será null no payload'
          : (!corMapeada ? `Cor "${veiculo?.cor}" sem mapeamento na tabela hinova_mapeamentos` : undefined),
      });

      // Combustível — verificar mapeamento
      const combPreenchido = veiculo?.combustivel && String(veiculo.combustivel).trim() !== '';
      const combMapeado = combPreenchido && combustiveisDisponiveis.includes(String(veiculo.combustivel).toLowerCase());
      itens.push({
        campo: 'combustivel', label: 'Combustível (mapeamento Hinova)', secao: 'veiculo',
        status: combMapeado ? 'ok' : (combPreenchido ? 'risco' : 'faltando'),
        valor: veiculo?.combustivel || null,
        detalhe: !combPreenchido
          ? 'Combustível não preenchido — será null no payload'
          : (!combMapeado ? `Combustível "${veiculo?.combustivel}" sem mapeamento na tabela hinova_mapeamentos` : undefined),
      });

      // === SISTEMA ===
      // Credenciais Hinova
      const hinovaConfigurado = credenciais?.configurado === true;
      itens.push({
        campo: 'credenciais_hinova', label: 'Credenciais Hinova', secao: 'sistema', critico: true,
        status: hinovaConfigurado ? 'ok' : 'faltando',
        detalhe: hinovaConfigurado ? undefined : 'Credenciais Hinova não configuradas — envio retornará erro 400',
      });

      // Código voluntário do vendedor
      itens.push({
        campo: 'codigo_voluntario', label: 'Código Voluntário (vendedor)', secao: 'sistema',
        status: codigoVoluntario ? 'ok' : 'risco',
        valor: codigoVoluntario,
        detalhe: codigoVoluntario ? undefined : 'Vendedor sem código SGA voluntário — será usado fallback "1"',
      });

      // Contrato vinculado
      itens.push({
        campo: 'contrato', label: 'Contrato vinculado', secao: 'sistema',
        status: contrato ? 'ok' : 'risco',
        detalhe: contrato ? undefined : 'Nenhum contrato encontrado para este veículo/associado',
      });

      return itens;
    },
    enabled: !!veiculoId && !!associadoId,
    staleTime: 10000,
  });

  const itens = data || [];
  const ok = itens.filter(i => i.status === 'ok').length;
  const faltando = itens.filter(i => i.status === 'faltando').length;
  const risco = itens.filter(i => i.status === 'risco').length;
  const pronto = faltando === 0;

  return {
    itens,
    contadores: { ok, faltando, risco, total: itens.length },
    pronto,
    isLoading,
  };
}
