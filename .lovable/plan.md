
## Plano: Ocultar elementos para Analista de Cadastro

### Objetivo

Aplicar restrições de visualização na tela de detalhes do associado para o perfil **Analista de Cadastro**, ocultando:

1. Aba "Documentos" (TabsList)
2. Botão "Documentos" (Header card)
3. Botão "Editar" (Header card)
4. Botão "Email" (Dropdown menu)

### Análise do Sistema de Permissões

O projeto já possui:
- Hook `usePermissions` que retorna `isAnalistaCadastroOnly`
- Essa flag identifica usuários que são **exclusivamente** analistas de cadastro (sem outros perfis de gerência)

### Modificações Técnicas

**Arquivo:** `src/pages/cadastro/AssociadoDetalhe.tsx`

**1. Importar hook de permissões:**
```typescript
import { usePermissions } from '@/hooks/usePermissions';
```

**2. Usar o hook no componente:**
```typescript
const { isAnalistaCadastroOnly } = usePermissions();
```

**3. Condicionar botão "Editar" (linha 516-518):**
- Envolver com verificação `!isAnalistaCadastroOnly`
- Ocultar para analistas de cadastro

**4. Condicionar botão "Documentos" (linha 519-524):**
- Envolver com verificação `!isAnalistaCadastroOnly`
- Ocultar para analistas de cadastro

**5. Condicionar aba "Documentos" (linha 617-620):**
- Envolver TabsTrigger com verificação `!isAnalistaCadastroOnly`
- Ocultar aba de Documentos para analistas de cadastro

**6. Remover botão "Email" (linha 588-590):**
- Remover completamente o DropdownMenuItem de Email para todos os usuários
- Conforme solicitado pelo usuário

### Estrutura Final dos Botões

| Elemento | Visível para Analista Cadastro? | Visível para Outros? |
|----------|--------------------------------|---------------------|
| Editar | Não | Sim |
| Documentos (botão) | Não | Sim |
| Documentos (aba) | Não | Sim |
| Financeiro | Sim | Sim |
| Email | Removido | Removido |
| WhatsApp | Sim | Sim |

### Código das Alterações

**Botão Editar (Linha 516):**
```typescript
{!isAnalistaCadastroOnly && (
  <Button variant="outline" onClick={() => navigate(`/cadastro/associados/${id}/editar`)}>
    <Edit className="mr-2 h-4 w-4" /> Editar
  </Button>
)}
```

**Botão Documentos (Linha 519):**
```typescript
{!isAnalistaCadastroOnly && (
  <Button variant="outline" onClick={() => setActiveTab('documentos')}>
    <FileCheck className="mr-2 h-4 w-4" /> Documentos
    {docsPendentes > 0 && (
      <Badge variant="destructive" className="ml-2 h-5 px-1.5">{docsPendentes}</Badge>
    )}
  </Button>
)}
```

**Aba Documentos (Linha 617):**
```typescript
{!isAnalistaCadastroOnly && (
  <TabsTrigger value="documentos">
    <FileCheck className="mr-2 h-4 w-4" /> Documentos
    {docsPendentes > 0 && <Badge variant="destructive" className="ml-2 h-5 px-1.5">{docsPendentes}</Badge>}
  </TabsTrigger>
)}
```

**Email - Remoção Completa (Linha 588-590):**
```typescript
// Remover estas linhas:
<DropdownMenuItem onClick={handleEmail}>
  <Mail className="mr-2 h-4 w-4" /> Email
</DropdownMenuItem>
```

### Impacto

- Analistas de Cadastro terão acesso restrito a funções de edição e documentos
- Fluxo de trabalho de análise simplificado para este perfil
- Botão de Email removido para todos os usuários (conforme solicitado)
- Não afeta outras funcionalidades ou outros perfis

### Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/cadastro/AssociadoDetalhe.tsx` | Adicionar condicionais de permissão e remover botão Email |
