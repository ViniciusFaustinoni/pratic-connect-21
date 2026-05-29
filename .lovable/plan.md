# Monitoramento como frente independente

Hoje, no super-grupo da sidebar (`SUPER_GROUPS` em `src/components/layout/AppSidebar.tsx`), **Monitoramento** está pendurado dentro de **Relacionamento**:

```ts
{ id: 'relacionamento', label: 'Relacionamento',
  moduleIds: ['relacionamento', 'monitoramento', 'cobranca'] }
```

Isso faz com que diretores precisem abrir "Relacionamento" para chegar em Monitoramento, mesmo sendo uma frente operacional distinta (Equipe, Serviços de Campo, Aprovações, Rastreadores, Calendário, etc.).

## Mudança

**Arquivo único:** `src/components/layout/AppSidebar.tsx` (constante `SUPER_GROUPS`, ~linha 469).

1. **Remover** `'monitoramento'` da lista `moduleIds` do grupo `relacionamento`:
   ```ts
   moduleIds: ['relacionamento', 'cobranca']
   ```

2. **Adicionar** um novo super-grupo `monitoramento` na ordem natural (entre Comercial e Relacionamento, refletindo o fluxo Vendas → Cadastro → Monitoramento → Relacionamento):
   ```ts
   {
     id: 'monitoramento',
     label: 'Monitoramento',
     icon: MapPin,
     color: MENU_COLORS.monitoramento, // '#f97316'
     moduleIds: ['monitoramento'],
   }
   ```

O módulo `monitoramento` (definição em ~linha 215, com seus 6 itens: Equipe, Chat, Serviços de Campo, Calendário, Rastreadores, Aprovações, Veículos) **não muda** — só passa a ser acessado por uma frente própria. Permissões (`canManageInstalacoes`), contadores (`useAprovacoesMonitoramentoCount`) e rotas seguem intactos.

## Fora de escopo

- Não mexer em rotas, permissões, edge functions ou nos itens internos do módulo.
- Não renomear nada. Apenas reagrupar visualmente.

## Validação

- Logar como diretor (`admin@teste.com` / `123456789123456789`) → sidebar deve mostrar **Monitoramento** como super-grupo próprio, lado a lado com Comercial / Relacionamento / Administrativo.
- Badge de Aprovações de Monitoramento continua aparecendo no item interno.
- Relacionamento continua existindo, agora só com Análises / E-mails / Cobranças / Chat.
