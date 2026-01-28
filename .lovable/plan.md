
# Plano: Acesso Antecipado ao App com Cobertura Parcial (Roubo/Furto)

## Objetivo

Permitir que associados com **cobertura de roubo e furto ativada** (mas sem cobertura total) possam:
1. Criar senha e acessar o app do associado
2. Ver funcionalidades limitadas apenas a roubo e furto
3. Receber informação da IA quando tentar acessar coberturas não ativas

## Diagnóstico do Estado Atual

### Problema 1: Criação de Conta Bloqueada para Cobertura Parcial

**Arquivo:** `src/pages/public/AcompanhamentoProposta.tsx` (linhas 209-241)

A lógica atual mostra o formulário de criação de conta apenas quando:
- `associado.status === 'ativo'` E `!associado.user_id`

**Mas**, logo depois (linhas 226-241), se tem `cobertura_roubo_furto` sem `cobertura_total`:
- Mostra status "cobertura_parcial" com `showCriarConta: false`
- Mensagem diz: "Aguarde a instalação do rastreador para cobertura total **e acesso ao app**"

Isso impede o cliente de criar a conta mesmo tendo cobertura ativa.

### Problema 2: App Não Diferencia Coberturas

**Arquivos afetados:**
- `src/pages/app/AppHome.tsx` - Mostra todos os atalhos (Assistência, Sinistro)
- `src/pages/app/NovoSinistro.tsx` - Permite todos os tipos de sinistro
- `supabase/functions/assistente-chat/index.ts` - IA não conhece as coberturas ativas

## Fluxos Esperados

| Cobertura | Funcionalidades Permitidas |
|-----------|---------------------------|
| Roubo/Furto apenas | Abrir sinistro de Roubo ou Furto, Consultar boletos, Documentos |
| Cobertura Total | Tudo: Assistência 24h, Todos tipos de sinistro, Rastreamento |

## Implementação

### 1. Permitir Criação de Conta com Cobertura Parcial

**Arquivo:** `src/pages/public/AcompanhamentoProposta.tsx`

Alterar a lógica em `getStatusInfo()`:

```typescript
// ANTES (linha 226-241)
// ATIVO COM COBERTURA PARCIAL - showCriarConta: false

// DEPOIS
// Verificar se tem cobertura_roubo_furto E não tem user_id → showCriarConta: true
if (associado.status === 'ativo' && veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total && !associado.user_id) {
  return {
    status: 'cobertura_parcial',
    icon: Shield,
    color: 'primary',
    title: 'Cobertura de Roubo e Furto Ativa!',
    description: 'Sua proteção contra roubo e furto está ativa. Crie sua conta para acessar o app!',
    showDetails: true,
    showCriarConta: true,  // ✅ HABILITAR criação de conta
    showInstalacao: true,
    // ...
  };
}

// Se já tem conta mas cobertura parcial
if (associado.status === 'ativo' && veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total && associado.user_id) {
  return {
    status: 'cobertura_parcial_conta_criada',
    // ...
    showCriarConta: false,
    description: 'Você já pode acessar o app! Login: /app/login',
  };
}
```

### 2. Adicionar Verificação de Cobertura no App

**Novo Hook:** `src/hooks/useMinhasCoberturasApp.ts`

Criar hook que retorna as coberturas ativas do veículo do associado:

```typescript
export function useMinhasCoberturas() {
  const { data: veiculos } = useVeiculosApp();
  
  const veiculo = veiculos?.[0];
  
  return {
    temCoberturaRouboFurto: veiculo?.cobertura_roubo_furto || false,
    temCoberturaTotal: veiculo?.cobertura_total || false,
    // Assistência 24h requer cobertura total
    podeAssistencia: veiculo?.cobertura_total || false,
    // Sinistros permitidos
    tiposSinistroPermitidos: veiculo?.cobertura_total 
      ? ['colisao', 'roubo', 'furto', 'incendio', 'fenomeno_natural', 'vandalismo', 'outro']
      : ['roubo', 'furto'],
  };
}
```

### 3. Atualizar Home para Mostrar Funcionalidades Baseadas em Cobertura

**Arquivo:** `src/pages/app/AppHome.tsx`

