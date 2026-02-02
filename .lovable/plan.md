

# Plano: Simplificar Formulário de Novo Rastreador

## Resumo

Simplificar o formulário de criação de rastreadores para exibir apenas os 4 campos solicitados pelo usuário.

## Estado Atual

O formulário atual (`RastreadorFormDialog.tsx`) possui **9 campos**:
- Código * (obrigatório)
- Número de Série
- IMEI
- ICCID do Chip
- Plataforma *
- ID na Plataforma
- Status *
- Veículo (condicional - se status = instalado)
- Portador (condicional - se status = estoque)

## Nova Estrutura

O formulário deve exibir apenas **4 campos**:

| Campo | Obrigatório | Observação |
|-------|-------------|------------|
| IMEI | Sim | 15-17 dígitos numéricos |
| Plataforma | Sim | Select com opções cadastradas |
| Status | Não | Default: "Em Estoque" |
| Portador (Vistoriador) | Não | Exibido apenas se status = "estoque" |

## Regras de Negócio

1. **Código será gerado automaticamente** a partir do IMEI
   - Formato: `RAT-{IMEI}` (ex: `RAT-867322045123456`)
   - Isso satisfaz a constraint NOT NULL do banco de dados

2. **IMEI passa a ser obrigatório** no formulário de criação
   - Manter opcional apenas na edição (para compatibilidade com registros antigos)

3. **Status tem default** no banco (`estoque`), então será opcional no formulário

4. **Campos removidos da interface**:
   - Código (gerado automaticamente)
   - Número de Série
   - ICCID do Chip
   - ID na Plataforma
   - Veículo (removido - rastreador novo não pode estar "instalado")

## Alterações no Arquivo

**Arquivo:** `src/components/rastreadores/RastreadorFormDialog.tsx`

### 1. Atualizar Schema de Validação

```typescript
const rastreadorSchema = z.object({
  imei: z.string()
    .min(15, 'IMEI deve ter pelo menos 15 dígitos')
    .max(17, 'IMEI deve ter no máximo 17 dígitos')
    .refine((val) => /^\d{15,17}$/.test(val), {
      message: 'IMEI deve conter apenas dígitos numéricos',
    }),
  plataforma: z.string().min(1, 'Plataforma é obrigatória'),
  status: z.enum(['estoque', 'manutencao', 'baixado'] as const).default('estoque'),
  portador_id: z.string().uuid().optional().nullable(),
  // Campos mantidos apenas para edição
  codigo: z.string().optional(),
  numero_serie: z.string().optional().nullable(),
  chip_iccid: z.string().optional().nullable(),
  id_plataforma: z.string().optional().nullable(),
  veiculo_id: z.string().uuid().optional().nullable(),
});
```

### 2. Atualizar Função onSubmit

```typescript
const onSubmit = async (data: RastreadorFormData) => {
  try {
    const payload = {
      // Gerar código automaticamente a partir do IMEI (apenas na criação)
      codigo: isEditing ? (data.codigo || `RAT-${data.imei}`) : `RAT-${data.imei}`,
      imei: data.imei,
      plataforma: data.plataforma,
      status: data.status || 'estoque',
      portador_id: data.status === 'estoque' ? (data.portador_id || null) : null,
      // Manter outros campos apenas na edição
      numero_serie: isEditing ? data.numero_serie : null,
      chip_iccid: isEditing ? data.chip_iccid : null,
      id_plataforma: isEditing ? data.id_plataforma : null,
      veiculo_id: isEditing && data.status === 'instalado' ? data.veiculo_id : null,
    };
    // ... resto da função
  }
};
```

### 3. Simplificar Interface do Formulário

Remover campos desnecessários e reorganizar o layout:

```tsx
<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
  {/* IMEI - Obrigatório */}
  <FormField
    control={form.control}
    name="imei"
    render={({ field }) => (
      <FormItem>
        <FormLabel>IMEI *</FormLabel>
        <FormControl>
          <Input
            placeholder="000000000000000"
            maxLength={17}
            inputMode="numeric"
            {...field}
            value={field.value || ''}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '');
              field.onChange(value);
            }}
            className="font-mono"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* Plataforma - Obrigatório */}
  <FormField
    control={form.control}
    name="plataforma"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Plataforma *</FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          ...
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* Status - Opcional */}
  <FormField
    control={form.control}
    name="status"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Status</FormLabel>
        <Select onValueChange={field.onChange} value={field.value}>
          {/* Excluir 'instalado' das opções de criação */}
        </Select>
        <FormMessage />
      </FormItem>
    )}
  />

  {/* Portador - Apenas quando status = estoque */}
  {watchStatus === 'estoque' && (
    <FormField
      control={form.control}
      name="portador_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Atribuir a Vistoriador (Porte)</FormLabel>
          <Select ...>
            ...
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )}
</form>
```

### 4. Manter Edição Completa

Quando `isEditing = true`, exibir todos os campos originais para permitir edição completa dos registros existentes.

## Layout Visual

```text
┌──────────────────────────────────────────┐
│  Novo Rastreador                     [X] │
├──────────────────────────────────────────┤
│                                          │
│  IMEI *                                  │
│  ┌────────────────────────────────────┐  │
│  │ 000000000000000                    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Plataforma *                            │
│  ┌────────────────────────────────┬───┐  │
│  │ Selecione                      │ ▼ │  │
│  └────────────────────────────────┴───┘  │
│                                          │
│  Status                                  │
│  ┌────────────────────────────────┬───┐  │
│  │ Em Estoque                     │ ▼ │  │
│  └────────────────────────────────┴───┘  │
│                                          │
│  Atribuir a Vistoriador (Porte)          │
│  ┌────────────────────────────────┬───┐  │
│  │ Nenhum portador                │ ▼ │  │
│  └────────────────────────────────┴───┘  │
│                                          │
│             ┌──────────┐ ┌──────────┐    │
│             │ Cancelar │ │  Criar   │    │
│             └──────────┘ └──────────┘    │
└──────────────────────────────────────────┘
```

## Resumo das Alterações

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Campos visíveis (criação) | 9 | 4 |
| IMEI | Opcional | Obrigatório |
| Código | Manual | Automático (RAT-{IMEI}) |
| Status "instalado" | Disponível | Indisponível na criação |
| Complexidade visual | Alta | Baixa |

