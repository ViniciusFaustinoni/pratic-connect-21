## Diagnóstico do fluxo atual (Troca de Titularidade pós-assinatura do termo de cancelamento)

Levantamento direto do código:

| Etapa | Hoje | Problema |
|---|---|---|
| Termo de cancelamento assinado (Autentique webhook) | Solicitação vai para `aguardando_cadastro` | ✅ correto |
| Novo titular acessa link público | `trocaLiberada` em `CotacaoContratacao.tsx` (linha 208) considera **liberado** se houver `termo_cancelamento_assinado_em`, mesmo em `aguardando_cadastro`. Comentário diz "cadastro é auto-aprovado por vincular-cotacao-troca" — mas a edge **não auto-aprova mais** (memória `troca-titularidade-cadastro-auto`). | ❌ Comentário/lógica desatualizada. Cliente segue Plano → Docs → Contrato → Autovistoria sem o Cadastro nunca olhar. |
| Autovistoria concluída | Trigger `fn_troca_promover_monitoramento_pos_vistoria` promove `liberada_para_assinatura`/`aguardando_vistoria` → `aguardando_monitoramento`. **NÃO reage a `aguardando_cadastro`** — porém a solicitação está justamente em `aguardando_cadastro` quando a vistoria roda no novo fluxo. | ❌ Cadastro é "pulado": ou trigger promove direto, ou solicitação fica órfã em `aguardando_cadastro` enquanto a cotação avança sozinha. |
| Cadastro aprova | `aprovar-troca-cadastro` envia direto para `liberada_para_assinatura` (pula Monitoramento). | ❌ Inverte a hierarquia que o usuário descreveu (Cadastro → Monitoramento). |
| Monitoramento (Aprovar / Solicitar vistoria / Agendar manutenção) | `aprovar-troca-monitoramento` já cobre as 3 ações. Botões existem em `ModalDetalhesTroca`. | ✅ funcional, só precisa entrar na ordem certa. |
| Após vistoria adicional pedida pelo Monitoramento | Trigger devolve para `aguardando_monitoramento`. | ✅ correto. |
| Cron de expiração à meia-noite | `cron-expirar-trocas-titularidade` cancela veículo + cotação + WhatsApp; novo titular precisa nova cotação. | ✅ correto. |

## Fluxo alvo (acordado com o usuário)

```text
Termo cancelamento assinado
        │
        ▼
aguardando_cadastro  ◄── novo titular acessa link público
        │              executa: Plano → Docs → Contrato → AUTOVISTORIA
        │              (Pagamento fica TRAVADO até Monitoramento liberar)
        ▼
[autovistoria concluída]  fotos + docs prontos para análise
        │
        ▼
Cadastro analisa em /cadastro/processos?tab=titularidade
        │
        ├── Reprova ──► reprovada_cadastro (fim)
        │
        └── Aprova ──► aguardando_monitoramento
                                │
                                ▼
                Monitoramento decide:
                  ├─ Aprovar ──────────────────► liberada_para_assinatura → Pagamento → efetivada
                  ├─ Solicitar vistoria ───────► aguardando_vistoria
                  │      (link atualiza para agendamento OU autovistoria extra)
                  │      vistoria concluída ──► aguardando_monitoramento (loop)
                  └─ Agendar manutenção ──────► aguardando_manutencao
                         manutenção concluída ► aguardando_monitoramento

Se passar 23:59:59 BRT do dia da assinatura sem termo de filiação assinado
   → cron expira: solicitação=expirada, veículo=cancelado, cotação=recusada,
     link público mostra "Solicitação expirada — exigir nova cotação".
```

## Mudanças propostas

### 1. Edge `vincular-cotacao-troca/index.ts`
- Manter sem auto-aprovação (já está). Atualizar comentário só por higiene.

