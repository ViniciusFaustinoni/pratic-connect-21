## Diagnóstico — TIB8F32 (revisado)

Rota aberta: `/monitoramento/aprovacao-associados/8a6f3676-…` → serviço **`instalacao`**, `status='aprovada'`.

| Componente | Valor |
|---|---|
| Veículo | Versa Advance, FIPE R$ 107.271 (exige técnica) |
| `veiculos.status` | `ativo` |
| Contrato | `assinado`, `cadastro_aprovado=true` |
| Instalação | `concluida`, rastreador `instalado` vinculado |
| Serviço aberto na tela | `tipo=instalacao`, `status=aprovada`, `vistoria_origem_id=null` |
| Serviço irmão | `vistoria_entrada` (autovistoria) `status=concluida` |

**Bug raiz**: o cálculo de bloqueio na tela (`AprovacaoInstalacaoDetalhe.tsx` linha 894) usa `servico.status !== 'concluida'` como sinônimo de "ainda não terminou em campo". Mas o pipeline canônico produz vários terminais positivos diferentes para o mesmo evento — `aprovada` (instalação fechada pelo técnico/auto-promoção), `concluida` (vistoria), `aprovada_ressalvas`. Hoje só `concluida` desbloqueia, então qualquer serviço já aceito em campo por outro caminho **esconde o botão Aprovar** e oferece apenas Devolver ao Cadastro — violando a regra canônica de que **o último aceite é do Monitoramento**.

## Plano de correção

### 1. Conjunto canônico de "terminais positivos de campo"
Criar helper compartilhado `servicoConcluidoEmCampo(servico)`:

```ts
const TERMINAIS_POSITIVOS_CAMPO = ['concluida', 'aprovada', 'aprovada_ressalvas'] as const;
```

Substituir todo uso de `servico.status !== 'concluida'` por `!servicoConcluidoEmCampo(servico)` na tela de aprovação (e no resolverFotosVeiculo se aplicável). Esse helper vira a fonte única.

### 2. Reescrever o bloqueio em sub-estados acionáveis
Em `AprovacaoInstalacaoDetalhe.tsx` (linhas 884-1003), abandonar o flag único `bloqueado`. Calcular um `subEstado`:

```text
A) PRONTO_PARA_ACEITE_FINAL     ← caso TIB8F32
   serviço terminou em campo (in TERMINAIS_POSITIVOS_CAMPO)
   + rastreador físico presente quando exigeTecnica
   ações: [Aprovar — Ativar Proteção 360] + [Reprovar] + [Solicitar Vistoria de Técnico]
   banner: nenhum (estado "verde", pronto pro aceite final)

B) AGUARDA_INSTALACAO_TECNICA
   modalidade=autovistoria + exigeTecnica + sem rastreador + cadastro_aprovado=false
   ações: [Devolver ao Cadastro] + [Reprovar]
   banner: âmbar (mensagem atual)

C) FALTA_RASTREADOR_FISICO
   exigeTecnica + sem rastreador + serviço terminou em campo
   ações: [Solicitar Vistoria de Técnico] + [Reprovar]
   banner: vermelho

D) SERVICO_NAO_CONCLUIDO_EM_CAMPO
   serviço fora dos terminais positivos
   ações: [Reprovar] + link "Ver execução do serviço"
   banner: cinza
```

Regra cruzada: **Reprovar fica visível nos 4 sub-estados** (caminho de exceção sempre disponível). Aprovar aparece em A; Devolver em B; Solicitar Vistoria em A e C.

### 3. Reaproveitar `useAprovarInstalacaoMonitoramento` (sem novas edges)
A edge `aprovar-instalacao-monitoramento` já chama `ativar-associado` (lock + CAS + 409 quando falta rastreador). No estado A, o botão Aprovar invoca o mesmo fluxo — qualquer ausência de pré-requisito é barrada no servidor com mensagem clara. Isso é o que resolve TIB8F32 sem efeito colateral.

### 4. Telemetria
`console.log('[AprovacaoInstalacao] sub-estado', { servicoId, tipo, status, subEstado, exigeTecnica, temRastreador, cadastroAprovado, veiculoStatus })` na renderização das ações.

### 5. Atualizar memória canônica
Atualizar `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao` registrando:
- terminais positivos de campo = {concluida, aprovada, aprovada_ressalvas};
- Reprovar sempre visível;
- Monitoramento é o último aceite — Aprovar reaparece sempre que o serviço já terminou positivamente em campo.

### Fora de escopo
- Edge nova para "encerrar artefato" — desnecessária, Aprovar já resolve.
- Mexer em triggers de promoção/dedupe da fila.
- Auto-fechamento por cron.

### Arquivos previstos
- `src/lib/servicos/terminaisPositivos.ts` (novo, helper + constante)
- `src/pages/monitoramento/AprovacaoInstalacaoDetalhe.tsx` (máquina de 4 sub-estados, Reprovar sempre, Aprovar em A)
- `mem://logic/operations/monitoramento-guard-aprovacao-sem-instalacao.md` (atualizar)
