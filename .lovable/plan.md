
# Plano: Unificar Criação de Vistoriadores com Fluxo de Usuários

## Contexto

Atualmente existem dois locais para criar profissionais de campo:
1. **Monitoramento → Equipe → Novo Profissional** (modal `ProfissionalModal`)
2. **Configurações → Usuários e Acessos → Novo Usuário** (página `UsuarioForm`)

O problema é que o modal em "Equipe" atualmente **não cria usuários reais** no sistema de autenticação — ele tenta apenas atualizar um profile existente, lançando erro se tentar criar novo.

## Objetivos

1. O modal "Novo Profissional" em Monitoramento → Equipe deve criar um usuário **completo** (auth + profile + role)
2. Utilizar a mesma Edge Function `create-user` já existente
3. Atribuir automaticamente a role `instalador_vistoriador` ou `vistoriador_base`
4. Campo de **Região** deve ser **opcional** (conforme solicitado) e salvo em `profiles.regioes_atendimento`
5. Sincronizar comportamento entre os dois fluxos de criação

## Alterações Necessárias

### 1. Atualizar Edge Function `create-user`

**Arquivo:** `supabase/functions/create-user/index.ts`

Adicionar suporte para salvar campos específicos de vistoriadores:
- `regioes_atendimento` (array de strings)
- `capacidade_diaria` (número)

```typescript
interface CreateUserRequest {
  // ... campos existentes
  regioes_atendimento?: string[];  // NOVO
  capacidade_diaria?: number;       // NOVO
}

// Após criar o profile, atualizar campos específicos
const updateData: any = { primeiro_acesso: !senha };
if (cpf) updateData.cpf = cpf;
if (telefone) updateData.telefone = telefone;
if (regioes_atendimento?.length) updateData.regioes_atendimento = regioes_atendimento;  // NOVO
if (capacidade_diaria) updateData.capacidade_diaria = capacidade_diaria;                 // NOVO
```

### 2. Atualizar Modal `ProfissionalModal`

**Arquivo:** `src/components/monitoramento/ProfissionalModal.tsx`

#### 2.1 Adicionar campo de tipo de vistoriador
```typescript
// No schema
tipoVistoriador: z.enum(['instalador_vistoriador', 'vistoriador_base']),

// Na interface
tipoVistoriador: 'instalador_vistoriador' | 'vistoriador_base';
```

#### 2.2 Tornar regiões opcionais (atualmente obrigatório)
```typescript
// ANTES
regioes: z.array(z.string()).min(1, 'Selecione pelo menos uma região'),

// DEPOIS
regioes: z.array(z.string()).default([]),  // Opcional
```

#### 2.3 Adicionar Select para tipo de vistoriador
```tsx
<FormField
  control={form.control}
  name="tipoVistoriador"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Tipo de Acesso *</FormLabel>
      <Select value={field.value} onValueChange={field.onChange}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="instalador_vistoriador">
            Vistoriador de Campo (rota)
          </SelectItem>
          <SelectItem value="vistoriador_base">
            Vistoriador de Base
          </SelectItem>
        </SelectContent>
      </Select>
      <FormDescription>
        Define qual interface o profissional terá acesso
      </FormDescription>
      <FormMessage />
    </FormItem>
  )}
/>
```

### 3. Atualizar Hook `useSaveProfissional`

**Arquivo:** `src/hooks/useEquipe.ts`

Modificar a mutation para chamar a Edge Function `create-user` ao criar novo profissional:

```typescript
export function useSaveProfissional() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id?: string;
      nome: string;
      email: string;
      telefone: string;
      cpf?: string;
      regioes_atendimento?: string[];
      capacidade_diaria?: number;
      ativo?: boolean;
      tipoVistoriador?: 'instalador_vistoriador' | 'vistoriador_base';
      senhaProvisoria?: string;
    }) => {
      if (data.id) {
        // ATUALIZAR profile existente
        const { error } = await supabase
          .from('profiles')
          .update({
            nome: data.nome,
            telefone: data.telefone,
            cpf: data.cpf,
            regioes_atendimento: data.regioes_atendimento,
            capacidade_diaria: data.capacidade_diaria,
            ativo: data.ativo,
          })
          .eq('id', data.id);

        if (error) throw error;
        return { success: true, updated: true };
      } else {
        // CRIAR novo usuário via Edge Function
        const { data: result, error } = await supabase.functions.invoke('create-user', {
          body: {
            nome: data.nome,
            email: data.email,
            telefone: data.telefone,
            cpf: data.cpf,
            senha: data.senhaProvisoria,
            tipo: 'prestador',  // Prestador = profissional externo
            perfis: [data.tipoVistoriador || 'instalador_vistoriador'],
            regioes_atendimento: data.regioes_atendimento,
            capacidade_diaria: data.capacidade_diaria,
          }
        });

        if (error) throw error;
        if (result?.error) throw new Error(result.error);
        
        return { success: true, created: true };
      }
    },
    // ... invalidate queries
  });
}
```

