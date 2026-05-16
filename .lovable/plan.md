## Auditoria — fila Monitoramento › Aprovação de Associados

Levantamento direto na tabela `servicos` (`tipo IN ('vistoria_entrada','instalacao')`, `status='concluida'`, `contratos.cadastro_aprovado=true`) mostra **16 cards** com 3 patologias:

| # | Associado | Veículo | FIPE | Patologia |
|---|---|---|---|---|
| 1 | **CAIO HERCULANO** (moto) | HONDA CG 160 START | R$ 18.878 (>9k → exige rastreador) | Autovistoria órfã: `vistoria_entrada` (autovistoria) `concluida` + R/F liberado, **sem instalação técnica** (a única instalação está `cancelada`). Aparece como aprovação final. |
| 2 | **FRANCISCO ERIVALDO** | Yamaha XTZ 250 | R$ 27.948 | Idêntico ao Caio: zero instalação. |
| 3 | **RIAN SANTOS** | HONDA CG 160 FAN | R$ 19.993 | Aparece **2×** (autovistoria + agendada_base), zero instalação. |
| 4 | **ROMARIO ROCHA** | Ford Ecosport | R$ 68.956 | Aparece **2×**: instalação técnica concluida + vistoria_entrada de autovistoria concluida. Duplicata. |
| 5 | **ICARO** (moto) | HONDA PCX 160 | R$ 21.627 | Aparece **2×**: autovistoria + `instalacao` `dispensa_rastreador=true` (instalação fictícia, indevida acima da FIPE). |
| 6 | André, Eduardo, Cláudia, Bruno, Thaís, Felipe | carros ≥30k | — | Caso correto: instalação técnica concluída → fila legítima. |

### Causa raiz única

`aprovar-proposta` promove **qualquer** `vistoria_entrada` de autovistoria para `status='concluida'`. Para **sub-FIPE** está certo (autovistoria É o artefato final). Para **acima da FIPE**, o manual diz que a autovistoria só serve para **antecipar R/F** — não substitui a instalação técnica. Como nada distingue os dois ramos, o serviço vai para a fila final indevidamente e gera, em sequência: cards travados, duplicatas quando a instalação real acontece depois, e em alguns casos uma `instalacao` fictícia com `dispensa_rastreador=true`.

---

## Plano de correção raiz

### 1. Edge `aprovar-proposta` — ramificar autovistoria por uso

Adicionar, ao aprovar o Cadastro, detecção `veiculoPrecisaRastreador` (FIPE × tipo × diesel, mesma lógica de `precisaRastreador`/`finalizar-autovistoria-cotacao`):

```
if (autovistoria && precisaRastreador) {
  // Acima da FIPE — autovistoria foi APENAS para antecipar R/F.
  // Libera R/F (cobertura_roubo_furto=true) + cadastro_aprovado=true (já fazem).
  // NÃO promove servico para 'concluida'. Marca como 'aprovada' (encerrada),
  // saindo da fila final. Veículo segue 'instalacao_pendente' aguardando
  // agendamento de instalação técnica via link público.
  UPDATE servicos SET status='aprovada', concluida_em=now()
  // Nunca cria instalacao com dispensa_rastreador=true neste ramo.
}
else if (autovistoria && !precisaRastreador) {
  // Sub-FIPE — comportamento atual: promove para 'concluida' (vai p/ fila).
}
```

### 2. Hook `useInstalacoesAguardandoAprovacao` — dedupe defensivo

- Se existe `servicos.tipo='instalacao' status='concluida'` no contrato, **excluir** qualquer `vistoria_entrada` de modalidade `autovistoria` do mesmo contrato.
- Excluir `vistoria_entrada` de autovistoria quando o veículo **precisa de rastreador** E não há `instalacao concluida` no contrato (significa que falta a instalação técnica — não é aprovação final).

### 3. Backfill via migration (one-shot)

- **Icaro**: cancelar a `instalacao` fictícia `a94dcfbd-…` (`dispensa_rastreador=true` acima da FIPE) e o servico de instalação correlato; marcar a `vistoria_entrada` da autovistoria como `aprovada` (preserva R/F já liberado).
- **Romario**: marcar a `vistoria_entrada` da autovistoria como `aprovada`; mantém a instalação técnica concluida na fila como única fonte.
- **Caio / Francisco / Rian**: marcar a(s) `vistoria_entrada` de autovistoria como `aprovada` (preserva R/F). Veículo permanece `instalacao_pendente`, contrato `cadastro_aprovado=true`; o link público continua exibindo o passo de agendamento de instalação, que materializa `instalacao` via `criar-instalacao-pos-pagamento` quando o associado escolher data. Nada de instalação síncrona criada no backfill.
- Nenhuma cobertura é perdida (R/F já está em `cobertura_roubo_furto=true` em todos).

### 4. Memory

Criar `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria` consolidando: autovistoria opcional acima da FIPE → marca servico como `aprovada`, não `concluida`; nunca cria instalação com `dispensa_rastreador=true`; fila final só recebe instalação técnica. Cross-reference em `mem://logic/operations/autovistoria-dois-usos`.

### Arquivos alterados

- `supabase/functions/aprovar-proposta/index.ts`
- `src/hooks/useAprovacaoMonitoramento.ts`
- `supabase/migrations/<ts>_backfill_autovistoria_acima_fipe.sql`
- `mem://logic/operations/autovistoria-acima-fipe-libera-rf-nao-conclui-vistoria.md` + atualização do index e do `autovistoria-dois-usos`

### Validação pós-correção (admin@teste.com)

1. Fila Monitoramento › Aprovação de Associados deve mostrar apenas os 6 cards com instalação técnica concluída (André, Eduardo, Cláudia, Bruno, Thaís, Felipe).
2. Caio / Francisco / Rian saem da fila; link público mostra "Aguardando agendamento de instalação".
3. Romario e Icaro aparecem **1× cada** (instalação técnica concluida).
4. Para uma nova cotação acima da FIPE com autovistoria opcional: após aprovação do Cadastro o card sai da fila final, R/F fica liberado, e o veículo aguarda agendamento de instalação técnica como manda o manual.
5. Para uma nova cotação sub-FIPE: comportamento atual preservado (vai para a fila final do Monitoramento).
