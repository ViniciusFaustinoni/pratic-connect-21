
# Adicionar Botao de Excluir Chamado de Assistencia 24h (Apenas Diretor)

## Resumo

Adicionar a opcao "Excluir Permanentemente" no dropdown de acoes da pagina de detalhe do chamado de assistencia, visivel apenas para diretores. A exclusao remove todas as dependencias (historico, atendimentos) e desvincula sinistros relacionados. Inclui dialogo de confirmacao com motivo obrigatorio.

## Alteracoes

### 1. Nova Edge Function: `supabase/functions/delete-chamado-assistencia/index.ts`

Seguindo o mesmo padrao da `delete-sinistro`, esta funcao ira:

1. Verificar autenticacao e role `diretor`
2. Buscar dados do chamado para auditoria
3. Exclusao em cascata:
   - Excluir registros de `chamados_assistencia_atendimentos` (chamado_id)
   - Excluir registros de `chamados_assistencia_historico` (chamado_id)
   - Desvincular sinistros: `UPDATE sinistros SET chamado_origem_id = null, chamado_assistencia_id = null WHERE chamado_origem_id = ID OR chamado_assistencia_id = ID`
   - Excluir o chamado principal de `chamados_assistencia`
4. Registrar log de auditoria em `auth_logs`

### 2. Frontend: `src/pages/assistencia/ChamadoDetalhe.tsx`

- Importar `usePermissions`, `Trash2`, `ConfirmacaoExclusaoDialog` (reutilizar o componente existente de sinistros, ou criar um generico)
- Adicionar estado para controlar o dialogo de confirmacao
- No dropdown de acoes (linha 289-293), adicionar item "Excluir Permanentemente" visivel apenas quando `isDiretor`
- Adicionar funcao `handleExcluir` que chama a edge function e redireciona para a lista apos sucesso
- Renderizar o dialogo de confirmacao (reutilizando `ConfirmacaoExclusaoDialog` adaptando o protocolo)

### 3. Dialogo de Confirmacao

Reutilizar o componente `ConfirmacaoExclusaoDialog` ja existente em `src/components/sinistros/`, que ja possui:
- Campo de motivo obrigatorio (minimo 5 caracteres)
- Aviso de acao irreversivel
- Lista de dados que serao excluidos

Adaptar o titulo/descricao para mencionar "Chamado de Assistencia" em vez de "Sinistro". Para isso, criar uma variante generica ou um novo componente similar em `src/components/assistencia/`.

## Detalhes Tecnicos

| Arquivo | Alteracao |
|---|---|
| `supabase/functions/delete-chamado-assistencia/index.ts` | Nova edge function para exclusao em cascata |
| `src/pages/assistencia/ChamadoDetalhe.tsx` | Botao de excluir no dropdown (apenas diretor) + dialogo de confirmacao |
| `src/components/assistencia/ConfirmacaoExclusaoChamadoDialog.tsx` | Novo componente de confirmacao (baseado no de sinistros) |

### Tabelas afetadas na exclusao

```text
chamados_assistencia_atendimentos  --> DELETE WHERE chamado_id = X
chamados_assistencia_historico     --> DELETE WHERE chamado_id = X
sinistros                          --> UPDATE SET chamado_origem_id = null, chamado_assistencia_id = null
chamados_assistencia               --> DELETE WHERE id = X
```

### Trecho do dropdown (ChamadoDetalhe.tsx)

Apos o item "Cancelar Chamado", adicionar:

```tsx
{isDiretor && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem
      className="text-red-600"
      onClick={() => setDialogExcluir(true)}
    >
      <Trash2 className="h-4 w-4 mr-2" />
      Excluir Permanentemente
    </DropdownMenuItem>
  </>
)}
```
