

# Plano: Exibir dados de deságio, cobertura FIPE e coberturas removidas no PDF

## Resumo

Adicionar exibição dos campos `cotaPercentual`, `cotaMinima`, `cotaDesagio`, `cotaMinimaDesagio`, `coberturaFipe`, `alertaDesagio`, `anoMinimo` e `coberturasRemovidas` nos PDFs simples e comparativo, e diferenciar coberturas removidas na tabela comparativa.

## Arquivo afetado

`src/lib/gerarPdfCotacao.ts`

---

## 1. PDF Comparativo — `desenharPaginaDetalhesPlano` (linhas 1024-1293)

**Já implementado parcialmente** (cotas, alertaDesagio, anoMinimo, coberturaFipe badge). Ajustes necessários:

### 1a. Alerta de deságio — multiline (linhas 1150-1162)

Substituir `truncateText(plano.alertaDesagio, 70)` por `splitTextToSize` para quebrar em múltiplas linhas. Calcular `alertaHeight` dinamicamente baseado no número de linhas.

### 1b. Seção "NÃO APLICÁVEL PARA ESTE VEÍCULO" (após linhas 1252)

Após a seção "NÃO INCLUI NESTE PLANO", se `plano.coberturasRemovidas?.length > 0`:
- Section header com título "NÃO APLICÁVEL PARA ESTE VEÍCULO"
- Mesmo layout 2 colunas com ícone `⚠` em `warningYellow` e texto em `glowRed`
- Zebra striping igual às outras seções

### 1c. Badge coberturaFipe com destaque condicional (linhas 1095-1103)

Já exibe `X% FIPE`. Quando `coberturaFipe !== 100`, mudar cor do badge de `glowBlue` para `warningYellow` para chamar atenção.

### 1d. Ano mínimo (linhas 1105-1113)

Já implementado como badge `> XXXX`. Alterar texto para `A partir de XXXX` para melhor legibilidade.

---

## 2. PDF Simples — `gerarPdfCotacao` (linhas 309-704)

Após a seção de coberturas incluídas (linha 565) e antes da seção de valores (linha 567):

### 2a. Cota de participação

Se `planoSimples` tiver `cotaPercentual` e `cotaMinima` (via dados da cotação, que precisam ser propagados):
- Exibir "Cota Passeio: X% — mín. R$ Y" 
- Se `cotaDesagio`/`cotaMinimaDesagio`: linha verde "Com Deságio: X% — mín. R$ Y"

**Nota**: O PDF simples recebe `CotacaoParaPdf`, que não tem esses campos. Será necessário:
- Adicionar campos opcionais `cotaPercentual`, `cotaMinima`, `cotaDesagio`, `cotaMinimaDesagio`, `coberturaFipe`, `anoMinimo`, `alertaDesagio`, `coberturasRemovidas` a `CotacaoParaPdf`
- Propagar ao `planoSimples` montado na linha 676

### 2b. Badge coberturaFipe

Se `coberturaFipe !== 100`, exibir badge de destaque amarelo: "Cobertura: X% da FIPE" antes dos valores.

### 2c. Alerta deságio

Se `alertaDesagio` presente, bloco amarelo com texto multiline (`splitTextToSize`).

### 2d. Coberturas removidas

Se `coberturasRemovidas?.length > 0`, seção "NÃO APLICÁVEL PARA ESTE VEÍCULO" em layout 2 colunas com ícone `⚠` amarelo e texto vermelho.

### 2e. Ano mínimo

Se `anoMinimo` presente, badge discreto: "Veículos a partir de XXXX".

---

## 3. Tabela comparativa — `desenharPaginaComparativoCoberturas` (linhas 1304-1431)

### 3a. Incluir coberturas removidas no pool de coberturas (linhas 1347-1352)

Ao coletar `todasCoberturas`, incluir também itens de `plano.coberturasRemovidas` (sem duplicatas).

### 3b. Diferenciar visualmente (linhas 1394-1410)

Lógica para cada célula:
- Se `plano.coberturas.includes(c)` → `✓` verde (já existe)
- Se `plano.coberturasRemovidas?.includes(c)` → `⚠` amarelo (`warningYellow`) — cobertura removida para este veículo
- Senão → `✗` vermelho (não faz parte do plano)

---

## 4. Atualizar `CotacaoParaPdf` (linhas 44-73)

Adicionar campos opcionais:

```typescript
cotaPercentual?: number;
cotaMinima?: number;
cotaDesagio?: number;
cotaMinimaDesagio?: number;
coberturaFipe?: number;
anoMinimo?: number;
alertaDesagio?: string;
coberturasRemovidas?: string[];
```

E propagar na construção do `planoSimples` (linha 676).

