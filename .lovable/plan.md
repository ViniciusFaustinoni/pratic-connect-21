## Situação atual (já implementado)

A busca via SGA no modal **Troca de Titularidade** **já usa exatamente os endpoints solicitados**:

- **Busca do associado** → `GET /associado/buscar/{cpf}/cpf` (função `buscarAssociadoComVeiculosPorCpf` em `supabase/functions/_shared/hinova-client.ts:751`).
- **Listagem de boletos por associado/veículo** → `POST /listar/boleto-associado-veiculo` (função `listarBoletosVeiculoJanela` em `_shared/hinova-client.ts:567`, com janelas de 90d).
- **Autenticação Bearer** já é resolvida por `getHinovaSession()` (token cacheado + refresh).

O hook `useBoletosSgaPorAssociado` chama a edge `sga-listar-boletos-associado`, que devolve `veiculos[].boletos_abertos[]` com `valor`, `data_vencimento`, `linha_digitavel`, `link_boleto` e `situacao_label` — já filtrando situação **em aberto + vencidos** (`STATUS_ABERTO = {pendente, vencido, aguardando_pagamento}`).

## O que está faltando no modal

O `TrocaTitularidadeDialog` recebe os boletos do hook, mas **não renderiza** essa informação. Hoje só lista os veículos no `<select>`. Não há:
- exibição dos boletos pendentes do veículo selecionado;
- botão para abrir o `link_boleto` / copiar a `linha_digitavel`;
- alerta visual quando o titular antigo tem débito.

## Plano

### 1. Novo bloco "Boletos pendentes" no modal

Em `src/components/associados/TrocaTitularidadeDialog.tsx`, abaixo do `<select>` de veículo (após linha ~329), renderizar:

- Quando `veiculoId` selecionado e o veículo SGA correspondente possui `boletos_abertos.length > 0`:
  - Card com título "Boletos pendentes do veículo" + total `saldo_devedor` formatado em BRL.
  - Lista compacta de até N boletos: vencimento, valor, badge da `situacao_label` (vermelho se `vencido`, âmbar se `pendente`).
  - Para cada boleto com `link_boleto` → botão **"Abrir boleto"** (`<a target="_blank" rel="noopener">`).
  - Para cada boleto com `linha_digitavel` → botão **"Copiar linha digitável"** (usa `navigator.clipboard` + toast).
- Quando o veículo não tem pendência → linha discreta "Sem boletos pendentes".

### 2. Mapeamento veículo SGA ↔ veículo local

O mapa `veiculos[]` já é construído em `veiculosSgaMapeados` (linhas 92-103). Adicionar paralelo um `boletosPorIdLocal: Record<string, BoletoAberto[]>` derivado do mesmo loop, chaveado por `local.id`. O bloco do passo 1 lê `boletosPorIdLocal[veiculoId]`.

### 3. Sem mudança em backend / endpoints / hooks

Nenhuma alteração necessária em edge functions ou hooks — os dados já chegam prontos. Apenas frontend/presentation.

## Validação

Login como diretor (admin@teste.com), abrir um associado com veículo que tenha boleto em aberto no SGA, abrir "Troca de Titularidade", selecionar o veículo e conferir:
- card de boletos aparece com vencimento/valor/badge correto;
- botão "Abrir boleto" abre o PDF da Hinova em nova aba;
- "Copiar linha digitável" copia e dispara toast.

## Detalhes técnicos

Arquivo a editar: `src/components/associados/TrocaTitularidadeDialog.tsx`.
Tipo `BoletoAbertoSGA` já exportado por `src/hooks/useBuscaSGA.ts`.
Formatação: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` e `new Date(b.data_vencimento).toLocaleDateString('pt-BR')`.
