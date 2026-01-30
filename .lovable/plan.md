
# Plano: Implementação de Campanhas de Desconto

## Resumo

Implementar um sistema completo de campanhas de desconto que permite ao diretor criar e gerenciar campanhas promocionais, e ao consultor selecionar campanhas ativas durante a cotação, aplicando descontos automáticos no valor mensal.

## Visão Geral da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE CAMPANHAS DE DESCONTO                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DIRETORIA                         COTAÇÃO                                  │
│  ┌──────────────────┐              ┌──────────────────────────────────────┐ │
│  │ CRUD Campanhas   │              │ Seleção de Campanha Ativa           │ │
│  │ • Nome           │   ────────▶  │                                      │ │
│  │ • Tipo (% ou R$) │              │ [v] Campanha: Black Friday -5%       │ │
│  │ • Valor          │              │                                      │ │
│  │ • Vigência       │              │ Valor Normal: R$ 100,00/mês         │ │
│  │ • Meses          │              │ Valor Promocional: R$ 95,00/mês     │ │
│  │ • Status         │              │ (Válido por 3 meses)                │ │
│  └──────────────────┘              └──────────────────────────────────────┘ │
│                                              │                              │
│                                              ▼                              │
│                              ┌─────────────────────────────────────────┐    │
│                              │           COTAÇÃO SALVA                 │    │
│                              │ • campanha_id: uuid                     │    │
│                              │ • valor_mensal_original: R$ 100        │    │
│                              │ • valor_mensal_promocional: R$ 95      │    │
│                              │ • meses_desconto: 3                     │    │
│                              └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Parte 1: Estrutura de Dados

### Nova Tabela: `campanhas_desconto`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | Identificador único |
| `nome` | VARCHAR | Nome da campanha (ex: "Black Friday 2026") |
| `descricao` | TEXT | Descrição detalhada |
| `tipo_beneficio` | VARCHAR | `percentual` ou `valor_fixo` |
| `valor_beneficio` | NUMERIC | Valor do desconto (ex: 5 para 5% ou 10 para R$10) |
| `data_inicio` | DATE | Data de início da vigência |
| `data_fim` | DATE | Data de término da vigência |
| `meses_aplicacao` | INTEGER | Quantidade de meses com desconto |
| `status` | VARCHAR | `ativa` ou `inativa` |
| `criado_por` | UUID | ID do usuário que criou |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

### Alterações na Tabela `cotacoes`

Adicionar novos campos:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `campanha_desconto_id` | UUID | FK para campanhas_desconto |
| `valor_mensal_promocional` | NUMERIC | Valor com desconto aplicado |
| `meses_desconto_campanha` | INTEGER | Meses de duração do desconto |

## Parte 2: CRUD de Campanhas (Diretoria)

### Nova Página: `src/pages/diretoria/CampanhasDesconto.tsx`

Interface com:
- Lista de campanhas em tabela
- Filtros: Status (ativa/inativa), Período
- Botão "Nova Campanha"
- Ações: Editar, Ativar/Desativar, Excluir

### Novo Componente: `src/components/diretoria/CampanhaDescontoModal.tsx`

Modal de criação/edição com campos:
- Nome da campanha
- Descrição
- Tipo de benefício (select: Percentual / Valor Fixo)
- Valor do benefício (input numérico)
- Data início e Data fim (date pickers)
- Quantidade de meses de aplicação
- Status (switch ativo/inativo)

### Novo Hook: `src/hooks/useCampanhasDesconto.ts`

```typescript
// Listagem de campanhas
useCampanhasDesconto(filtros?: { status?: string })

// Campanhas ativas e vigentes (para cotação)
useCampanhasDescontoVigentes()

// Mutations
useCreateCampanhaDesconto()
useUpdateCampanhaDesconto()
useDeleteCampanhaDesconto()
useToggleCampanhaDescontoStatus()
```

## Parte 3: Integração na Cotação

### Modificações no `src/pages/vendas/Cotador.tsx`

1. **Novo estado para campanha selecionada:**
```typescript
const [campanhaDesconto, setCampanhaDesconto] = useState<CampanhaDesconto | null>(null);
```

2. **Buscar campanhas vigentes:**
```typescript
const { data: campanhasVigentes } = useCampanhasDescontoVigentes();
```

3. **Novo componente de seleção de campanha** (antes da exibição dos planos):
```tsx
<SeletorCampanhaDesconto
  campanhas={campanhasVigentes}
  campanhaId={campanhaDesconto?.id}
  onSelect={setCampanhaDesconto}
/>
```

4. **Exibição de valores com desconto nos cards de plano:**
```tsx
// Valor promocional
<div className="flex items-center gap-2">
  <span className="text-3xl font-bold text-primary">
    {formatarMoeda(valorComDesconto)}
  </span>
  <span className="text-sm text-muted-foreground line-through">
    {formatarMoeda(valorOriginal)}
  </span>
</div>
<p className="text-sm text-success">
  Desconto válido por {campanhaDesconto.meses_aplicacao} meses
</p>
```

5. **Salvar campanha na cotação:**
```typescript
const cotacaoData = await criarCotacao.mutateAsync({
  // ... outros campos
  campanha_desconto_id: campanhaDesconto?.id,
  valor_mensal_promocional: valorComDesconto,
  meses_desconto_campanha: campanhaDesconto?.meses_aplicacao,
});
```

### Novo Componente: `src/components/cotador/SeletorCampanhaDesconto.tsx`

