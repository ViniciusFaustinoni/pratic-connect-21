import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Função para enviar email via API Resend
async function sendResendEmail(to: string, subject: string, html: string, from: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Erro ao enviar email");
  }

  return response.json();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  template: string;
  to: string;
  data: Record<string, unknown>;
}

// Templates de email
const TEMPLATES: Record<string, {
  subject: string | ((data: Record<string, unknown>) => string);
  html: (data: Record<string, unknown>) => string;
}> = {
  'boas-vindas': {
    subject: 'Bem-vindo à PRATIC Proteção Veicular!',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">Olá, ${data.nome}! 👋</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Seja bem-vindo à <strong>PRATIC Proteção Veicular</strong>!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Seu cadastro foi realizado com sucesso. Agora você pode acessar nosso aplicativo para gerenciar seus veículos, cobranças e muito mais.
            </p>
            <a href="${data.appUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Acessar App do Associado
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'boleto-gerado': {
    subject: 'Sua cobrança foi gerada - PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">Nova Cobrança Gerada 📄</h1>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Competência</p>
              <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.competencia}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Valor</p>
              <p style="color: #18181b; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">R$ ${data.valor}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Vencimento</p>
              <p style="color: #dc2626; font-size: 18px; font-weight: 600; margin: 0;">${data.vencimento}</p>
            </div>
            <a href="${data.boletoUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Visualizar Boleto
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'pagamento-confirmado': {
    subject: 'Pagamento Confirmado - PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #16a34a; font-size: 24px; margin: 0 0 24px 0;">✅ Pagamento Confirmado!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Recebemos seu pagamento com sucesso. Obrigado por manter sua proteção em dia!
            </p>
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Competência</p>
              <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.competencia}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Valor Pago</p>
              <p style="color: #16a34a; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">R$ ${data.valor}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Data do Pagamento</p>
              <p style="color: #18181b; font-size: 16px; font-weight: 500; margin: 0;">${data.dataPagamento}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'sinistro-status': {
    subject: (data) => `Sinistro ${data.protocolo} - ${data.statusLabel}`,
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">${data.titulo}</h1>
            <div style="background-color: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="color: #52525b; font-size: 14px; margin: 0;">
                Protocolo: <strong>${data.protocolo}</strong>
              </p>
            </div>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${data.mensagem}
            </p>
            <a href="${data.link}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Ver Detalhes no App
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'contrato-ativado': {
    subject: 'Seu contrato foi ativado - PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #16a34a; font-size: 24px; margin: 0 0 24px 0;">🎉 Contrato Ativado!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Parabéns! Seu contrato de proteção veicular foi ativado com sucesso.
            </p>
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Número do Contrato</p>
              <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.numero}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Plano</p>
              <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.plano}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Data de Início</p>
              <p style="color: #18181b; font-size: 16px; font-weight: 500; margin: 0;">${data.dataInicio}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'boleto-vencendo': {
    subject: 'Lembrete: Sua cobrança vence em breve - PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #f59e0b; font-size: 24px; margin: 0 0 24px 0;">⏰ Lembrete de Vencimento</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Sua cobrança vence em <strong>${data.diasRestantes} dias</strong>. Não deixe sua proteção expirar!
            </p>
            <div style="background-color: #fffbeb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #fde68a;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Competência</p>
              <p style="color: #18181b; font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">${data.competencia}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Valor</p>
              <p style="color: #18181b; font-size: 24px; font-weight: 700; margin: 0 0 16px 0;">R$ ${data.valor}</p>
              <p style="color: #52525b; font-size: 14px; margin: 0 0 8px 0;">Vencimento</p>
              <p style="color: #f59e0b; font-size: 18px; font-weight: 600; margin: 0;">${data.vencimento}</p>
            </div>
            <a href="${data.boletoUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Pagar Agora
            </a>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'recuperacao-senha': {
    subject: 'Recuperação de Senha - PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">🔐 Recuperação de Senha</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Olá, ${data.nome}!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Recebemos uma solicitação para redefinir sua senha. Clique no botão abaixo para criar uma nova senha.
            </p>
            <a href="${data.linkReset}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
              Redefinir Senha
            </a>
            <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
              Se você não solicitou esta alteração, pode ignorar este email com segurança.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'primeiro-acesso': {
    subject: '🔐 Crie sua senha - App PRATIC',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">🎉 Olá, ${data.nome}!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Seu veículo está protegido pela <strong>PRATIC</strong>!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Clique no botão abaixo para criar sua senha e acessar o App PRATIC:
            </p>
            <a href="${data.linkCriarSenha}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              🔐 Criar minha senha
            </a>
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fde68a;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                ⏰ Este link é válido por ${data.prazoHoras || 48} horas.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'generico': {
    subject: (data) => String(data.assunto),
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">${data.titulo || data.assunto}</h1>
            <div style="color: #52525b; font-size: 16px; line-height: 1.6;">
              ${data.conteudo}
            </div>
            ${data.linkUrl ? `
              <a href="${data.linkUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500; margin-top: 24px;">
                ${data.linkTexto || 'Acessar'}
              </a>
            ` : ''}
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'acesso-funcionario': {
    subject: 'Seu acesso ao SGA PRATIC foi criado',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #18181b; font-size: 24px; margin: 0 0 24px 0;">Olá, ${data.nome}! 👋</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Seu acesso ao <strong>SGA PRATIC</strong> foi criado com sucesso.
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Clique no botão abaixo para definir sua senha e acessar o sistema:
            </p>
            <a href="${data.linkAcesso}" style="display: inline-block; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              🔐 Acessar Sistema
            </a>
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fde68a;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                ⏰ Este link expira em 24 horas. Após acessar, você definirá sua senha pessoal.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular - Sistema de Gestão
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'acesso-associado': {
    subject: 'Seu acesso ao App PRATIC está liberado! 🚗',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #16a34a; font-size: 24px; margin: 0 0 24px 0;">🎉 Seu acesso está liberado!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Olá, <strong>${data.nome}</strong>!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              O rastreador do seu veículo foi ativado e agora você pode acessar o App PRATIC para acompanhar seu veículo, boletos e muito mais!
            </p>
            <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #bbf7d0;">
              <p style="color: #52525b; font-size: 14px; margin: 0 0 12px 0;"><strong>Seus dados de acesso:</strong></p>
              <p style="color: #18181b; font-size: 16px; margin: 0 0 8px 0;">
                🔗 <strong>URL:</strong> <a href="${data.appUrl}" style="color: #2563eb;">${data.appUrl}</a>
              </p>
              <p style="color: #18181b; font-size: 16px; margin: 0 0 8px 0;">
                👤 <strong>Login:</strong> ${data.cpf}
              </p>
              <p style="color: #18181b; font-size: 16px; margin: 0;">
                🔑 <strong>Senha:</strong> ${data.senha}
              </p>
            </div>
            <a href="${data.appUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Acessar App do Associado
            </a>
            <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin-top: 24px; border: 1px solid #fde68a;">
              <p style="color: #92400e; font-size: 14px; margin: 0;">
                🔒 No primeiro acesso, você deverá trocar sua senha por uma de sua preferência.
              </p>
            </div>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  },
  'rastreador-ativado': {
    subject: 'Seu rastreador foi ativado! 📍',
    html: (data) => `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #16a34a; font-size: 24px; margin: 0 0 24px 0;">📍 Rastreador Ativado!</h1>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Olá, <strong>${data.nome}</strong>!
            </p>
            <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              O rastreador do seu veículo foi ativado com sucesso! Agora você pode acompanhar a localização em tempo real pelo App do Associado.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 32px 0;">
            <p style="color: #a1a1aa; font-size: 14px; margin: 0;">
              PRATIC Proteção Veicular
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  }
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      console.error('Erro de autenticação:', claimsError?.message);
      return new Response(
        JSON.stringify({ error: 'Token inválido' }), 
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { template, to, data }: EmailRequest = await req.json();

    console.log(`Enviando email - Template: ${template}, Para: ${to}`);

    // Validar template
    if (!TEMPLATES[template]) {
      console.error(`Template não encontrado: ${template}`);
      return new Response(
        JSON.stringify({ error: `Template '${template}' não encontrado` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tpl = TEMPLATES[template];
    
    // Gerar subject (pode ser string ou função)
    const subject = typeof tpl.subject === 'function' 
      ? tpl.subject(data) 
      : tpl.subject;

    // Gerar HTML
    const html = tpl.html(data);

    // Configurar remetente
    // Usar domínio próprio quando configurado, ou resend.dev para testes
    const fromEmail = Deno.env.get("EMAIL_FROM") || "PRATIC <onboarding@resend.dev>";

    const emailResponse = await sendResendEmail(to, subject, html, fromEmail);

    console.log("Email enviado com sucesso:", emailResponse);

    return new Response(JSON.stringify({ success: true, id: emailResponse.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("Erro ao enviar email:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
