
# Plano: Incluir Campo "Plataforma" no Select de Rastreadores

## Problema Identificado

Na página de detalhes da instalação (`InstalacaoDetalhe.tsx`), o campo "Plataforma" do rastreador aparece vazio ("—") mesmo quando o rastreador já está cadastrado com plataforma definida no banco de dados.

## Causa Raiz

O hook `useInstalacao` em `src/hooks/useInstalacoes.ts` (linha 228) não inclui o campo `plataforma` no select:

```typescript
// Linha 228 - Atual (INCORRETO)
rastreadores (id, codigo, numero_serie, imei),
```

Enquanto outros hooks como `useAssociados` e `useServicos` incluem corretamente:

```typescript
// useAssociados.ts - Linha 317 (CORRETO)
rastreador:rastreadores!...(id, codigo, numero_serie, imei, plataforma, plataforma_device_id, status, ...)
```

## Solução Proposta

### Arquivo a Modificar

**`src/hooks/useInstalacoes.ts`** - Linha 228

**Antes:**
```typescript
rastreadores (id, codigo, numero_serie, imei),
```

**Depois:**
```typescript
rastreadores (id, codigo, numero_serie, imei, plataforma, status),
```

### Também atualizar a listagem (linha 127)

Para consistência, adicionar o campo `plataforma` também na query da listagem de instalações.

**Antes (linha 127):**
```typescript
rastreadores (id, codigo, numero_serie, imei),
```

**Depois:**
```typescript
rastreadores (id, codigo, numero_serie, imei, plataforma, status),
```

## Comportamento Esperado

| Campo | Antes | Depois |
|-------|-------|--------|
| Plataforma | — | SOFTRUCK ou REDE_VEICULOS |

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `src/hooks/useInstalacoes.ts` | Adicionar `plataforma, status` ao select de rastreadores (linhas 127 e 228) |

## Testes Recomendados

1. Acessar uma instalação que tenha rastreador reservado
2. Verificar se o campo "Plataforma" agora exibe corretamente o valor (SOFTRUCK ou REDE_VEICULOS)
3. Verificar se a listagem de instalações também carrega corretamente
