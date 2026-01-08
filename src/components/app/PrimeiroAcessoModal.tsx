import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PrimeiroAcessoModalProps {
  open: boolean;
  onClose: () => void;
}

type ModalState = 'form' | 'loading' | 'success' | 'error';

export function PrimeiroAcessoModal({ open, onClose }: PrimeiroAcessoModalProps) {
  const [cpf, setCpf] = useState('');
  const [estado, setEstado] = useState<ModalState>('form');
  const [dadosEnvio, setDadosEnvio] = useState<{ whatsapp: string; email: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Máscara de CPF
  const formatarCPF = (valor: string) => {
    const nums = valor.replace(/\D/g, '').slice(0, 11);
    return nums
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  // Mascarar dados sensíveis
  const mascarar = (texto: string, tipo: 'telefone' | 'email') => {
    if (!texto) return '';
    if (tipo === 'telefone') {
      const nums = texto.replace(/\D/g, '');
      if (nums.length < 8) return texto;
      return `(${nums.slice(0, 2)}) ${nums[2]}****-${nums.slice(-4)}`;
    } else {
      const [user, domain] = texto.split('@');
      if (!user || !domain) return texto;
      return `${user[0]}****@${domain}`;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    if (cpfLimpo.length !== 11) {
      toast.error('CPF inválido');
      return;
    }

    setEstado('loading');
    setErro(null);
    setHasAccount(false);

    try {
      const { data, error } = await supabase.functions.invoke('app-primeiro-acesso', {
        body: { cpf: cpfLimpo }
      });

      if (error) throw error;

      if (!data.success) {
        setEstado('error');
        setErro(data.error);
        setHasAccount(data.hasAccount || false);
        return;
      }

      setDadosEnvio({
        whatsapp: mascarar(data.whatsapp, 'telefone'),
        email: mascarar(data.email, 'email')
      });
      setEstado('success');
      iniciarCountdown();

    } catch (error: any) {
      console.error('Erro:', error);
      setEstado('error');
      setErro('Erro ao processar. Tente novamente.');
    }
  };

  const iniciarCountdown = () => {
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleReenviar = async () => {
    if (countdown > 0) return;
    setEstado('loading');
    
    const cpfLimpo = cpf.replace(/\D/g, '');
    
    try {
      const { data, error } = await supabase.functions.invoke('app-primeiro-acesso', {
        body: { cpf: cpfLimpo }
      });

      if (error) throw error;

      if (data.success) {
        setDadosEnvio({
          whatsapp: mascarar(data.whatsapp, 'telefone'),
          email: mascarar(data.email, 'email')
        });
        setEstado('success');
        iniciarCountdown();
        toast.success('Link reenviado!');
      } else {
        setEstado('error');
        setErro(data.error);
      }
    } catch (error) {
      setEstado('error');
      setErro('Erro ao reenviar. Tente novamente.');
    }
  };

  const handleTentarNovamente = () => {
    setCpf('');
    setEstado('form');
    setErro(null);
    setHasAccount(false);
  };

  const handleFechar = () => {
    setCpf('');
    setEstado('form');
    setErro(null);
    setDadosEnvio(null);
    setHasAccount(false);
    onClose();
  };

  const abrirWhatsAppSuporte = () => {
    window.open('https://wa.me/5500000000000?text=Olá! Preciso de ajuda com meu primeiro acesso no App PRATIC.', '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="sm:max-w-md">
        
        {/* ESTADO: FORMULÁRIO */}
        {estado === 'form' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                🔐 Primeiro Acesso
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Informe seu CPF para criar sua senha:
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={(e) => setCpf(formatarCPF(e.target.value))}
                  maxLength={14}
                  className="text-lg tracking-wide"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={cpf.replace(/\D/g, '').length !== 11}
              >
                Continuar
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                📱 Enviaremos um link para o WhatsApp e Email cadastrados na sua adesão.
              </p>
            </form>
          </>
        )}

        {/* ESTADO: LOADING */}
        {estado === 'loading' && (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground">Verificando seus dados...</p>
          </div>
        )}

        {/* ESTADO: SUCESSO */}
        {estado === 'success' && dadosEnvio && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Link enviado!
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                Enviamos um link para criar sua senha:
              </p>

              <div className="bg-muted rounded-lg p-4 space-y-2">
                {dadosEnvio.whatsapp && (
                  <p className="text-sm">
                    📱 WhatsApp: <strong>{dadosEnvio.whatsapp}</strong>
                  </p>
                )}
                {dadosEnvio.email && (
                  <p className="text-sm">
                    📧 Email: <strong>{dadosEnvio.email}</strong>
                  </p>
                )}
              </div>

              <p className="text-sm text-muted-foreground">
                Verifique suas mensagens e clique no link para criar sua senha.
              </p>

              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground mb-2">Não recebeu?</p>
                <button
                  onClick={handleReenviar}
                  disabled={countdown > 0}
                  className={`text-sm ${countdown > 0 ? 'text-muted-foreground' : 'text-primary hover:underline'}`}
                >
                  {countdown > 0 ? `Reenviar em ${countdown}s` : 'Reenviar link'}
                </button>
              </div>

              <Button variant="outline" className="w-full" onClick={handleFechar}>
                Fechar
              </Button>
            </div>
          </>
        )}

        {/* ESTADO: ERRO */}
        {estado === 'error' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <XCircle className="w-5 h-5" />
                {hasAccount ? 'Conta já existe' : 'CPF não encontrado'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-muted-foreground">
                {erro || 'Não encontramos um associado ativo com este CPF.'}
              </p>

              {!hasAccount && (
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Possíveis motivos:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Você ainda não é associado PRATIC</li>
                    <li>• Seu cadastro ainda está em análise</li>
                    <li>• O rastreador ainda não foi instalado</li>
                  </ul>
                </div>
              )}

              <div className="space-y-2">
                {hasAccount ? (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={handleFechar}
                  >
                    Ir para "Esqueci minha senha"
                  </Button>
                ) : (
                  <Button className="w-full" onClick={abrirWhatsAppSuporte}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Falar com suporte
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={handleTentarNovamente}>
                  Tentar novamente
                </Button>
              </div>
            </div>
          </>
        )}

      </DialogContent>
    </Dialog>
  );
}
