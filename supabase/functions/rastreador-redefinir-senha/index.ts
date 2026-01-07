import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gerar senha aleatória
function gerarSenha(tamanho = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length: tamanho }, () => 
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join('');
}

interface Plataforma {
  id: string;
  plataforma: string;
  nome_exibicao: string;
  api_url_sandbox: string;
  api_url_producao: string;
  ambiente_atual: string;
  suporta_redefinir_senha: boolean;
}

interface Associado {
  id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  whatsapp: string | null;
}

interface Veiculo {
  id: string;
  placa: string;
  associados: Associado | null;
}

interface Rastreador {
  id: string;
  plataforma_user_id: string | null;
  plataforma_device_id: string | null;
  plataforma_id: string;
  rastreadores_config_plataformas: Plataforma | null;
  veiculos: Veiculo | null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { rastreador_id } = await req.json();

    if (!rastreador_id) {
      throw new Error('rastreador_id é obrigatório');
    }

    // Buscar rastreador com plataforma, veículo e associado
    const { data: rastreadorData, error: rastError } = await supabase
      .from('rastreadores')
      .select(`
        id, 
        plataforma_user_id,
        plataforma_device_id,
        plataforma_id,
        rastreadores_config_plataformas(*),
        veiculos(
          id,
          placa,
          associados(id, nome, cpf, telefone, whatsapp)
        )
      `)
      .eq('id', rastreador_id)
      .single();

    if (rastError || !rastreadorData) {
      throw new Error('Rastreador não encontrado');
    }

    const rastreador = rastreadorData as unknown as Rastreador;
    const plataforma = rastreador.rastreadores_config_plataformas;
    const associado = rastreador.veiculos?.associados;

    if (!plataforma) {
      throw new Error('Plataforma não configurada para este rastreador');
    }

    if (!plataforma.suporta_redefinir_senha) {
      return new Response(
        JSON.stringify({
          success: false,
          erro: `Plataforma ${plataforma.nome_exibicao || plataforma.plataforma} não suporta redefinição de senha via API`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!associado) {
      throw new Error('Rastreador não está vinculado a um associado');
    }

    // Obter token
    const authResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/rastreador-auth`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ plataforma_codigo: plataforma.plataforma })
      }
    );
    
    const authData = await authResponse.json();
    if (!authData.success) {
      throw new Error('Falha na autenticação com a plataforma');
    }

    const baseUrl = plataforma.ambiente_atual === 'producao' 
      ? plataforma.api_url_producao 
      : plataforma.api_url_sandbox;

    let resultado: { success: boolean; novaSenha?: string; mensagem?: string; erro?: string };

    if (plataforma.plataforma === 'rede_veiculos') {
      // RedeVeículos - envia por SMS/email automaticamente
      const cpf = associado.cpf?.replace(/\D/g, '');
      
      if (!cpf) {
        throw new Error('CPF do associado não encontrado');
      }

      const formData = new URLSearchParams();
      formData.append('json', JSON.stringify({ cpfCnpjCliente: cpf }));

      const response = await fetch(`${baseUrl}/redefinirSenhaCliente/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      const data = await response.json();
      const isSuccess = data.error === 'false' || data.error === false || response.ok;
      
      resultado = {
        success: isSuccess,
        mensagem: isSuccess 
          ? 'Nova senha enviada por SMS/e-mail para o cliente'
          : (data.message || 'Erro ao redefinir senha'),
        erro: isSuccess ? undefined : (data.message || 'Erro desconhecido'),
      };

    } else if (plataforma.plataforma === 'softruck') {
      // Softruck - definimos uma nova senha
      if (!rastreador.plataforma_user_id) {
        throw new Error('ID do usuário não configurado na plataforma Softruck. Configure o campo plataforma_user_id.');
      }

      const novaSenha = gerarSenha(8);

      const response = await fetch(`${baseUrl}/v2/users/${rastreador.plataforma_user_id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authData.token}`,
          'public-key': Deno.env.get('SOFTRUCK_PUBLIC_KEY') || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            attributes: { password: novaSenha }
          }
        }),
      });

      const data = await response.json();
      
      resultado = {
        success: response.ok,
        novaSenha: response.ok ? novaSenha : undefined,
        mensagem: response.ok 
          ? 'Senha redefinida com sucesso. Informe ao cliente.'
          : (data.message || data.errors?.[0]?.detail || 'Erro ao redefinir senha'),
        erro: response.ok ? undefined : (data.message || 'Erro desconhecido'),
      };
    } else {
      throw new Error(`Plataforma ${plataforma.plataforma} não suportada para redefinição de senha`);
    }

    // Log da operação
    await supabase
      .from('rastreadores_logs')
      .insert({
        rastreador_id: rastreador.id,
        plataforma_id: plataforma.id,
        operacao: 'redefinir_senha',
        status: resultado.success ? 'sucesso' : 'erro',
        erro: resultado.erro || null,
        dados_enviados: { associado_id: associado.id },
        dados_recebidos: { success: resultado.success, mensagem: resultado.mensagem },
      });

    return new Response(
      JSON.stringify({
        success: resultado.success,
        novaSenha: resultado.novaSenha,
        mensagem: resultado.mensagem,
        plataforma: plataforma.nome_exibicao || plataforma.plataforma,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Erro redefinir senha:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, erro: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
