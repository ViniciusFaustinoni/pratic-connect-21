
# Plano: Corrigir Cobertura do Veículo do Marcus Vinicius

## Problema

A IA do WhatsApp mostra cobertura parcial porque o veículo está com dados incorretos no banco:

| Campo | Valor Atual | Valor Correto |
|-------|-------------|---------------|
| `cobertura_total` | `false` | `true` |
| `status` | `em_analise` | `ativo` |

**Causa**: A migration anterior (`20260202204328`) atualizou um ID de veículo antigo (`05a11b11...`) que já foi deletado junto com o associado original. O veículo atual tem ID diferente (`9dba80a3...`).

---

## Solução

### Parte 1: Corrigir Dados do Veículo Atual

Criar nova migration para atualizar o veículo correto:

```sql
-- Corrigir cobertura do veículo do Marcus Vinicius (ID correto)
UPDATE veiculos 
SET cobertura_total = true, 
    status = 'ativo'
WHERE id = '9dba80a3-a344-4290-9643-b00689d01d7d';
```

**Dados do veículo:**
- **ID**: `9dba80a3-a344-4290-9643-b00689d01d7d`
- **Placa**: LTB4J74
- **Associado**: MARCUS VINICIUS FAUSTINONI DE FREITAS

---

### Parte 2: Remover Migration Obsoleta

A migration `20260202204328` atualiza um veículo que não existe mais e pode ser removida ou mantida (não causa problemas).

---

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| Nova migration SQL | **CRIAR** | Atualizar cobertura_total e status do veículo correto |

---

## Resultado Esperado

Após a correção:
1. A IA do WhatsApp reconhecerá cobertura total
2. O associado poderá abrir sinistros de colisão
3. O associado terá acesso à assistência 24h

---

## Detalhes Técnicos

A Edge Function `assistente-chat` monta o contexto do veículo assim (linhas 628-638):

```typescript
const veiculosTexto = veiculos.map((v) => {
  const coberturas = [];
  if (v.cobertura_roubo_furto) coberturas.push('Roubo/Furto');
  if (v.cobertura_total) coberturas.push('Total (inclui Assistência 24h)');
  // ...
});
```

Quando `cobertura_total = true`, a IA receberá no contexto:
```
Coberturas: Roubo/Furto, Total (inclui Assistência 24h)
```

E permitirá sinistros de colisão e assistência 24h.
