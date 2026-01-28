

# Plano: Incluir Vistoriadores BASE no Dropdown de Portador

## Problema Identificado

O hook `useProfissionaisEquipe` em `src/hooks/useEquipe.ts` busca apenas usuários com a role `instalador_vistoriador`:

```typescript
// Linha 48 atual:
.eq('role', 'instalador_vistoriador');
```

Isso exclui usuários com a role `vistoriador_base`, que são vistoriadores que trabalham na base física (sem app de campo).

## Impacto

| Componente | Arquivo | Uso |
|------------|---------|-----|
| AtribuirPortadorDialog | estoque/AtribuirPortadorDialog.tsx | Modal de atribuição individual |
| AtribuirPortadorLoteDialog | estoque/AtribuirPortadorLoteDialog.tsx | Modal de atribuição em lote |
| RastreadorFormDialog | rastreadores/RastreadorFormDialog.tsx | Form de novo rastreador |
| ListaRastreadores | estoque/ListaRastreadores.tsx | Lista de rastreadores |
| Equipe | monitoramento/Equipe.tsx | Página de gestão da equipe |

## Solução

Modificar a query para incluir **ambas** as roles:

```typescript
// De:
.eq('role', 'instalador_vistoriador');

// Para:
.in('role', ['instalador_vistoriador', 'vistoriador_base']);
```

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/hooks/useEquipe.ts` | 48 | Trocar `.eq()` por `.in()` para incluir ambas roles |

## Resultado Esperado

Após a alteração, o dropdown "Portador (Profissional Responsável)" exibirá:
- ✅ Instaladores/Vistoriadores (role `instalador_vistoriador`)
- ✅ Vistoriadores Base (role `vistoriador_base`)

## Outras Áreas Afetadas

Nenhuma. A alteração está isolada no hook `useProfissionaisEquipe` e todos os componentes que o utilizam se beneficiarão automaticamente da mudança sem necessidade de alterações adicionais.

