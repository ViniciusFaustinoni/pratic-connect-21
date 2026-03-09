import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportUserData {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  perfil?: string;
}

interface ImportRequest {
  usuarios: ImportUserData[];
  perfilPadrao?: string;
  tipo?: 'funcionario' | 'associado' | 'prestador';
}

interface ImportResult {
  linha: number;
  email: string;
  sucesso: boolean;
  erro?: string;
  userId?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    
    // Cliente com service role para operações admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Extrair token do header
    const token = authHeader.replace('Bearer ', '');

    // Validar JWT usando getUser(token) - passa o token diretamente
    const { data: { user: currentUser }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !currentUser) {
      console.error('Erro ao validar usuário:', userError);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar permissão dinâmica via has_permission
    const { data: temPermissao } = await supabaseAdmin.rpc('has_permission', {
      _user_id: currentUser.id,
      _permission: 'canImportUsers',
    });

    if (!temPermissao) {
      return new Response(
        JSON.stringify({ error: 'Sem permissão para importar usuários' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: ImportRequest = await req.json();
    const { usuarios, perfilPadrao = 'vendedor_clt', tipo = 'funcionario' } = body;

    if (!usuarios || !Array.isArray(usuarios) || usuarios.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum usuário para importar' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Iniciando importação de ${usuarios.length} usuários`);

    const resultados: ImportResult[] = [];
    let sucesso = 0;
    let erros = 0;

    // Processar cada usuário
    for (let i = 0; i < usuarios.length; i++) {
      const usuario = usuarios[i];
      const linha = i + 2; // +2 porque linha 1 é cabeçalho e índice começa em 0

      try {
        // Validar campos obrigatórios
        if (!usuario.nome?.trim()) {
          throw new Error('Nome é obrigatório');
        }
        if (!usuario.email?.trim()) {
          throw new Error('Email é obrigatório');
        }
        if (!usuario.senha?.trim()) {
          throw new Error('Senha é obrigatória');
        }

        const email = usuario.email.toLowerCase().trim();
        const nome = usuario.nome.trim();
        const telefone = usuario.telefone?.trim() || '';
        const senha = usuario.senha.trim();
        const perfil = usuario.perfil?.trim() || perfilPadrao;

        // Validar formato de email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error('Email inválido');
        }

        // Validar senha (mínimo 6 caracteres)
        if (senha.length < 6) {
          throw new Error('Senha deve ter no mínimo 6 caracteres');
        }

        // Verificar se email já existe
        const { data: existingEmail } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingEmail) {
          throw new Error('Email já cadastrado');
        }

        // Criar usuário no Auth com senha
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: {
            nome,
            telefone,
            tipo,
          }
        });

        if (authError) {
          throw new Error(authError.message);
        }

        // Atualizar profile
        await supabaseAdmin
          .from('profiles')
          .update({
            telefone,
            primeiro_acesso: false, // Já tem senha definida
          })
          .eq('user_id', authUser.user.id);

        // Adicionar role
        await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authUser.user.id,
            role: perfil,
          });

        // Registrar log de auditoria
        await supabaseAdmin
          .from('auth_logs')
          .insert({
            profile_id: authUser.user.id,
            email,
            acao: 'usuario_importado',
            metadata: {
              importado_por: currentUser.id,
              tipo,
              perfil,
              lote: true,
            }
          });

        resultados.push({
          linha,
          email,
          sucesso: true,
          userId: authUser.user.id,
        });
        sucesso++;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        resultados.push({
          linha,
          email: usuario.email || 'N/A',
          sucesso: false,
          erro: errorMessage,
        });
        erros++;
      }
    }

    console.log(`Importação concluída: ${sucesso} sucesso, ${erros} erros`);

    return new Response(
      JSON.stringify({ 
        total: usuarios.length,
        sucesso,
        erros,
        resultados,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error('Erro na função import-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
