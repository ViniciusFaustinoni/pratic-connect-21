

# Plano: Trocar Ações dos Botões de Link

## Objetivo

Inverter as funções dos dois botões de link:
- **Botão externo** (fora do menu): Trocar de "Acessar" para **"Copiar Link do Cliente"**
- **Menu dropdown**: Trocar de "Copiar Link" para **"Acessar Link do Cliente"**

## Situação Atual

| Local | Texto | Ação |
|-------|-------|------|
| Botão externo (linha 440-444) | "Acessar Link do Cliente" | Abre em nova aba |
| Menu dropdown (linha 497-503) | "Copiar Link" | Copia para clipboard |
| Menu dropdown (linha 504-510) | "Acessar Link do Cliente" | Abre em nova aba (DUPLICADO) |

## Situação Desejada

| Local | Texto | Ação |
|-------|-------|------|
| Botão externo | **"Copiar Link do Cliente"** | Copia para clipboard |
| Menu dropdown | **"Acessar Link do Cliente"** | Abre em nova aba |

## Alterações

**Arquivo**: `src/components/cotacoes/CotacaoCard.tsx`

### 1. Botão Externo (linhas 436-445)

Trocar a ação e o texto:

```tsx
// DE:
onClick={() => window.open(`/cotacao/${cotacao.token_publico}`, '_blank')}
<ExternalLink className="h-4 w-4 mr-1" />
Acessar Link do Cliente

// PARA:
onClick={() => {
  const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
  navigator.clipboard.writeText(link);
  toast.success('Link copiado!');
}}
<Link2 className="h-4 w-4 mr-1" />
Copiar Link do Cliente
```

### 2. Menu Dropdown (linhas 495-511)

Remover o item duplicado "Acessar Link do Cliente" e manter apenas um item que abre o link:

```tsx
// Manter apenas:
<DropdownMenuItem onClick={() => {
  const link = `${window.location.origin}/cotacao/${cotacao.token_publico}`;
  window.open(link, '_blank');
}}>
  <ExternalLink className="h-4 w-4 mr-2" />
  Acessar Link do Cliente
</DropdownMenuItem>
```

## Resumo Visual

```text
ANTES                              DEPOIS
─────────────────────────────────────────────────────
Botão externo:                     Botão externo:
[Acessar Link do Cliente]    →     [Copiar Link do Cliente]
(abre nova aba)                    (copia para clipboard)

Menu dropdown:                     Menu dropdown:
├─ Copiar Link              →      ├─ Acessar Link do Cliente
├─ Acessar Link do Cliente         (abre nova aba)
└─ (duplicado)
```

## Resumo de Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/cotacoes/CotacaoCard.tsx` | Trocar ação do botão externo para copiar link |
| `src/components/cotacoes/CotacaoCard.tsx` | Remover item duplicado do dropdown e manter apenas "Acessar" |

