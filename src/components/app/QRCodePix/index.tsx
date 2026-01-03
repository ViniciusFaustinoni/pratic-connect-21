import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Info } from 'lucide-react'

import { QRCodeDisplay } from './QRCodeDisplay'
import { PixActions } from './PixActions'
import { PixCountdown } from './PixCountdown'
import { CodigoPix } from './CodigoPix'
import type { 
  QRCodePixProps, 
  QRCodeSize, 
  QRCodeStatus,
  QRCodeVariant
} from './types'

// Configuração de tamanhos
const tamanhoConfig: Record<QRCodeSize, number> = {
  sm: 120,
  md: 180,
  lg: 220,
  xl: 280
}

// Tamanho padrão por variante
const tamanhoVariante: Record<QRCodeVariant, QRCodeSize> = {
  compacto: 'sm',
  padrao: 'md',
  expandido: 'lg'
}

export function QRCodePix({
  pix,
  variante = 'padrao',
  tamanho,
  mostrarValor = true,
  mostrarCodigo = true,
  mostrarAcoes = true,
  mostrarCountdown = true,
  mostrarInstrucoes = false,
  corQR = '#000000',
  corFundo = '#FFFFFF',
  logoUrl,
  onCopiar,
  onBaixar,
  onCompartilhar,
  onExpirar,
  className
}: QRCodePixProps) {
  const [status, setStatus] = useState<QRCodeStatus>('loading')
  
  // Determinar tamanho
  const tamanhoFinal = tamanho 
    ? tamanhoConfig[tamanho] 
    : tamanhoConfig[tamanhoVariante[variante]]

  // Verificar expiração
  const expiraEm = pix.expiraEm 
    ? (typeof pix.expiraEm === 'string' ? new Date(pix.expiraEm) : pix.expiraEm)
    : null
  
  const expirado = expiraEm ? new Date() > expiraEm : false

  useEffect(() => {
    if (expirado) {
      setStatus('expired')
    } else if (pix.codigo) {
      // Simular carregamento do QR
      const timer = setTimeout(() => {
        setStatus('idle')
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [pix.codigo, expirado])

  const handleExpirar = useCallback(() => {
    setStatus('expired')
    onExpirar?.()
  }, [onExpirar])

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    })
  }

  // ========== VARIANTE COMPACTA ==========
  if (variante === 'compacto') {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="flex-shrink-0">
          <QRCodeDisplay
            codigo={pix.codigo}
            tamanho={tamanhoFinal}
            cor={corQR}
            corFundo={corFundo}
            logoUrl={logoUrl}
            status={status}
          />
        </div>

        <div className="flex flex-col gap-2">
          {mostrarValor && pix.valor && (
            <span className="text-lg font-semibold">
              {formatarValor(pix.valor)}
            </span>
          )}
          {mostrarAcoes && (
            <PixActions
              codigo={pix.codigo}
              status={status}
              setStatus={setStatus}
              variante={variante}
              onCopiar={onCopiar}
            />
          )}
          {mostrarCountdown && expiraEm && !expirado && (
            <PixCountdown
              expiraEm={expiraEm}
              onExpirar={handleExpirar}
              variante={variante}
            />
          )}
        </div>
      </div>
    )
  }

  // ========== VARIANTE PADRÃO ==========
  if (variante === 'padrao') {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="pt-6 space-y-4">
          {/* QR Code */}
          <div className="flex justify-center">
            <QRCodeDisplay
              codigo={pix.codigo}
              tamanho={tamanhoFinal}
              cor={corQR}
              corFundo={corFundo}
              logoUrl={logoUrl}
              status={status}
            />
          </div>

          {/* Instrução */}
          <p className="text-sm text-muted-foreground text-center">
            Escaneie o QR Code ou copie o código abaixo
          </p>

          {/* Código */}
          {mostrarCodigo && (
            <CodigoPix
              codigo={pix.codigo}
              status={status}
              setStatus={setStatus}
              onCopiar={onCopiar}
            />
          )}

          {/* Ações */}
          {mostrarAcoes && (
            <PixActions
              codigo={pix.codigo}
              status={status}
              setStatus={setStatus}
              variante={variante}
              onCopiar={onCopiar}
            />
          )}

          {/* Countdown */}
          {mostrarCountdown && expiraEm && !expirado && (
            <PixCountdown
              expiraEm={expiraEm}
              onExpirar={handleExpirar}
              variante={variante}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  // ========== VARIANTE EXPANDIDA ==========
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="text-center pb-2">
        <h3 className="text-lg font-semibold">
          Pague com Pix
        </h3>
        {pix.beneficiario && (
          <p className="text-sm text-muted-foreground">{pix.beneficiario}</p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* QR Code */}
        <div className="flex justify-center">
          <div className="relative">
            <QRCodeDisplay
              codigo={pix.codigo}
              tamanho={tamanhoFinal}
              cor={corQR}
              corFundo={corFundo}
              logoUrl={logoUrl}
              status={status}
            />
          </div>
        </div>

        {/* Valor */}
        {mostrarValor && pix.valor && (
          <div className="text-center">
            <span className="text-2xl font-bold">
              {formatarValor(pix.valor)}
            </span>
            {pix.descricao && (
              <p className="text-sm text-muted-foreground mt-1">{pix.descricao}</p>
            )}
          </div>
        )}

        {/* Código */}
        {mostrarCodigo && (
          <CodigoPix
            codigo={pix.codigo}
            status={status}
            setStatus={setStatus}
            onCopiar={onCopiar}
            expandido
          />
        )}

        {/* Ações */}
        {mostrarAcoes && (
          <div className="pt-2">
            <PixActions
              codigo={pix.codigo}
              status={status}
              setStatus={setStatus}
              variante={variante}
              onCopiar={onCopiar}
              onBaixar={onBaixar}
              onCompartilhar={onCompartilhar}
            />
          </div>
        )}

        {/* Countdown */}
        {mostrarCountdown && expiraEm && !expirado && (
          <div className="pt-2">
            <PixCountdown
              expiraEm={expiraEm}
              onExpirar={handleExpirar}
              variante={variante}
            />
          </div>
        )}

        {/* Instruções */}
        {mostrarInstrucoes && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              Como pagar:
            </p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside pl-1">
              <li>Abra o app do seu banco</li>
              <li>Escolha pagar com Pix</li>
              <li>Escaneie o QR Code ou cole o código</li>
              <li>Confirme o pagamento</li>
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default QRCodePix
export * from './types'
