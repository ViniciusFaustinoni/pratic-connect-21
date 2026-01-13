import { Link } from 'react-router-dom';
import { Download, Zap, Bell, Wifi, Shield, ArrowLeft, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { IOSInstallGuide } from '@/components/pwa/IOSInstallGuide';

export default function AppInstall() {
  const {
    isInstalled,
    isIOS,
    isAndroid,
    promptInstall,
    showIOSInstructions,
    setShowIOSInstructions,
  } = usePWAInstall();

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  const benefits = [
    {
      icon: Zap,
      title: 'Acesso Rápido',
      description: 'Abra o app direto da sua tela inicial, sem precisar do navegador',
    },
    {
      icon: Bell,
      title: 'Notificações',
      description: 'Receba alertas sobre boletos, assistências e atualizações importantes',
    },
    {
      icon: Wifi,
      title: 'Funciona Offline',
      description: 'Acesse informações básicas mesmo sem conexão com a internet',
    },
    {
      icon: Shield,
      title: 'Mais Seguro',
      description: 'Ambiente dedicado com proteção adicional para seus dados',
    },
  ];

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Shield className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            App já instalado!
          </h1>
          <p className="text-muted-foreground mb-6">
            O app PRATIC já está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
          </p>
          
          <Link to="/app/home">
            <Button className="w-full">
              Continuar para o App
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-sm border-b">
        <div className="flex items-center h-14 px-4 max-w-lg mx-auto">
          <Link to="/app/login" className="p-2 -ml-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="ml-2 font-medium">Instalar App</span>
        </div>
      </header>

      <main className="px-4 py-8 max-w-lg mx-auto">
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-primary/10 flex items-center justify-center shadow-lg">
            <img 
              src="/pratic-logo.png" 
              alt="PRATIC" 
              className="w-16 h-16 object-contain"
            />
          </div>
          
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Instale o App PRATIC
          </h1>
          <p className="text-muted-foreground">
            Tenha acesso rápido a todos os recursos de proteção veicular
          </p>
        </div>

        {/* Install Button */}
        <Button 
          onClick={handleInstall} 
          size="lg" 
          className="w-full mb-8 h-14 text-lg"
        >
          <Download className="h-5 w-5 mr-2" />
          {isIOS ? 'Ver instruções de instalação' : 'Instalar agora'}
        </Button>

        {/* Platform Info */}
        <div className="flex items-center justify-center gap-2 mb-8 text-sm text-muted-foreground">
          <Smartphone className="h-4 w-4" />
          {isIOS && 'iPhone/iPad detectado - use o Safari'}
          {isAndroid && 'Android detectado - use o Chrome'}
          {!isIOS && !isAndroid && 'Disponível para iOS e Android'}
        </div>

        {/* Benefits */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground text-center mb-4">
            Vantagens do App
          </h2>
          
          {benefits.map((benefit, index) => (
            <Card key={index} className="border-0 shadow-sm">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="flex-shrink-0 p-2 rounded-lg bg-primary/10">
                  <benefit.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {benefit.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Skip Link */}
        <div className="mt-8 text-center">
          <Link 
            to="/app/login" 
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            Continuar no navegador
          </Link>
        </div>
      </main>

      <IOSInstallGuide 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </div>
  );
}
