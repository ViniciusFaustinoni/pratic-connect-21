import { AlertTriangle, Phone, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';

export default function VeiculoReprovado() {
  const { signOut } = useAuth();

  const handleWhatsApp = () => {
    // Número de suporte (ajustar conforme necessário)
    window.open('https://wa.me/5521970048549?text=Olá, preciso de ajuda sobre a reprovação do meu veículo.', '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl text-destructive">VEÍCULO REPROVADO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <p className="text-muted-foreground">
              Infelizmente, seu veículo não foi aprovado em nossa análise.
            </p>
            <p className="text-sm text-muted-foreground">
              Isso pode ocorrer por diversos motivos relacionados às condições do veículo ou
              documentação.
            </p>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">O que acontece agora?</h4>
            <ul className="text-sm text-muted-foreground space-y-1.5">
              <li>• Seu contrato foi cancelado automaticamente</li>
              <li>• O pagamento de adesão será estornado</li>
              <li>• Você receberá mais informações por e-mail</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button onClick={handleWhatsApp} className="w-full" variant="outline">
              <Phone className="h-4 w-4 mr-2" />
              Falar com Suporte
            </Button>
            <Button onClick={() => signOut()} variant="ghost" className="w-full text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Em caso de dúvidas, entre em contato com nossa central de atendimento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
