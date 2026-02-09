
# Plano: Implementar Sistema de Multa de Retirada

## 📋 Resumo Executivo

Implementar o sistema de multa de R$ 400 para retiradas (não devolução, não comparecimento, aparelho danificado) com suporte a cobrança automática via ASAAS e registro manual para financeiro.

---

## 🔍 Análise de Padrões Encontrados

### Hooks Existentes Reutilizáveis
- **useAsaas.ts**: Já possui `criarCobranca()` mutation que integra com edge function `asaas-cobrancas`. Padrão: 
  ```typescript
  criarCobranca({
    billingType: 'BOLETO',
    value: 400,
    dueDate: 'YYYY-MM-DD',
    description: 'Multa rastreador',
    associado_id,
  })
  ```

### Tipos Já Definidos
- **src/types/retirada.ts**: Contém `FormaCobrancaMulta` com labels e `VALOR_MULTA_NAO_DEVOLUCAO = 400.00`
- **supabase types**: Tabela `servicos` já tem campos `multa_aplicada`, `multa_asaas_id`, `multa_cobrada_em`, `multa_valor`, `multa_motivo`, `multa_forma_cobranca`, `cancelamento_bloqueado_ate_devolucao`

### Padrão de Modal Encontrado
- **TratarAusenciaModal.tsx** (manutenção): Referência estrutural para modais de ação pós-serviço com RadioGroup para opções múltiplas

---

## 📦 Arquivos a Criar/Modificar

### 1. CRIAR: `src/hooks/useMultaRetirada.ts`

Novo hook com 3 mutations:

#### **useAplicarMulta()**
```typescript
interface AplicarMultaParams {
  servicoId: string;
  motivo: 'nao_devolveu' | 'nao_compareceu' | 'aparelho_danificado';
  formaCobranca: 'automatica_asaas' | 'manual_financeiro';
  bloquearCancelamento: boolean;
}

// Ações:
// 1. Atualiza servicos:
//    - multa_aplicada = true
//    - multa_valor = 400.00
//    - multa_motivo = motivo
//    - multa_cobrada_em = now()
//    - multa_forma_cobranca = formaCobranca
//    - cancelamento_bloqueado_ate_devolucao = bloquearCancelamento
// 2. Se formaCobranca = 'automatica_asaas':
//    - Chamar useAsaas().criarCobranca() passando associado_id + valor 400
//    - Salvar multa_asaas_id retornado (ou 'PENDENTE_CONFIG' em erro)
// 3. Se formaCobranca = 'manual_financeiro':
//    - Apenas registrar no banco
// 4. Invalidar queries: ['retiradas'], ['servicos']
```

**Tratamento de Erro ASAAS**: Se falhar, registra multa com `multa_asaas_id = 'PENDENTE_CONFIG'` e toast.warning ao invés de error.

#### **useCancelarMulta()**
```typescript
interface CancelarMultaParams {
  servicoId: string;
}

// Requer: isDiretor
// Ações:
// - multa_aplicada = false
// - cancelamento_bloqueado_ate_devolucao = false
// - Registra em histórico quem cancelou e quando
```

#### **useConsultarMultas()**
```typescript
interface FiltrosMulta {
  formaCobranca?: 'automatica_asaas' | 'manual_financeiro';
  associadoNome?: string;
  dataDe?: string;
  dataAte?: string;
}

// Query que lista:
// - Todos os serviços com multa_aplicada = true
// - Join com associados, veiculos, rastreadores
// - Retorna paginávelou listar sem paginação
```

---

### 2. CRIAR: `src/components/monitoramento/retirada/AplicarMultaModal.tsx`

Modal estruturado como TratarAusenciaModal:

**Props:**
```typescript
interface AplicarMultaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  retirada: {
    id: string; // servico.id
    associado?: { nome: string; cpf: string };
    rastreador?: { codigo: string };
    integridade?: IntegridadeAparelho;
  } | null;
  motivo?: 'nao_devolveu' | 'nao_compareceu' | 'aparelho_danificado'; // Pré-selecionado
}
```

