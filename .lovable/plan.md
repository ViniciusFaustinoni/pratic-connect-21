

## Painel de Biometrias Pendentes + Reenvio de Selfie (A + C)

Implementar gestão centralizada de biometrias Autentique que estão em `review` (aguardando aprovação manual da Autentique) ou `rejected` (selfie reprovada), com ação de reenvio de selfie para casos rejeitados.

### Contexto técnico

- A API GraphQL pública do Autentique **não permite aprovar biometrias em review** — isso é feito apenas no painel web da Autentique por operador deles. Portanto a página será uma central de **visibilidade + ações suportadas**, não de aprovação direta.
- O hook `useAutentiqueBiometricStatus.ts` já faz polling individual via `autentique-sync-contrato` e retorna `biometric_status: 'review' | 'rejected' | null`. Vamos usar a mesma fonte de dados, mas em modo lista.
- O webhook `autentique-webhook` (já existente) atualiza o banco automaticamente quando a Autentique resolve a biometria → não precisamos de polling manual no painel após a ação.
- A coluna `biometric_status` já existe nos contratos (populada por `autentique-sync-contrato`). Vamos consultar diretamente a tabela `contratos` filtrando por esse campo.

### O que vai mudar

**1. Nova página `/admin/autentique/biometrias-pendentes`** (`src/pages/admin/AutentiqueBiometriasPendentes.tsx`)
- Tabela com contratos onde `biometric_status IN ('review', 'rejected')`.
- Colunas: Associado (nome + CPF), Contrato (número), Data da assinatura/selfie, Status (badge âmbar `Em revisão` / vermelho `Rejeitada`), Motivo (se rejeitada — vem de `biometric_reason`), Ações.
- Filtros: status (review / rejected / todos), busca por nome/CPF, range de datas.
- Auto-refresh a cada 60s (mesmo intervalo do hook existente — não consome créditos extras).
- Indicador no topo: "X biometrias aguardando revisão" / "Y rejeitadas".

**2. Ações por linha**
- **"Abrir no Autentique"** — botão que abre `https://painel.autentique.com.br/documentos/{autentique_document_id}` em nova aba. Operador aprova/reprova lá; webhook atualiza nosso banco.
- **"Reenviar selfie"** (apenas para `rejected`) — chama nova edge function `autentique-reenviar-selfie` que:
  1. Cancela a assinatura atual via mutation Autentique (`removeSignerFromDocument` ou recria documento).
  2. Gera novo signatário com `PF_FACIAL` no mesmo documento (ou cria novo documento se a API não permitir reset de signer).
  3. Dispara WhatsApp para o associado com o novo link via `enviar-mensagem-whatsapp` (template existente `solicitacao_nova_selfie` — criar se não existir, usando padrão dos templates atuais).
  4. Loga em `autentique_audit_log` (tabela já existente para auditoria).
- **"Ver detalhes"** — drawer lateral mostrando histórico do contrato, link para o associado, contato (telefone/whatsapp).

**3. Nova edge function `supabase/functions/autentique-reenviar-selfie/index.ts`**
- Input: `{ contratoId: string, motivo?: string }`.
- Valida JWT (operador autenticado com role `admin`, `diretor` ou `analista_documentos`).
- Busca contrato + dados do associado + `autentique_document_id`.
- Verifica saldo de créditos `PF_FACIAL` (usar lógica existente; se zero, retorna erro claro pedindo recarga — alinhado com `mem://integrations/autentique/signature-credits-policy`).
- Executa mutation Autentique para regenerar a assinatura facial.
- Atualiza `contratos.biometric_status = 'pending'`, `biometric_reason = null`, registra timestamp `biometric_resent_at`.
- Dispara WhatsApp.
- Retorna `{ success, signature_url, message }`.

**4. Migração de banco**
- Adicionar colunas em `contratos` se ainda não existirem:
  - `biometric_reason TEXT NULL` (motivo da rejeição vindo da Autentique)
  - `biometric_resent_at TIMESTAMPTZ NULL` (quando foi pedida nova selfie)
  - `biometric_resent_by UUID NULL REFERENCES profiles(id)` (quem pediu)
- Não mexer em RLS existente — os campos são lidos pelas mesmas policies do contrato.

**5. Integração com sidebar/menu**
- Adicionar item no menu admin: **Cadastro → Autentique → Biometrias Pendentes** (seguindo padrão dos itens existentes em `src/components/layout/AppSidebar.tsx` ou equivalente).
- Badge no menu com contador de biometrias em `review` (consulta leve `count(*) WHERE biometric_status IN ('review','rejected')`, com cache de 60s).

**6. Permissões**
- Acesso restrito a roles: `admin`, `diretor`, `analista_documentos`, `gerente_comercial`. Outros perfis não veem o menu nem conseguem acessar a rota (guard via `usePermissions`).

### O que NÃO vai mudar

- Nenhuma alteração no fluxo público de assinatura `/cotacao/:token` (memo `mem://features/contracts/autentique-signing-flow-v7` preservada).
- Webhook `autentique-webhook` continua sendo a fonte de verdade para mudanças de status — apenas adicionamos uma UI para visibilidade + reenvio.
- Hook `useAutentiqueBiometricStatus` (polling individual no fluxo público) permanece intacto.
- Função `autentique-sync-contrato` permanece intacta.

### Riscos e mitigações

- **Limite de créditos PF_FACIAL**: a edge function valida saldo antes de gastar. Se zero, devolve erro claro sem cobrar.
- **Reset de signatário pode não existir na API**: se `removeSignerFromDocument` não for suportado para PF_FACIAL, fallback é criar novo documento Autentique (mantendo o anterior cancelado para auditoria). Decisão final via teste no momento da implementação.
- **Spam de reenvio**: limitar 1 reenvio por contrato a cada 6h (validação na edge function via `biometric_resent_at`).

### Arquivos editados/criados

- `src/pages/admin/AutentiqueBiometriasPendentes.tsx` (novo)
- `src/components/admin/autentique/BiometriaPendenteRow.tsx` (novo, opcional para isolar)
- `src/hooks/useBiometriasPendentes.ts` (novo — query + auto-refresh)
- `src/components/layout/AppSidebar.tsx` (item de menu + badge)
- `src/App.tsx` ou roteador equivalente (registrar rota)
- `supabase/functions/autentique-reenviar-selfie/index.ts` (nova edge function)
- Migração SQL: 3 colunas em `contratos`

