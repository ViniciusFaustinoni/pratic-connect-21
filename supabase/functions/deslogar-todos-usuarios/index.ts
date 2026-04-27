import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Identify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Validate role: diretor
    const { data: roles, error: rolesErr } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId);
    if (rolesErr) {
      return new Response(JSON.stringify({ error: rolesErr.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const isDiretor = (roles ?? []).some((r: { role: string }) => r.role === 'diretor');
    if (!isDiretor) {
      return new Response(JSON.stringify({ error: 'Apenas Diretor pode executar esta ação' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Caller display name
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('nome, email')
      .eq('id', callerId)
      .maybeSingle();
    const callerNome =
      (callerProfile as { nome?: string; email?: string } | null)?.nome ??
      (callerProfile as { nome?: string; email?: string } | null)?.email ??
      userData.user.email ??
      'Diretor';

    // List + sign out all users except caller
    let page = 1;
    const perPage = 1000;
    let totalProcessados = 0;
    let totalDeslogados = 0;
    const erros: string[] = [];

    while (true) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page, perPage });
      if (listErr) {
        erros.push(`listUsers page ${page}: ${listErr.message}`);
        break;
      }
      const users = list?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        totalProcessados++;
        if (u.id === callerId) continue;
        const { error: signOutErr } = await admin.auth.admin.signOut(u.id, 'global');
        if (signOutErr) {
          erros.push(`signOut ${u.id}: ${signOutErr.message}`);
        } else {
          totalDeslogados++;
        }
      }

      if (users.length < perPage) break;
      page++;
      if (page > 50) break; // safety cap (50k users)
    }

    // Audit log
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('cf-connecting-ip') ??
      null;
    const userAgent = req.headers.get('user-agent') ?? null;

    await admin.from('logs_auditoria').insert({
      usuario_id: callerId,
      usuario_nome: callerNome,
      ip_address: ip,
      user_agent: userAgent,
      acao: 'configuracao',
      modulo: 'seguranca',
      descricao: 'Logout em massa: todas as sessões ativas foram invalidadas pelo Diretor',
      dados_novos: {
        evento: 'deslogar_todos_usuarios',
        total_processados: totalProcessados,
        total_deslogados: totalDeslogados,
        erros: erros.slice(0, 20),
        executor_id: callerId,
        executor_nome: callerNome,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        total_processados: totalProcessados,
        total_deslogados: totalDeslogados,
        erros_count: erros.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
