import { MapPinOff, RefreshCw, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TelaLocalizacaoBloqueadaProps {
  onRetry: () => void;
  isRetrying?: boolean;
}

export function TelaLocalizacaoBloqueada({ onRetry, isRetrying }: TelaLocalizacaoBloqueadaProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Ícone grande */}
      <div className="w-24 h-24 rounded-full bg-red-600/20 flex items-center justify-center mb-6">
        <MapPinOff className="h-12 w-12 text-red-500" />
      </div>
      
      {/* Título */}
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        Localização Desativada
      </h1>
      
      {/* Descrição */}
      <p className="text-slate-400 text-center max-w-sm mb-6">
        Para continuar trabalhando, você precisa ativar a localização do seu dispositivo.
      </p>
      
      {/* Instruções */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6 max-w-sm w-full">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">Como ativar:</h3>
        </div>
        <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
          <li>Abra as <span className="text-white">Configurações</span> do seu dispositivo</li>
          <li>Vá em <span className="text-white">Privacidade {'>'} Localização</span></li>
          <li>Ative a localização e permita para este app</li>
        </ol>
      </div>

      {/* Alerta */}
      <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3 mb-6 max-w-sm w-full">
        <p className="text-amber-400 text-xs text-center">
          ⚠️ A localização é necessária para registrar suas tarefas e calcular rotas.
        </p>
      </div>
      
      {/* Botão Retry */}
      <Button 
        size="lg" 
        onClick={onRetry} 
        className="w-full max-w-sm"
        disabled={isRetrying}
      >
        {isRetrying ? (
          <>
            <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            <RefreshCw className="h-5 w-5 mr-2" />
            Tentar Novamente
          </>
        )}
      </Button>
    </div>
  );
}
