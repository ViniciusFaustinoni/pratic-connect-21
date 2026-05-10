## Objetivo

Adicionar um botão **Chat** no menu lateral **Cadastro** que abre exatamente o mesmo chat com IA já usado em **Relacionamento › Chat** (`/eventos/chat-ia`).

## Contexto verificado

- O chat de Relacionamento hoje aponta para `/eventos/chat-ia` (`src/components/layout/AppSidebar.tsx`, linha 246).
- O menu Cadastro fica no mesmo arquivo (linhas 195–210) e atualmente tem: Propostas Pendentes, Associados, Veículos, Processos, Recusas do Instalador, Biometrias Pendentes, Base Antiga, Fila SGA.
- Não é uma nova tela — é apenas um atalho de menu reutilizando a rota existente.

## Mudança

Arquivo: `src/components/layout/AppSidebar.tsx`

Inserir como **primeiro item** do bloco `cadastro` (acima de "Propostas Pendentes"):

```ts
{ title: 'Chat', url: '/eventos/chat-ia', icon: MessageCircle },
```

`MessageCircle` já está importado no arquivo (usado nos outros chats).

## O que NÃO será feito

- Não criar nova rota nem nova página.
- Não duplicar lógica do chat — é o mesmo `/eventos/chat-ia`.
- Não alterar permissões: o item herda `canManageCadastro` do bloco Cadastro (mesmo que já controla os demais itens). Se o usuário quiser que apareça também para perfis sem essa permissão, basta avisar.

## Validação

- Logar como diretor, abrir sidebar, expandir **Cadastro** → "Chat" aparece no topo e leva para a mesma tela do Relacionamento › Chat.
