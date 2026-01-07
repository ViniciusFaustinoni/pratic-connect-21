import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SessionPayload {
  action: 'create' | 'validate' | 'refresh' | 'logout' | 'logout_all';
  profile_id?: string;
  token?: string;
  tipo_dispositivo?: 'desktop' | 'mobile';
  ip?: string;
  user_agent?: string;
}

// Configurações
const SESSAO_INATIVIDADE_HORAS = 8;
const SESSAO_MAXIMA_DIAS = 7;
const MAX_SESSOES_POR_TIPO = 1;

// Função para hash do token
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const payload = await req.json() as SessionPayload;
    const { action, profile_id, token, tipo_dispositivo, ip, user_agent } = payload;

    // ==========================================
    // ACTION: CREATE - Criar nova sessão
    // ==========================================
    if (action === 'create') {
      if (!profile_id || !tipo_dispositivo) {
        throw new Error('profile_id e tipo_dispositivo são obrigatórios');
      }

      // Verificar se usuário está ativo
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, nome, email, ativo, bloqueado')
        .eq('id', profile_id)
        .single();

      if (profileError || !profile) {
        throw new Error('Usuário não encontrado');
      }

      if (!profile.ativo) {
        throw new Error('Usuário inativo. Contate seu supervisor.');
      }

      if (profile.bloqueado) {
        throw new Error('Usuário bloqueado. Contate seu supervisor.');
      }

      // Contar sessões ativas do mesmo tipo
      const { data: sessoesAtivas } = await supabase
        .from('auth_sessoes')
        .select('id, created_at')
        .eq('profile_id', profile_id)
        .eq('tipo_dispositivo', tipo_dispositivo)
        .eq('ativo', true)
        .gt('expira_em', new Date().toISOString())
        .order('created_at', { ascending: true });

      // Se já tem sessão do mesmo tipo, encerrar a mais antiga
      if (sessoesAtivas && sessoesAtivas.length >= MAX_SESSOES_POR_TIPO) {
        const sessaoMaisAntiga = sessoesAtivas[0];
        
        await supabase
          .from('auth_sessoes')
          .update({ ativo: false })
          .eq('id', sessaoMaisAntiga.id);

        // Registrar log
        await supabase
          .from('auth_logs')
          .insert({
            profile_id,
            email: profile.email,
            acao: 'sessao_encerrada_limite',
            ip_address: ip,
            user_agent,
            metadata: { sessao_encerrada: sessaoMaisAntiga.id, tipo_dispositivo }
          });
      }

      // Gerar novo token
      const novoToken = crypto.randomUUID() + '-' + crypto.randomUUID();
      const tokenHash = await hashToken(novoToken);

      // Calcular expiração
      const agora = new Date();
      const expiraEm = new Date(agora.getTime() + (SESSAO_MAXIMA_DIAS * 24 * 60 * 60 * 1000));

      // Criar sessão
      const { data: novaSessao, error: sessaoError } = await supabase
        .from('auth_sessoes')
        .insert({
          profile_id,
          token_hash: tokenHash,
          tipo_dispositivo,
          ip,
          user_agent,
          expira_em: expiraEm.toISOString(),
          ativo: true
        })
        .select()
        .single();

      if (sessaoError) {
        throw new Error('Erro ao criar sessão: ' + sessaoError.message);
      }

      // Atualizar último acesso do usuário
      await supabase
        .from('profiles')
        .update({ data_ultimo_acesso: agora.toISOString() })
        .eq('id', profile_id);

      // Registrar log de login
      await supabase
        .from('auth_logs')
        .insert({
          profile_id,
          email: profile.email,
          acao: 'login_sessao_criada',
          ip_address: ip,
          user_agent,
          metadata: { sessao_id: novaSessao.id, tipo_dispositivo }
        });

      return new Response(
        JSON.stringify({ 
          success: true, 
          token: novoToken,
          sessao_id: novaSessao.id,
          expira_em: expiraEm.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION: VALIDATE - Validar sessão existente
    // ==========================================
    if (action === 'validate') {
      if (!token) {
        throw new Error('Token é obrigatório');
      }

      const tokenHash = await hashToken(token);

      const { data: sessao, error: sessaoError } = await supabase
        .from('auth_sessoes')
        .select(`
          *,
          profile:profiles(id, nome, email, ativo, bloqueado)
        `)
        .eq('token_hash', tokenHash)
        .eq('ativo', true)
        .single();

      if (sessaoError || !sessao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sessão inválida ou expirada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar se usuário ainda está ativo
      if (!sessao.profile?.ativo || sessao.profile?.bloqueado) {
        // Encerrar sessão
        await supabase
          .from('auth_sessoes')
          .update({ ativo: false })
          .eq('id', sessao.id);

        return new Response(
          JSON.stringify({ success: false, error: 'Usuário inativo ou bloqueado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar expiração
      const agora = new Date();
      const expiraEm = new Date(sessao.expira_em);
      
      if (agora > expiraEm) {
        await supabase
          .from('auth_sessoes')
          .update({ ativo: false })
          .eq('id', sessao.id);

        return new Response(
          JSON.stringify({ success: false, error: 'Sessão expirada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verificar inatividade (8 horas)
      const ultimoAcesso = new Date(sessao.ultimo_acesso);
      const limiteInatividade = new Date(ultimoAcesso.getTime() + (SESSAO_INATIVIDADE_HORAS * 60 * 60 * 1000));
      
      if (agora > limiteInatividade) {
        await supabase
          .from('auth_sessoes')
          .update({ ativo: false })
          .eq('id', sessao.id);

        await supabase
          .from('auth_logs')
          .insert({
            profile_id: sessao.profile_id,
            email: sessao.profile?.email || '',
            acao: 'sessao_expirada_inatividade',
            ip_address: ip,
            user_agent,
            metadata: { sessao_id: sessao.id, tipo_dispositivo: sessao.tipo_dispositivo }
          });

        return new Response(
          JSON.stringify({ success: false, error: 'Sessão expirada por inatividade' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Atualizar último acesso
      await supabase
        .from('auth_sessoes')
        .update({ ultimo_acesso: agora.toISOString() })
        .eq('id', sessao.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          profile: sessao.profile,
          sessao_id: sessao.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION: REFRESH - Atualizar último acesso
    // ==========================================
    if (action === 'refresh') {
      if (!token) {
        throw new Error('Token é obrigatório');
      }

      const tokenHash = await hashToken(token);

      const { error } = await supabase
        .from('auth_sessoes')
        .update({ ultimo_acesso: new Date().toISOString() })
        .eq('token_hash', tokenHash)
        .eq('ativo', true);

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sessão não encontrada' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION: LOGOUT - Encerrar sessão específica
    // ==========================================
    if (action === 'logout') {
      if (!token) {
        throw new Error('Token é obrigatório');
      }

      const tokenHash = await hashToken(token);

      const { data: sessao } = await supabase
        .from('auth_sessoes')
        .select('id, profile_id, profile:profiles(email)')
        .eq('token_hash', tokenHash)
        .single();

      if (sessao) {
        await supabase
          .from('auth_sessoes')
          .update({ ativo: false })
          .eq('id', sessao.id);

        await supabase
          .from('auth_logs')
          .insert({
            profile_id: sessao.profile_id,
            email: (sessao.profile as any)?.email || '',
            acao: 'logout',
            ip_address: ip,
            user_agent,
            metadata: { sessao_id: sessao.id }
          });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ==========================================
    // ACTION: LOGOUT_ALL - Encerrar todas as sessões
    // ==========================================
    if (action === 'logout_all') {
      if (!profile_id) {
        throw new Error('profile_id é obrigatório');
      }

      // Buscar email do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', profile_id)
        .single();

      await supabase
        .from('auth_sessoes')
        .update({ ativo: false })
        .eq('profile_id', profile_id);

      await supabase
        .from('auth_logs')
        .insert({
          profile_id,
          email: profile?.email || '',
          acao: 'logout_all',
          ip_address: ip,
          user_agent,
          metadata: { motivo: 'logout_all_dispositivos' }
        });

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Ação inválida');

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
