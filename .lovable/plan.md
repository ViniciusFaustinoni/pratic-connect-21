
Contexto do problema (o que está acontecendo)
- Esse “card lateral” é o Sheet `Configurar {Integração}` (ex.: “Configurar SGA Hinova”).
- Hoje, ao abrir o Sheet, o componente zera o estado local (`setValores({})`). Isso faz com que:
  1) Tudo que você digitou (mesmo antes de salvar) se perca ao fechar e abrir novamente.
  2) Mesmo após salvar, os campos ficam “vazios” (apenas com placeholder “••••••••”), o que dá a impressão de que não persistiu.
- Além disso, há um problema de backend/fluxo: o endpoint `integracoes-credenciais` (POST) exige que `credenciais` contenha todos os campos obrigatórios sempre. Isso impede:
  - Atualizar só um campo (ex.: trocar apenas o token) sem redigitar usuário/senha.
  - Registrar o resultado do “Testar Conexão” sem reenviar credenciais (no hook atual isso pode falhar silenciosamente e não atualizar status).

Objetivo
1) Persistir no UI os valores digitados enquanto o usuário estiver na tela, mesmo fechando e reabrindo o Sheet (persistência de “rascunho”).
2) Melhorar o “Salvar” para permitir atualização parcial (alterar só o que foi digitado) e manter o resto do que já está salvo no banco.
3) Garantir que “Testar Conexão” atualize o status (teste pendente/sucesso/falha) sem exigir reenvio de credenciais.

Exploração do que existe hoje (onde mexer)
- Frontend
  - `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`
    - Reseta valores sempre que abre (`useEffect` com `if (open) setValores({})`).
    - Exige todos os obrigatórios preenchidos sempre (`podeSalvar`).
  - `src/components/integracoes/ServicosTab.tsx`
    - Abre o Sheet e controla apenas open/close e seleção da integração.
  - `src/hooks/useIntegracaoCredenciais.ts`
    - `salvar()` sempre envia as credenciais informadas.
    - `testar()` para Hinova chama `sga-hinova-sync` sem enviar credenciais; depois tenta “atualizar status” via POST, mas o endpoint atual pode rejeitar (porque faltam credenciais obrigatórias).
- Backend
  - `supabase/functions/integracoes-credenciais/index.ts`
    - POST sempre valida obrigatórios em `credenciais` e sobrescreve o registro.
    - Não tem modo “update parcial” nem “somente atualizar teste”.

Solução proposta (alto nível)
A) Frontend: persistir rascunho no estado do `ServicosTab`
- Manter um estado “draft” por integração (apenas em memória, não localStorage) para que ao fechar/abrir o Sheet, os campos voltem como estavam digitados.
- Ao salvar ou remover credenciais, limpar o draft dessa integração (para evitar reusar dados antigos).

B) Backend: permitir “update parcial” e “atualizar teste” sem credenciais
- Alterar o POST do `integracoes-credenciais` para suportar 2 comportamentos:
  1) Atualização de credenciais (parcial): mesclar credenciais novas (não vazias) com as credenciais já salvas (descriptografando as antigas). Validar obrigatórios após o merge.
  2) Atualização de resultado de teste: quando vier `teste_sucesso`/`teste_mensagem` e `credenciais` vier vazio/ausente, atualizar apenas colunas `teste_sucesso`, `teste_mensagem`, `testado_em` e manter a criptografia existente.

C) Frontend: ajustar “Salvar” e “Testar Conexão” para o novo comportamento
- “Salvar”:
  - Se já está configurado, permitir salvar quando pelo menos um campo foi digitado (em vez de exigir todos obrigatórios).
  - Enviar apenas os campos preenchidos (para fazer update parcial).
- “Testar Conexão”:
  - Ao terminar o teste, fazer POST para `integracoes-credenciais` com `teste_sucesso`/`teste_mensagem` sem precisar reenviar credenciais.
  - Isso garante que o status no card e no sheet será persistido corretamente.

