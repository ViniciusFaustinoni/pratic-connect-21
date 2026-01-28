

# Plano: Adicionar Badge de Cobertura na Lista de Associados

## Diagnóstico

O associado **MARCUS VINICIUS** foi aprovado pelo analista de cadastro e possui:
- `cobertura_roubo_furto: true`
- `cobertura_total: false`

O problema é que a lista de associados (`src/pages/cadastro/Associados.tsx`) não exibe o badge de cobertura ao lado do veículo. O componente `BadgeCobertura` já existe e está pronto para uso, mas simplesmente não está sendo utilizado na tabela.

## Solução

Adicionar o componente `BadgeCoberturaCompact` na célula do veículo, exibindo a cobertura ativa.

## Alterações

### Arquivo: `src/pages/cadastro/Associados.tsx`

**1. Adicionar import do componente**

```typescript
import { BadgeCoberturaCompact } from '@/components/veiculos/BadgeCobertura';
```

**2. Modificar célula do veículo (linhas 537-548)**

Adicionar o badge compacto ao lado das informações do veículo:

```typescript
<TableCell onClick={() => navigate(`/cadastro/associados/${associado.id}`)}>
  {associado.veiculos && associado.veiculos.length > 0 ? (
    <div className="flex items-center gap-2">
      <span>{associado.veiculos[0].placa} - {associado.veiculos[0].modelo}</span>
      {associado.veiculos.length > 1 && (
        <Badge variant="secondary" className="text-xs">
          +{associado.veiculos.length - 1}
        </Badge>
      )}
      {/* Badge de cobertura do veículo principal */}
      <BadgeCoberturaCompact
        coberturaTotal={associado.veiculos[0].cobertura_total}
        coberturaRouboFurto={associado.veiculos[0].cobertura_roubo_furto}
      />
    </div>
  ) : '—'}
</TableCell>
```

## Visual Esperado

| Antes | Depois |
|-------|--------|
| `LTB4J74 - corolla Xei Flex` | `LTB4J74 - corolla Xei Flex` 🛡️ (ícone amarelo de Roubo/Furto) |

O badge compacto mostrará:
- 🛡️ **Amarelo** (Shield) → Cobertura Roubo/Furto ativa
- ✅ **Verde** (ShieldCheck) → Cobertura Total ativa
- ⚪ **Cinza** (ShieldOff) → Sem cobertura

Com tooltip explicativo ao passar o mouse.

## Arquivos Alterados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/cadastro/Associados.tsx` | Importar e usar `BadgeCoberturaCompact` na célula de veículo |

