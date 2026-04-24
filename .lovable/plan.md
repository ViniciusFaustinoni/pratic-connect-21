## Plano: configuração única para múltiplos planos na Grade de Comissão

### Objetivo
Alterar a tela de criação/edição de grade para que, quando mais de um plano estiver selecionado, as parcelas e comissões sejam configuradas uma única vez e aplicadas a todos os planos selecionados.

Fluxo esperado:

```text
Seleciona 1 plano  -> configura regras daquele plano
Seleciona 2+ planos -> configura um único modelo de regras
Salvar -> replica o modelo para todos os planos selecionados no banco
```

### Ajustes na tela
1. Trocar o texto da seleção de planos para deixar claro que os planos selecionados compartilharão a mesma configuração quando houver mais de um.
2. Quando `selectedPlanIds.length > 1`, renderizar apenas um card de configuração, por exemplo:
   - “Configuração compartilhada”
   - badge com “Aplicada a X planos”
   - lista/resumo dos planos selecionados
3. Manter o comportamento atual para apenas 1 plano selecionado.
4. Botões “Parcela”, “Vitalícia”, editar, remover e reordenar passarão a alterar esse modelo único quando houver múltiplos planos.

### Ajustes de estado e regra
1. Manter um modelo base de parcelas para a configuração compartilhada.
2. Ao selecionar/desselecionar planos, não duplicar cards de configuração na interface.
3. Ao salvar, replicar a configuração compartilhada para cada `plano_id` selecionado, preservando a estrutura atual do banco:
   - `grade_comissao_planos`
   - `grades_comissao_parcelas`
   - `grades_comissao_niveis`
   - `grade_comissao_plano_regras`
   - snapshot de versão

### Compatibilidade com edição
1. Ao editar uma grade já existente com múltiplos planos:
   - usar as regras do primeiro plano como modelo inicial;
   - se as regras existentes forem iguais entre os planos, a edição será naturalmente compartilhada;
   - se houver divergências antigas, a próxima gravação padronizará todos os planos selecionados com o modelo exibido.
2. Exibir uma mensagem informativa discreta quando houver múltiplos planos, explicando que salvar irá refletir a configuração em todos.

### Validações
1. Validar a configuração apenas uma vez quando houver múltiplos planos, evitando mensagens repetidas por plano.
2. Garantir que pelo menos uma parcela e um perfil remunerado sejam configurados.
3. Preservar validações atuais de:
   - rótulo da parcela;
   - número da parcela;
   - vitalícia com início válido;
   - soma percentual até 100%;
   - perfis duplicados na mesma parcela.

### Arquivo principal
- `src/pages/configuracoes/GradeComissaoForm.tsx`

### Testes após implementação
1. Criar grade com apenas 1 plano e confirmar que continua configurando individualmente.
2. Criar grade com 2 ou mais planos e confirmar que aparece apenas um card de configuração.
3. Usar “Selecionar todos” e confirmar que continua aparecendo apenas uma configuração compartilhada.
4. Salvar e verificar se todos os planos selecionados recebem as mesmas regras.
5. Editar uma grade com múltiplos planos e confirmar que a edição compartilhada é persistida para todos.