import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  id: string;
  profissional_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  is_active: boolean;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: Array<{ action: string; title: string; icon?: string }>;
}

interface SendPushRequest {
  profissional_id?: string;
  notification?: NotificationPayload;
  action?: string;
}

// Função para criar JWT para Web Push
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Enviar notificação usando fetch (sem dependência externa)
async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ success: boolean; shouldDeactivate: boolean }> {
  try {
    // Usar biblioteca web-push via ESM
    const webPush = await import("https://esm.sh/web-push@3.6.7");
    
    webPush.default.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    await webPush.default.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth
        }
      },
      payload
    );

    console.log(`✅ Push enviado para subscription ${subscription.id}`);
    return { success: true, shouldDeactivate: false };

  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    console.error(`❌ Erro ao enviar push ${subscription.id}:`, err.message);

    // Desativar apenas em erros 404 (not found) ou 410 (gone/expired)
    const shouldDeactivate = err.statusCode === 404 || err.statusCode === 410;

    return { success: false, shouldDeactivate };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Buscar secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:suporte@pratic.com.br';

    const body: SendPushRequest = await req.json();

    // Ação especial: retornar VAPID public key para o frontend
    if (body.action === 'get-vapid-key') {
      return new Response(
        JSON.stringify({ vapidPublicKey }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar VAPID keys
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.error('VAPID keys não configuradas');
      return new Response(
        JSON.stringify({ error: 'VAPID keys não configuradas no servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { profissional_id, notification } = body;

    if (!profissional_id || !notification) {
      return new Response(
        JSON.stringify({ error: 'profissional_id e notification são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📤 Enviando push para profissional ${profissional_id}: ${notification.title}`);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar subscriptions ativas do profissional
    const { data: subscriptions, error: fetchError } = await supabase
      .from('push_subscriptions_profissionais')
      .select('*')
      .eq('profissional_id', profissional_id)
      .eq('is_active', true);

    if (fetchError) {
      console.error('Erro ao buscar subscriptions:', fetchError);
      throw fetchError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`Nenhuma subscription ativa para profissional ${profissional_id}`);
      return new Response(
        JSON.stringify({ message: 'Nenhuma subscription ativa', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 ${subscriptions.length} subscription(s) encontrada(s)`);

    // Montar payload da notificação
    const notificationPayload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/pwa-instalador-512x512.png',
      badge: notification.badge || '/pwa-instalador-192x192.png',
      tag: notification.tag || `tarefa-${Date.now()}`,
      data: notification.data || {},
      actions: notification.actions || [
        { action: 'ver', title: 'Ver Tarefa' },
        { action: 'fechar', title: 'Fechar' }
      ]
    });

    // Enviar para todas as subscriptions
    let successCount = 0;
    const subscriptionsToDeactivate: string[] = [];

    for (const sub of subscriptions) {
      const result = await sendWebPushNotification(
        sub,
        notificationPayload,
        vapidPublicKey,
        vapidPrivateKey,
        vapidSubject
      );

      if (result.success) {
        successCount++;
      } else if (result.shouldDeactivate) {
        subscriptionsToDeactivate.push(sub.id);
      }
    }

    // Desativar subscriptions expiradas/inválidas
    if (subscriptionsToDeactivate.length > 0) {
      await supabase
        .from('push_subscriptions_profissionais')
        .update({ is_active: false })
        .in('id', subscriptionsToDeactivate);

      console.log(`🗑️ ${subscriptionsToDeactivate.length} subscription(s) desativada(s)`);
    }

    console.log(`✅ Push enviado: ${successCount}/${subscriptions.length}`);

    return new Response(
      JSON.stringify({
        message: 'Notificações enviadas',
        total: subscriptions.length,
        sent: successCount,
        failed: subscriptions.length - successCount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('❌ Erro na função:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
