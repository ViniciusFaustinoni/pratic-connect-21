import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CodigoPixProps } from './types'

export function CodigoPix({ 
  codigo, 
  status,
  setStatus,
  onCopiar,
  expandido = false
}: CodigoPixProps) {
  const [copiado, setCopiado] = useState(false)
  
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setStatus('copied')
      onCopiar?.(codigo)
      
      setTimeout(() => {
        setCopiado(false)
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
      setCopiado(true)
      onCopiar?.(codigo)
      
      setTimeout(() => {
        setCopiado(false)
        setStatus('idle')
      }, 2000)
    }
  }

  return (
    <div 
      className={cn(
        "group relative flex items-center gap-2 p-3 bg-muted/50 rounded-lg border cursor-pointer hover:bg-muted transition-colors",
        copiado && "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
      )}
      onClick={copiar}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && copiar()}
      aria-label="Clique para copiar o código Pix"
    >
      <div className="flex-1 min-w-0">
        {expandido && (
          <p className="text-xs text-muted-foreground mb-1">
            Código Pix Copia e Cola
          </p>
        )}
        <p className={cn(
          "font-mono text-xs break-all select-all",
          expandido ? "line-clamp-3" : "line-clamp-2"
        )}>
          {codigo}
        </p>
      </div>
      
      <div className={cn(
        "flex-shrink-0 p-2 rounded-md transition-colors",
        copiado 
          ? "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400" 
          : "bg-background text-muted-foreground group-hover:text-foreground"
      )}>
        {copiado ? (
          <Check className="h-4 w-4" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </div>
    </div>
  )
}
