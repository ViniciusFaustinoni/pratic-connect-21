export type QRCodeSize = 'sm' | 'md' | 'lg' | 'xl'
export type QRCodeVariant = 'compacto' | 'padrao' | 'expandido'
export type QRCodeStatus = 'idle' | 'loading' | 'success' | 'error' | 'expired' | 'copied'

export interface PixData {
  codigo: string
  valor?: number
  descricao?: string
  expiraEm?: Date | string
  beneficiario?: string
  txid?: string
}

export interface QRCodePixProps {
  pix: PixData
  variante?: QRCodeVariant
  tamanho?: QRCodeSize
  mostrarValor?: boolean
  mostrarCodigo?: boolean
  mostrarAcoes?: boolean
  mostrarCountdown?: boolean
  mostrarInstrucoes?: boolean
  corQR?: string
  corFundo?: string
  logoUrl?: string
  onCopiar?: (codigo: string) => void
  onBaixar?: () => void
  onCompartilhar?: () => void
  onExpirar?: () => void
  className?: string
}

export interface QRCodeDisplayProps {
  codigo: string
  tamanho: number
  cor?: string
  corFundo?: string
  logoUrl?: string
  status: QRCodeStatus
}

export interface PixActionsProps {
  codigo: string
  status: QRCodeStatus
  setStatus: (status: QRCodeStatus) => void
  variante: QRCodeVariant
  onCopiar?: (codigo: string) => void
  onBaixar?: () => void
  onCompartilhar?: () => void
}

export interface PixCountdownProps {
  expiraEm: Date
  onExpirar?: () => void
  variante: QRCodeVariant
}

export interface CodigoPixProps {
  codigo: string
  status: QRCodeStatus
  setStatus: (status: QRCodeStatus) => void
  onCopiar?: (codigo: string) => void
  expandido?: boolean
}