**Seções:**
1. **Header**: "💰 Aplicar Multa de Rastreador" com ícone do lucide-react
2. **Info do Serviço**: Card com Associado, CPF, Rastreador (não editável)
3. **Motivo da Multa**: RadioGroup com 3 opções (se não pré-selecionado, pode mudar)
4. **Forma de Cobrança**: RadioGroup com 2 opções (Automática ASAAS / Manual)
5. **Checkbox Bloquear**: "Bloquear finalização do cancelamento até resolução"
6. **Valor**: R$ 400,00 (fixo, apenas exibição)
7. **Footer**: Botões Cancelar + "Confirmar Multa"

**Comportamento:**
- Se escolher Automática → mostrar mensagem "Boleto/PIX será gerado via ASAAS"
- Se escolher Manual → mostrar "Financeiro será notificado"
- Se integridade for danificado/violado/molhado → checkbox pré-marcado
- Ao confirmar: usar `useAplicarMulta().mutate()`

---

### 3. MODIFICAR: `src/hooks/useRetiradaRastreador.ts`

Adicionar tipo `MotivoMulta` para exports:
```typescript
export type MotivoMulta = 'nao_devolveu' | 'nao_compareceu' | 'aparelho_danificado';
```

---

### 4. ADICIONAR: Tipos em `src/types/retirada.ts`

```typescript
export type MotivoMulta = 'nao_devolveu' | 'nao_compareceu' | 'aparelho_danificado';

export const MOTIVO_MULTA_LABELS: Record<MotivoMulta, string> = {
  nao_devolveu: 'Não devolução do equipamento',
  nao_compareceu: 'Não comparecimento à retirada',
  aparelho_danificado: 'Aparelho devolvido danificado/violado',
};
```

---

## 🔗 Integração com Componentes Existentes

### Em `RetiradasPage.tsx` (Quando for criada):

Na tabela de retiradas, adicionar coluna/indicador visual:
- Ícone 💰 se `multa_aplicada = true`
  - Tooltip: "Multa R$400 — [motivo] — [forma]"
- Ícone 🔒 se `cancelamento_bloqueado_ate_devolucao = true`
  - Tooltip: "Cancelamento bloqueado até resolução"

No dropdown de ações:
- Se status `concluida` E integridade != 'integro': botão "Aplicar Multa (danificado)"
  - Abre `AplicarMultaModal` com `motivo` pré-selecionado como `'aparelho_danificado'`
- Se status `nao_compareceu`: botão "Aplicar Multa (48h)"
  - Abre `AplicarMultaModal` com `motivo` pré-selecionado como `'nao_compareceu'`
- Se status `concluida`: botão "Aplicar Multa" genérico
  - Abre `AplicarMultaModal` sem pré-seleção

### Em `TratarAusenciaRetirada.tsx` (Quando for criada):

Se coordenador escolher "Aplicar multa":
- Fechar este modal
- Abrir `AplicarMultaModal` com `motivo = 'nao_compareceu'`

### Sugestão pós-retirada danificada (em ExecutarRetirada.tsx):

Após técnico concluir retirada com `integridade != 'integro'`:
- Toast toast.warning(): "⚠️ Rastreador devolvido danificado. Considere aplicar multa de R$400."
- Destacar linha na tabela em cor amarela/laranja (quando RetiradasPage for exibir)

---

## 🔐 Permissões

- **Aplicar multa**: Diretor, Coordenador de Monitoramento
- **Cancelar multa**: Diretor apenas (validação no hook com `usePermissions`)
- **Consultar relatório**: Financeiro, Diretor

---

## 🎯 Fluxos de Integração

