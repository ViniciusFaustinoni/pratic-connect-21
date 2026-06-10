
## Diagnóstico (caso Everaldo / COT-20260609-140053334-121)

- Cotação `75aa835f-1348-4081-9c2d-b0a556c99d22`, Voyage 2010, **FIPE R$ 29.019** → **sub-FIPE** (`fn_veiculo_precisa_rastreador=false`), `cenario_adesao=isenta_rota` (adesão zerada).
- `dados_extras.via_vistoria_sub_fipe` está **ausente** — o cliente nunca abriu a etapa 5 (Vistoria) para escolher entre Via 1 (completa), Via 2 (R&F) ou Via 3 (sem fotos).
- Edge `confirmar-adesao-zerada` (linhas 169-177) devolve corretamente 409 `via_sub_fipe_nao_escolhida` — log já confirma: `WARNING [confirmar-adesao-zerada] bloqueado: via sub-FIPE não escolhida`.
- Causa raiz: o stepper de `src/pages/public/CotacaoContratacao.tsx` define ordem **Plano → Docs → Contrato → Pagamento(4) → Vistoria(5)**. Para sub-FIPE isenta isso é incoerente — não há pagamento real, mas a tela 4 exige o clique "Confirmar adesão isenta" que precisa de via, e a via só é escolhida na tela 5. O cliente bate na parede toda vez.
- Caso o cliente leia o erro e clique no passo 5, o gate pode bloquear: vistoria é mostrada como `isReachable` só até `maxReachableStep`; o stepper exige sequência. O texto pede para "voltar" mas o avanço para 5 nem sempre é navegável → loop "Tentar Novamente" → mesmo 409.

> Este é um padrão: **toda sub-FIPE isenta** cai aqui (não só Everaldo). Por isso o usuário pediu correção na raiz.

## Princípio canônico (project-knowledge)

O fluxo sub-FIPE manda:
1. Plano → 2. Docs → 3. Termo → 4. Pagamento (se houver) → **5. Autovistoria** → 6. Cadastro.

Quando a adesão é **isenta** o passo 4 deixa de ter pagamento real. Forçar o clique em "Confirmar adesão isenta" antes da escolha de via quebra a cronologia canônica do sub-FIPE — porque a escolha de via é um **pré-requisito** da confirmação isenta no backend.

## Plano de correção (mínimo, frontend-only no fluxo público)

### 1. Sub-FIPE isenta: trocar a ordem visual e funcional para `Plano → Docs → Contrato → Vistoria → Pagamento`

Em `src/pages/public/CotacaoContratacao.tsx`:

- Detectar sub-FIPE isenta de forma confiável (`cenario_adesao IN ('isenta_rota','isenta_base')` **E** `fn_veiculo_precisa_rastreador=false`, consultado via RPC já existente; cachear em estado).
- Quando `subFipeIsenta === true`:
  - `STEPS[3]` passa a ser **Vistoria** e `STEPS[4]` passa a ser **Pagamento** (rótulos e descrições trocados).
  - `navOrder` muda para `[0,1,2,4,3,5]` (mantendo índices internos para não quebrar os blocos `case` que renderizam cada etapa).
  - `etapaDoStatus` passa Vistoria a contar como "concluída" para liberar o passo Pagamento (que vira o último antes de Conclusão).
- Demais fluxos (adesão acima da FIPE, troca de titularidade, sub-FIPE com pagamento real) ficam na ordem atual sem alteração.

### 2. Defesa em profundidade: tornar o passo 5 imediatamente alcançável em sub-FIPE isenta mesmo na ordem antiga

Independentemente da troca de ordem (caso de cotações já avançadas onde o swap não dispara), elevar `maxReachableStep` para incluir o índice da Vistoria assim que o contrato estiver assinado em sub-FIPE isenta. Isso destrava o clique direto no passo 5 a partir do erro mostrado.

### 3. Tela de Pagamento — auto-redirect amigável

`EtapaPagamentoCotacao` (ou o branch case 3 em `CotacaoContratacao`) detecta o cenário sub-FIPE isenta sem via escolhida ANTES de chamar `confirmar-adesao-zerada`:
- Em vez de chamar o edge e mostrar `Erro ao processar`, mostra um card "Antes de confirmar a adesão, escolha como será sua vistoria" com um botão `Ir para a etapa Vistoria` que executa `setEtapaAtual(4)`.
- Mantém o gate do edge intacto (defesa de servidor preservada para clientes antigos / chamadas direta).

### 4. Saneamento de Everaldo (operacional, não-código)

Não há dado para sanear no banco (a cotação está consistente, só falta o cliente escolher via). O próprio fix do passo 3 já desbloqueia. Não precisamos tocar em registros.

### 5. Memória

Atualizar `mem://logic/operations/sub-fipe-gates-canonicos` com nota:
> Sub-FIPE **isenta** segue ordem `Vistoria → Pagamento` no link público, invertendo a ordem padrão `Pagamento → Vistoria`. Sem isso, `confirmar-adesao-zerada` devolve 409 `via_sub_fipe_nao_escolhida` em loop. Defesa adicional: `EtapaPagamentoCotacao` redireciona para Vistoria antes de chamar o edge quando detecta sub-FIPE isenta sem `via_vistoria_sub_fipe`.

## Não-objetos

- Não alterar a ordem para fluxos não-isentos (acima da FIPE / troca / sub-FIPE com cobrança).
- Não mexer em `confirmar-adesao-zerada` nem em `aprovar-proposta` — gates atuais são canônicos.
- Não tocar em registros do Everaldo no banco.

## Risco / blast radius

- Mudança escopo: somente `src/pages/public/CotacaoContratacao.tsx` e (opcional) `src/components/cotacao-publica/EtapaPagamentoCotacao.tsx`.
- Backend e edges inalterados.
- Demais cenários (adesão acima da FIPE, troca, substituição, sub-FIPE com adesão paga) usam o mesmo array `navOrder` atual — preservados.