### 4. Atualizar UsuarioForm para exibir campos de região

**Arquivo:** `src/pages/configuracoes/UsuarioForm.tsx`

Exibir seção de "Regiões de Atendimento" quando o perfil selecionado for `instalador_vistoriador` ou `vistoriador_base`:

```tsx
{/* Mostrar apenas se for vistoriador */}
{formData.perfis.some(p => ['instalador_vistoriador', 'vistoriador_base'].includes(p)) && (
  <Card className="border-border/50 border-yellow-500/30">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <MapPin className="w-5 h-5 text-yellow-500" />
        Configurações de Campo
      </CardTitle>
      <CardDescription>
        Configurações específicas para vistoriadores (opcional)
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Regiões de Atendimento */}
      <div className="space-y-2">
        <Label>Regiões de Atuação</Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {REGIOES_ATENDIMENTO.map((regiao) => (
            <label key={regiao.value} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={formData.regioes_atendimento?.includes(regiao.value)}
                onCheckedChange={(checked) => {
                  const current = formData.regioes_atendimento || [];
                  setFormData({
                    ...formData,
                    regioes_atendimento: checked 
                      ? [...current, regiao.value]
                      : current.filter(r => r !== regiao.value)
                  });
                }}
              />
              {regiao.label}
            </label>
          ))}
        </div>
      </div>
      
      {/* Capacidade Diária */}
      <div className="space-y-2">
        <Label>Capacidade Diária</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={formData.capacidade_diaria || 10}
          onChange={(e) => setFormData({...formData, capacidade_diaria: parseInt(e.target.value)})}
        />
        <p className="text-xs text-muted-foreground">Máximo de tarefas por dia (1-20)</p>
      </div>
    </CardContent>
  </Card>
)}
```

### 5. Atualizar Página Equipe para passar dados corretos

**Arquivo:** `src/pages/monitoramento/Equipe.tsx`

Atualizar o `handleSave` para incluir novos campos:

```typescript
const handleSave = (data: ProfissionalFormData) => {
  saveProfissional(
    {
      id: profissionalSelecionado?.id,
      nome: data.nome,
      email: data.email,
      telefone: data.telefone,
      cpf: data.cpf,
      regioes_atendimento: data.regioes,  // Pode ser vazio
      capacidade_diaria: data.capacidadeDiaria,
      ativo: data.status === 'disponivel',
      tipoVistoriador: data.tipoVistoriador,
      senhaProvisoria: data.senhaProvisoria,
    },
    // callbacks...
  );
};
```

---

## Resumo de Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/create-user/index.ts` | Adicionar suporte para `regioes_atendimento` e `capacidade_diaria` |
| `src/components/monitoramento/ProfissionalModal.tsx` | Adicionar tipo de vistoriador, tornar regiões opcionais |
| `src/hooks/useEquipe.ts` | Integrar com Edge Function para criar novos profissionais |
| `src/pages/monitoramento/Equipe.tsx` | Passar novos campos para o hook |
| `src/pages/configuracoes/UsuarioForm.tsx` | Adicionar seção de "Configurações de Campo" para vistoriadores |

---

## Fluxo Final

```
┌─────────────────────────────────────────────────────────────┐
│  MONITORAMENTO → EQUIPE → NOVO PROFISSIONAL                │
├─────────────────────────────────────────────────────────────┤
│  [Dados Pessoais]                                           │
│  Nome, CPF, Email, Telefone, WhatsApp                       │
├─────────────────────────────────────────────────────────────┤
│  [Endereço Base]                                            │
│  CEP, Logradouro, Número, Bairro, Cidade, UF                │
├─────────────────────────────────────────────────────────────┤
│  [Configurações de Trabalho]                                │
│  Tipo de Acesso *:  [ Vistoriador Campo ▼ ]                │
│                     [ Vistoriador Base   ]                  │
│                                                             │
│  Regiões de atuação (opcional):                            │
│  ☐ SP Centro  ☐ SP Zona Sul  ☐ SP Zona Norte               │
│  ☐ ABC        ☐ Campinas     ☐ Santos                      │
│                                                             │
│  Capacidade diária: [10]                                    │
├─────────────────────────────────────────────────────────────┤
│  [Acesso ao Sistema]                                        │
│  ☑ Criar acesso ao app mobile                              │
│  Senha provisória: [********]                               │
├─────────────────────────────────────────────────────────────┤
│                          [Cancelar] [Salvar]                │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Unificação**: Mesmo fluxo de criação em ambos os locais
2. **Segurança**: Usuário criado corretamente com auth + profile + role
3. **Flexibilidade**: Regiões opcionais para uso futuro
4. **Acesso imediato**: Profissional criado já pode usar o App do Vistoriador
