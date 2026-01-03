import { QRCodeSVG } from 'qrcode.react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { AlertTriangle, RefreshCw, Check } from 'lucide-react'
import type { QRCodeDisplayProps } from './types'

export function QRCodeDisplay({
  codigo,
  tamanho,
  cor = '#000000',
  corFundo = '#FFFFFF',
  logoUrl,
  status
}: QRCodeDisplayProps) {
  // Estado de Loading
  if (status === 'loading') {
    return (
      <div 
        className="relative rounded-xl overflow-hidden"
        style={{ width: tamanho, height: tamanho }}
      >
        <Skeleton className="w-full h-full" />
      </div>
    )
  }

  // Estado Expirado
  if (status === 'expired') {
    return (
      <div 
        className="relative rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center gap-2"
        style={{ width: tamanho, height: tamanho }}
      >
        <AlertTriangle className="h-8 w-8 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Expirado</span>
      </div>
    )
  }

  // Estado de Erro
  if (status === 'error') {
    return (
      <div 
        className="relative rounded-xl overflow-hidden bg-muted flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-muted/80 transition-colors"
        style={{ width: tamanho, height: tamanho }}
      >
        <RefreshCw className="h-6 w-6 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Tentar novamente</span>
      </div>
    )
  }

  // QR Code gerado
  return (
    <div 
      className="relative rounded-xl overflow-hidden bg-white p-3 shadow-sm border"
      style={{ width: tamanho + 24, height: tamanho + 24 }}
    >
      <QRCodeSVG
        value={codigo}
        size={tamanho}
        level="M"
        fgColor={cor}
        bgColor={corFundo}
        imageSettings={logoUrl ? {
          src: logoUrl,
          height: tamanho * 0.2,
          width: tamanho * 0.2,
          excavate: true
        } : undefined}
      />

      {/* Indicador de copiado */}
      {status === 'copied' && (
        <div className="absolute inset-0 bg-green-500/90 flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-white rounded-full p-3">
            <Check className="h-8 w-8 text-green-600" />
          </div>
        </div>
      )}
    </div>
  )
}
