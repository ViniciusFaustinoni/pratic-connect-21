import { cn } from '@/lib/utils';

interface GaugeSinistralidadeProps {
  valor: number;
  meta?: number;
}

export function GaugeSinistralidade({ valor, meta = 65 }: GaugeSinistralidadeProps) {
  // Limitar valor entre 0 e 100 para cálculos
  const valorCapped = Math.min(Math.max(valor, 0), 100);
  
  // Calcular ângulo do ponteiro (-90° = 0%, +90° = 100%)
  const anguloPonteiro = -90 + (valorCapped / 100) * 180;
  
  // Calcular ângulo da meta
  const anguloMeta = -90 + (Math.min(meta, 100) / 100) * 180;

  // Determinar cor do valor baseado na faixa
  const getCorValor = () => {
    if (valorCapped <= 55) return 'text-green-500';
    if (valorCapped <= 65) return 'text-yellow-500';
    if (valorCapped <= 75) return 'text-orange-500';
    return 'text-red-500';
  };

  // Função para criar arco SVG
  const criarArco = (startAngle: number, endAngle: number, radius: number) => {
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Faixas de cores (em graus: -90 a +90)
  const faixas = [
    { inicio: -90, fim: -90 + (55 / 100) * 180, cor: '#22c55e' }, // Verde: 0-55%
    { inicio: -90 + (55 / 100) * 180, fim: -90 + (65 / 100) * 180, cor: '#eab308' }, // Amarelo: 55-65%
    { inicio: -90 + (65 / 100) * 180, fim: -90 + (75 / 100) * 180, cor: '#f97316' }, // Laranja: 65-75%
    { inicio: -90 + (75 / 100) * 180, fim: 90, cor: '#ef4444' }, // Vermelho: 75-100%
  ];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 120" className="w-full max-w-[280px]">
        {/* Fundo cinza */}
        <path
          d={criarArco(-90, 90, 80)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Faixas de cores */}
        {faixas.map((faixa, i) => (
          <path
            key={i}
            d={criarArco(faixa.inicio, faixa.fim, 80)}
            fill="none"
            stroke={faixa.cor}
            strokeWidth="16"
            strokeLinecap="butt"
            opacity="0.9"
          />
        ))}

        {/* Linha da meta (tracejada) */}
        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.cos((anguloMeta * Math.PI) / 180)}
          y2={100 + 70 * Math.sin((anguloMeta * Math.PI) / 180)}
          stroke="hsl(var(--foreground))"
          strokeWidth="2"
          strokeDasharray="4 2"
          opacity="0.5"
        />

        {/* Ponteiro */}
        <line
          x1="100"
          y1="100"
          x2={100 + 60 * Math.cos((anguloPonteiro * Math.PI) / 180)}
          y2={100 + 60 * Math.sin((anguloPonteiro * Math.PI) / 180)}
          stroke="hsl(var(--foreground))"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Centro do ponteiro */}
        <circle
          cx="100"
          cy="100"
          r="6"
          fill="hsl(var(--foreground))"
        />

        {/* Labels das extremidades */}
        <text x="15" y="105" className="fill-muted-foreground text-[10px]">0%</text>
        <text x="175" y="105" className="fill-muted-foreground text-[10px]">100%</text>
      </svg>

      {/* Valor central */}
      <div className="flex flex-col items-center -mt-8">
        <span className={cn('text-3xl font-bold', getCorValor())}>
          {valor.toFixed(1)}%
        </span>
        <span className="text-sm text-muted-foreground">
          Meta: {meta}%
        </span>
      </div>
    </div>
  );
}
