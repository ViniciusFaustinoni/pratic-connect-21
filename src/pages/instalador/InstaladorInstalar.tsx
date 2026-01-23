import { Link } from 'react-router-dom';
import { ArrowLeft, Download, Wrench, Zap, Wifi, Bell, MapPin, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePWAInstallProfissional } from '@/hooks/usePWAInstallProfissional';
import { IOSInstallGuideProfissional } from '@/components/pwa/IOSInstallGuideProfissional';

const benefits = [
  {
    icon: Zap,
    title: 'Acesso Rápido',
    description: 'Abra suas tarefas com um toque, direto da tela inicial'
  },
  {
    icon: Wifi,
    title: 'Funciona Offline',
    description: 'Visualize suas tarefas mesmo sem conexão com internet'
  },
  {
    icon: Bell,
    title: 'Notificações',
    description: 'Receba alertas de novas tarefas atribuídas a você'
  },
  {
    icon: MapPin,
    title: 'Navegação GPS',
    description: 'Acesse rotas e navegue até os clientes facilmente'
  },
];

export default function InstaladorInstalar() {
  const {
    isInstalled,
    isIOS,
    isAndroid,
    promptInstall,
    showIOSInstructions,
    setShowIOSInstructions,
  } = usePWAInstallProfissional();

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
    } else {
      await promptInstall();
    }
  };

  // Se já está instalado
  if (isInstalled) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-green-600 mx-auto mb-6">
            <CheckCircle2 className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            App Instalado!
          </h1>
          <p className="text-slate-400 mb-8">
            O PRATIC Profissional já está instalado no seu dispositivo. Acesse pela tela inicial.
          </p>
          <Link to="/instalador">
            <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Ir para o App
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/instalador" className="text-slate-400 hover:text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-white">Instalar App</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto p-6 space-y-8">
        {/* Hero */}
        <div className="text-center">
          <div className="flex items-center justify-center w-24 h-24 rounded-3xl bg-blue-600 mx-auto mb-6 shadow-lg shadow-blue-600/30">
            <Wrench className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            PRATIC Profissional
          </h2>
          <p className="text-slate-400">
            Instale o app para uma experiência completa
          </p>
        </div>

        {/* Botão de Instalação */}
        <Button
          onClick={handleInstall}
          size="lg"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg gap-3"
        >
          <Download className="h-5 w-5" />
          {isIOS ? 'Ver instruções de instalação' : 'Instalar agora'}
        </Button>

        {/* Info da plataforma */}
        <div className="text-center">
          <span className="inline-flex items-center gap-2 text-sm text-slate-500 bg-slate-800 px-3 py-1.5 rounded-full">
            {isIOS && '📱 iPhone/iPad detectado'}
            {isAndroid && '📱 Android detectado'}
            {!isIOS && !isAndroid && '💻 Navegador detectado'}
          </span>
        </div>

        {/* Benefícios */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wide">
            Benefícios do App
          </h3>
          
          <div className="grid gap-3">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <Card key={index} className="bg-slate-800 border-slate-700">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-blue-600/20">
                        <Icon className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white text-sm">
                          {benefit.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {benefit.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Link para continuar no navegador */}
        <div className="text-center pt-4">
          <Link 
            to="/instalador" 
            className="text-sm text-slate-400 hover:text-blue-400 underline underline-offset-4"
          >
            Continuar no navegador
          </Link>
        </div>
      </div>

      {/* iOS Install Guide */}
      <IOSInstallGuideProfissional 
        open={showIOSInstructions} 
        onOpenChange={setShowIOSInstructions} 
      />
    </div>
  );
}
