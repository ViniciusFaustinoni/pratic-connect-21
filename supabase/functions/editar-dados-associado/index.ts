// Edição auditada de dados cadastrais sensíveis do associado (Cadastro).
// Calcula diff, valida campos, faz UPDATE atômico e registra `associados_historico`
// com tipo='dados_atualizados', motivo, executado_por, dados_anteriores/novos.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'https://esm.sh/zod@3.23.8';

const onlyDigits = (s: string) => s.replace(/\D/g, '');

const CamposSchema = z
  .object({
    nome: z.string().trim().min(3).max(120).optional(),
    cpf: z.string().transform(onlyDigits).refine((v) => v.length === 11, 'CPF deve ter 11 dígitos').optional(),
    rg: z.string().trim().max(30).optional().nullable(),
    data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    sexo: z.string().trim().max(20).optional().nullable(),
    estado_civil: z.string().trim().max(30).optional().nullable(),
    profissao: z.string().trim().max(120).optional().nullable(),
    email: z.string().trim().email().max(255).optional().nullable(),
    telefone: z.string().transform(onlyDigits).refine((v) => v === '' || (v.length >= 10 && v.length <= 13), 'Telefone inválido').optional().nullable(),
    telefone_secundario: z.string().transform(onlyDigits).refine((v) => v === '' || (v.length >= 10 && v.length <= 13), 'Telefone inválido').optional().nullable(),
    whatsapp: z.string().transform(onlyDigits).refine((v) => v === '' || (v.length >= 10 && v.length <= 13), 'WhatsApp inválido').optional().nullable(),
    cep: z.string().transform(onlyDigits).refine((v) => v === '' || v.length === 8, 'CEP deve ter 8 dígitos').optional().nullable(),
    logradouro: z.string().trim().max(200).optional().nullable(),
    numero: z.string().trim().max(20).optional().nullable(),
    complemento: z.string().trim().max(120).optional().nullable(),
    bairro: z.string().trim().max(120).optional().nullable(),
    cidade: z.string().trim().max(120).optional().nullable(),
    uf: z.string().trim().length(2).optional().nullable(),
    cnh_numero: z.string().trim().max(30).optional().nullable(),
    cnh_categoria: z.string().trim().max(10).optional().nullable(),
    cnh_validade: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  })
  .strict();

const BodySchema = z.object({
  associado_id: z.string().uuid(),
  campos: CamposSchema,
  motivo: z.string().trim().min(10, 'Motivo precisa ter ao menos 10 caracteres').max(1000),
});

const ROLES_PERMITIDAS = new Set([
  'analista_cadastro',
  'coordenador_cadastro',
  'gerente_cadastro',
  'diretor',
  'admin',
  'admin_master',
  'desenvolvedor',
]);

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonRes({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return jsonRes({ error: 'unauthorized' }, 401);
  const jwt = authHeader.slice(7);

  // Identifica usuário
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await authClient.auth.getUser(jwt);
  if (userErr || !userRes.user) return jsonRes({ error: 'unauthorized' }, 401);
  const authUserId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve profile + roles
  const { data: profile } = await admin
    .from('profiles')
    .select('id, nome')
    .eq('user_id', authUserId)
    .maybeSingle();
  if (!profile) return jsonRes({ error: 'profile_nao_encontrado' }, 403);

  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', authUserId);
  const userRoles = (roles || []).map((r) => String(r.role));
  const autorizado = userRoles.some((r) => ROLES_PERMITIDAS.has(r));
  if (!autorizado) return jsonRes({ error: 'sem_permissao', roles: userRoles }, 403);

  // Valida body
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return jsonRes({ error: 'json_invalido' }, 400); }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return jsonRes({ error: 'validacao', detalhes: parsed.error.flatten() }, 400);
  }
  const { associado_id, campos, motivo } = parsed.data;

  // Carrega associado atual
  const colunas = Object.keys(CamposSchema.shape).join(', ');
  const { data: atual, error: errAtual } = await admin
    .from('associados')
    .select(`id, ${colunas}`)
    .eq('id', associado_id)
    .maybeSingle();
  if (errAtual || !atual) return jsonRes({ error: 'associado_nao_encontrado' }, 404);

  // Monta diff (apenas campos efetivamente alterados; null vs '' tratados como iguais quando ambos vazios)
  const diff: Record<string, { antes: unknown; depois: unknown }> = {};
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(campos)) {
    if (v === undefined) continue;
    const antes = (atual as Record<string, unknown>)[k] ?? null;
    const depoisNorm = v === '' ? null : v;
    const antesNorm = antes === '' ? null : antes;
    if (JSON.stringify(antesNorm) === JSON.stringify(depoisNorm)) continue;
    diff[k] = { antes: antesNorm, depois: depoisNorm };
    patch[k] = depoisNorm;
  }

  if (Object.keys(patch).length === 0) {
    return jsonRes({ ok: true, alterado: false, mensagem: 'Nenhuma alteração' });
  }

  // Unicidade de CPF
  if ('cpf' in patch) {
    const { data: conflito } = await admin
      .from('associados')
      .select('id, nome')
      .eq('cpf', String(patch.cpf))
      .neq('id', associado_id)
      .maybeSingle();
    if (conflito) {
      return jsonRes({ error: 'cpf_em_uso', conflito }, 409);
    }
  }

  // UPDATE atômico
  const { error: errUpd } = await admin
    .from('associados')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', associado_id);
  if (errUpd) return jsonRes({ error: 'update_falhou', detalhes: errUpd.message }, 500);

  // Audit
  const camposAlterados = Object.keys(diff);
  const dadosAnteriores = Object.fromEntries(camposAlterados.map((k) => [k, diff[k].antes]));
  const dadosNovos = Object.fromEntries(camposAlterados.map((k) => [k, diff[k].depois]));

  const { error: errHist } = await admin.from('associados_historico').insert({
    associado_id,
    tipo: 'dados_atualizados',
    acao: 'editar_dados_cadastrais',
    descricao: `Cadastro editou ${camposAlterados.length} campo(s): ${camposAlterados.join(', ')}`,
    dados_anteriores: dadosAnteriores,
    dados_novos: dadosNovos,
    motivo,
    executado_por: profile.id,
    usuario_id: profile.id,
    metadata: {
      campos_alterados: camposAlterados,
      origem: 'cadastro_associados_editar_dados',
      user_agent: req.headers.get('user-agent') || null,
      ip: req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null,
    },
  });
  if (errHist) {
    console.error('[editar-dados-associado] Falha ao gravar histórico:', errHist);
    // Não revertemos o UPDATE — log fica como warning crítico.
  }

  return jsonRes({ ok: true, alterado: true, campos_alterados: camposAlterados });
});
