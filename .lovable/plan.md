## Diagnóstico (Carlos Roberto Alves / RJM3D69 — Chevrolet Onix)

Confirmado em DB:

```text
cotacoes.id      = 6c6871ae-547c-4967-b466-19fee4fce30f
  veiculo_marca  = 'Chevrolet'
  veiculo_modelo = 'onix 10mt Lt2'
  veiculo_categoria = NULL
  categoria      = 'moto'   ← campo errado, propaga p/ tudo
  plano          = "Select One - Passeio 5%"  (plano de carro!)

contratos (gerado a partir da cotação)
  veiculo_categoria = 'moto'   ← copiado da cotação

veiculos.RJM3D69 → não tem coluna `tipo`, mas a UI lê
  `proposta.veiculo_categoria` (do contrato) e mostra "moto".
```

### Por que o app mobile do instalador mostra "Checklist de Moto"

`InstaladorChecklist.tsx:205` chama `detectarTipoVeiculo(undefined, modelo, marca)` do `vistoriaConfigCompleta.ts`. Para `marca='Chevrolet'`, `CARRO_BRANDS` deveria devolver `'automovel'`. **Mas a regra atual do detector ignora a categoria já gravada na cotação/contrato e não tem fonte única**: o que aparece na ficha "CATEGORIA: moto" vem de `contratos.veiculo_categoria='moto'`, e essa string foi escrita por `contrato-gerar`.

### Causa raiz — duas falhas em série

1. **Campo `cotacoes.categoria` está sendo usado para dois propósitos incompatíveis**: 
   - "situação especial" do veículo (taxi/leilão/aplicativo) — único uso legítimo, vide `categorias_veiculo` em `configuracoes`.
   - "tipo de veículo" (moto/carro) — escrito por `useCotacaoContratacao.ts:536` (fluxo público OCR), pelo `useCotacao.ts:402` e variações. Esse desvio gera o valor `'moto'` mesmo sem a opção existir no select de categorias.

2. **`contrato-gerar/index.ts:detectarCategoriaVeiculo` (linha 134) confia cegamente em `categoriaExistente`**:
   ```ts
   if (categoriaExistente && categoriaExistente !== 'nenhuma') return categoriaExistente;
   ```
   Recebe `cotacao.categoria='moto'` e devolve `'moto'` para `contratos.veiculo_categoria`, mesmo quando a marca é `Chevrolet` (CARRO_BRANDS) — sem nenhuma sanidade contra marca/modelo.

Resultado: qualquer ruído em `cotacoes.categoria` vira a verdade do contrato, e cascateia para a ficha do veículo, vistoria e instalação.

## Correção

### 1. `supabase/functions/contrato-gerar/index.ts` — sanity-check obrigatório em `detectarCategoriaVeiculo`

Reescrever o early-return para **só aceitar `categoriaExistente` quando ela for compatível com marca/modelo**:

- Se `categoriaExistente` indicar moto (`/moto|motocicleta|ciclomotor/i`) **e** `marca` estiver em `CARRO_BRANDS_LOCAL` (Chevrolet, Fiat, VW, Ford, Toyota, etc.) **e** o modelo não bater MOTO_KEYWORDS por word boundary → ignora `categoriaExistente` e segue regras 1→3 normais.
- Se `categoriaExistente` for um valor de "situação especial" do `configuracoes.categorias_veiculo` (taxi/leilão/aplicativo/etc.) → continua respeitando (não é tipo de veículo).
- Replicar a lista `CARRO_BRANDS` que já existe no front (`vistoriaConfigCompleta.ts`) num módulo compartilhado da edge function (constante local) para a sanidade.

### 2. Frontend — parar de poluir `cotacoes.categoria` com tipo de veículo

- `src/hooks/useCotacaoContratacao.ts:536`: remover o bloco que escreve `categoria: detectarCategoriaPorModelo(...)`. O tipo já é detectado em runtime pelo instalador / vistoria via `detectarTipoVeiculo` a partir de marca+modelo. O campo `categoria` na cotação fica reservado a "situação especial" (taxi/leilão).
- `src/hooks/useCotacao.ts:402` (e equivalentes): manter `categoria: payload.categoria_veiculo` somente quando `categoria_veiculo` for um valor da lista `categorias_veiculo` do `configuracoes` (whitelist). Bloquear `'moto'/'carro'/'automovel'` antes do insert.

### 3. `src/components/cadastro/proposta/PropostaDetalhesTabs.tsx:205`

Trocar a fonte do label "Categoria" do veículo para um derivado **on-the-fly** via `detectarTipoVeiculo(undefined, proposta.veiculo_modelo, proposta.veiculo_marca)` mostrado como `"Automóvel" | "Motocicleta"`. Não ler mais `proposta.veiculo_categoria` (que ficará reservado a "Táxi/Leilão/Aplicativo"). Quando houver situação especial, exibir como badge separado.

### 4. Migração one-shot — corrigir o registro do Carlos Roberto

```sql
-- Limpa categoria poluída
UPDATE cotacoes
   SET categoria = NULL,
       updated_at = NOW()
 WHERE id = '6c6871ae-547c-4967-b466-19fee4fce30f';

-- Corrige veiculo_categoria do contrato
UPDATE contratos
   SET veiculo_categoria = 'Automóvel',
       updated_at = NOW()
 WHERE id = '13899c82-97b0-4069-9440-86b4c34f6e6a';
```

Não toca em `veiculos` (a tabela não tem coluna `tipo`/`categoria`; a UI mobile derivará certo via marca Chevrolet → CARRO_BRANDS).

### 5. Memória nova

`mem://logic/operations/cotacao-categoria-vs-tipo-veiculo`:
> `cotacoes.categoria` e `contratos.veiculo_categoria` armazenam **APENAS situação especial do veículo** (taxi, leilão, aplicativo, ex-táxi, placa vermelha, etc.) — listadas em `configuracoes.categorias_veiculo`. NUNCA gravar `'moto'/'carro'/'automovel'` nesses campos. Tipo de veículo (moto vs automóvel) é derivado em runtime via `detectarTipoVeiculo(tipo_api, modelo, marca)`. `contrato-gerar/detectarCategoriaVeiculo` deve ignorar `categoriaExistente` quando ela for `moto/motocicleta` mas marca pertencer a `CARRO_BRANDS`.

## Validação

- Reabrir a ficha do Carlos Roberto: aba Veículo deve mostrar "CATEGORIA: Automóvel".
- Reabrir o link de vistoria do instalador no celular: badge passa a "Checklist de Automóvel (31 fotos)".
- Criar nova cotação Onix sem nenhum input de categoria → `cotacoes.categoria` permanece NULL e o termo gerado traz `veiculo_categoria='Automóvel'`.

## Fora de escopo

- Não alterar a lógica de planos de moto (`usePlanosCotacao`/`usePlansAdmin`), que usa um `categoria='moto'` interno do plano (não da cotação/contrato).
- Não alterar fluxos de inclusão/substituição/troca além das chamadas dos hooks acima.
- Não criar tabela nova para tipo de veículo — o derivado por `detectarTipoVeiculo(marca, modelo)` já é suficiente e tem fallback dinâmico via `marcas_exclusivas_moto`.
