

# Notificacao Amigavel ao Associado + Follow-up Pos-Recusa

## Contexto
Quando o instalador/vistoriador recusa um veiculo, o associado nao recebe nenhuma comunicacao. Alem disso, nao existe follow-up para reengajar o associado. A mensagem precisa ser acolhedora, com passo-a-passo baseado no motivo da recusa, e orientar que sera necessaria nova cotacao (valores FIPE mudam mensalmente).

## Motivos de recusa existentes no sistema
O modal de recusa (`ModalRecusaVeiculoComFotos.tsx`) tem 9 motivos padronizados:
- condicoes_precarias, danos_estruturais, adulteracoes, quilometragem_adulterada, documentacao_irregular, chassi_divergente, sinais_sinistro, sistema_eletrico, outro

## Alteracoes

### 1. Template de recusa amigavel (`supabase/functions/notificar-cliente/index.ts`)

Adicionar template `veiculo_negado_orientacoes` com mensagem humanizada:

```
Ola {nome}! Passamos para te atualizar sobre a avaliacao do seu veiculo {placa}.

Nosso tecnico identificou uma pendencia que precisa ser resolvida antes de seguirmos com a protecao:

{orientacoes_resolucao}

Assim que resolver, voce pode fazer uma nova cotacao pelo nosso app ou entrando em contato conosco. Como os valores de protecao sao atualizados mensalmente, sera necessario gerar uma nova cotacao — e pode ser ate mais vantajoso!

Estamos aqui para te ajudar. Qualquer duvida, e so responder esta mensagem.
```

A variavel `{orientacoes_resolucao}` sera preenchida com passo-a-passo especifico por motivo.

### 2. Mapeamento motivo → orientacoes (`src/hooks/useServicos.ts` e `useVistoriaCompleta.ts`)

Criar funcao `getOrientacoesRecusa(motivo: string): string` que retorna texto amigavel:

- **condicoes_precarias**: "Leve o veiculo a uma oficina de confianca para revisao geral. Itens como pneus, farois, lanternas e lataria precisam estar em boas condicoes."
- **danos_estruturais**: "O veiculo apresentou danos na estrutura. Procure uma funilaria para reparo e guarde os comprovantes do servico."
- **adulteracoes**: "Foram identificadas modificacoes nao originais. Restaure os itens alterados ao padrao de fabrica."
- **quilometragem_adulterada**: "Ha indicio de inconsistencia no hodometro. Solicite uma pericia veicular em empresa credenciada pelo DETRAN."
- **documentacao_irregular**: "A documentacao esta com pendencias. Verifique junto ao DETRAN se ha debitos, restricoes ou transferencia pendente."
- **chassi_divergente**: "O numero do chassi diverge do documento. Procure o DETRAN para regularizacao e pericia."
- **sinais_sinistro**: "Foram identificados sinais de sinistro anterior. Obtenha um laudo cautelar em empresa credenciada para comprovar que o veiculo esta em condicoes."
- **sistema_eletrico**: "O sistema eletrico do veiculo precisa de reparos. Leve a um eletricista automotivo para diagnostico e correcao."
- **outro / generico**: "Nosso tecnico identificou uma pendencia. Entre em contato para entender os detalhes e como resolver."

### 3. Disparar notificacao nos hooks de recusa

**`src/hooks/useServicos.ts`** (onSuccess de `useRecusarVeiculoServico`):
- Chamar `notificar-cliente` com tipo `veiculo_negado_orientacoes` passando `orientacoes_resolucao` baseada no motivo

**`src/hooks/useVistoriaCompleta.ts`** (onSuccess de `useRecusarVeiculoVistoria`):
- Mesmo disparo, extraindo motivo e associado_id dos dados da mutacao

### 4. Follow-up automatico pos-recusa (Edge Function cron)

**Novo arquivo: `supabase/functions/cron-followup-recusa/index.ts`**

Cron job que roda diariamente e:
1. Busca servicos com `decisao_instalador = 'negado'` e `status = 'em_analise'` criados ha mais de 3 dias sem interacao
2. Verifica se ja nao enviou follow-up (checando `whatsapp_mensagens` com `referencia_tipo = 'followup_recusa'`)
3. Envia mensagem de reengajamento:

```
Ola {nome}! Vimos que ainda nao retornou sobre a pendencia do seu veiculo {placa}.

Sabemos que pode parecer complicado, mas estamos aqui para te ajudar! Lembre-se:

{orientacoes_resolucao}

Quando estiver pronto, faca uma nova cotacao pelo app ou fale conosco. Queremos te ver protegido!
```

4. Marca o servico com flag `followup_recusa_enviado = true` (novo campo) para nao reenviar
5. Segundo follow-up apos 7 dias (se ainda sem resposta), mensagem final mais curta

### 5. Migracao de banco

Adicionar campo `followup_recusa_enviado_em` (timestamp nullable) na tabela `servicos` para controlar envio do follow-up.

### 6. Registrar cron job

Agendar `cron-followup-recusa` para rodar diariamente as 10h (horario comercial amigavel).

## Arquivos afetados
- `supabase/functions/notificar-cliente/index.ts` — novo template amigavel
- `src/hooks/useServicos.ts` — funcao de orientacoes + disparo da notificacao
- `src/hooks/useVistoriaCompleta.ts` — mesmo disparo com orientacoes
- `supabase/functions/cron-followup-recusa/index.ts` — novo cron de follow-up
- Migracao SQL — campo `followup_recusa_enviado_em` em `servicos`

## Fluxo completo

```text
Recusa do instalador/vistoriador
  ├── WhatsApp imediato → Mensagem acolhedora + passo-a-passo por motivo
  │     "Leve a uma oficina... Quando resolver, faca nova cotacao..."
  │
  ├── Dia 3 → Follow-up automatico (se sem resposta)
  │     "Vimos que ainda nao retornou... Estamos aqui para ajudar!"
  │
  ├── Dia 7 → Segundo follow-up (ultimo)
  │     "Ola {nome}, sua protecao esta esperando por voce..."
  │
  └── Associado resolve → Nova cotacao (FIPE atualizada) → Novo fluxo completo
```

