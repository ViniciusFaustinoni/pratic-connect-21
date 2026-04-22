

## Troca de Titularidade — fluxo completo (cotação + dupla aprovação)

### Estado atual

- Existe `TrocaTitularidadeDialog` antigo que apenas cria registro em `chat_solicitacoes_ia` e a função `efetivar-troca-titularidade` cria associado/contrato direto. **Não há cotação pública, dupla aprovação, nem termo de cancelamento Autentique.**
- Vou substituir o fluxo legado mantendo o histórico antigo intocado.

### Fluxo ponta a ponta

```text
[Atendente] abre Troca de Titularidade do associado A
        │
        ▼
Cria solicitacao_troca_titularidade (status=cotacao_em_andamento)
+ cria cotação comum (tipo_entrada='troca_titularidade')
        │
        ▼
[Atendente] preenche cotação → gera link público /cotacao/:token
        │
        ▼
[Novo Titular] escolhe plano, envia docs até passo de assinatura
       Sistema NÃO gera contrato. Mostra "Em análise — aguarde"
       (status=aguardando_cadastro)
        │
        ▼
[Sistema] dispara Autentique → Termo de Cancelamento ao A (email)
        │
        ▼
[Associado A] assina termo (webhook marca assinado)
        │
        ▼
[Analista Cadastro] /relacionamento/troca-titularidade
   Modal: dados, docs, financeiro/adimplência do A, termo assinado
   Botões Aprovar / Reprovar
        │
   ┌────┴────┐
   ▼         ▼
Reprovar   Aprovar (→ aguardando_monitoramento)
   │         │
   │         ▼
   │   [Coord. Monitoramento] /monitoramento/aprovacoes
   │   Botões: Aprovar | Solicitar Vistoria
   │         │
   │   ┌─────┴─────┐
   │   ▼           ▼
   │ Aprova    Cria serviço vistoria_entrada
   │ direto    (aguardando_vistoria)
   │   │           │
   │   │     vistoria concluída
   │   └───────────┘
   │         ▼
   │   liberada_para_assinatura
   │   Tela pública atualiza (realtime) → assinatura → autovistoria → pagamento
   ▼
reprovada (cadastro ou monitoramento)
   • Tela pública mostra reprovação
   • WhatsApp Meta notifica A
   • Solicitação vai para aba "Recusadas"
```

### Banco

**Nova tabela `solicitacoes_troca_titularidade`**: associado_antigo_id, veiculo_id, cotacao_id, novo_titular_dados (jsonb), novo_associado_id, status (enum), termo_cancelamento_autentique_id, termo_cancelamento_assinado_em, termo_cancelamento_url, aprovado_cadastro_por/em, aprovado_monitoramento_por/em, servico_vistoria_id, motivo_reprovacao, reprovado_por/em, token_publico (unique), created_at/updated_at/criado_por.

Enum status: `cotacao_em_andamento | aguardando_cadastro | aguardando_monitoramento | aguardando_vistoria | liberada_para_assinatura | efetivada | reprovada_cadastro | reprovada_monitoramento | cancelada`.

RLS: associado antigo SELECT própria; cadastro (`canManageAssociados`) full; coord monitoramento full; anônimo SELECT via `token_publico`. Realtime habilitado.

Trigger no `servicos`: ao concluir vistoria vinculada → atualiza solicitação para `liberada_para_assinatura`.

### Frontend

| Arquivo | Mudança |
|---|---|
| `TrocaTitularidadeDialog.tsx` (existente) | Reescrito: cria solicitação v2 + cotação base + redireciona pra edição da cotação |
| `App.tsx` | + rotas `/relacionamento/troca-titularidade` e `/monitoramento/aprovacoes` |
| `AppSidebar.tsx` | + 2 itens (Troca em Relacionamento, Aprovações em Monitoramento) |
| `CotacaoContratacao.tsx` (público) | Detectar `tipo_entrada=troca_titularidade`; gatear assinatura por status |

**Novos arquivos:**
- `src/pages/relacionamento/TrocaTitularidade.tsx` — abas Pendentes/Aguardando Monit./Em Vistoria/Aprovadas/Recusadas
- `src/pages/monitoramento/AprovacoesTroca.tsx` — Aprovar | Solicitar Vistoria
- `src/components/troca-titularidade/ModalDetalhesTroca.tsx` — modal compartilhado
- `src/components/troca-titularidade/RelatorioFinanceiroAntigo.tsx` — boletos + adimplência
- `src/components/troca-titularidade/TimelineAprovacao.tsx`
- `src/components/troca-titularidade/TelaAnaliseTrocaTitularidade.tsx` — tela pública aguardando
- `src/hooks/useSolicitacaoTrocaPublica.ts` — realtime via publicClient
- `src/hooks/useSolicitacoesTroca.ts` — hooks internos

### Edge Functions

- **Nova `criar-solicitacao-troca-titularidade`** — cria solicitação + cotação base
- **Nova `enviar-termo-cancelamento-troca`** — Autentique email + PF_FACIAL para A
- **Nova `aprovar-troca-cadastro`** / **`aprovar-troca-monitoramento`** / **`reprovar-troca-titularidade`** — validam papel, atualizam status, disparam WhatsApp Meta + email
- **Alterar `autentique-webhook`** — capturar assinatura do termo de cancelamento da troca
- **Alterar `efetivar-troca-titularidade`** — chamada após pagamento confirmado, cria associado novo do snapshot da cotação aprovada

### Templates Meta WhatsApp (a criar)

- `troca_titularidade_solicitada`
- `troca_titularidade_termo_pendente`
- `troca_titularidade_aprovada`
- `troca_titularidade_reprovada`

UTILITY com CTA URL para `https://app.praticcar.org/cotacao/{{1}}` ou `/relacionamento/troca-titularidade/{{1}}`.

### Critérios de aceitação

1. Atendente inicia troca → cria cotação vinculada → gera link público
2. Novo titular escolhe plano e envia docs; ao chegar na assinatura vê "Em análise"
3. Antigo recebe email Autentique do termo de cancelamento
4. Cadastro vê em `/relacionamento/troca-titularidade` com docs, financeiro, adimplência, termo
5. Reprovar → tela pública mostra reprovação + WhatsApp ao antigo + aba Recusadas
6. Aprovar cadastro → aparece em `/monitoramento/aprovacoes`
7. Coord aprova → tela pública libera assinatura imediatamente (realtime)
8. Coord pede vistoria → cria serviço; ao concluir libera assinatura
9. Após assinatura+pagamento → cria associado novo + contrato (efetiva)
10. Sidebar mostra os 2 novos itens

### Fora de escopo

- Reescrever a aba antiga `Titularidade` em `/cadastro/processos-operacionais` (mantida read-only de histórico)
- Migrar solicitações antigas
- Múltiplos veículos numa mesma troca (1:1)

