## Diagnóstico — por que a Troca KOU6D37 (Marcus Vinicius) não apareceu

A cotação `COT-20260520-173700155-759` (contrato `71b21fd9…`) está **correta no banco**:

- `contratos.status = 'assinado'`
- `contratos.cadastro_aprovado = false`
- `contratos.tipo_entrada = 'troca_titularidade'`
- `contratos.origem_troca_titularidade_id` preenchido
- `veiculos.status = 'instalacao_pendente'` (não é 'ativo')

Portanto ela **deveria** aparecer em `/cadastro/propostas`. Não aparece por causa de **um filtro do hook `usePropostasPendentes`** que assume fluxo de Nova Adesão:

`src/hooks/usePropostasPendentes.ts:795-801`
```ts
const temQualquerEtapa =
  instalacaoInfo ||
  temAutovistoria ||
  temVistoriaBaseRealizada ||
  temVistoriaBaseAgendada ||
  temInstalacaoAgendada;
if (!temQualquerEtapa) return null;
```

Esse gate exige autovistoria, vistoria de base (agendada/realizada) ou instalação (agendada/concluída) **antes** de admitir o item na fila do Cadastro.

Pelo manual canônico, **Troca de Titularidade NÃO faz autovistoria** e o agendamento de vistoria (se houver) é decidido pelo **Monitoramento**, depois do Cadastro. Logo, no momento exato em que o novo titular termina o link público (escolher plano → docs → assinar termo), nenhuma dessas etapas existe — o item é descartado pelo `return null` e some da fila.

Mesmo sintoma vale para qualquer troca futura: hoje só aparece no Cadastro se, por acaso, já existir vistoria/instalação anexada — o que não é o fluxo canônico.

---

## Correção

Ajustar o gate em `usePropostasPendentes.ts` para **dispensar `temQualquerEtapa` quando o contrato é Troca de Titularidade**, alinhado ao fluxo canônico.

### Mudança única (cirúrgica)

`src/hooks/usePropostasPendentes.ts` ~ linha 795:

```ts
const isTroca =
  contrato.tipo_entrada === 'troca_titularidade' ||
  !!(contrato as any).origem_troca_titularidade_id;

const temQualquerEtapa =
  instalacaoInfo ||
  temAutovistoria ||
  temVistoriaBaseRealizada ||
  temVistoriaBaseAgendada ||
  temInstalacaoAgendada;

// Troca de titularidade entra no Cadastro logo após a assinatura do termo,
// sem depender de vistoria/instalação (essas etapas são decididas pelo
// Monitoramento, DEPOIS do Cadastro). Para os demais fluxos mantemos o
// gate de "alguma etapa executada" para evitar lixo de rascunho.
if (!isTroca && !temQualquerEtapa) return null;
```

E definir `tipoEtapaAnalise` para troca sem etapa:

```ts
let tipoEtapaAnalise: TipoEtapaAnalise;
if (instalacaoInfo) tipoEtapaAnalise = 'instalacao_concluida';
else if (temAutovistoria || temVistoriaBaseRealizada) tipoEtapaAnalise = 'vistoria_concluida';
else if (isTroca) tipoEtapaAnalise = 'agendamento_confirmado'; // será reavaliada após Cadastro/Monitoramento
else tipoEtapaAnalise = 'agendamento_confirmado';
```

(O badge "TROCA DE TITULARIDADE" já existe via `proposta.tipo_entrada === 'troca_titularidade'` na linha 875.)

### Espelhar no contador

`src/hooks/usePropostasPendentesCount.ts` já reaproveita `usePropostasPendentes`, então o badge da sidebar passa a contar a troca automaticamente — sem mudança.

### Saneamento (one-off)

Após o deploy, a cotação `COT-20260520-173700155-759` (Marcus Vinicius) aparecerá automaticamente em `/cadastro/propostas` na aba **Aguardando**, com o pill roxo "TROCA DE TITULARIDADE". Nenhum dado precisa ser corrigido manualmente — apenas refetch.

---

## Por que isso é seguro

- Não altera o gate de saída (`cadastro_aprovado=true` continua sendo a única forma de sair da fila do Cadastro).
- Não cria caminho alternativo para o fluxo de Nova Adesão — só dispensa o pré-requisito de "etapa executada" exclusivamente para `tipo_entrada='troca_titularidade'`.
- Mantém o veto duplo (veículo `ativo` ou `cadastro_aprovado=true` ⇒ `return null`).
- Próximas trocas seguirão o caminho correto: assinou termo → cai no Cadastro → Cadastro aprova → Monitoramento decide vistoria/aprovação → SGA, conforme o manual.

---

## Detalhes técnicos

- Arquivo único: `src/hooks/usePropostasPendentes.ts` (≈ 4 linhas alteradas)
- Sem migração de DB
- Sem alteração em edge functions
- Memória `mem://logic/operations/propostas-pendentes-entrada-caminho-completo` precisa ser **atualizada** acrescentando: "Troca de titularidade é exceção — entra na fila do Cadastro assim que o termo é assinado, sem exigir vistoria/instalação. As demais etapas (vistoria/instalação) são decididas pelo Monitoramento DEPOIS."
