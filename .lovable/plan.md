

# Calculadora — Aplicar Regras de Deságio e Categoria

## Problema

A calculadora não tem campo de **categoria** (leilão, táxi, chassi remarcado, etc.), então ignora:
- Preço de deságio (`valor_desagio` da tabela)
- Cota diferenciada (deságio usa % e mínimo maiores)
- Regra APP + deságio (categoria anula adicional APP, planos passeio Select ficam visíveis, Select Exclusive é ocultado)

## Solução — arquivo único: `CalculadoraPreco.tsx`

Manter o layout idêntico. Adicionar um Select de categoria e replicar as mesmas regras de `usePlanosCotacao.ts`.

### 1. Novo campo: Categoria (opcional, só para carros)

Após "Tipo de Uso", um `<Select>` com: Nenhuma (default), Leilão, Ex-táxi, Táxi, Chassi Remarcado, Placa Vermelha, Ressarcimento Integral. Compacto, mesmo estilo dos outros campos.

### 2. Novas queries (reusar as mesmas chaves do cotador)

- `categorias_desagio` → quais categorias ativam deságio
- `linhas_com_desagio` → quais linhas têm `valor_desagio`
- `categorias_que_sobrepoe_app` → categorias que anulam adicional APP
- `cota_desagio_default` e `cota_minima_desagio_default` → defaults de cota deságio
- `planos_cotas_categoria` → overrides de cota por categoria/plano

As queries já existem no cache do React Query (mesmas `queryKey`), então não geram requests extras.

### 3. Ajustes na função `calcular()`

Replicar a lógica de `usePlanosCotacao.ts` linhas 396-598:

- **Visibilidade APP + deságio**: Se `usoApp` e categoria está em `categoriasQueSobrepoeApp`, permitir planos `passeio` da linha Select (igual cotador linha 397-404)
- **Ocultar Select Exclusive**: Quando APP + deságio combinam (linha 437-442)
- **Preço de deságio**: Se categoria é deságio e linha tem deságio e NÃO tem coluna APP dedicada → usar `valor_desagio` (linha 536-538)
- **Adicional APP anulado**: Se categoria está em `categoriasQueSobrepoeApp`, NÃO aplicar `resolverPrecoApp` (linha 540-544)
- **Cota cascata**: Buscar de `planos_cotas_categoria` → campos do plano (`cota_desagio`, `cota_minima_desagio`) → defaults do banco (linha 570-598)

### 4. Badge visual no card de resultado

Quando deságio está ativo, mostrar badge "Deságio" discreto no card (mesmo estilo dos badges existentes de adicional/desconto).

### 5. Limpar

Adicionar `categoria` ao `limpar()`.

## Resumo

| O que | Como |
|-------|------|
| Campo categoria | Select após Tipo de Uso (só carros) |
| Preço deságio | `valor_desagio` da faixa quando aplicável |
| APP + deságio | Anula adicional APP, mostra Select passeio, oculta Exclusive |
| Cota deságio | Cascata: `planos_cotas_categoria` → plano → defaults |
| Badge | "Deságio" no card quando ativo |

Arquivo modificado: `src/components/planos/CalculadoraPreco.tsx` (único)

