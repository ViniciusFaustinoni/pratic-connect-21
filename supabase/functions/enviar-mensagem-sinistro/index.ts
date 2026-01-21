import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnviarMensagemRequest {
  sinistro_id: string;
  mensagem: string;
  anexo_base64?: string;
  anexo_nome?: string;
  anexo_mime_type?: string;
}

const MIME_TYPES_ANEXO = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Cliente admin para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Extrair JWT do header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cliente com contexto do usuário
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verificar usuário autenticado
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      console.error('[EnviarMensagem] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[EnviarMensagem] Usuário autenticado:', user.id);

    // Parse body
    const payload: EnviarMensagemRequest = await req.json();
    const { sinistro_id, mensagem, anexo_base64, anexo_nome, anexo_mime_type } = payload;

    // Validações básicas
    if (!sinistro_id || !mensagem?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sinistro ID e mensagem são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar associado vinculado ao usuário
    const { data: associado, error: assocError } = await supabaseAdmin
      .from('associados')
      .select('id, nome')
      .eq('user_id', user.id)
      .single();

    if (assocError || !associado) {
      console.error('[EnviarMensagem] Associado não encontrado:', assocError);
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar profile do associado
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    // Verificar se o sinistro pertence ao associado
    const { data: sinistro, error: sinistroError } = await supabaseAdmin
      .from('sinistros')
      .select('id, status, analista_id, protocolo')
      .eq('id', sinistro_id)
      .eq('associado_id', associado.id)
      .single();

    if (sinistroError || !sinistro) {
      console.error('[EnviarMensagem] Sinistro não encontrado:', sinistroError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sinistro não encontrado ou acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se sinistro permite mensagens
    const statusBloqueados = ['encerrado', 'cancelado'];
    if (statusBloqueados.includes(sinistro.status)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este sinistro não aceita mais mensagens' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let anexoUrl: string | null = null;

    // Upload de anexo se fornecido
    if (anexo_base64 && anexo_nome && anexo_mime_type) {
      // Validar MIME type
      if (!MIME_TYPES_ANEXO.includes(anexo_mime_type)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Formato de anexo não aceito' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Decodificar base64
      const base64Data = anexo_base64.includes(',') 
        ? anexo_base64.split(',')[1] 
        : anexo_base64;
      
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Verificar tamanho (max 5MB para anexos de mensagem)
      if (bytes.length > 5 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ success: false, error: 'Anexo excede o limite de 5MB' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Gerar nome único
      const ext = anexo_nome.split('.').pop() || 'jpg';
      const uniqueId = crypto.randomUUID();
      const storagePath = `${sinistro_id}/mensagens/${uniqueId}.${ext}`;

      console.log('[EnviarMensagem] Uploading anexo to:', storagePath);

      // Upload para storage
      const { error: uploadError } = await supabaseAdmin.storage
        .from('sinistros')
        .upload(storagePath, bytes, {
          contentType: anexo_mime_type,
          upsert: false,
        });

      if (uploadError) {
        console.error('[EnviarMensagem] Upload error:', uploadError);
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao fazer upload do anexo' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Gerar URL assinada
      const { data: signedUrlData } = await supabaseAdmin.storage
        .from('sinistros')
        .createSignedUrl(storagePath, 3600);

      anexoUrl = signedUrlData?.signedUrl || storagePath;
    }

    // Inserir mensagem
    const { data: novaMensagem, error: insertError } = await supabaseAdmin
      .from('sinistro_mensagens')
      .insert({
        sinistro_id,
        remetente_tipo: 'associado',
        remetente_id: profile?.id || null,
        mensagem: mensagem.trim(),
        anexo_url: anexoUrl,
        anexo_nome: anexo_nome || null,
        anexo_tipo: anexo_mime_type || null,
        lida: false,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      console.error('[EnviarMensagem] Insert error:', insertError);
      throw insertError;
    }

    console.log('[EnviarMensagem] Mensagem criada:', novaMensagem.id);

    // Notificar analista (se atribuído)
    if (sinistro.analista_id) {
      try {
        // Buscar profile_id do analista
        const { data: analistaProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('user_id', sinistro.analista_id)
          .single();

        if (analistaProfile) {
          await supabaseAdmin
            .from('notificacoes')
            .insert({
              usuario_id: analistaProfile.id,
              tipo: 'sinistro_mensagem',
              titulo: '💬 Nova mensagem do associado',
              mensagem: `${associado.nome} enviou uma mensagem no sinistro ${sinistro.protocolo}`,
              link: `/admin/sinistros/${sinistro_id}`,
            });
        }
      } catch (notifError) {
        console.error('[EnviarMensagem] Erro ao notificar:', notifError);
        // Não falha a operação principal
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mensagem_id: novaMensagem.id,
        created_at: novaMensagem.created_at,
        anexo_url: anexoUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EnviarMensagem] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
