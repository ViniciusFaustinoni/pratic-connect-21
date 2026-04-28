## Objetivo

No fluxo público de cotação (link enviado ao cliente), quando o cliente envia o documento do veículo (CRLV, NF ou ATPV-e) e a IA **não consegue extrair os dados**, oferecer um formulário manual para que ele preencha chassi, ano, placa, etc., incluindo a marcação **0KM Sim/Não**.

Hoje já existe um botão escondido ("A IA não leu tudo? Preencher manualmente") que só aparece **depois** do upload. Falham dois cenários:
1. Quando a IA falha por completo (nada extraído) o cliente fica sem caminho óbvio.
2. Não há campo de **0KM** nem o submit do formulário envia essa informação.

## Onde alterar

Arquivo único: `src/components/cotacao-publica/EtapaDadosPessoaisDocumentos.tsx`

## Mudanças

### 1. Detectar quando o OCR falhou no documento do veículo
Criar um flag `crlvSemDados`:
- `true` quando há documento do veículo enviado com sucesso (`temCrlv`) **mas** nenhum dado relevante foi extraído (`!temDadosVeiculo` — sem placa nem chassi).
- Quando `crlvSemDados` for `true`, abrir o painel manual automaticamente (`setMostrarManualVeiculo(true)`) e mostrar um aviso amarelo: *"Não conseguimos ler o documento. Preencha os dados do veículo abaixo."*

### 2. Adicionar campo "0KM" no painel manual
Dentro do bloco manual de veículo (linhas 758–809), adicionar antes da grade de inputs:
- Toggle **"Veículo 0KM?"** (Sim/Não), default `Não`.
- Quando **Sim**: tornar a placa opcional (placa fica vazia / "0KM"), exigir apenas chassi + ano modelo. Define `procedenciaVeiculo = 'Novo (zero km)'`.
- Quando **Não**: exigir placa + chassi.

### 3. Tornar o painel manual disponível mesmo SEM documento
Hoje só aparece com `temCrlv === true`. Alterar a condição para também aparecer quando o cliente enviou um arquivo mas o OCR retornou vazio. Mantém o botão "Preencher manualmente" em qualquer cenário onde o usuário queira.

### 4. Ajustar `temDadosVeiculo` para considerar 0KM
Alterar:
```ts
const temDadosVeiculo = !!(
  dadosExtraidos.veiculo_placa ||
  dadosExtraidos.veiculo_chassi ||
  (isZeroKm && dadosExtraidos.veiculo_chassi)
);
```
(Em 0KM, basta chassi + ano para liberar o "Continuar".)

### 5. Submeter o flag 0KM e procedência
No `handleSubmit` (linha 419), incluir no payload:
- `veiculo_zero_km: isZeroKm`
- `veiculo_procedencia: procedenciaVeiculo` (já existe state, mas nunca era enviado)

### 6. Adicionar campos ao tipo `DadosPessoaisForm`
Em `src/components/cotacao-publica/FormularioDadosPessoais.tsx`, estender o schema com `veiculo_zero_km?: boolean` e `veiculo_procedencia?: string` (ambos opcionais).

### 7. Persistência no consumidor
Em `src/pages/public/CotacaoContratacao.tsx` (consumidor da etapa), ao receber `onSubmit`, gravar os novos campos junto com o resto na cotação/associado conforme já é feito (sem nova migration — `cotacoes.veiculo_zero_km` ou flag equivalente já existe; se não existir, será adicionada).

## Critérios de aceitação

- Cliente envia foto do CRLV; IA não extrai nada → painel manual abre **sozinho** com aviso destacado.
- Cliente marca 0KM = Sim → campo placa some/fica opcional; chassi e ano modelo permanecem obrigatórios; botão "Continuar" libera.
- Cliente marca 0KM = Não → fluxo igual ao atual (placa + chassi obrigatórios).
- Marca/modelo **não** aparecem no fallback (já vêm da seleção FIPE da etapa anterior — confirmado no código).
- Nenhuma quebra no fluxo atual quando a IA extrai os dados normalmente (painel manual continua opcional/recolhido).

## Fora de escopo

- Mexer no OCR / `document-ocr` edge function.
- Adicionar marca/modelo manuais (já vêm da etapa de seleção FIPE).
- Mudanças no fluxo de Documentos Pendentes pós-cotação (`DocumentosPendentesPublico.tsx`) — o pedido foi específico ao link público de cotação.