Passo a passo de implementação (sequência)
1) Ajustar o backend `integracoes-credenciais` (essencial para corrigir persistência de status e permitir update parcial)
   - Arquivo: `supabase/functions/integracoes-credenciais/index.ts`
   - Implementar no POST:
     - Ler body com: `integracao`, `credenciais?`, `teste_sucesso?`, `teste_mensagem?`
     - Buscar registro atual por `integracao` (se existir).
     - Se `credenciais` estiver ausente ou vazio E existir `teste_sucesso`:
       - Fazer `update` somente dos campos de teste (e `updated_at`), sem validar schema.
       - Retornar `{success:true}`.
     - Caso contrário:
       - Se existe registro atual configurado, descriptografar e fazer merge:
         - `merged = { ...credenciaisExistentes, ...credenciaisNovasNaoVazias }`
       - Validar obrigatórios em `merged`.
       - Criptografar `merged` e fazer upsert, preservando flags/atualizando timestamps.
   - Garantir que o GET continue retornando apenas status (nunca credenciais).

2) Persistência do rascunho no UI (fechar/abrir sem perder o que digitou)
   - Arquivo: `src/components/integracoes/ServicosTab.tsx`
   - Criar estado:
     - `const [drafts, setDrafts] = useState<Partial<Record<IntegracaoTipo, Record<string,string>>>>({});`
   - Ao abrir o sheet, manter `integracaoSelecionada` e passar `initialValues={drafts[integracaoSelecionada] ?? {}}`
   - Passar callback `onValuesChange` para atualizar `drafts[integracao]` conforme o usuário digita.
   - Em `handleIntegracaoSuccess` (após salvar/remover), limpar draft da integração atual.

3) Alterar `ConfigurarIntegracaoSheet` para usar `initialValues` e não resetar ao abrir
   - Arquivo: `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`
   - Adicionar props:
     - `initialValues?: Record<string,string>`
     - `onValuesChange?: (values: Record<string,string>) => void`
   - Remover/ajustar o `useEffect` que zera tudo ao abrir:
     - Em vez de resetar, carregar `initialValues` quando `open` ou `integracao` mudar.
   - `handleChange`:
     - Atualiza state local + chama `onValuesChange` com o novo objeto.
   - `podeSalvar`:
     - Se `configurado === false`: exigir obrigatórios preenchidos (como hoje).
     - Se `configurado === true`: permitir salvar se existe ao menos 1 campo preenchido (algum valor não vazio) para update parcial.
   - Melhorar microcopy:
     - Quando configurado e `valores` vazio, exibir um texto: “Credenciais já salvas. Para alterar, digite apenas o(s) campo(s) que deseja atualizar e clique em Salvar.”

4) Ajustar o hook para atualizar status de teste sem exigir credenciais
   - Arquivo: `src/hooks/useIntegracaoCredenciais.ts`
   - No `testar()`:
     - Depois do teste, sempre registrar resultado chamando POST com:
       - `{ integracao, credenciais: {}, teste_sucesso, teste_mensagem }`
     - Agora o backend aceitará isso e persistirá o status.
   - No `salvar()`:
     - Para update parcial, enviar apenas os campos que o usuário preencheu (o próprio objeto `valores` já terá só o que ele digitou se a gente não preencher automaticamente).
   - Garantir `invalidateQueries` para `['integracao-credenciais-status', integracao]` e `['todas-integracoes-credenciais']` (este último é usado no grid do `ServicosTab`).

5) Validação manual (passos de teste)
   - Abrir: Configurações > Integrações > Serviços > SGA Hinova > Configurar/Editar
   - Digitar alguns campos e fechar sem salvar; reabrir:
     - Os valores digitados devem continuar no formulário (rascunho).
   - Salvar; fechar e reabrir:
     - Deve mostrar status “Credenciais salvas…” e permitir alterar apenas 1 campo e salvar novamente sem digitar tudo.
   - Clicar em “Testar Conexão”:
     - O status “Última tentativa…” deve persistir após fechar e reabrir e também refletir no card (Serviços).
   - Recarregar a página:
     - Rascunho (em memória) pode se perder, mas credenciais/status do teste devem continuar (persistidos no banco).

Riscos/observações
- Segurança: o “rascunho” ficará apenas em memória (state React). Não vamos armazenar em localStorage.
- Não exibiremos credenciais reais já salvas (por design do endpoint), apenas placeholders e status. O objetivo é não perder o que está digitado e não precisar redigitar tudo para pequenas alterações.

Arquivos envolvidos
- Frontend
  - `src/components/integracoes/ServicosTab.tsx`
  - `src/components/integracoes/ConfigurarIntegracaoSheet.tsx`
  - `src/hooks/useIntegracaoCredenciais.ts`
- Backend
  - `supabase/functions/integracoes-credenciais/index.ts`
