import { useNavigate } from 'react-router-dom';
import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function WhatsAppConnectionAlert() {
  const navigate = useNavigate();
  const { connected, status, isLoading } = useWhatsAppStatus();
  const [dismissed, setDismissed] = useState(false);
  const [isDiretor, setIsDiretor] = useState(false);
  const [hasEvolutionConfig, setHasEvolutionConfig] = useState(false);

  // Verificar se usuário é diretor
  useEffect(() => {
    async function checkRole() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (roles?.some(r => r.role === 'diretor' || r.role === 'desenvolvedor' || r.role === 'admin_master')) {
        setIsDiretor(true);
      }
    }

    // Verificar se existe configuração de Evolution API
    async function checkEvolutionConfig() {
      const { data } = await supabase
        .from('whatsapp_instancias')
        .select('id')
        .eq('principal', true)
        .maybeSingle();
      
      setHasEvolutionConfig(!!data);
    }

    checkRole();
    checkEvolutionConfig();
  }, []);

  // Não mostrar se:
  // - Ainda carregando
  // - Usuário não é diretor
  // - WhatsApp está conectado
  // - Usuário dismissou o alerta
  // - Não há configuração de Evolution (não configurado ainda)
  if (isLoading || !isDiretor || connected || dismissed || !hasEvolutionConfig) {
    return null;
  }

  return (
    <Alert variant="destructive" className="mb-4 relative">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>WhatsApp Desconectado</AlertTitle>
      <AlertDescription className="flex items-center justify-between mt-2">
        <span className="text-sm">
          A conexão do WhatsApp foi perdida. Mensagens não serão enviadas.
        </span>
        <div className="flex items-center gap-2 ml-4">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/configuracoes/integracoes')}
          >
            Reconectar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
