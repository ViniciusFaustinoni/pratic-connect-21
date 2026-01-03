import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-key',
}

// Gera um CPF válido aleatório
function gerarCPFValido(): string {
  const random = () => Math.floor(Math.random() * 10);
  const n = Array.from({ length: 9 }, random);
  
  // Cálculo do primeiro dígito verificador
  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += n[i] * (10 - i);
  }
  const d1 = (sum1 * 10) % 11 % 10;
  
  // Cálculo do segundo dígito verificador
  let sum2 = 0;
  for (let i = 0; i < 9; i++) {
    sum2 += n[i] * (11 - i);
  }
  sum2 += d1 * 2;
  const d2 = (sum2 * 10) % 11 % 10;
  
  return [...n, d1, d2].join('');
}

// Formata CPF com pontos e traço
function formatarCPF(cpf: string): string {
  const numeros = cpf.replace(/\D/g, '');
  return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar chave admin
    const adminKey = req.headers.get('x-admin-key');
    const expectedKey = Deno.env.get('TEST_ADMIN_KEY') || 'pratic-test-2025';

    if (adminKey !== expectedKey) {
      console.log('Unauthorized attempt with key:', adminKey?.substring(0, 5) + '...');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', message: 'Chave de admin inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    
    // Gerar ou usar CPF informado
    const cpfNumeros = (body.cpf || gerarCPFValido()).replace(/\D/g, '');
    const cpfFormatado = formatarCPF(cpfNumeros);
    const email = `${cpfNumeros}@associado.pratic.com.br`;
    const password = email;
    const nome = body.nome || `Teste ${cpfNumeros.substring(0, 4)}`;
    const tipo = body.tipo || 'associado';

    console.log(`Criando usuário de teste: ${nome} (${cpfFormatado})`);

    // Criar cliente Supabase com service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verificar se CPF já existe em associados
    const { data: existingAssociado } = await supabaseAdmin
      .from('associados')
      .select('id, user_id, nome, email')
      .eq('cpf', cpfFormatado)
      .maybeSingle();

    if (existingAssociado) {
      console.log('CPF já existe:', existingAssociado.id);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'CPF já cadastrado',
          existing: {
            associado_id: existingAssociado.id,
            nome: existingAssociado.nome,
            email: existingAssociado.email
          },
          credentials: {
            cpf: cpfFormatado,
            email: email,
            password: password
          }
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Criar usuário no Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nome,
        tipo
      }
    });

    if (authError) {
      console.error('Erro ao criar usuário auth:', authError);
      return new Response(
        JSON.stringify({ error: 'Erro ao criar usuário', details: authError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = authData.user.id;
    console.log('Usuário auth criado:', userId);

    // Aguardar trigger criar o profile
    await new Promise(resolve => setTimeout(resolve, 500));

    // Atualizar profile com CPF e telefone
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        cpf: cpfFormatado,
        telefone: '11999999999'
      })
      .eq('user_id', userId)
      .select('id')
      .single();

    if (profileError) {
      console.error('Erro ao atualizar profile:', profileError);
    }

    // Criar registro de associado (apenas se tipo for associado)
    let associadoData = null;
    if (tipo === 'associado') {
      const { data: assocData, error: assocError } = await supabaseAdmin
        .from('associados')
        .insert({
          user_id: userId,
          cpf: cpfFormatado,
          nome,
          email,
          telefone: '11999999999',
          status: 'ativo'
        })
        .select('id')
        .single();

      if (assocError) {
        console.error('Erro ao criar associado:', assocError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar associado', details: assocError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      associadoData = assocData;
      console.log('Associado criado:', associadoData.id);
    }

    // Se for funcionário, adicionar role
    if (tipo === 'funcionario') {
      const role = body.role || 'vendedor_clt';
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role
        });

      if (roleError) {
        console.error('Erro ao adicionar role:', roleError);
      } else {
        console.log('Role adicionada:', role);
      }
    }

    console.log('Usuário de teste criado com sucesso!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Usuário de teste criado com sucesso!',
        credentials: {
          cpf: cpfFormatado,
          email,
          password
        },
        ids: {
          user_id: userId,
          profile_id: profileData?.id || null,
          associado_id: associadoData?.id || null
        },
        tipo
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
