
# Correções na Landing Page /planos

## Arquivos a modificar

| Arquivo | Alteração |
|---|---|
| `src/pages/public/LandingPlanos.tsx` | Adicionar `onError` na img dos planos + atualizar copyright |

## Detalhamento

### 1. Fallback de imagem quebrada (linha 135-140)

Adicionar handler `onError` na tag `<img>` que esconde a imagem e mostra o ícone Car. Implementação: usar estado local ou simplesmente substituir o `src` por vazio e esconder via `display:none`, revelando o fallback. Abordagem mais simples: converter para um componente inline que troca para o ícone no `onError`:

```tsx
<img
  src={plano.imagem_landing_url}
  alt={plano.nome}
  className="h-full w-full object-cover"
  loading="lazy"
  onError={(e) => {
    e.currentTarget.style.display = 'none';
    e.currentTarget.nextElementSibling?.classList.remove('hidden');
  }}
/>
<Car className="h-16 w-16 text-white/30 hidden" />
```

### 2. Copyright (linha 273)

Alterar `© 2025` para `© 2026`.