Modificar o grid de atalhos para desabilitar opções não cobertas:

```typescript
// Importar hook
import { useMinhasCoberturas } from '@/hooks/useMinhasCoberturasApp';

// No componente
const { podeAssistencia, temCoberturaTotal } = useMinhasCoberturas();

// No grid de atalhos - Assistência 24h
{podeAssistencia ? (
  <Link to="/app/assistencia">
    {/* Card normal */}
  </Link>
) : (
  <Card className="bg-gray-100 opacity-60 cursor-not-allowed">
    <CardContent className="p-4 flex flex-col items-center gap-2">
      <Phone className="h-6 w-6 text-gray-400" />
      <span className="text-sm text-gray-400">Assistência 24h</span>
      <Badge variant="outline" className="text-xs">Requer instalação</Badge>
    </CardContent>
  </Card>
)}

// Rastreamento - só se tiver cobertura total
{temCoberturaTotal && veiculoPrincipal?.rastreador_ativo && (
  <Card className="...">Rastreamento</Card>
)}
```

### 4. Filtrar Tipos de Sinistro Permitidos

**Arquivo:** `src/pages/app/NovoSinistro.tsx`

Filtrar os tipos de sinistro baseado na cobertura:

```typescript
import { useMinhasCoberturas } from '@/hooks/useMinhasCoberturasApp';

// No componente
const { tiposSinistroPermitidos, temCoberturaTotal } = useMinhasCoberturas();

// Filtrar lista de tipos
const tiposDisponiveis = TIPOS_SINISTRO.filter(tipo => 
  tiposSinistroPermitidos.includes(tipo.id)
);

// Mostrar mensagem se cobertura parcial
{!temCoberturaTotal && (
  <Alert className="mb-4">
    <AlertDescription>
      Sua cobertura atual é apenas para <strong>roubo e furto</strong>. 
      Após a instalação do rastreador, você terá cobertura total.
    </AlertDescription>
  </Alert>
)}
```

### 5. Instruir a IA sobre Coberturas

**Arquivo:** `supabase/functions/assistente-chat/index.ts`

Atualizar o contexto enviado para a IA incluindo informações de cobertura:

```typescript
// Na busca de veículos (linha 588-591), adicionar coberturas
const { data: veiculosResult } = await supabase
  .from("veiculos")
  .select("id, placa, marca, modelo, ano_modelo, cor, status, cobertura_roubo_furto, cobertura_total")
  .eq("associado_id", associado.id);

// No contexto do associado (linhas 625-629)
const veiculosTexto = veiculos.length > 0 
  ? veiculos.map((v: any) => {
      const coberturas = [];
      if (v.cobertura_roubo_furto) coberturas.push('Roubo/Furto');
      if (v.cobertura_total) coberturas.push('Total (inclui Assistência 24h)');
      const coberturaInfo = coberturas.length > 0 
        ? `Coberturas: ${coberturas.join(', ')}` 
        : 'Aguardando ativação de cobertura';
      return `- ${v.marca} ${v.modelo} (Placa: ${v.placa}, ${coberturaInfo}, ID: ${v.id})`;
    }).join('\n')
  : 'Nenhum veículo cadastrado';

// Adicionar instrução ao SYSTEM_PROMPT
// Após linha 91, adicionar:
`
## REGRAS DE COBERTURA (MUITO IMPORTANTE!)
- Verifique SEMPRE a cobertura do veículo antes de criar solicitações
- Se o veículo tem apenas cobertura "Roubo/Furto":
  - APENAS sinistros de roubo ou furto são permitidos
  - Assistência 24h (guincho, chaveiro, etc.) NÃO está disponível
  - Informe educadamente: "Sua cobertura atual é apenas para roubo e furto. Após a instalação do rastreador, você terá acesso à assistência 24h e cobertura total."
- Se o veículo tem cobertura "Total":
  - Todos os tipos de sinistro e assistência estão liberados
`
```

### 6. Atualizar Hook de Veículos para Incluir Coberturas

**Arquivo:** `src/hooks/useAppAssociado.ts`

Atualizar a query de veículos para trazer as coberturas:

```typescript
// Em useVeiculosApp (linha 64-71)
const { data, error } = await supabase
  .from('veiculos')
  .select(`
    id, placa, marca, modelo, ano_modelo, cor, status,
    cobertura_roubo_furto, cobertura_total,  // ✅ Adicionar
    rastreadores(id, status)
  `)
  .eq('associado_id', assoc.id)
  .eq('status', 'ativo');
```

Atualizar interface `VeiculoApp` em `src/types/app-associado.ts`:

```typescript
export interface VeiculoApp {
  // ... existentes
  cobertura_roubo_furto?: boolean;
  cobertura_total?: boolean;
}
```

## Arquivos a Serem Modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/public/AcompanhamentoProposta.tsx` | Permitir criação de conta com cobertura parcial |
| `src/hooks/useMinhasCoberturasApp.ts` | **Criar** - Hook para verificar coberturas ativas |
| `src/types/app-associado.ts` | Adicionar campos `cobertura_*` à interface `VeiculoApp` |
| `src/hooks/useAppAssociado.ts` | Incluir coberturas na query de veículos |
| `src/pages/app/AppHome.tsx` | Ocultar/desabilitar atalhos baseado em cobertura |
| `src/pages/app/NovoSinistro.tsx` | Filtrar tipos de sinistro permitidos |
| `supabase/functions/assistente-chat/index.ts` | Instruir IA sobre coberturas e restrições |

## Seção Técnica - Detalhes de Implementação

### Lógica Completa para `getStatusInfo()`

```typescript
// Verificar cobertura parcial ANTES da verificação de ativo genérico
// Ordem de prioridade:

// 1. Se tem roubo/furto mas não total E não tem conta → criar conta
if (associado.status === 'ativo' && veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total && !associado.user_id) {
  return {
    status: 'cobertura_parcial_criar_conta',
    icon: KeyRound,
    color: 'success',
    title: 'Cobertura Ativa - Crie sua Conta!',
    description: 'Sua proteção contra roubo e furto já está ativa. Crie sua conta para acessar o app.',
    showCriarConta: true,
    showInstalacao: true,
    // ...
  };
}

// 2. Se tem roubo/furto mas não total E já tem conta
if (associado.status === 'ativo' && veiculo?.cobertura_roubo_furto && !veiculo?.cobertura_total && associado.user_id) {
  return {
    status: 'cobertura_parcial',
    icon: Shield,
    color: 'primary',
    title: 'Cobertura Parcial Ativa',
    description: 'Sua proteção contra roubo e furto está ativa. Acesse o app e aguarde a instalação para cobertura total.',
    showCriarConta: false,
    showInstalacao: true,
    // ...
  };
}
```

### SYSTEM_PROMPT Atualizado para IA

```typescript
const REGRAS_COBERTURA = `
## REGRAS DE COBERTURA (VERIFICAR SEMPRE!)

Antes de criar qualquer solicitação, verifique a cobertura do veículo no contexto:

1. **Cobertura apenas "Roubo/Furto":**
   - ✅ Permitido: Sinistros de roubo ou furto
   - ❌ Bloqueado: Assistência 24h, colisão, incêndio, outros tipos
   - Resposta padrão: "Entendo sua necessidade, mas sua cobertura atual é apenas para roubo e furto. Após a instalação do rastreador, você terá acesso à cobertura total que inclui assistência 24h, colisão, e outros tipos de sinistro. Posso ajudar com algo relacionado a roubo ou furto?"

2. **Cobertura "Total":**
   - ✅ Tudo liberado: Assistência 24h, todos tipos de sinistro, rastreamento
`;

const SYSTEM_PROMPT = `...

${REGRAS_COBERTURA}

...`;
```

## Resultado Esperado

### Antes (Problema)
1. Cliente com cobertura roubo/furto não consegue criar conta
2. App mostra todas as opções mesmo sem cobertura total
3. IA não sabe das limitações de cobertura

### Depois (Corrigido)
1. Cliente com cobertura roubo/furto pode criar conta ✅
2. App mostra apenas opções cobertas (sinistro roubo/furto) ✅
3. Atalho de Assistência 24h desabilitado com "Requer instalação" ✅
4. IA informa educadamente sobre limitações de cobertura ✅
5. Após instalação e ativação total, tudo fica liberado ✅
