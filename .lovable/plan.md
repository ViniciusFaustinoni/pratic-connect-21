
# Plano: Centralizar e Melhorar Visual da Análise de Proposta

## Contexto

A tela de análise de proposta pelo analista de cadastro precisa de melhorias visuais para:
1. Centralizar elementos importantes
2. Criar uma estrutura mais atrativa e organizada
3. Melhorar a hierarquia visual da informação

## Melhorias Propostas

### 1. Container Principal Centralizado

Adicionar largura máxima e centralização ao container principal:

| Antes | Depois |
|-------|--------|
| `<div className="space-y-6">` | `<div className="max-w-7xl mx-auto space-y-6 px-4 lg:px-0">` |

### 2. Card de Status da Proposta

Centralizar o conteúdo e melhorar o visual:
- Badge de status maior e mais destacado
- Texto de descrição centralizado
- Adicionar ícone relacionado ao status

### 3. Card de Ações

Melhorar a apresentação dos botões:
- Título centralizado
- Espaçamento mais uniforme entre botões
- Efeitos hover mais suaves

### 4. Cards de Dados (Cliente, Veículo, Contrato)

Melhorar os InfoItems:
- Ícones com cores temáticas (não apenas muted)
- Melhor alinhamento dos textos
- Adicionar divisores sutis entre seções

### 5. Seção de Documentos e Fotos

Melhorar a apresentação:
- Grid mais uniforme
- Thumbnails maiores nas fotos
- Badges de data mais visíveis

## Alterações por Arquivo

### Arquivo: `src/pages/cadastro/PropostaAnalise.tsx`

#### 1. Componente InfoItem (linhas 94-118)
Melhorar com ícones coloridos e layout mais limpo:

```typescript
function InfoItem({
  icon: Icon,
  label,
  value,
  highlight,
  iconColor = 'text-muted-foreground',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  iconColor?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted/50 flex-shrink-0">
        <Icon className={cn("h-4 w-4", iconColor)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className={cn(
          "text-foreground break-words", 
          highlight && "font-semibold text-base"
        )}>
          {value || '---'}
        </p>
      </div>
    </div>
  );
}
```

#### 2. Container Principal (linha 322)
Centralizar e limitar largura:

```typescript
<div className="max-w-7xl mx-auto space-y-6">
```

#### 3. Header (linhas 324-353)
Centralizar melhor e adicionar borda inferior sutil:

```typescript
<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-4 border-b border-border">
```

#### 4. Card de Status (linhas 643-655)
Melhorar visual e centralização:

```typescript
<Card className="border-border bg-card">
  <CardHeader className="text-center pb-2">
    <CardTitle className="text-foreground">Status da Proposta</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col items-center gap-4 pt-2">
    <StatusBadge status={proposta.status} />
    {proposta.status === 'assinado' && (
      <p className="text-sm text-muted-foreground text-center max-w-xs">
        Esta proposta está aguardando sua análise e aprovação.
      </p>
    )}
  </CardContent>
</Card>
```

#### 5. Card de Ações (linhas 685-858)
Centralizar título e melhorar espaçamento:

```typescript
<Card className="border-border bg-card">
  <CardHeader className="text-center pb-2">
    <CardTitle className="text-foreground">Ações</CardTitle>
    <CardDescription className="text-center">
      {proposta.status === 'assinado' && !proposta.tem_documento_pendente
        ? 'Analise os dados e tome uma decisão'
        : 'Ações indisponíveis no momento'}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-3">
    {/* ... botões com espaçamento uniforme */}
  </CardContent>
</Card>
```

#### 6. Cards de Dados com Ícones Coloridos

Usar cores temáticas nos InfoItems:

| Card | Cor do Ícone |
|------|--------------|
| Dados do Cliente | `text-primary` |
| Dados do Veículo | `text-purple-500` |
| Dados do Contrato | `text-emerald-500` |
| Instalação | `text-blue-500` |

## Resultado Visual Esperado

```text
┌─────────────────────────────────────────────────────────────────────┐
│                      ANÁLISE DE PROPOSTA                            │
│                   Contrato #CTR-2026...                             │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │                             │  │     STATUS DA PROPOSTA      │  │
│  │    📋 DADOS DO CLIENTE      │  │                             │  │
│  │                             │  │  [🟡 Aguardando Análise]    │  │
│  │    Nome  │  CPF             │  │                             │  │
│  │    Fone  │  Email           │  │  Aguardando sua análise     │  │
│  │    Endereço                 │  │                             │  │
│  │                             │  └─────────────────────────────┘  │
│  └─────────────────────────────┘                                    │
│                                    ┌─────────────────────────────┐  │
│  ┌─────────────────────────────┐  │     📄 DOCUMENTOS           │  │
│  │                             │  │                             │  │
│  │    🚗 DADOS DO VEÍCULO      │  │  ┌──────┐ ┌──────┐          │  │
│  │                             │  │  │ CNH  │ │ CRLV │          │  │
│  │    Modelo │  Placa          │  │  └──────┘ └──────┘          │  │
│  │    Ano    │  Cor            │  │                             │  │
│  │                             │  └─────────────────────────────┘  │
│  └─────────────────────────────┘                                    │
│                                    ┌─────────────────────────────┐  │
│  ┌─────────────────────────────┐  │          AÇÕES              │  │
│  │                             │  │                             │  │
│  │    📋 DADOS DO CONTRATO     │  │  [✓ APROVAR PROPOSTA   ]    │  │
│  │                             │  │  [📄 Solicitar Docs    ]    │  │
│  │    Número │  Plano          │  │  [✗ Reprovar           ]    │  │
│  │    Valor  │  Assinatura     │  │  [↑ Enviar para SGA    ]    │  │
│  │                             │  │                             │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Alterações |
|---------|------------|
| `src/pages/cadastro/PropostaAnalise.tsx` | Container, InfoItem, Cards, Espaçamentos |

## Benefícios

1. **Hierarquia visual clara** - Status e ações ficam em destaque
2. **Melhor leitura** - Espaçamento e centralização uniformes
3. **Cores temáticas** - Ícones coloridos identificam cada seção
4. **Responsividade** - Layout adapta bem em diferentes tamanhos
5. **Consistência** - Padrão visual uniforme em toda a página
