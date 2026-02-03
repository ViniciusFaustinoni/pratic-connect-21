
# CRUD de Consultores com Código SGA Hinova

## Contexto

O sistema precisa de um campo `codigo_sga_voluntario` por consultor/vendedor para que, ao sincronizar um veículo com o SGA Hinova, seja usado o código voluntário do vendedor responsável pela venda (em vez de um código global configurado nas credenciais da integração).

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CÓDIGO VOLUNTÁRIO                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Diretor acessa: Vendas > Equipe Comercial > Consultores         │
│                          │                                          │
│                          ▼                                          │
│  2. Edita consultor e preenche "Código SGA Voluntário"              │
│                          │                                          │
│                          ▼                                          │
│  3. Campo salvo na tabela profiles.codigo_sga_voluntario            │
│                          │                                          │
│                          ▼                                          │
│  4. Ao ativar associado/veículo no SGA:                             │
│     - Edge function busca o vendedor do contrato                    │
│     - Obtém profiles.codigo_sga_voluntario do vendedor              │
│     - Usa esse código no payload para API Hinova                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Etapa 1: Adicionar Campo na Tabela `profiles`

Criar migration para adicionar o campo `codigo_sga_voluntario`:

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS codigo_sga_voluntario VARCHAR(20);

COMMENT ON COLUMN profiles.codigo_sga_voluntario 
IS 'Código do voluntário no SGA Hinova para sincronização de veículos';
```

---

## Etapa 2: Criar Página de Gestão de Consultores

### Rota
- `/vendas/consultores` - Lista de consultores com CRUD

### Localização no Menu
- Vendas > Equipe Comercial > aba "Consultores" OU
- Botão "Gerenciar Consultores" na página de Propostas

### Funcionalidades da Página

1. **Listagem de consultores** (vendedores com roles comerciais)
   - Nome, telefone, email
   - Código SGA Voluntário (editável inline ou via modal)
   - Status (ativo/inativo)
   - Quantidade de leads/propostas

2. **Edição de consultor** (Sheet/Drawer lateral)
   - Campo: Código SGA Voluntário (input numérico, opcional)
   - Botão salvar

3. **Filtros**
   - Busca por nome
   - Filtro por role (vendedor_clt, vendedor_externo, etc.)

---

## Etapa 3: Criar Componentes

### Arquivo: `src/pages/vendas/Consultores.tsx`
Nova página com listagem e edição de consultores.

### Arquivo: `src/components/consultores/ConsultorEditSheet.tsx`
Sheet lateral para editar dados do consultor, incluindo o código SGA.

### Arquivo: `src/hooks/useConsultores.ts`
Hook para CRUD de consultores:
- `useConsultores()` - Lista consultores
- `useUpdateConsultor()` - Atualiza dados do consultor

---

## Etapa 4: Atualizar Edge Function `sga-hinova-sync`

Modificar a lógica para buscar o `codigo_sga_voluntario` do vendedor responsável:

```typescript
// Após buscar os dados do associado/veículo:

// Buscar vendedor do contrato/lead
const { data: contrato } = await supabase
  .from('contratos')
  .select('vendedor_id')
  .eq('associado_id', associado_id)
  .single();

// Buscar código voluntário do vendedor
if (contrato?.vendedor_id) {
  const { data: vendedor } = await supabase
    .from('profiles')
    .select('codigo_sga_voluntario')
    .eq('id', contrato.vendedor_id)
    .single();
  
  if (vendedor?.codigo_sga_voluntario) {
    // Usar código do vendedor ao invés do global
    hinovaCodigoVoluntario = vendedor.codigo_sga_voluntario;
  }
}
```

### Prioridade de Código Voluntário:
1. Código do vendedor responsável (se configurado)
2. Código global da integração (fallback)

---

## Etapa 5: Atualizar Rotas

### Arquivo: `src/App.tsx`
Adicionar rota:
```typescript
<Route path="/vendas/consultores" element={<Consultores />} />
```

---

## Resumo de Arquivos

| Arquivo | Ação |
|---------|------|
| `supabase/migrations/xxx.sql` | Adicionar coluna `codigo_sga_voluntario` em profiles |
| `src/pages/vendas/Consultores.tsx` | **CRIAR** - Página de gestão de consultores |
| `src/components/consultores/ConsultorEditSheet.tsx` | **CRIAR** - Sheet de edição |
| `src/hooks/useConsultores.ts` | **CRIAR** - Hook de CRUD |
| `supabase/functions/sga-hinova-sync/index.ts` | **EDITAR** - Usar código do vendedor |
| `src/App.tsx` | **EDITAR** - Adicionar rota |
| `src/pages/vendas/Propostas.tsx` | **EDITAR** - Adicionar botão "Gerenciar Consultores" |

---

## Interface Visual

### Tela de Consultores

```text
┌─────────────────────────────────────────────────────────────────────┐
│  👥 Consultores                              [+ Novo Consultor]     │
├─────────────────────────────────────────────────────────────────────┤
│  🔍 Buscar consultor...                         [Filtro por Role]   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ Nome               │ Telefone    │ Código SGA  │ Leads │ Ações│  │
│  ├───────────────────────────────────────────────────────────────┤  │
│  │ Maria Julia        │ 31 99999... │ 1234        │  45   │ ✏️   │  │
│  │ Kalayane Murado    │ 31 88888... │ 5678        │  32   │ ✏️   │  │
│  │ Leonardo Lopes     │ 31 77777... │ -----       │  28   │ ✏️   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Sheet de Edição

```text
┌─────────────────────────────────────┐
│  ✏️ Editar Consultor                │
├─────────────────────────────────────┤
│                                     │
│  👤 Maria Julia Florencio           │
│  📧 maria.julia@empresa.com         │
│  📱 31 99999-9999                   │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  Código SGA Voluntário              │
│  ┌───────────────────────────────┐  │
│  │ 1234                          │  │
│  └───────────────────────────────┘  │
│  💡 Código usado na API Hinova      │
│     para sincronizar veículos       │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│          [Cancelar] [💾 Salvar]     │
│                                     │
└─────────────────────────────────────┘
```

---

## Fluxo de Uso

1. Diretor acessa **Vendas > Equipe Comercial** (Propostas)
2. Clica em **"Gerenciar Consultores"** ou acessa **Vendas > Consultores**
3. Na lista, clica no botão de edição do consultor desejado
4. Preenche o campo **Código SGA Voluntário** com o código fornecido pelo Hinova
5. Salva
6. Ao ativar um associado/veículo no SGA, o sistema usa automaticamente o código do vendedor responsável pela venda
