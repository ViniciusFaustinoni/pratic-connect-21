Plano para ajustar a área de Atribuição de Grades

## Objetivo
Separar a tela atual em duas abas claras:

```text
Atribuição
├─ Equipes / Hierarquia
│  └─ Editável: define supervisor, gerente e agência de cada usuário
└─ Grades
   └─ Somente visualização: mostra a grade automática aplicada por perfil/role
```

## 1. Criar abas na tela de Atribuição
Na página `AtribuicaoGrades`, substituir a tabela única por um layout com abas:

- Aba `Equipes / Hierarquia`
- Aba `Grades aplicadas`

A tela continuará acessível pelo mesmo menu atual: `/comissoes/atribuicao`.

## 2. Aba Equipes / Hierarquia
Essa aba será focada apenas na montagem da cadeia comercial.

Ela deve exibir:

- usuário;
- perfil do usuário;
- supervisor atual;
- gerente atual;
- agência atual;
- ação para editar hierarquia.

A coluna de grade não será o foco dessa aba.

## 3. Novo modal visual para configuração de equipe
Refatorar o modal atual `AtribuirGradeModal` para deixar de editar grade e virar um modal específico de hierarquia, por exemplo `EditarHierarquiaModal`.

Ao abrir, o modal deve carregar e exibir os dados já salvos:

- supervisor já vinculado;
- gerente já vinculado;
- agência já vinculada;
- observações já salvas.

O modal será mais visual e intuitivo, com uma representação da cadeia:

```text
Gerente
   ↓
Supervisor
   ↓
Vendedor / Agência / Usuário selecionado
   ↓
Equipe inferior vinculada, quando existir
```

Também terá seletores separados por tipo de perfil:

- selecionar gerente entre usuários com role `gerente_comercial`;
- selecionar supervisor entre usuários com role `supervisor_vendas`;
- selecionar agência entre usuários com role `agencia`.

Para evitar confusão, o próprio usuário editado não aparecerá como opção de superior dele mesmo.

## 4. Exibir hierarquia inferior quando aplicável
Na configuração de equipe, além dos superiores, mostrar uma área informativa de subordinados já relacionados ao usuário selecionado.

Exemplos:

- se abrir um gerente, mostrar supervisores/vendedores/agências vinculados a ele;
- se abrir um supervisor, mostrar vendedores vinculados a ele;
- se abrir uma agência, mostrar vendedores vinculados à agência.

Essa parte será inicialmente visual, para ajudar o diretor a entender a estrutura antes de salvar.

## 5. Aba Grades aplicadas somente leitura
Criar uma aba separada para grades com a finalidade de consulta.

Ela deve exibir:

- usuário;
- perfil/role comercial;
- grade vigente aplicada;
- data de início, se existir;
- status: com grade / sem grade.

Não haverá botão de edição de vínculo de grade nessa aba.

Essa área deve deixar claro que a grade é definida automaticamente conforme o perfil selecionado na criação/configuração da grade, e não editada manualmente aqui.

## 6. Remover edição manual de grade da Atribuição
O modal atual permite selecionar `Grade aplicada às vendas deste usuário`. Isso será removido da área de Atribuição.

A tela não chamará mais `useAtribuirGrade` pelo modal.

Atribuição manual de grade ficará fora desse fluxo para não contradizer a regra atual:

> A grade vem da criação da grade, quando o diretor seleciona o perfil de acesso e configura as comissões.

## 7. Ajustar textos e alertas
Atualizar os textos da tela para refletir a nova lógica:

- onde hoje diz que a tela escolhe a grade comercial de cada usuário, trocar para explicar que:
  - a aba Equipes define hierarquia;
  - a aba Grades mostra a grade já calculada/aplicada pelo perfil;
  - usuários sem grade exibidos ali precisam ter seu perfil contemplado em alguma grade ativa.

O alerta de “usuários sem grade” continuará existindo, mas será tratado como alerta de configuração ausente, não como convite para editar manualmente ali.

## 8. Ajustes técnicos previstos
Arquivos principais:

- `src/pages/configuracoes/AtribuicaoGrades.tsx`
- `src/components/comissoes/AtribuirGradeModal.tsx` ou criação de novo `EditarHierarquiaModal.tsx`
- `src/hooks/useAtribuicaoComissoes.ts`
- `src/types/atribuicaoComissao.ts`

Mudanças técnicas:

- manter a consulta atual de usuários, grades vigentes e hierarquia;
- adicionar derivação de subordinados por `supervisor_id`, `gerente_id` e `agencia_id`;
- manter `useUpsertHierarquia` para salvar hierarquia;
- deixar `useAtribuirGrade` sem uso nessa tela;
- manter filtros por busca, perfil e status na aba de grades;
- adaptar filtros da aba de equipes para busca/perfil.

## 9. Validação esperada
Após a alteração:

- a tela terá duas abas separadas;
- a aba de Equipes permitirá editar apenas hierarquia;
- o modal abrirá preenchido com os dados já salvos;
- o modal será visual, mostrando superiores e subordinados;
- a aba de Grades será somente leitura;
- não será possível editar vínculo de grade manualmente nessa área;
- usuários com grade automática continuarão aparecendo com a grade vigente;
- usuários sem grade aparecerão como alerta de configuração pendente.