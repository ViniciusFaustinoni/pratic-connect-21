

## Plano: Assinatura do Laudo via Autentique como pre-requisito para aprovacao

### Contexto
Atualmente, quando o tecnico conclui a instalacao (`useAprovarVeiculoServico`), o sistema envia um link de assinatura simples via WhatsApp. O usuario quer que:
1. O sistema gere o Laudo PDF (ja existe: `gerar-laudo-vistoria`)
2. Envie esse PDF para assinatura via Autentique (nova funcionalidade)
3. Envie o link de assinatura do Autentique via WhatsApp ao associado
4. Somente apos o associado assinar o laudo no Autentique, o veiculo possa ser aprovado pelo tecnico ou analista

### Alteracoes

**1. Migracao SQL** — Adicionar colunas na tabela `servicos`
```sql
ALTER TABLE servicos ADD COLUMN laudo_autentique_id text;
ALTER TABLE servicos ADD COLUMN laudo_autentique_url text;
ALTER TABLE servicos ADD COLUMN laudo_assinado boolean DEFAULT false;
ALTER TABLE servicos ADD COLUMN laudo_assinado_em timestamptz;
ALTER TABLE servicos ADD COLUMN laudo_pdf_url text;
ALTER TABLE servicos ADD COLUMN laudo_pdf_assinado_url text;
```

**2. Nova Edge Function: `autentique-create-laudo`**
- Recebe: `servicoId`, `associadoId`, `veiculoId`, `laudoPdfUrl`
- Cria documento no Autentique com o PDF do laudo como anexo
- Signatario: associado (nome, email, telefone)
- Salva `laudo_autentique_id` e `laudo_autentique_url` no servico
- Retorna o link de assinatura

**3. Atualizar `autentique-webhook/index.ts`**
- Apos os fallbacks de contratos e sinistros, adicionar fallback para servicos
- Buscar `servicos` por `laudo_autentique_id = documento_id`
- Quando assinado: atualizar `laudo_assinado = true`, `laudo_assinado_em`, e `laudo_pdf_assinado_url`

**4. Atualizar `useAprovarVeiculoServico` em `src/hooks/useServicos.ts`**
- Apos concluir a instalacao (status `concluida`), invocar:
  1. `gerar-laudo-vistoria` para gerar o PDF
  2. `autentique-create-laudo` para enviar o PDF ao Autentique
- Enviar o link de assinatura do Autentique via WhatsApp (substituir o link atual `/acompanhar/:token` pelo link do Autentique)
- O servico fica com status `concluida` mas `laudo_assinado = false`

**5. Bloquear aprovacao ate laudo assinado**
- Em `src/hooks/useAprovacaoMonitoramento.ts` — ao listar servicos pendentes, exibir status "Pendente Assinatura do Laudo" quando `laudo_assinado = false`
- Em `src/pages/cadastro/PropostaAnalise.tsx` — se `laudo_assinado = false`, mostrar badge "Aguardando Assinatura do Laudo" e desabilitar botao de aprovacao
- Em `src/hooks/usePropostasPendentes.ts` — incluir `laudo_assinado` nos dados retornados
- Na interface `InstalacaoInfo`, adicionar campos `laudo_assinado`, `laudo_autentique_url`

**6. Polling para detectar assinatura do laudo**
- Em `AcompanhamentoProposta.tsx` e/ou na tela do tecnico: polling a cada 15s para verificar se `laudo_assinado` mudou para `true`
- Quando assinado, liberar fluxo de aprovacao

**7. UI na tela de propostas pendentes (cadastro)**
- Badge "Pendente Assinatura Laudo" em amarelo quando `laudo_assinado = false`
- Badge "Laudo Assinado" em verde quando `laudo_assinado = true`
- Botao "Aprovar" desabilitado enquanto laudo nao assinado, com tooltip explicativo

### Fluxo resumido
```text
Tecnico conclui instalacao
  → Sistema gera Laudo PDF (gerar-laudo-vistoria)
  → Sistema envia PDF ao Autentique (autentique-create-laudo)
  → WhatsApp enviado com link de assinatura Autentique
    → Associado abre link Autentique
      → Assina o laudo digitalmente
        → Webhook Autentique dispara
          → servicos.laudo_assinado = true
            → Fluxo de aprovacao liberado
              → Tecnico aprova OU analista de cadastro processa
```

### Arquivos criados/editados
- **Criar**: `supabase/functions/autentique-create-laudo/index.ts`
- **Criar**: Migracao SQL (colunas em servicos)
- **Editar**: `supabase/functions/autentique-webhook/index.ts` (fallback para servicos/laudo)
- **Editar**: `src/hooks/useServicos.ts` (gerar laudo + enviar Autentique pos-instalacao)
- **Editar**: `src/hooks/usePropostasPendentes.ts` (incluir laudo_assinado)
- **Editar**: `src/pages/cadastro/PropostaAnalise.tsx` (bloquear aprovacao)
- **Editar**: `src/pages/cadastro/PropostasPendentes.tsx` (badge de status)
- **Editar**: `src/pages/public/AcompanhamentoProposta.tsx` (mostrar status do laudo)

