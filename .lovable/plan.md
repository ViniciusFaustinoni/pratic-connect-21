## Contexto
O módulo de e-mails de suspensão já possui uma camada de hooks em `src/hooks/emails-suspensao/` (`useEmailSuspensao`, `useTemplatesList`, `useEnviarEmailTeste`). A única chamada direta ao Supabase remanescente está em `EnviarTesteDialog.tsx`, dentro da função `selecionarAssociado`, que faz 2 lookups inline: (1) e-mail do associado e (2) placa do veículo ativo.

## Tarefas

### 1. Criar hook `usePreviewAssociadoData`
Novo arquivo: `src/hooks/emails-suspensao/usePreviewAssociadoData.ts`

- Recebe `associadoId: string | null`.
- Expõe `useQuery` (TanStack Query) com:
  - `queryKey: ['preview-associado-data', associadoId]`
  - Query function que faz os 2 selects em paralelo (`associados.email` e `veiculos.placa` filtrado por status ativo/instalacao_pendente/em_analise, ordenado por `created_at` DESC, limit 1).
  - `enabled: !!associadoId`.
- Retorno tipado: `{ email: string | null; placa: string | null; isLoading: boolean; error: Error | null }`.

### 2. Refatorar `EnviarTesteDialog.tsx`
- Importar e consumir `usePreviewAssociadoData`.
- Substituir o bloco `selecionarAssociado` que fazia os 2 `await supabase.from(...)` pelo hook.
- Manter a lógica de estado local (`associadoSelecionado`, `associadoVars`, `carregandoAssociado`) e a composição do objeto `novasVars` (nome_cliente, data, placa).
- Remover o `import { supabase } from '@/integrations/supabase/client'` do componente — torna-se consumidor puro de hooks.
- Manter inalterado: `useEnviarEmailTeste`, `useEmailSuspensaoTemplatesList`, `useAssociadoSearch`, validação de variáveis e preview.

## Fora de escopo
- Não alterar outros componentes do módulo (já usam hooks).
- Não criar `useEmailsRelacionamento` guarda-chuva (evita duplicação).
- Sem mudanças de backend, RLS, banco ou edge functions.

## Critérios de aceite
- `EnviarTesteDialog` não importa mais `supabase` diretamente.
- Seleção de associado no preview continua populando e-mail e placa corretamente.
- Teste de envio de e-mail preserva comportamento existente (bloqueio por variáveis, preview renderizado, etc).