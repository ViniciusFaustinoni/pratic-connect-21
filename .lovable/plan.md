

# Reenviar templates PENDING para a Meta

## Análise

Templates com status `PENDING` já foram enviados para a Meta e possuem um `meta_template_id`. A Meta não permite reenviar um template com o mesmo nome enquanto ele já existe — isso retorna erro `"Message template with the same name already exists"`. 

**O que funciona**: Sincronizar (`acao: sincronizar`) busca o status atualizado da Meta. Se o template já foi aprovado/rejeitado lá, a sincronização atualiza o status local.

**Reenviar PENDING não é possível** pela API da Meta — o template já está em análise. A ação correta é: (1) sincronizar para ver se o status mudou, ou (2) excluir na Meta e recriar.

## Proposta: Botão "Verificar Status" para templates PENDING

Em vez de reenviar (que daria erro), adicionar um botão que força sincronização individual dos templates pendentes, verificando se a Meta já atualizou o status.

### Mudanças

#### 1. `src/components/integracoes/WhatsAppMetaTemplates.tsx`
- Adicionar botão com ícone `RefreshCw` nas ações de templates `PENDING`, com tooltip "Verificar status na Meta"
- Ao clicar, chama `sincronizar.mutate()` (já sincroniza todos e atualiza status)

#### 2. Alternativa: forçar reenvio (excluir + recriar)
Se o usuário realmente quer forçar reenvio, seria necessário:
- Excluir o template na Meta via API (`DELETE /message_templates?name=xxx`)
- Reenviar como novo (`POST /message_templates`)
- Isso pode causar problemas se o template estiver sendo usado em automações

### Recomendação

Implementar apenas o botão de **sincronização/verificação de status** nos templates PENDING. Se a Meta já aprovou, o status atualiza automaticamente. Reenviar forçado (delete + recreate) é arriscado e pode quebrar referências existentes.

### Implementação concreta

No `WhatsAppMetaTemplates.tsx`, na seção de ações (linha 141-191):

```typescript
{t.status === 'PENDING' && (
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7 text-yellow-600"
    title="Verificar status na Meta"
    onClick={() => sincronizar.mutate()}
    disabled={sincronizar.isPending}
  >
    <RefreshCw className="h-3 w-3" />
  </Button>
)}
```

Isso usa a infraestrutura existente sem risco de erros da API da Meta.

