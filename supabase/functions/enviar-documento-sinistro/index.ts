import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnviarDocumentoRequest {
  sinistro_id: string;
  tipo_documento: string;
  arquivo_base64: string;
  nome_arquivo: string;
  mime_type: string;
  observacao?: string;
}

const TIPOS_DOCUMENTO_VALIDOS = [
  'cnh', 'crlv', 'bo', 'laudo', 'laudo_bombeiros', 
  'foto_adicional', 'chaves', 'comprovante_evento', 'outro'
];

const MIME_TYPES_ACEITOS = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
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
      console.error('[EnviarDocumento] Auth error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[EnviarDocumento] Usuário autenticado:', user.id);

    // Parse body
    const payload: EnviarDocumentoRequest = await req.json();
    const { sinistro_id, tipo_documento, arquivo_base64, nome_arquivo, mime_type, observacao } = payload;

    // Validações básicas
    if (!sinistro_id || !tipo_documento || !arquivo_base64 || !nome_arquivo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Campos obrigatórios faltando' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo de documento
    if (!TIPOS_DOCUMENTO_VALIDOS.includes(tipo_documento)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tipo de documento inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar MIME type
    if (!MIME_TYPES_ACEITOS.includes(mime_type)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Formato de arquivo não aceito. Use PDF, JPG, PNG ou WebP.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar associado vinculado ao usuário
    const { data: associado, error: assocError } = await supabaseAdmin
      .from('associados')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (assocError || !associado) {
      console.error('[EnviarDocumento] Associado não encontrado:', assocError);
      return new Response(
        JSON.stringify({ success: false, error: 'Associado não encontrado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se o sinistro pertence ao associado
    const { data: sinistro, error: sinistroError } = await supabaseAdmin
      .from('sinistros')
      .select('id, status, analista_id, protocolo')
      .eq('id', sinistro_id)
      .eq('associado_id', associado.id)
      .single();

    if (sinistroError || !sinistro) {
      console.error('[EnviarDocumento] Sinistro não encontrado ou não pertence ao associado:', sinistroError);
      return new Response(
        JSON.stringify({ success: false, error: 'Sinistro não encontrado ou acesso negado' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se sinistro permite envio de documentos
    const statusBloqueados = ['encerrado', 'cancelado', 'pago'];
    if (statusBloqueados.includes(sinistro.status)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este sinistro não aceita mais documentos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decodificar base64
    const base64Data = arquivo_base64.includes(',') 
      ? arquivo_base64.split(',')[1] 
      : arquivo_base64;
    
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Verificar tamanho (max 10MB)
    if (bytes.length > 10 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: 'Arquivo excede o limite de 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar nome único para o arquivo
    const ext = nome_arquivo.split('.').pop() || 'pdf';
    const uniqueId = crypto.randomUUID();
    const storagePath = `${sinistro_id}/documentos/${tipo_documento}_${uniqueId}.${ext}`;

    console.log('[EnviarDocumento] Uploading to:', storagePath);

    // Upload para storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('sinistros')
      .upload(storagePath, bytes, {
        contentType: mime_type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[EnviarDocumento] Upload error:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao fazer upload do arquivo' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Gerar URL assinada (1 hora)
    const { data: signedUrlData } = await supabaseAdmin.storage
      .from('sinistros')
      .createSignedUrl(storagePath, 3600);

    // Verificar se já existe documento pendente/reprovado deste tipo
    const { data: docExistente } = await supabaseAdmin
      .from('sinistro_documentos')
      .select('id')
      .eq('sinistro_id', sinistro_id)
      .eq('tipo', tipo_documento)
      .in('status', ['pendente', 'reprovado'])
      .maybeSingle();

    let documentoId: string;

    if (docExistente) {
      // Atualizar documento existente
      const { data: docAtualizado, error: updateError } = await supabaseAdmin
        .from('sinistro_documentos')
        .update({
          arquivo_url: signedUrlData?.signedUrl || storagePath,
          nome_arquivo,
          status: 'enviado',
          enviado_em: new Date().toISOString(),
          motivo_reprovacao: null,
        })
        .eq('id', docExistente.id)
        .select('id')
        .single();

      if (updateError) {
        console.error('[EnviarDocumento] Update error:', updateError);
        throw updateError;
      }
      documentoId = docAtualizado.id;
    } else {
      // Criar novo documento
      const { data: novoDoc, error: insertError } = await supabaseAdmin
        .from('sinistro_documentos')
        .insert({
          sinistro_id,
          tipo: tipo_documento,
          nome_arquivo,
          arquivo_url: signedUrlData?.signedUrl || storagePath,
          status: 'enviado',
          enviado_em: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('[EnviarDocumento] Insert error:', insertError);
        throw insertError;
      }
      documentoId = novoDoc.id;
    }

    // Contar documentos ainda pendentes
    const { count: pendentesCount } = await supabaseAdmin
      .from('sinistro_documentos')
      .select('id', { count: 'exact', head: true })
      .eq('sinistro_id', sinistro_id)
      .eq('status', 'pendente');

    const documentosRestantes = pendentesCount || 0;

    // Se todos os documentos foram enviados e sinistro está em 'comunicado' ou 'documentacao_pendente'
    let novoStatus: string | null = null;
    if (documentosRestantes === 0 && ['comunicado', 'documentacao_pendente'].includes(sinistro.status)) {
      const { error: statusError } = await supabaseAdmin
        .from('sinistros')
        .update({ status: 'em_analise', updated_at: new Date().toISOString() })
        .eq('id', sinistro_id);

      if (!statusError) {
        novoStatus = 'em_analise';
        
        // Registrar no histórico
        await supabaseAdmin
          .from('sinistro_historico')
          .insert({
            sinistro_id,
            status_anterior: sinistro.status,
            status_novo: 'em_analise',
            observacao: 'Todos os documentos foram enviados',
          });
      }
    }

    // Registrar histórico do documento
    await supabaseAdmin
      .from('sinistro_historico')
      .insert({
        sinistro_id,
        status_anterior: sinistro.status,
        status_novo: sinistro.status,
        observacao: `Documento ${tipo_documento} enviado${observacao ? ': ' + observacao : ''}`,
      });

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
              tipo: 'sinistro_documento',
              titulo: '📄 Novo documento recebido',
              mensagem: `O associado enviou o documento ${tipo_documento} para o sinistro ${sinistro.protocolo}`,
              link: `/admin/sinistros/${sinistro_id}`,
            });
        }
      } catch (notifError) {
        console.error('[EnviarDocumento] Erro ao notificar analista:', notifError);
      }
    }

    // ========================================
    // NOTIFICAR ASSOCIADO VIA WHATSAPP
    // ========================================
    try {
      // Buscar telefone do associado
      const { data: associadoData } = await supabaseAdmin
        .from('associados')
        .select('telefone, whatsapp')
        .eq('id', associado.id)
        .single();

      const telefoneAssociado = associadoData?.whatsapp || associadoData?.telefone;
      
      if (telefoneAssociado) {
        const tipoDocFormatado = tipo_documento.replace(/_/g, ' ').toUpperCase();
        
        const mensagem = documentosRestantes > 0
          ? `✅ *Documento Recebido*\n\nRecebemos seu documento "${tipoDocFormatado}".\n\n📋 Ainda faltam *${documentosRestantes} documento(s)*.\n\nEnvie os demais para dar continuidade ao sinistro ${sinistro.protocolo}.`
          : `✅ *Todos os Documentos Recebidos*\n\nRecebemos todos os documentos solicitados!\n\n🔍 Seu sinistro *${sinistro.protocolo}* entrou em análise.\n\n⏰ *Prazo estimado:* até 5 dias úteis.\n\nVocê será notificado sobre o resultado.`;

        await supabaseAdmin.functions.invoke('whatsapp-send-text', {
          body: { 
            telefone: telefoneAssociado.replace(/\D/g, ''), 
            mensagem 
          }
        });
        
        console.log(`[EnviarDocumento] WhatsApp de confirmação enviado para ${telefoneAssociado}`);
      }
    } catch (whatsErr) {
      console.error('[EnviarDocumento] Erro ao enviar WhatsApp:', whatsErr);
      // Não falhar a operação principal
    }

    console.log('[EnviarDocumento] Sucesso! Documento ID:', documentoId);

    return new Response(
      JSON.stringify({
        success: true,
        documento_id: documentoId,
        status: 'enviado',
        documentos_restantes: documentosRestantes,
        sinistro_novo_status: novoStatus,
        mensagem_confirmacao: documentosRestantes > 0 
          ? `Documento enviado! Ainda restam ${documentosRestantes} documento(s) pendente(s).`
          : 'Documento enviado com sucesso!',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[EnviarDocumento] Erro:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
