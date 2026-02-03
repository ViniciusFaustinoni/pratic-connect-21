
# Plano: Esconder Card de Documentos na Aba Resumo

## Objetivo
Remover o card que mostra "5/1 Documentos ✓" da seção de stats cards na aba Resumo, mantendo apenas os demais cards.

---

## Estado Atual

Na aba Resumo existem 4 cards de estatísticas:
1. **Veículos** - quantidade de veículos
2. **Documentos ✓** - documentos aprovados/total (a ser removido)
3. **Em dia / Em atraso** - situação financeira
4. **Sinistros** - quantidade de sinistros

---

## Alterações

### Arquivo: `src/pages/cadastro/AssociadoDetalhe.tsx`

**Linha 659**: Alterar o grid de 4 colunas para 3:
```tsx
// De:
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">

// Para:
<div className="grid grid-cols-3 gap-4">
```

**Linhas 667-672**: Remover o card de Documentos:
```tsx
// REMOVER:
<Card>
  <CardContent className="p-4 text-center">
    <FileCheck className="h-8 w-8 mx-auto text-green-500" />
    <p className="text-2xl font-bold mt-2">{docsAprovados}/{documentos?.length || 0}</p>
    <p className="text-sm text-muted-foreground">Documentos ✓</p>
  </CardContent>
</Card>
```

---

## Resultado

Os 3 cards restantes serão:
| Card | Descrição |
|------|-----------|
| Veículos | Quantidade de veículos do associado |
| Em dia / Em atraso | Situação financeira |
| Sinistros | Quantidade de sinistros |

O layout ficará balanceado com 3 colunas.
