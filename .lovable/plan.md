

# Status Preciso do Associado — Redesign da View de Acompanhamento

## Problema Atual

A `view_acompanhamento` usa um CASE simples com apenas 7 fases genéricas:
- `documentacao`, `analise_cadastro`, `aprovado`, `instalacao_agendada`, `instalacao_concluida`, `ativacao_pendente`, `ativo`

Isso não diferencia cenários reais como: "enviando fotos de vistoria", "vistoria em análise pelo monitoramento", "aguardando pagamento da adesão", "contrato pendente de assinatura", etc.

## Solução

Reescrever a view e o frontend para suportar **12 fases granulares** que refletem exatamente o que está acontecendo:

| Fase | Descrição visível |
|---|---|
| `cotacao_pendente` | Link de cotação enviado, aguardando cliente |
| `documentacao_pendente` | Aguardando envio de documentos |
| `documentacao_analise` | Documentos em análise pelo monitoramento |
| `vistoria_pendente` | Vistoria ainda não agendada |
| `vistoria_agendada` | Vistoria agendada (data X) |
| `vistoria_analise` | Fotos enviadas, análise em andamento |
| `pagamento_pendente` | Aguardando pagamento da adesão |
| `contrato_pendente` | Contrato gerado, aguardando assinatura |
| `contrato_assinado` | Contrato assinado, próximo passo |
| `instalacao_agendada` | Instalação agendada |
| `instalacao_andamento` | Instalador em rota ou executando |
| `ativo` | Associado totalmente ativo |

## Alterações

### 1. SQL — Recriar `view_acompanhamento` (migração)

Nova lógica CASE mais granular cruzando dados de:
- `cotacoes_publicas` (status da cotação pública do lead)
- `documentos` (pendente/em_analise/aprovado)
- `vistorias` tipo='entrada' (status da vistoria de entrada)
- `contratos` (adesao_paga, status, data_assinatura)
- `instalacoes` (agendada, em_rota, em_andamento, concluida)
- `associados` (status final)

A prioridade do CASE segue a ordem reversa: verifica primeiro se já está ativo, depois instalação, depois contrato, etc.

### 2. Frontend — `src/pages/vendas/Acompanhamento.tsx`

- Expandir `ETAPAS_ATIVACAO` de 6 para ~9 colunas visuais (agrupando fases relacionadas)
- Atualizar `FASE_TO_ETAPA` para mapear as 12 fases do banco para as colunas visuais
- Adicionar ícones e cores diferenciadas para cada sub-fase

### 3. Frontend — `src/hooks/useAcompanhamento.ts`

- Expandir interface `AcompanhamentoItem` com campos extras da view (cotacao_status, vistoria_status, contrato_status, etc.) para exibir detalhes contextuais nos cards

### Detalhes técnicos — Nova lógica do CASE na view

```text
Prioridade (de baixo para cima):
1. a.status = 'ativo' → 'ativo'
2. i.status IN ('em_rota','em_andamento') → 'instalacao_andamento'
3. i.status IN ('agendada','reagendada') → 'instalacao_agendada'
4. c.data_assinatura IS NOT NULL → 'contrato_assinado'
5. c.id IS NOT NULL AND c.data_assinatura IS NULL → 'contrato_pendente'
6. c.adesao_paga = false AND c.id IS NOT NULL → 'pagamento_pendente'
7. vis.status = 'em_analise' → 'vistoria_analise'
8. vis.status IN ('agendada','em_rota','em_andamento') → 'vistoria_agendada'
9. a.status = 'pendente_vistoria' → 'vistoria_pendente'
10. docs em_analise exist → 'documentacao_analise'
11. docs pendente/reprovado exist → 'documentacao_pendente'
12. cp.status IS NOT NULL AND cp.status NOT IN ('aprovado','expirado','cancelado') → 'cotacao_pendente'
13. default → 'documentacao_pendente'
```

A view também passará a incluir leads em etapas anteriores (`cotacao_enviada`, `negociacao`, `vistoria_agendada`, `contrato_enviado`) para capturar o pipeline completo.

