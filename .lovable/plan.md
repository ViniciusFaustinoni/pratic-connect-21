
# Plano: Corrigir Campo "Modelo" para "Plataforma" na Seção de Rastreador

## Problema Identificado

Na página de detalhes da instalação (`InstalacaoDetalhe.tsx`), a seção "Rastreador" exibe um campo chamado **"Modelo"** que mostra "—" (vazio).

Este campo está incorreto porque:
1. O rastreador não possui um campo "modelo" na estrutura de dados
2. O rastreador possui um campo **"plataforma"** que indica qual integração está sendo usada (softruck, rede_veiculos)
3. A plataforma é a informação relevante a ser exibida, não um modelo

## Locais Afetados

1. **`src/pages/monitoramento/InstalacaoDetalhe.tsx`** (linhas 427-428)
   - Exibe: `{(instalacao.rastreadores as any).modelo || '—'}`
   - Deveria exibir: `{(instalacao.rastreadores as any).plataforma || '—'}`

## Causa Raiz

A estrutura de dados do rastreador (`RastreadorComPlataforma`) define:
- `plataforma`: PlataformaRastreador ('rede_veiculos' | 'softruck')
- Não existe campo "modelo" na tabela rastreadores

O código está tentando acessar um campo inexistente, resultando sempre em "—".

## Solução Proposta

### Arquivo a Modificar

**`src/pages/monitoramento/InstalacaoDetalhe.tsx`** (linhas 427-428)

**Antes:**
```typescript
<div>
  <p className="text-sm text-muted-foreground">Modelo</p>
  <p className="font-medium">{(instalacao.rastreadores as any).modelo || '—'}</p>
</div>
```

**Depois:**
```typescript
<div>
  <p className="text-sm text-muted-foreground">Plataforma</p>
  <p className="font-medium">{(instalacao.rastreadores as any).plataforma?.toUpperCase() || '—'}</p>
</div>
```

## Efeito Visual

| Campo | Antes | Depois |
|-------|-------|--------|
| Label | Modelo | Plataforma |
| Valor | — | SOFTRUCK ou REDE_VEICULOS |

## Comportamento Esperado

Quando um rastreador está vinculado à instalação, a plataforma será exibida em maiúsculas (SOFTRUCK ou REDE_VEICULOS) em vez de um campo vazio.

