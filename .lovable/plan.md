## Diagnóstico — o que o PDF revela

O PDF anexado é a retificação v1 emitida hoje. Mesmo com a Fase 1 (template + cascade fallback) já em produção, o termo ainda está incompleto:

1. **Checkbox saiu vazio**: `(X) Subs. Placa (o veíc. terá a cob. do PSM cancelada)` — sem nenhuma placa depois. O token `{{substituicao.placa_anterior}}` resolveu para string vazia/`—` na retificação.
2. **Bloco "DADOS DO VEÍCULO"** mostra só **LTP7C50** (novo). Não há nenhuma seção do veículo **substituído** (RJN2A96). O associado assina sem ciência clara de qual carro está sendo cancelado.

O que o usuário quer (canônico): o termo precisa exibir, lado a lado e de forma inequívoca, **dois blocos**: veículo que sai (cancelado) e veículo que entra (novo).

---

## Fase A — Desbloquear o Patrick (operacional)

Sequência:

1. **Investigar por que a retificação v1 saiu sem `placa_anterior`** — ler edge `retificar-termo-filiacao` e confirmar se ela chama o mesmo helper de cascade usado em `autentique-create` (suspeita: a retificação reusa `templateData` salvo originalmente, sem repassar pelos novos fallbacks). Corrigir se for o caso.
2. **Atualizar o template SUB** (passo da Fase B abaixo) — só depois é seguro reemitir, senão sai outro termo errado.
3. **Reemitir retificação v2 do Patrick** chamando `retificar-termo-filiacao` novamente com o template já corrigido. v1 fica histórica.
4. Verificar PDF gerado: chassi/placa anterior visíveis, novo veículo visível, ambos rotulados.

Sem mexer em `contratos.veiculo_id`, `substituicoes_veiculo` ou `cotacoes` — dados já estão corretos.

---

## Fase B — Raiz: template + edges

### B1. Template `documento_templates` codigo='SUB'

Migração ajustando `conteudo`:

- **Cláusula do checkbox**: trocar para texto explícito mesmo com fallback vazio:
  > `(X) Subs. Placa — veículo {{substituicao.placa_anterior}} ({{substituicao.modelo_anterior}}) terá a cobertura do PSM cancelada`
- **Novo bloco antes de "DADOS DO VEÍCULO"** (só renderiza em substituição, controlado por sentinela `OPT_VAZIO` já existente):
  ```
  VEÍCULO SUBSTITUÍDO (Cobertura Cancelada)
  ┌─────────────┬──────────────────────────┐
  │ Placa:      │ {{substituicao.placa_anterior}}
  │ Marca/Modelo│ {{substituicao.modelo_anterior}}
  │ Valor FIPE: │ {{substituicao.fipe_anterior}}
  └─────────────┴──────────────────────────┘
  ```
- **Renomear** o bloco existente "DADOS DO VEÍCULO" para "**VEÍCULO NOVO (Substituto)**" no template SUB (só esse template — não toca AF1).

### B2. Edges Autentique + retificação

Em `_shared/template-utils.ts` + `autentique-create` + `autentique-create-by-token` + `retificar-termo-filiacao`:

- Garantir que o helper de cascade (Fase 1) também alimente:
  - `substituicao.modelo_anterior` (de `cotacoes.dados_extras.veiculo_antigo_modelo` → `solicitacoes_substituicao_placa.veiculo_antigo_snapshot.modelo` → `veiculos.marca + modelo`)
  - `substituicao.fipe_anterior` (mesma cascade, com `formatCurrency`)
- **`retificar-termo-filiacao`**: forçar reexecução do cascade a partir de `cotacao_id`/`contrato_id` em vez de reutilizar `dados_utilizados` antigos. Esse é provavelmente o motivo da v1 do Patrick ter saído vazia.
- Sentinela `OPT_VAZIO`: continuar suprimindo `<tr>` quando os 3 campos vierem vazios (ex: contrato não-substituição).

### B3. Atualizar memória

`mem://logic/documents/termo-substituicao-placa-anterior-canonico` — incluir:
- Novos tokens (`modelo_anterior`, `fipe_anterior`) e o bloco "VEÍCULO SUBSTITUÍDO" canônico.
- Regra de que `retificar-termo-filiacao` SEMPRE reexecuta o cascade, nunca reutiliza payload antigo.

---

## Não-objetivos

- Não alterar template AF1 (adesão comum) nem outros.
- Sem saneamento em massa de outros contratos de substituição históricos (se aparecer caso novo, retificar individualmente).
- Sem mudança em fluxo de Substituição no front (`SubstituicaoStatusCard`, `StepConclusao` etc.) — já leem direto de `substituicoes_veiculo`.

## Risco

- Crédito Autentique: +1 doc PF_FACIAL para reemitir Patrick v2.
- Se o associado já assinou v1, v2 prevalece (padrão canônico `contrato_retificacoes` já em uso).