### 2. Tela pública `src/pages/public/CotacaoContratacao.tsx`
- Reescrever `trocaLiberada`:
  - Liberar **navegação até a Autovistoria** quando `termo_cancelamento_assinado_em` existir e status ∈ {`aguardando_cadastro`, `aguardando_monitoramento`, `aguardando_vistoria`, `aguardando_manutencao`, `liberada_para_assinatura`, `efetivada`}.
  - Bloquear etapa **Pagamento** enquanto status ≠ `liberada_para_assinatura` / `efetivada`. Mostrar `TelaAnaliseTrocaTitularidade` no lugar com mensagem "Aguardando aprovação do Cadastro/Monitoramento" baseada no status real.
- Atualizar o comentário da linha 205.

### 3. Trigger `fn_troca_promover_monitoramento_pos_vistoria` (nova migration)
- **Não promover direto para `aguardando_monitoramento`**. Em vez disso:
  - Se solicitação está em `aguardando_cadastro` → manter `aguardando_cadastro` mas marcar uma flag (ex.: `vistoria_pronta_para_cadastro=true` ou `autovistoria_concluida_em=now()`) — Cadastro vê na fila com badge "Autovistoria concluída — pronta para análise".
  - Se solicitação está em `aguardando_vistoria` (vistoria pedida pelo Monitoramento, modalidade autovistoria) → promover para `aguardando_monitoramento` (comportamento atual).
- Adicionar coluna `autovistoria_concluida_em timestamptz` em `solicitacoes_troca_titularidade`.

### 4. Edge `aprovar-troca-cadastro/index.ts`
- Trocar destino de `liberada_para_assinatura` para `aguardando_monitoramento`.
- Pré-checagem: bloquear aprovação se `autovistoria_concluida_em IS NULL` (cadastro só aprova depois das fotos).
- Atualizar `useAprovarTrocaCadastro` (toast: "enviada ao Monitoramento").

### 5. Tela `src/pages/cadastro/ProcessosOperacionais.tsx` + `ModalDetalhesTroca`
- Subaba "Aguardando Cadastro" passa a mostrar badge **"Autovistoria concluída"** (verde) vs **"Aguardando autovistoria"** (cinza). Botão "Aprovar/Reprovar" só habilita quando concluída.
- Modal Cadastro: adicionar bloco com fotos da autovistoria + documentos (CNH/CRLV/comprovante) usando o mesmo padrão da fila de Monitoramento (reaproveitar `useServicoDetalheAprovacao` ou query equivalente baseada em `vistoria_origem_id`).

### 6. Tela `ModalDetalhesTroca` (modo Monitoramento)
- Já tem os 3 botões (Aprovar / Solicitar vistoria / Agendar manutenção). Conferir que aparecem apenas em `aguardando_monitoramento`. Adicionar/realçar botão "Solicitar manutenção de rastreador" se hoje estiver oculto.

### 7. Backfill (migration)
- Solicitações hoje em `liberada_para_assinatura` que NÃO têm `aprovado_monitoramento_em` voltam para `aguardando_monitoramento` (corrige presas pelo fluxo antigo).
- Solicitações em `aguardando_cadastro` com vistoria já em `em_analise/concluida/aprovada` recebem `autovistoria_concluida_em = updated_at` para aparecerem prontas na fila.

### 8. Memória
- Atualizar `mem://logic/operations/troca-titularidade-monitoramento-pos-vistoria`: novo fluxo é **Cadastro → Monitoramento** com Cadastro analisando depois da autovistoria; trigger não promove mais `aguardando_cadastro`.
- Atualizar `mem://logic/operations/troca-titularidade-cadastro-auto`: cadastro continua manual; aprovar agora envia para Monitoramento (não mais para `liberada_para_assinatura`).

## Fora de escopo
- Mudar set canônico de fotos da autovistoria (segue 2 fotos + 360°).
- Cron de expiração (já está correto).
- Tela `AprovacoesTroca` do Monitoramento (mantém comportamento — só passa a receber casos pós-cadastro).
- Etapa Pagamento (mantém regra atual; só ganha bloqueio condicional).
