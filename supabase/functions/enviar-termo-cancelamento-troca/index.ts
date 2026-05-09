// Envia o Termo de Cancelamento ao associado antigo via Autentique (email + PF_FACIAL)
// Refatorado: consome template do banco (TERMO_CANCELAMENTO_V1), suporta reenvio
// (cancela doc anterior no Autentique) e persiste status do disparo WhatsApp.
// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { substituirVariaveisEvento, markdownParaHTML, generateStyles } from '../_shared/template-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTENTIQUE_URL = 'https://api.autentique.com.br/v2/graphql';
const TEMPLATE_CODIGO = 'TERMO_CANCELAMENTO_V1';

function formatCPF(cpf?: string | null) {
  const r = (cpf || '').replace(/\D/g, '');
  if (r.length !== 11) return cpf || '—';
  return r.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

async function cancelarDocAutentique(token: string, docId: string) {
  try {
    const mutation = `mutation { deleteDocument(id: "${docId}") }`;
    await fetch(AUTENTIQUE_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation }),
    });
  } catch (e) {
    console.warn('[enviar-termo-cancelamento-troca] falha ao deletar doc anterior', e);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { solicitacao_id, force_resend } = await req.json();
    if (!solicitacao_id) {
      return new Response(JSON.stringify({ error: 'solicitacao_id obrigatório' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const AUTENTIQUE_TOKEN = Deno.env.get('AUTENTIQUE_API_KEY');
    if (!AUTENTIQUE_TOKEN) {
      return new Response(JSON.stringify({ error: 'Autentique não configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: solicitacao, error: solErr } = await admin
      .from('solicitacoes_troca_titularidade')
      .select('id, novo_titular_dados, associado_antigo_id, veiculo_id, termo_cancelamento_autentique_id, termo_cancelamento_assinado_em, termo_reenvios_count')
      .eq('id', solicitacao_id)
      .maybeSingle();
    if (solErr || !solicitacao) throw new Error('Solicitação não encontrada');

    if (solicitacao.termo_cancelamento_assinado_em) {
      return new Response(JSON.stringify({ success: true, message: 'Termo já assinado — reenvio bloqueado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isResend = !!solicitacao.termo_cancelamento_autentique_id;
    if (isResend && !force_resend) {
      // Compatibilidade: chamada legada sem force_resend não reenvia
      return new Response(JSON.stringify({ success: true, message: 'Termo já enviado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Se for reenvio, deletar doc anterior no Autentique
    if (isResend && force_resend) {
      await cancelarDocAutentique(AUTENTIQUE_TOKEN, solicitacao.termo_cancelamento_autentique_id);
    }

    const { data: associadoAntigo, error: assocErr } = await admin
      .from('associados')
      .select('id, nome, cpf, rg, email, telefone, logradouro, numero, complemento, bairro, cidade, uf, cep, data_adesao, created_at')
      .eq('id', solicitacao.associado_antigo_id)
      .maybeSingle();
    if (assocErr) {
      console.error('[enviar-termo-cancelamento-troca] erro ao buscar associado:', assocErr);
      throw new Error('Erro ao buscar associado antigo: ' + assocErr.message);
    }
    if (!associadoAntigo) throw new Error('Associado antigo não encontrado');
    if (!associadoAntigo.email) throw new Error('Associado antigo sem email cadastrado');

    const { data: veiculo } = await admin
      .from('veiculos')
      .select('id, marca, modelo, placa, ano_modelo, cor, chassi, renavam')
      .eq('id', solicitacao.veiculo_id)
      .maybeSingle();

    // Contrato ativo do veículo (para variáveis)
    const { data: contrato } = await admin
      .from('contratos')
      .select('id, numero, valor_mensal, data_inicio, created_at')
      .eq('associado_id', solicitacao.associado_antigo_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const novoTitular = (solicitacao.novo_titular_dados || {}) as { nome?: string; cpf?: string };

    // Buscar template
    const { data: template } = await admin
      .from('documento_templates')
      .select('conteudo, cabecalho_html, rodape_html')
      .eq('codigo', TEMPLATE_CODIGO)
      .eq('ativo', true)
      .maybeSingle();

    const enderecoCompleto = [
      associadoAntigo.logradouro, associadoAntigo.numero, associadoAntigo.complemento,
      associadoAntigo.bairro,
      associadoAntigo.cidade && associadoAntigo.uf ? `${associadoAntigo.cidade}/${associadoAntigo.uf}` : (associadoAntigo.cidade || associadoAntigo.uf),
      associadoAntigo.cep ? `CEP ${associadoAntigo.cep}` : null,
    ].filter(Boolean).join(', ') || '___';

    const hoje = new Date();
    const dd = String(hoje.getDate()).padStart(2, '0');
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const yyyy = hoje.getFullYear();
    const dataAtualBr = `${dd}/${mm}/${yyyy}`;
    const dataExtenso = hoje.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    const motivoTxt = `Troca de titularidade para ${novoTitular?.nome || '___'} (CPF ${formatCPF(novoTitular?.cpf)}).`;

    const variaveis: Record<string, string> = {
      'associado.nome': associadoAntigo.nome || '___',
      'associado.cpf': formatCPF(associadoAntigo.cpf),
      'associado.rg': associadoAntigo.rg || '___',
      'associado.email': associadoAntigo.email || '___',
      'associado.telefone': associadoAntigo.telefone || '___',
      'associado.endereco_completo': enderecoCompleto,
      'associado.cidade': associadoAntigo.cidade || '___',
      'associado.estado': associadoAntigo.uf || '___',
      'associado.data_adesao': associadoAntigo.data_associacao
        ? new Date(associadoAntigo.data_associacao).toLocaleDateString('pt-BR')
        : (associadoAntigo.created_at ? new Date(associadoAntigo.created_at).toLocaleDateString('pt-BR') : '—'),
      'veiculo.marca': veiculo?.marca || '___',
      'veiculo.modelo': veiculo?.modelo || '___',
      'veiculo.placa': veiculo?.placa || '___',
      'veiculo.ano': String(veiculo?.ano_modelo || '___'),
      'veiculo.cor': veiculo?.cor || '___',
      'veiculo.chassi': veiculo?.chassi || '___',
      'veiculo.renavam': veiculo?.renavam || '___',
      'contrato.numero': contrato?.numero || '—',
      'contrato.plano': '—',
      'contrato.valor_mensal': contrato?.valor_mensal ? `R$ ${Number(contrato.valor_mensal).toFixed(2).replace('.', ',')}` : '—',
      'cancelamento.motivo': motivoTxt,
      'cancelamento.data': dataAtualBr,
      'sistema.data_atual': dataAtualBr,
      'sistema.data_extenso': dataExtenso,
      'empresa.nome': 'PRATICCAR',
    };

    let html: string;
    if (template?.conteudo) {
      console.log('[enviar-termo-cancelamento-troca] usando template do banco', TEMPLATE_CODIGO);
      const conteudoSubstituido = substituirVariaveisEvento(template.conteudo, variaveis);
      const corpoHTML = markdownParaHTML(conteudoSubstituido);
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Termo de Cancelamento</title>${generateStyles()}</head><body><div class="page">
${template.cabecalho_html || `<div class="header"><div class="header-logo-area"><img src="https://app.praticcar.org/logos/logo-full-light.png" alt="Praticcar" /></div><div class="header-titulo">TERMO DE CANCELAMENTO</div></div>`}
${corpoHTML}
${template.rodape_html || `<div class="footer">PRATICCAR · www.praticcar.org · Termo de Cancelamento</div>`}
</div></body></html>`;
    } else {
      // Fallback resiliente — mantém comportamento anterior
      console.warn('[enviar-termo-cancelamento-troca] template não encontrado, usando HTML embutido (fallback)');
      const veiculoTxt = `${veiculo?.marca || ''} ${veiculo?.modelo || ''} ${veiculo?.ano_modelo || ''}`.trim();
      html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de Cancelamento</title>
        <style>
          @page { size: A4; margin: 24mm 22mm; }
          body { font-family: Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.55; }
          .logo { text-align: center; margin-bottom: 18pt; } .logo img { max-height: 70px; }
          h1 { text-align: center; font-size: 16pt; letter-spacing: 1pt; margin: 8pt 0 22pt 0; }
          p { margin: 0 0 12pt 0; text-align: justify; }
          .motivo-box { border: 1px solid #333; padding: 10pt; min-height: 60pt; margin: 14pt 0; }
          .data { margin: 28pt 0 60pt 0; }
          .assinatura { border-top: 1px solid #000; width: 70%; margin: 0 auto; padding-top: 6pt; text-align: center; font-size: 10pt; letter-spacing: 1pt; }
          .footer { margin-top: 50pt; border-top: 1px solid #ccc; padding-top: 10pt; text-align: center; font-size: 9pt; color: #555; }
        </style></head>
        <body>
          <div class="logo"><img src="https://app.praticcar.org/logos/logo-full-light.png" alt="Praticcar" /></div>
          <h1>TERMO DE CANCELAMENTO</h1>
          <p>Eu, <strong>${associadoAntigo.nome || '___'}</strong>, portador da identidade de n° <strong>${associadoAntigo.rg || '___'}</strong> inscrito no CPF sob o n° <strong>${formatCPF(associadoAntigo.cpf)}</strong>, residente ao endereço <strong>${enderecoCompleto}</strong>.</p>
          <p>Solicito o cancelamento de todos os benefícios oferecidos pela Praticcar, inclusive o benefício da proteção veicular do veículo <strong>${veiculoTxt || '___'}</strong>, placa <strong>${veiculo?.placa || '___'}</strong>;</p>
          <p>Declaro estar ciente que na instalação do equipamento rastreador, em regime de comodato, o associado se torna fiel depositário do aparelho. Em caso de não devolução do equipamento será devido <strong>R$400,00</strong> conforme regulamento.</p>
          <div class="motivo-box"><strong>Motivo:</strong><br/>${motivoTxt}</div>
          <p class="data">Data: ${dataAtualBr}</p>
          <div class="assinatura">ASSINATURA DO ASSOCIADO</div>
          <div class="footer">www.praticcar.org · 21 97019-4372<br/>Avenida das Américas, 19005, Recreio dos Bandeirantes - RJ</div>
        </body></html>`;
    }

    // Criar documento no Autentique
    const cpfRaw = (associadoAntigo.cpf || '').replace(/\D/g, '');
    const signerObj: any = {
      name: associadoAntigo.nome,
      email: associadoAntigo.email,
      action: 'SIGN',
      delivery_method: 'DELIVERY_METHOD_EMAIL',
      security_verifications: [{ type: 'PF_FACIAL' }],
    };
    if (cpfRaw.length === 11) signerObj.configs = { cpf: cpfRaw };

    const operations = {
      query: `mutation CreateDocumentMutation($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
        createDocument(sandbox: false, document: $document, signers: $signers, file: $file) { id name }
      }`,
      variables: {
        document: { name: `Termo de Cancelamento - Troca - ${veiculo?.placa || ''}`, new_signature_style: true },
        signers: [signerObj],
        file: null,
      },
    };

    const formData = new FormData();
    formData.append('operations', JSON.stringify(operations));
    formData.append('map', JSON.stringify({ '0': ['variables.file'] }));
    formData.append('0', new Blob([html], { type: 'text/html' }), 'termo-cancelamento.html');

    const resp = await fetch(AUTENTIQUE_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${AUTENTIQUE_TOKEN}` }, body: formData,
    });
    const json = await resp.json();
    if (!resp.ok || json.errors) {
      console.error('[autentique]', json);
      throw new Error('Erro ao criar documento Autentique: ' + JSON.stringify(json.errors || json));
    }

    const docId = json.data?.createDocument?.id;
    if (!docId) throw new Error('Documento sem ID retornado');
    const termoUrl = `https://app.autentique.com.br/documentos/${docId}`;

    // Disparo WhatsApp + persistência do status
    let waStatus: 'enviado' | 'falhou' | 'sem_telefone' = 'sem_telefone';
    if (associadoAntigo.telefone) {
      try {
        const msg = `Olá, ${associadoAntigo.nome}!\n\nRecebemos uma solicitação de troca de titularidade do veículo *${veiculo?.marca || ''} ${veiculo?.modelo || ''} - ${veiculo?.placa || ''}*.\n\nPara liberar a transferência, é necessário assinar o termo de cancelamento abaixo (assinatura por reconhecimento facial):\n\n${termoUrl}\n\nApós sua assinatura, o processo segue automaticamente.`;
        const { error: waErr } = await admin.functions.invoke('whatsapp-send-text', {
          body: { telefone: associadoAntigo.telefone, mensagem: msg },
        });
        waStatus = waErr ? 'falhou' : 'enviado';
        if (waErr) console.warn('[enviar-termo-cancelamento-troca] WhatsApp falhou:', waErr);
      } catch (e) {
        waStatus = 'falhou';
        console.warn('[enviar-termo-cancelamento-troca] WhatsApp exceção:', e);
      }
    }

    const update: Record<string, any> = {
      termo_cancelamento_autentique_id: docId,
      termo_cancelamento_url: termoUrl,
      termo_cancelamento_enviado_em: new Date().toISOString(),
      termo_whatsapp_status: waStatus,
    };
    if (isResend && force_resend) {
      update.termo_reenvios_count = (solicitacao.termo_reenvios_count || 0) + 1;
      update.termo_ultimo_reenvio_em = new Date().toISOString();
    }

    await admin.from('solicitacoes_troca_titularidade').update(update).eq('id', solicitacao_id);

    return new Response(
      JSON.stringify({ success: true, autentique_id: docId, termo_url: termoUrl, whatsapp_status: waStatus, reenvio: !!(isResend && force_resend) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('[enviar-termo-cancelamento-troca]', e);
    const msg = e instanceof Error ? e.message : 'erro';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
