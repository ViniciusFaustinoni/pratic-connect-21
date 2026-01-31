
# Plano de Correção de Erros de Lógica e Botões Não Funcionais

## Resumo da Análise

Durante os testes de navegação e revisão de código, identifiquei os seguintes problemas que precisam de correção:

---

## PROBLEMA CRÍTICO 1: Crash ao Abrir Modal de Nova Cotação

### Sintoma
Ao clicar em "Nova Cotação" na página `/vendas/cotacoes`, o sistema crasha com o erro:
```
Failed to execute 'removeChild' on 'Node': The node to be removed is not a child of this node.
```

### Arquivo Afetado
- `src/components/cotacoes/CotacaoFormDialog.tsx`

### Causa Provável
Conflito de portais React (Dialog/AlertDialog aninhados) ou manipulação incorreta de DOM durante a renderização condicional de componentes.

### Solução
1. Revisar a estrutura de Dialogs aninhados no componente
2. Garantir que `AlertDialog` e `Dialog` não compartilhem o mesmo container de portal
3. Adicionar keys únicas aos elementos condicionais
4. Verificar se há renderização fora de ordem ao abrir/fechar modais

---

## PROBLEMA 2: Botão "Criar Perfil" Não Implementado

### Sintoma
No componente `GerenciarRolesTab.tsx`, o botão "Novo Perfil" apenas loga no console:
```typescript
// TODO: Implementar criação de role via API
console.log('Criar role:', { nome: newRoleName, descricao: newRoleDescription });
```

### Arquivo Afetado
- `src/components/configuracoes/GerenciarRolesTab.tsx` (linha 101)

### Solução
Implementar a mutation para criar novo perfil via Supabase, com as validações necessárias.

---

## PROBLEMA 3: Botão "Enviar Email" Não Funcional

### Sintoma
No Cotador (`src/pages/vendas/Cotador.tsx`), a função `handleEnviarEmail` apenas exibe um toast:
```typescript
const handleEnviarEmail = () => {
  toast.info('Funcionalidade de email será implementada em breve');
};
```

### Arquivo Afetado
- `src/pages/vendas/Cotador.tsx` (linha 765-767)

### Solução
Implementar integração com o hook `useEnviarEmail` para envio real do email da cotação.

---

## PROBLEMA 4: Hooks de Document Types Precisam de Atualização

### Sintoma
O hook `useDocumentTypes.ts` foi criado recentemente mas precisa ser integrado à tabela existente. As colunas `canvas_data`, `is_default` e `status` foram adicionadas ao `documento_templates`, mas os hooks existentes não as utilizam.

### Arquivos Afetados
- `src/hooks/useDocumentoTemplates.ts`
- `src/hooks/useDocumentTypes.ts`

### Solução
Atualizar o hook `useDocumentoTemplates` para incluir os novos campos da migration recente.

---

## PROBLEMA 5: Erros de CORS no Manifest PWA

### Sintoma
Erro de CORS ao carregar o manifest do app associado:
```
Access to manifest blocked by CORS policy: No 'Access-Control-Allow-Origin' header
```

### Arquivo Afetado
- Configuração de manifest PWA

### Solução
Verificar se o arquivo `manifest-associado.json` está sendo servido corretamente ou se há redirecionamento incorreto.

---

## Arquivos a Modificar

| Prioridade | Arquivo | Problema |
|------------|---------|----------|
| CRÍTICA | `src/components/cotacoes/CotacaoFormDialog.tsx` | Crash ao abrir modal |
| Alta | `src/components/configuracoes/GerenciarRolesTab.tsx` | Botão criar perfil sem ação |
| Média | `src/pages/vendas/Cotador.tsx` | Botão email não implementado |
| Média | `src/hooks/useDocumentoTemplates.ts` | Integrar novos campos |
| Baixa | PWA manifest config | Erro de CORS |

---

## Ordem de Implementação Sugerida

1. **Corrigir crash do modal de cotação** (bloqueia fluxo de vendas)
2. Implementar criação de perfis no GerenciarRolesTab
3. Conectar botão de email no Cotador
4. Atualizar hooks de documentos
5. Resolver problema de CORS do PWA

---

## Observações Adicionais

- O sistema de permissões está funcionando corretamente
- Os demais botões de navegação e ações rápidas do dashboard estão operacionais
- A busca de associados para gerar documentos funciona, mas não há dados no ambiente de teste
- Os perfis de acesso estão exibindo corretamente com contagem de usuários
