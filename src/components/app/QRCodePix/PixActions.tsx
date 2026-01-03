import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Copy, 
  Check, 
  Download, 
  Share2, 
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { PixActionsProps } from './types'

export function PixActions({
  codigo,
  status,
  setStatus,
  variante,
  onCopiar,
  onBaixar,
  onCompartilhar
}: PixActionsProps) {
  const [copiando, setCopiando] = useState(false)
  const [baixando, setBaixando] = useState(false)
  const [compartilhando, setCompartilhando] = useState(false)

  const disabled = status === 'expired'

  // ========== COPIAR ==========
  const copiar = async () => {
    if (disabled) return
    setCopiando(true)
    
    try {
      await navigator.clipboard.writeText(codigo)
      setStatus('copied')
      toast.success('Código Pix copiado!', {
        description: 'Cole no app do seu banco para pagar'
      })
      onCopiar?.(codigo)
      
      setTimeout(() => {
        setStatus('idle')
      }, 2000)
    } catch {
      // Fallback para navegadores antigos
      const textarea = document.createElement('textarea')
      textarea.value = codigo
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      
      setStatus('copied')
      toast.success('Código Pix copiado!')
      onCopiar?.(codigo)
      
      setTimeout(() => {
        setStatus('idle')
      }, 2000)
    } finally {
      setTimeout(() => setCopiando(false), 2000)
    }
  }

  // ========== BAIXAR ==========
  const baixar = async () => {
    if (disabled) return
    setBaixando(true)
    
    try {
      // Criar URL do QR Code via API
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(codigo)}`
      
      // Baixar imagem
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      
      // Criar link de download
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `pix-qrcode-${Date.now()}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast.success('QR Code baixado!')
      onBaixar?.()
    } catch {
      toast.error('Erro ao baixar QR Code')
    } finally {
      setBaixando(false)
    }
  }

  // ========== COMPARTILHAR ==========
  const compartilhar = async () => {
    if (disabled) return
    setCompartilhando(true)
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Código Pix',
          text: `Pague com Pix:\n\n${codigo}`,
        })
        toast.success('Compartilhado!')
      } else {
        // Fallback: copiar
        await navigator.clipboard.writeText(`Pague com Pix:\n\n${codigo}`)
        toast.success('Código copiado para compartilhar!')
      }
      onCompartilhar?.()
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        toast.error('Erro ao compartilhar')
      }
    } finally {
      setCompartilhando(false)
    }
  }

  // ========== VARIANTE COMPACTA ==========
  if (variante === 'compacto') {
    return (
      <Button 
        size="sm" 
        variant="secondary"
        onClick={copiar}
        disabled={disabled}
        className="text-xs"
      >
        {copiando ? (
          <>
            <Check className="h-3 w-3 mr-1" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="h-3 w-3 mr-1" />
            Copiar Pix
          </>
        )}
      </Button>
    )
  }

  // ========== VARIANTE PADRÃO ==========
  if (variante === 'padrao') {
    return (
      <Button 
        className={cn(
          "w-full transition-all",
          copiando && "bg-green-600 hover:bg-green-600"
        )}
        onClick={copiar}
        disabled={disabled}
      >
        {copiando ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Copiado! Cole no app do banco
          </>
        ) : (
          <>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Código Pix
          </>
        )}
      </Button>
    )
  }

  // ========== VARIANTE EXPANDIDA ==========
  return (
    <div className="space-y-3">
      {/* Botão principal */}
      <Button 
        className={cn(
          "w-full h-12 text-base transition-all",
          copiando && "bg-green-600 hover:bg-green-600"
        )}
        onClick={copiar}
        disabled={disabled}
      >
        {copiando ? (
          <>
            <Check className="h-5 w-5 mr-2" />
            Copiado! Cole no app do banco
          </>
        ) : (
          <>
            <Copy className="h-5 w-5 mr-2" />
            Copiar Código Pix
          </>
        )}
      </Button>

      {/* Botões secundários */}
      <div className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          onClick={baixar}
          disabled={disabled || baixando}
        >
          {baixando ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Baixar QR
        </Button>
        
        <Button 
          variant="outline" 
          onClick={compartilhar}
          disabled={disabled || compartilhando}
        >
          {compartilhando ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          Compartilhar
        </Button>
      </div>
    </div>
  )
}
