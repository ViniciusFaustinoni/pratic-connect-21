

## O que aconteceu com a proposta LSP3E65 (CTR-20260417124855-MF0CWF)

**Cliente:** WILLIAM DO CARMO DA SILVA — Honda XRE 300, placa LSP3E65

### Linha do tempo real (do banco)

| Hora (17/04) | Evento |
|---|---|
| 12:48:55 | Contrato criado a partir da cotação COT-20260417-093916772-294 |
| 12:49:03 | Status `rascunho → pendente_assinatura` (envio Autentique) |
| 13:35:58 | Cliente visualizou o documento |
| 13:38:42 | Cliente assinou (Autentique, e-mail williamsilvacarmoo@gmail.com) |
| **17:55:22** | **Diretor aprovou a proposta** (`aprovado_em`, `aprovado_por=37beadcf...`) |
| 17:55:23 | Status `assinado → ativo` |

### Estado atual no banco

- `contratos.status = ativo` ✅
- `autentique_status = signed` ✅
- `aprovado_em = 17:55:22` ✅
- `data_ativacao = 17:55:22` ✅
- `adesao_paga = true` ✅
- Associado `b10ad945-...` está `ativo` ✅
- Veículo `LSP3E65` está `ativo` ✅

**Conclusão: a aprovação foi processada com sucesso. O cadastro está concluído. Não houve falha no backend.**

### O que o usuário viu (e por que parece "travada")

A tela de Aprovação Final (`PropostaApprovalStepper`, etapa 3) só renderiza os botões "Aprovar Proposta / Solicitar Documentos / Reprovar" quando `podeAprovar === true`.

`podeAprovar` é definido em `src/pages/cadastro/PropostaAnalise.tsx` linha 85:
```ts
const podeAprovar = proposta?.status === 'assinado' && !proposta?.tem_documento_pendente;
```

Como o contrato já está `ativo` (não `assinado`), os botões somem — **mas a tela não exibe nenhuma mensagem dizendo "já aprovado"**. Resultado visual: Resumo mostra tudo "Concluído" mas não aparece nenhuma ação. Parece travado.

Provável fluxo do usuário: clicou em "Aprovar Proposta" às 17:55, aprovação processou, mas a navegação automática (`navigate('/cadastro/propostas')`) não ocorreu por algum motivo (clique no Voltar do navegador, refresh, ou o `setShowConfirmAprovar(false)` que disparou um re-render), e ele ficou na URL detalhada vendo um estado pós-aprovação sem feedback.

### Correção proposta (UX)

Em `src/pages/cadastro/PropostaAnalise.tsx` + `PropostaApprovalStepper.tsx`:

1. Quando `proposta.status === 'ativo'` (já aprovado), exibir um **banner verde de sucesso** no topo:
   > "Proposta já aprovada em 17/04/2026 às 17:55 por [Aprovador]. Cadastro concluído."
   
   Com botão **"Ver associado"** (vai para `/cadastro/associados/{associado_id}`) e **"Voltar para lista"**.

2. No stepper (etapa 3), substituir os botões de ação por uma mensagem de estado final quando `status === 'ativo'`, `cancelado` ou `reprovado` — em vez de simplesmente esconder os botões.

3. Garantir que `useProposta` redirecione automaticamente para a lista quando o status não for mais `assinado` (opcional — pode fazer apenas o item 1 para manter rastreabilidade).

### Arquivos a editar

- `src/pages/cadastro/PropostaAnalise.tsx` — adicionar banner de "já aprovado" + buscar nome de quem aprovou.
- `src/components/cadastro/proposta/PropostaApprovalStepper.tsx` — exibir estado final quando `!podeAprovar` por motivo de já estar aprovado/reprovado/cancelado.

### Validação

1. Abrir `/cadastro/propostas/d96300ef-9c49-4b3b-9e14-47197098ccbc` → deve mostrar banner verde "Proposta aprovada em 17/04 17:55" com botão para ver o associado.
2. Abrir uma proposta ainda `assinado` → fluxo normal de aprovação inalterado.
3. Após aprovar uma proposta nova, navegação para próxima/lista continua funcionando.

### Resultado

A "proposta LSP3E65" **não tem problema** — está aprovada e o associado está ativo. O bug é puramente visual: a tela de análise não comunica o estado pós-aprovação quando o usuário volta a ela.

