
## Análise

O sistema PRATIC está estruturado para criar associados **exclusivamente através de cotações**. O fluxo correto é:
1. **Cotação** criada no módulo de Vendas
2. Cliente aceita proposta e dados são validados
3. **ContratoWizard** cria o associado automaticamente (linha 572 de ContratoWizard.tsx)
4. Associado fica em status "em_analise" aguardando documentação/vistoria/aprovação

Atualmente existem **3 pontos** onde "Novo Associado" é exposto de forma inadequada:

### Problemas Identificados

1. **Página de Associados** (`src/pages/cadastro/Associados.tsx:387-390`)
   - Botão "Novo Associado" disponível para todos exceto Analistas de Cadastro
   - Permitir criar associado manualmente viola o fluxo da cotação
   - Já tem condição `!isAnalistaCadastroOnly` que limita visibilidade

2. **Busca Global** (`src/components/layout/GlobalSearch.tsx:37`)
   - Atalho rápido "Novo Associado" nas Quick Actions
   - Acessível via Cmd+K ou Ctrl+K
   - Redireciona para `/cadastro/associados`

3. **Modal AssociadoFormDialog** (`src/components/associados/AssociadoFormDialog.tsx`)
   - Componente permite criação standalone
   - Usado apenas em 2 cenários:
     - Na página de Associados (formDialogOpen state)
     - No ContratoWizard (integrado)

### Solução Proposta

**Remover acesso direto ao cadastro de Associados**:

| Localização | Ação | Razão |
|-------------|------|-------|
| `src/pages/cadastro/Associados.tsx` (linhas 386-391) | **Remover botão** "Novo Associado" | Associados só criam via Cotação |
| `src/components/layout/GlobalSearch.tsx` (linha 37) | **Remover** "Novo Associado" das quick actions | Evita criação manual descontrolada |
| `src/components/associados/AssociadoFormDialog.tsx` | **Manter inalterado** | Ainda usado internamente por ContratoWizard |
| `src/pages/cadastro/Associados.tsx` | **Manter estado** `formDialogOpen` | Para futuro uso se necessário |

### Implementação

**Arquivo 1: `src/pages/cadastro/Associados.tsx` (linhas 386-391)**
- Remover o `Button` com "Novo Associado"
- Manter apenas "Exportar" dropdown
- Remover estado `formDialogOpen` se não usado em outro lugar
- Remover `setFormDialogOpen` setter
- Remover renderização de `<AssociadoFormDialog>`

**Arquivo 2: `src/components/layout/GlobalSearch.tsx` (linha 37)**
- Remover objeto com `{ name: 'Novo Associado', url: '/cadastro/associados', ... }`
- Remover import `UserPlus` se não usar em outro lugar

### Impacto

✅ **Positivo:**
- Força fluxo correto: Cotação → Contrato → Associado
- Evita duplicação de associados com dados incompletos
- Alinha permissões (Analistas não veem mais o botão)
- Simplifica UI

⚠️ **Considerações:**
- Se usuário tentar acessar `/cadastro/associados?novo=true` diretamente, o modal não abrirá (apenas lista)
- Associados ainda aparecem na página de listagem com todas as funcionalidades (filtros, exportação, etc.)
- ContratoWizard continua criando associados normalmente

### Verificação de Dependências

- Modal `AssociadoFormDialog` continua existindo para uso interno (ContratoWizard)
- Estado `formDialogOpen` pode ser removido se não usado em outro lugar
- `useCreateAssociado` hook continua funcional
