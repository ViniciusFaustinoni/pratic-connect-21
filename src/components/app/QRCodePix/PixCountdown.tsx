import { useState, useEffect } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { PixCountdownProps } from './types'

export function PixCountdown({
  expiraEm,
  onExpirar,
  variante
}: PixCountdownProps) {
  const [tempoRestante, setTempoRestante] = useState(0)
  const [tempoTotal, setTempoTotal] = useState(0)

  useEffect(() => {
    const agora = new Date()
    const diff = expiraEm.getTime() - agora.getTime()
    
    if (diff <= 0) {
      onExpirar?.()
      return
    }

    setTempoTotal(diff)
    setTempoRestante(diff)

    const interval = setInterval(() => {
      setTempoRestante(prev => {
        const novo = prev - 1000
        if (novo <= 0) {
          clearInterval(interval)
          onExpirar?.()
          return 0
        }
        return novo
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [expiraEm, onExpirar])

  const formatarTempo = (ms: number): string => {
    const segundos = Math.floor(ms / 1000)
    const minutos = Math.floor(segundos / 60)
    const horas = Math.floor(minutos / 60)
    
    if (horas > 0) {
      return `${horas}h ${minutos % 60}min`
    }
    
    const segs = segundos % 60
    const mins = minutos % 60
    
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`
  }

  const porcentagem = tempoTotal > 0 
    ? (tempoRestante / tempoTotal) * 100 
    : 0

  const urgente = tempoRestante < 5 * 60 * 1000 // menos de 5 minutos
  const critico = tempoRestante < 1 * 60 * 1000 // menos de 1 minuto

  // Versão compacta
  if (variante === 'compacto') {
    return (
      <span className={cn(
        "text-xs flex items-center gap-1",
        critico ? "text-destructive" : urgente ? "text-orange-500" : "text-muted-foreground"
      )}>
        <Clock className="h-3 w-3" />
        {formatarTempo(tempoRestante)}
      </span>
    )
  }

  // Versão padrão/expandida
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className={cn(
          "flex items-center gap-2 text-sm",
          critico ? "text-destructive" : urgente ? "text-orange-500" : "text-muted-foreground"
        )}>
          {critico ? (
            <AlertTriangle className={cn("h-4 w-4", critico && "animate-pulse")} />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          <span>
            {critico ? 'Expirando!' : 'Código expira em'}
          </span>
        </div>
        <span className={cn(
          "font-mono font-semibold text-sm",
          critico ? "text-destructive" : urgente ? "text-orange-500" : "text-foreground"
        )}>
          {formatarTempo(tempoRestante)}
        </span>
      </div>
      
      {variante === 'expandido' && (
        <Progress 
          value={porcentagem} 
          className={cn(
            "h-1.5",
            critico ? "[&>div]:bg-destructive" : 
            urgente ? "[&>div]:bg-orange-500" : "[&>div]:bg-primary"
          )}
        />
      )}
    </div>
  )
}
