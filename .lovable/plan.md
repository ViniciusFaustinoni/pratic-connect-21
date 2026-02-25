
# Corrigir Campos Vazios na Proposta de Filiacao (Autentique)

## Problema
O documento gerado para assinatura no Autentique apresenta varios campos vazios:
- **Cambio**: vazio
- **Portas**: vazio
- **Cod. FIPE**: vazio
- **Valor FIPE**: mostrando R$ 0,00 em alguns casos
- **Veiculo proveniente de leilao?**: vazio (deveria mostrar SIM ou NAO)
- **Utilizado para aplicativo?**: vazio (deveria mostrar SIM ou NAO)
- **Nome do Consultor**: vazio

## Causa Raiz
1. `codigo_fipe` e `uso_aplicativo` nao sao copiados da tabela `cotacoes` para `contratos` quando o contrato e gerado
2. O campo `categoria` da cotacao (que indica leilao/aplicativo) nao e mapeado para as variaveis do template
3. O vendedor (consultor) nao e buscado pelo `vendedor_id` na funcao `autentique-create`
4. O mapeamento de variaveis em `template-utils.ts` nao inclui `veiculo.cambio`, `veiculo.portas`, `veiculo.leilao`, `veiculo.uso_aplicativo`, `consultor.nome`

## Solucao

### 1. Migration: Adicionar colunas faltantes em `contratos`
Adicionar 2 colunas na tabela `contratos`:
- `codigo_fipe` (text, nullable)
- `uso_aplicativo` (boolean, nullable)

A coluna `veiculo_categoria` ja existe e sera reaproveitada para armazenar a categoria de uso (leilao, aplicativo, etc.).

### 2. Edge Function `contrato-gerar/index.ts`
Nos 3 pontos onde veiculos sao inseridos e no INSERT do contrato, adicionar:
- `codigo_fipe: cotacao.codigo_fipe`
- `uso_aplicativo: cotacao.uso_aplicativo`
- `veiculo_categoria: cotacao.categoria` (usar a categoria de uso da cotacao, nao "Automovel")

### 3. Edge Function `autentique-create/index.ts`
Apos buscar o contrato, buscar o nome do vendedor/consultor:
```
const vendedorNome = contrato.vendedor_id 
  ? (await supabase.from('profiles').select('nome').eq('id', contrato.vendedor_id).maybeSingle())?.data?.nome 
  : null;
```
Passar `vendedorNome` para `mapearDadosParaTemplate`.

### 4. `_shared/termo-afiliacao-utils.ts`
Atualizar `VeiculoData` para incluir novos campos:
- `cambio?: string`
- `portas?: number`
- `uso_aplicativo?: boolean`

Atualizar `TermoAfiliacaoData` para incluir:
- `consultor?: { nome: string }`

Atualizar `mapearDadosParaTemplate` para:
- Mapear `codigo_fipe` do contrato (nao apenas do lead): `contrato.codigo_fipe || veiculo.codigo_fipe`
- Mapear `uso_aplicativo` do contrato
- Inferir `leilao` de `veiculo_categoria`
- Inferir `cambio` do nome do modelo (se contem "Manual"/"Mecanico" = Manual, "Automatico"/"CVT"/"AT" = Automatico)
- Inferir `portas` do tipo de veiculo (moto = 0, default = 4)
- Receber e mapear `consultor.nome`

### 5. `_shared/template-utils.ts`
Adicionar novas variaveis ao mapeamento:
```
'veiculo.cambio': dados.veiculo.cambio || '—',
'veiculo.portas': String(dados.veiculo.portas || 4),
'veiculo.leilao': (categoria de uso indica leilao) ? 'SIM' : 'NAO',
'veiculo.uso_aplicativo': dados.veiculo.uso_aplicativo ? 'SIM' : 'NAO',
'veiculo.valor_protegido': formatCurrency(dados.veiculo.valor_fipe),
'consultor.nome': dados.consultor?.nome || '—',
```

### Arquivos Alterados
1. Nova migration SQL (adicionar `codigo_fipe` e `uso_aplicativo` em `contratos`)
2. `supabase/functions/contrato-gerar/index.ts` — copiar campos da cotacao
3. `supabase/functions/autentique-create/index.ts` — buscar nome do vendedor
4. `supabase/functions/_shared/termo-afiliacao-utils.ts` — interfaces e mapeamento
5. `supabase/functions/_shared/template-utils.ts` — novas variaveis

### Logica de Inferencia

**Cambio**: Analise do campo `modelo` do veiculo:
- Se contem "Mecanico", "Manual", "MT" -> "Manual"
- Se contem "Automatico", "CVT", "AT", "Tiptronic" -> "Automatico"
- Caso contrario -> "—"

**Portas**: Inferido pela categoria:
- Se moto -> sem portas (0)
- Se veiculo tipo pickup/SUV com modelo indicando -> 4
- Default -> 4

**Leilao**: Derivado de `veiculo_categoria` ou `categoria` da cotacao:
- Se contem "leilao" -> "SIM", senao -> "NAO"

**Uso Aplicativo**: Leitura direta do campo `uso_aplicativo` boolean -> "SIM" ou "NAO"