### Fluxo 1: Não Devolução (48h estourou)
```
Coordenador vê retirada pendente com data_agendada + 48h vencida
→ Clica "Aplicar Multa (não devolução)"
→ Abre AplicarMultaModal com motivo pré-selecionado
→ Escolhe forma cobrança
→ Confirma
→ useAplicarMulta executa (cria cobrança ASAAS se automática)
→ Tabela atualiza com ícone 💰
```

### Fluxo 2: Não Comparecimento
```
Técnico marca "Associado Ausente" em ExecutarRetirada
→ Status muda para 'nao_compareceu'
→ Coordenador vê retirada com status nao_compareceu
→ Clica "Tratar Ausência" (de outro prompt)
→ Modal oferece: reagendar OU aplicar multa
→ Se aplicar multa: abre AplicarMultaModal com motivo 'nao_compareceu'
→ (resto igual fluxo 1)
```

### Fluxo 3: Aparelho Danificado
```
Técnico seleciona integridade != 'integro' em ExecutarRetirada
→ Conclui retirada
→ Toast: "Considere aplicar multa"
→ Coordenador vê retirada com ícone de dano
→ Clica "Aplicar Multa (danificado)"
→ Abre AplicarMultaModal com motivo pré-selecionado
→ (resto igual fluxo 1)
```

---

## ⚠️ Considerações Técnicas

1. **ASAAS Fallback**: Se edge function `asaas-cobrancas` falhar, salvar `multa_asaas_id = 'PENDENTE_CONFIG'` e não impedir o fluxo. Toast.warning ao invés de error.

2. **Reutilização useAsaas**: O hook `useAsaas.criarCobranca()` já existe e integra com a edge function. Apenas chamar com params corretos.

3. **Edge Function Não Precisa Ser Criada**: A edge function `asaas-cobrancas` já existe com action `'criar'`. Usar conforme protocolo estabelecido.

4. **Bloqueio de Cancelamento**: Campo `cancelamento_bloqueado_ate_devolucao` já existe na tabela. Lógica de validação será feita em outro prompt quando integrar com módulo de Cadastro.

5. **Campos no Banco**: Todos os campos necessários já existem em `servicos`:
   - multa_aplicada
   - multa_valor
   - multa_motivo
   - multa_cobrada_em
   - multa_forma_cobranca
   - multa_asaas_id
   - cancelamento_bloqueado_ate_devolucao

---

## 📊 Estrutura de Dados

### Mutation Body para useAplicarMulta
```typescript
{
  servicoId: string;
  motivo: 'nao_devolveu' | 'nao_compareceu' | 'aparelho_danificado';
  formaCobranca: 'automatica_asaas' | 'manual_financeiro';
  bloquearCancelamento: boolean;
}
```

### Response
```typescript
{
  success: boolean;
  servicoId: string;
  multaId?: string; // Se automática
  asaasId?: string; // ID da cobrança no ASAAS (ou 'PENDENTE_CONFIG')
}
```

---

## ✅ Checklist de Implementação

- [ ] Criar `src/hooks/useMultaRetirada.ts` com mutations/queries
- [ ] Criar `src/components/monitoramento/retirada/AplicarMultaModal.tsx`
- [ ] Adicionar tipos em `src/types/retirada.ts`
- [ ] Exportar `AplicarMultaModal` em componentes/retirada/index.ts (se existir)
- [ ] Integrar indicadores visuais (💰, 🔒) em RetiradasPage (quando for criada)
- [ ] Integrar botões de ação (Aplicar Multa) em RetiradasPage (quando for criada)
- [ ] Integrar sugestão de multa em ExecutarRetirada.tsx (após conclusão com dano)
- [ ] Testar fluxo automático ASAAS + fallback manual

---

## 🔗 Dependências Externas

- **useAsaas()**: Hook existente em `src/hooks/useAsaas.ts` — usar para cobrança automática
- **Edge Function asaas-cobrancas**: Já existe, não precisa criar
- **usePermissions()**: Para validar que apenas Diretor cancela multa
- **Components UI**: Dialog, RadioGroup, Badge, Button, Checkbox (já existem)

