import { MapPinOff, RefreshCw, Settings, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TelaLocalizacaoBloqueadaProps {
  onRetry: () => void;
  isRetrying?: boolean;
  errorType?: 'denied' | 'unavailable';
}

export function TelaLocalizacaoBloqueada({ onRetry, isRetrying, errorType = 'denied' }: TelaLocalizacaoBloqueadaProps) {
  const isDenied = errorType === 'denied';
  
  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-6">
      {/* Ícone grande */}
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${isDenied ? 'bg-red-600/20' : 'bg-amber-600/20'}`}>
        {isDenied ? (
          <MapPinOff className="h-12 w-12 text-red-500" />
        ) : (
          <WifiOff className="h-12 w-12 text-amber-500" />
        )}
      </div>
      
      {/* Título */}
      <h1 className="text-2xl font-bold text-white mb-2 text-center">
        {isDenied ? 'Localização Desativada' : 'GPS Temporariamente Indisponível'}
      </h1>
      
      {/* Descrição */}
      <p className="text-slate-400 text-center max-w-sm mb-6">
        {isDenied 
          ? 'Para continuar trabalhando, você precisa ativar a localização do seu dispositivo.'
          : 'O sinal de GPS está fraco ou indisponível. Tente ir para um local mais aberto.'}
      </p>
      
      {/* Instruções */}
      <div className="bg-slate-800 rounded-lg p-4 mb-6 max-w-sm w-full">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-medium text-white">
            {isDenied ? 'Como ativar:' : 'O que fazer:'}
          </h3>
        </div>
        {isDenied ? (
          <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
            <li>Abra as <span className="text-white">Configurações</span> do seu dispositivo</li>
            <li>Vá em <span className="text-white">Privacidade {'>'} Localização</span></li>
            <li>Ative a localização e permita para este app</li>
          </ol>
        ) : (
          <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
            <li>Vá para um <span className="text-white">local aberto</span> (longe de construções)</li>
            <li>Verifique se o <span className="text-white">GPS está ativado</span> nas configurações</li>
            <li>Aguarde alguns segundos e toque em <span className="text-white">Tentar Novamente</span></li>
          </ol>
        )}
      </div>

      {/* Alerta */}
      <div className={`border rounded-lg p-3 mb-6 max-w-sm w-full ${isDenied ? 'bg-amber-900/30 border-amber-700/50' : 'bg-blue-900/30 border-blue-700/50'}`}>
        <p className={`text-xs text-center ${isDenied ? 'text-amber-400' : 'text-blue-400'}`}>
          {isDenied 
            ? '⚠️ A localização é necessária para registrar suas tarefas e calcular rotas.'
            : '📡 O GPS pode demorar para calibrar em áreas fechadas, túneis ou próximo a edifícios altos.'}
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
