

## Plano: Aprovação Dupla da Diretoria para FIPE Acima do Limite

### Resumo
Quando uma cotação ultrapassar o limite FIPE, o sistema notificará todos os diretores via WhatsApp (template Meta) com os dados completos. A resposta do diretor (sim/nao) será interpretada pelo webhook. Com 2+ aprovações, o veículo é liberado. Enquanto pendente, a etapa de assinatura fica bloqueada com aviso genérico. Tudo é ativável/desativável na aba "Autorizações" das Regras de Venda.

### Alterações técnicas

**1. Migration: tabela `aprovacoes_fipe_diretoria`**
```sql
CREATE TABLE public.aprovacoes_fipe_diretoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid NOT NULL REFERENCES cotacoes(id) ON DELETE CASCADE,
  diretor_id uuid NOT NULL REFERENCES auth.users(id),
  telefone text,
  status text NOT NULL DEFAULT 'pendente', -- pendente, aprovado, recusado
  respondido_em timestamptz,
  created_at timestamptz DEFAULT now()
);
-- Unique para evitar voto duplicado
ALTER TABLE aprovacoes_fipe_diretoria ADD CONSTRAINT uq_cotacao_diretor UNIQUE (cotacao_id, diretor_id);
ALTER TABLE aprovacoes_fipe_diretoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Diretores veem aprovações" ON aprovacoes_fipe_diretoria
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'diretor'));
CREATE POLICY "Sistema insere" ON aprovacoes_fipe_diretoria
  FOR INSERT TO authenticated WITH CHECK (true);
```

Adicionar coluna na cotacoes:
```sql
ALTER TABLE cotacoes ADD COLUMN IF NOT EXISTS fipe_diretoria_aprovado boolean DEFAULT null;
-- null = sem necessidade, false = pendente, true = aprovado
```

Adicionar configuração:
```sql
INSERT INTO configuracoes (chave, valor) VALUES 
  ('dupla_aprovacao_fipe_diretoria_ativa', 'false'),
  ('dupla_aprovacao_fipe_minimo_votos', '2')
ON CONFLICT (chave) DO NOTHING;
```

**2. Nova aba na seção "Autorizações" do `RegrasVendaContent.tsx`**
- Switch: "Exigir dupla aprovação para veículos acima do limite FIPE"
- Campo numérico: "Mínimo de aprovações necessárias" (default: 2)
- Descrição explicativa
- Persiste nas chaves `dupla_aprovacao_fipe_diretoria_ativa` e `dupla_aprovacao_fipe_minimo_votos` na tabela `configuracoes`

**3. Edge Function `notificar-diretoria-fipe/index.ts`**
- Recebe: `cotacao_id`, dados do veículo/associado
- Busca todos os diretores com telefone na tabela `user_roles` + `profiles`
- Cria registros em `aprovacoes_fipe_diretoria` (1 por diretor)
- Envia template Meta `aprovacao_fipe_diretoria_v1` para cada diretor via `whatsapp-send-text`
- Template params: nome associado, marca/modelo/ano, placa, valor FIPE, categoria placa

**4. Template Meta `aprovacao_fipe_diretoria_v1`**
- Criar registro na tabela `whatsapp_meta_templates` com status `PENDING`
- Corpo: "Autorização necessária: Veículo {{1}} {{2}}/{{3}} placa {{4}} - FIPE R$ {{5}} (limite: R$ {{6}}). Associado: {{7}}. Responda APROVAR ou RECUSAR."
- Categoria: UTILITY
- O template será enviado para análise da Meta automaticamente

**5. Processar resposta do diretor no `whatsapp-meta-webhook`**
- Quando mensagem recebida de telefone de diretor contém "APROVAR/SIM/APROVADO" ou "RECUSAR/NAO/NEGADO":
  - Buscar `aprovacoes_fipe_diretoria` pendente para aquele telefone
  - Atualizar status do registro
  - Contar total de aprovações para a cotação
  - Se >= mínimo configurado: atualizar `cotacoes.fipe_diretoria_aprovado = true` e `cotacoes.fipe_limite_aprovado = true`
  - Se recusado por maioria: marcar como `false`
  - Responder ao diretor confirmando o voto

**6. Instrumentar `CotacaoFormDialog.tsx`**
- Após criar solicitação FIPE limite (já existente), se `dupla_aprovacao_fipe_diretoria_ativa === 'true'`:
  - Invocar `notificar-diretoria-fipe` passando dados da cotação
  - Setar `cotacoes.fipe_diretoria_aprovado = false` (pendente)

**7. Bloquear `EtapaAssinaturaContrato.tsx`**
- No início da etapa, verificar se cotação tem `fipe_diretoria_aprovado === false`
- Se sim, exibir Card com ícone Clock + "Aguardando aprovação interna. Você será notificado quando a análise for concluída."
- Bloquear geração/envio de contrato
- Polling a cada 15s para verificar mudança de status
- Sem mencionar "diretores"

**8. Hook `useAprovacoesFipeDiretoria.ts`**
- Query para verificar status de aprovação por cotação
- Usado pela EtapaAssinatura para polling

### Escopo
- 1 migration (nova tabela + coluna + configs)
- 1 nova Edge Function (`notificar-diretoria-fipe`)
- 1 novo hook (`useAprovacoesFipeDiretoria`)
- 3 arquivos editados (`RegrasVendaContent.tsx`, `EtapaAssinaturaContrato.tsx`, `whatsapp-meta-webhook/index.ts`)
- 1 registro de template Meta na tabela `whatsapp_meta_templates`
- Deploy de 2 Edge Functions

