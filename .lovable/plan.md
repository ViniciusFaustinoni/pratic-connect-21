
## Problema Identificado

O modal `AgendarManutencaoModal.tsx` está usando `LOCAL_TIPO_OPTIONS` que inclui três opções:
- **Base** — associado leva o veículo até a sede
- **Ponto de Instalação** — associado vai a um ponto de instalação autorizado  
- **Rota** — técnico vai ao local do associado

Porém, para **vistorias de manutenção**, deve haver apenas:
- **Base**
- **Rota**

A opção "Ponto de Instalação" é exclusiva para **vistorias de entrada** (cotações), onde o cliente pode escolher levar o veículo a um local parceiro.

## Solução

Filtrar o array `LOCAL_TIPO_OPTIONS` no `AgendarManutencaoModal.tsx` para remover a opção "ponto_instalacao", exibindo apenas "base" e "rota".

### Alterações

**Arquivo: `src/components/monitoramento/manutencao/AgendarManutencaoModal.tsx`**

1. **Importar** a constante completa e criar um filtro:
```typescript
import { 
  LOCAL_TIPO_OPTIONS,
  type LocalTipoManutencao,
  type VistoriaManutencao,
} from '@/types/vistoriaManutencao';

// Dentro do componente
const localTipoOptions = LOCAL_TIPO_OPTIONS.filter(
  option => option.value === 'base' || option.value === 'rota'
);
```

2. **Usar a variável filtrada** no Select de "Tipo de Local":
```tsx
<Select value={localTipo} onValueChange={(v) => setLocalTipo(v as LocalTipoManutencao)}>
  <SelectTrigger>
    <SelectValue placeholder="Selecione o tipo de local" />
  </SelectTrigger>
  <SelectContent>
    {localTipoOptions.map(option => (
      <SelectItem key={option.value} value={option.value}>
        <div className="flex flex-col gap-1">
          <span className="font-medium">{option.label}</span>
          <span className="text-xs text-muted-foreground">{option.description}</span>
        </div>
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

## Resultado Esperado

Ao abrir o modal de agendamento de manutenção, o campo "Tipo de Local" exibirá apenas as opções:
- ✅ Base
- ✅ Rota
- ❌ Ponto de Instalação (removido)
