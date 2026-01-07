import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TentativaPayload {
  action: 'registrar' | 'verificar' | 'desbloquear';
  email: string;
  ip?: string;
  sucesso?: boolean;
  motivo_falha?: string;
  desbloqueado_por?: string;
}

// Configurações de bloqueio progressivo
const BLOQUEIO_CONFIG = [
  { tentativas: 3, minutos: 5, nivel: 1 },      // 1-3 tentativas = 5 min
  { tentativas: 6, minutos: 30, nivel: 2 },     // 4-6 tentativas = 30 min
  { tentativas: 7, minutos: null, nivel: 3, permanente: true }  // 7+ = permanente
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const payload = await req.json() as TentativaPayload
    const { action, email, ip, sucesso, motivo_falha, desbloqueado_por } = payload

    if (!email) {
      throw new Error('Email é obrigatório')
    }

    const emailNormalizado = email.toLowerCase().trim()

    // ==========================================
    // ACTION: VERIFICAR - Verificar se está bloqueado
    // ==========================================
    if (action === 'verificar') {
      const { data: bloqueio } = await supabase
        .from('auth_bloqueios')
        .select('*')
        .eq('email', emailNormalizado)
        .is('desbloqueado_em', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!bloqueio) {
        return new Response(
          JSON.stringify({ bloqueado: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const agora = new Date()

      // Bloqueio permanente
      if (bloqueio.bloqueio_permanente) {
        return new Response(
          JSON.stringify({ 
            bloqueado: true, 
            permanente: true,
            nivel: bloqueio.nivel,
            mensagem: 'Conta bloqueada. Contate seu supervisor para desbloquear.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Bloqueio temporário
      const bloqueadoAte = new Date(bloqueio.bloqueado_ate)
      if (agora < bloqueadoAte) {
        const minutosRestantes = Math.ceil((bloqueadoAte.getTime() - agora.getTime()) / 60000)
        return new Response(
          JSON.stringify({ 
            bloqueado: true, 
            permanente: false,
            nivel: bloqueio.nivel,
            bloqueado_ate: bloqueio.bloqueado_ate,
            minutos_restantes: minutosRestantes,
            mensagem: `Conta temporariamente bloqueada. Tente novamente em ${minutosRestantes} minuto(s).`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Bloqueio expirou
      return new Response(
        JSON.stringify({ bloqueado: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==========================================
    // ACTION: REGISTRAR - Registrar tentativa
    // ==========================================
    if (action === 'registrar') {
      // Registrar tentativa
      await supabase
        .from('auth_tentativas')
        .insert({
          email: emailNormalizado,
          ip: ip || null,
          sucesso: sucesso || false,
          motivo_falha: motivo_falha || null
        })

      // Se foi sucesso, limpar bloqueios anteriores
      if (sucesso) {
        await supabase
          .from('auth_bloqueios')
          .update({ desbloqueado_em: new Date().toISOString() })
          .eq('email', emailNormalizado)
          .is('desbloqueado_em', null)

        return new Response(
          JSON.stringify({ success: true, bloqueado: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Contar tentativas falhas recentes (última hora)
      const umaHoraAtras = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { count } = await supabase
        .from('auth_tentativas')
        .select('*', { count: 'exact', head: true })
        .eq('email', emailNormalizado)
        .eq('sucesso', false)
        .gte('created_at', umaHoraAtras)

      const tentativasFalhas = count || 0

      // Verificar se precisa bloquear (iterar do maior para o menor)
      let bloqueioAplicar = null
      for (const config of [...BLOQUEIO_CONFIG].reverse()) {
        if (tentativasFalhas >= config.tentativas) {
          bloqueioAplicar = config
          break
        }
      }

      if (bloqueioAplicar) {
        const agora = new Date()
        const bloqueadoAte = bloqueioAplicar.minutos 
          ? new Date(agora.getTime() + bloqueioAplicar.minutos * 60 * 1000)
          : null

        // Criar bloqueio
        await supabase
          .from('auth_bloqueios')
          .insert({
            email: emailNormalizado,
            ip: ip || null,
            nivel: bloqueioAplicar.nivel,
            bloqueado_ate: bloqueadoAte?.toISOString() || null,
            bloqueio_permanente: bloqueioAplicar.permanente || false,
            motivo: `${tentativasFalhas} tentativas falhas`
          })

        // Buscar profile_id para log (se existir)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', emailNormalizado)
          .single()

        // Registrar log em auth_logs
        await supabase
          .from('auth_logs')
          .insert({
            profile_id: profile?.id || null,
            email: emailNormalizado,
            acao: bloqueioAplicar.permanente ? 'bloqueio_permanente' : 'bloqueio_temporario',
            ip_address: ip || null,
            metadata: { 
              tentativas: tentativasFalhas, 
              nivel: bloqueioAplicar.nivel,
              minutos_bloqueio: bloqueioAplicar.minutos
            }
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            bloqueado: true,
            permanente: bloqueioAplicar.permanente || false,
            nivel: bloqueioAplicar.nivel,
            bloqueado_ate: bloqueadoAte?.toISOString() || null,
            minutos: bloqueioAplicar.minutos,
            mensagem: bloqueioAplicar.permanente 
              ? 'Conta bloqueada permanentemente. Contate seu supervisor.'
              : `Conta bloqueada por ${bloqueioAplicar.minutos} minutos.`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Não bloqueado ainda, retornar tentativas restantes
      const tentativasRestantes = 3 - tentativasFalhas
      return new Response(
        JSON.stringify({ 
          success: true, 
          bloqueado: false,
          tentativas_restantes: Math.max(0, tentativasRestantes)
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ==========================================
    // ACTION: DESBLOQUEAR - Desbloqueio manual
    // ==========================================
    if (action === 'desbloquear') {
      if (!desbloqueado_por) {
        throw new Error('desbloqueado_por é obrigatório')
      }

      // Verificar se quem está desbloqueando tem permissão
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', desbloqueado_por)

      const perfisPermitidos = ['diretor', 'gerente_comercial', 'supervisor_vendas']
      const temPermissao = adminRoles?.some(
        (r) => perfisPermitidos.includes(r.role)
      )

      if (!temPermissao) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sem permissão para desbloquear usuários' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Buscar profile_id do admin que está desbloqueando
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', desbloqueado_por)
        .single()

      // Desbloquear
      await supabase
        .from('auth_bloqueios')
        .update({ 
          desbloqueado_em: new Date().toISOString(),
          desbloqueado_por: adminProfile?.id || null
        })
        .eq('email', emailNormalizado)
        .is('desbloqueado_em', null)

      // Buscar profile_id do usuário desbloqueado para log
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', emailNormalizado)
        .single()

      // Registrar log
      await supabase
        .from('auth_logs')
        .insert({
          profile_id: profile?.id || null,
          email: emailNormalizado,
          acao: 'desbloqueio_manual',
          ip_address: ip || null,
          metadata: { desbloqueado_por }
        })

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    throw new Error('Ação inválida')

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
