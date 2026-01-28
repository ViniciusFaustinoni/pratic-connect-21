import { useState, useEffect } from 'react';
import { 
  MessageCircle, Wifi, WifiOff, QrCode, 
  RefreshCw, LogOut, Loader2, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { useWhatsAppStatus } from '@/hooks/useWhatsAppStatus';

const STATUS_CONFIG = {
  open: { 
    label: 'Conectado', 
    variant: 'default' as const,
    className: 'bg-green-500 hover:bg-green-600',
    icon: Wifi 
  },
  disconnected: { 
    label: 'Desconectado', 
    variant: 'destructive' as const,
    className: '',
    icon: WifiOff 
  },
  connecting: { 
    label: 'Conectando...', 
    variant: 'secondary' as const,
    className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    icon: Loader2 
  },
  qrcode: { 
    label: 'Aguardando QR Code', 
    variant: 'secondary' as const,
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
    icon: QrCode 
  },
  close: { 
    label: 'Fechado', 
    variant: 'secondary' as const,
    className: '',
    icon: WifiOff 
  },
};

export function WhatsAppStatusCard() {
  const [qrCodeOpen, setQrCodeOpen] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  
  const { 
    status, 
    connected, 
    instancia, 
    telefone,
    isLoading,
    isRefetching,
    refetch,
    obterQRCode,
    desconectar,
  } = useWhatsAppStatus();

  // Polling mais frequente quando aguardando QR code
  useEffect(() => {
    if (qrCodeOpen && !connected) {
      const interval = setInterval(() => {
        refetch();
      }, 5000);
      
      return () => clearInterval(interval);
    }
  }, [qrCodeOpen, connected, refetch]);

  // Fechar modal quando conectar
  useEffect(() => {
    if (connected && qrCodeOpen) {
      setQrCodeOpen(false);
      setQrCodeData(null);
      setPairingCode(null);
    }
  }, [connected, qrCodeOpen]);

  const handleObterQRCode = async () => {
    try {
      const result = await obterQRCode.mutateAsync();
      if (result.qrcode) {
        setQrCodeData(result.qrcode);
        setPairingCode(result.pairingCode || null);
        setQrCodeOpen(true);
      }
    } catch {
      // Error já tratado no hook
    }
  };

  const currentStatus = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.disconnected;
  const StatusIcon = currentStatus.icon;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg">WhatsApp</CardTitle>
            </div>
            <Badge 
              variant={currentStatus.variant}
              className={currentStatus.className}
            >
              <StatusIcon className={`h-3 w-3 mr-1 ${status === 'connecting' ? 'animate-spin' : ''}`} />
              {currentStatus.label}
            </Badge>
          </div>
          <CardDescription>
            {instancia?.nome || 'Instância Principal'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected && telefone && (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
              <Phone className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                {telefone}
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            {!connected && (
              <Button
                size="sm"
                onClick={handleObterQRCode}
                disabled={obterQRCode.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {obterQRCode.isPending ? 'Gerando...' : 'Conectar'}
              </Button>
            )}

            {connected && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <LogOut className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso irá encerrar a sessão do WhatsApp. 
                      Você precisará escanear o QR Code novamente para reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => desconectar.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal QR Code */}
      <Dialog open={qrCodeOpen} onOpenChange={setQrCodeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              Conectar WhatsApp
            </DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeData ? (
              <>
                <div className="p-4 bg-white rounded-lg">
                  <img 
                    src={qrCodeData.startsWith('data:image') ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
                
                {pairingCode && (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">
                      Ou use o código de pareamento:
                    </p>
                    <code className="text-lg font-mono font-bold tracking-widest bg-muted px-4 py-2 rounded">
                      {pairingCode}
                    </code>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center w-64 h-64 bg-muted rounded-lg">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Abra o WhatsApp no seu celular</p>
            <p>Menu → Aparelhos conectados → Conectar um aparelho</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