```tsx
<Card className="border-amber-500/30 bg-amber-500/5">
  <CardContent className="p-4">
    <div className="flex items-center gap-2 mb-3">
      <Ticket className="h-5 w-5 text-amber-500" />
      <span className="font-medium">Campanha Promocional</span>
    </div>
    <Select value={campanhaId} onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Selecione uma campanha (opcional)" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">Sem campanha</SelectItem>
        {campanhas.map(c => (
          <SelectItem key={c.id} value={c.id}>
            {c.nome} ({c.tipo_beneficio === 'percentual' 
              ? `-${c.valor_beneficio}%` 
              : `-R$ ${c.valor_beneficio}`})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
```

## Parte 4: Cálculo de Desconto

### Função de Cálculo

```typescript
function calcularValorComDesconto(
  valorOriginal: number,
  campanha: CampanhaDesconto | null
): { valorPromocional: number; economia: number } {
  if (!campanha) {
    return { valorPromocional: valorOriginal, economia: 0 };
  }

  let valorPromocional: number;
  
  if (campanha.tipo_beneficio === 'percentual') {
    valorPromocional = valorOriginal * (1 - campanha.valor_beneficio / 100);
  } else {
    valorPromocional = valorOriginal - campanha.valor_beneficio;
  }

  // Garantir valor mínimo
  valorPromocional = Math.max(valorPromocional, 0);

  return {
    valorPromocional: Math.round(valorPromocional * 100) / 100,
    economia: Math.round((valorOriginal - valorPromocional) * 100) / 100,
  };
}
```

## Parte 5: Exibição na Proposta e PDF

### Alterações no `EscolhaPlano.tsx` (Link Público)

Exibir informações da campanha quando houver:
- Badge "Promoção Ativa"
- Valor original riscado + valor promocional
- Texto: "Após X meses, retorna ao valor normal de R$ Y"

### Alterações na Geração de PDF

No arquivo de geração de proposta PDF, incluir:
- Nome da campanha
- Período promocional (X meses)
- Valor mensal promocional vs valor normal
- Aviso sobre retorno ao valor normal

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/diretoria/CampanhasDesconto.tsx` | Página CRUD de campanhas |
| `src/components/diretoria/CampanhaDescontoModal.tsx` | Modal de edição |
| `src/hooks/useCampanhasDesconto.ts` | Hooks de gerenciamento |
| `src/components/cotador/SeletorCampanhaDesconto.tsx` | Seletor na cotação |
| `src/types/campanha-desconto.ts` | Tipos TypeScript |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/vendas/Cotador.tsx` | Adicionar seleção de campanha e cálculo |
| `src/hooks/useCotacao.ts` | Incluir campos de campanha no payload |
| `src/components/cotacao-publica/EscolhaPlano.tsx` | Exibir valor promocional |
| `src/lib/gerarPdfCotacao.ts` | Incluir info de campanha no PDF |
| Rotas/Menu da Diretoria | Adicionar link para Campanhas |

## Migração SQL

```sql
-- Criar tabela de campanhas de desconto
CREATE TABLE campanhas_desconto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  tipo_beneficio VARCHAR(20) NOT NULL CHECK (tipo_beneficio IN ('percentual', 'valor_fixo')),
  valor_beneficio NUMERIC(10,2) NOT NULL CHECK (valor_beneficio > 0),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  meses_aplicacao INTEGER NOT NULL DEFAULT 1 CHECK (meses_aplicacao >= 1),
  status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  criado_por UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT data_fim_maior_inicio CHECK (data_fim >= data_inicio)
);

-- Adicionar campos na tabela cotacoes
ALTER TABLE cotacoes 
ADD COLUMN campanha_desconto_id UUID REFERENCES campanhas_desconto(id),
ADD COLUMN valor_mensal_promocional NUMERIC(10,2),
ADD COLUMN meses_desconto_campanha INTEGER;

-- Índices
CREATE INDEX idx_campanhas_desconto_status ON campanhas_desconto(status);
CREATE INDEX idx_campanhas_desconto_vigencia ON campanhas_desconto(data_inicio, data_fim);
CREATE INDEX idx_cotacoes_campanha ON cotacoes(campanha_desconto_id);

-- RLS
ALTER TABLE campanhas_desconto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campanhas visíveis para autenticados" ON campanhas_desconto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Campanhas editáveis por diretoria/admin" ON campanhas_desconto
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.cargo IN ('diretor', 'admin_master')
    )
  );
```

## Regras de Negócio Implementadas

| Regra | Implementação |
|-------|---------------|
| Apenas campanhas ativas e vigentes aparecem na cotação | Query filtra por `status = 'ativa' AND data_inicio <= NOW() AND data_fim >= NOW()` |
| Valor promocional exibido junto com valor original | UI mostra ambos valores lado a lado |
| Campanha registrada na cotação e proposta | Campos `campanha_desconto_id`, `valor_mensal_promocional`, `meses_desconto_campanha` |
| Sem campanha = valor padrão | Se `campanha_desconto_id` é null, usa `valor_total_mensal` |
| Informação consistente em todas as visualizações | Tela, proposta e PDF usam mesmos dados |

## Fluxo Visual da Exibição de Preços

```text
┌──────────────────────────────────────────────────────────────────┐
│  💰 VALORES                                                      │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Mensalidade:                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ R$ 95,00/mês ────────────── R$ 100,00 (valor normal)      │  │
│  │ ▲ valor promocional         ▲ riscado                      │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ⚠️ Promoção válida por 3 meses.                                 │
│  Após este período, a mensalidade será de R$ 100,00.            │
│                                                                  │
│  Economia total: R$ 15,00 (3x R$ 5,00)                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Flexibilidade comercial** - Campanhas podem ser criadas rapidamente pela diretoria
2. **Transparência** - Cliente vê claramente o valor promocional vs normal
3. **Rastreabilidade** - Cada cotação registra qual campanha foi aplicada
4. **Automação** - Sistema filtra automaticamente campanhas expiradas
5. **Consistência** - Mesma informação em todas as visualizações (tela, PDF, proposta)
