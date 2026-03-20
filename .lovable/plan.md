

# Plano: Carência de Vidros e Faróis — Configurável, End-to-End

## Estado Atual

**Configuração**: Não existe campo específico para carência de vidros na tabela `configuracoes`. Existe `carencia_dias_padrao` (120), que é a carência geral. A carência de vidros está hardcoded como `120` em `src/types/sinistros.ts` (linha 376) e na validação do `NovoSinistroModal.tsx` (linha 284).

**Banco**: A tabela `contratos` tem `data_carencia_inicio` e `data_carencia_fim` (carência geral), mas **não tem** colunas para carência específica de vidros/faróis.

**Ficha do associado**: O `OrigemCadastroCard` e `useAssociadoSituacao` exibem a carência geral. Não há menção a carência de vidros.

**App do associado**: `AppPlano.tsx` lista benefícios do plano mas não diferencia status de carência de vidros.

**Proposta PDF**: `useGerarProposta.ts` não inclui informação de carência de vidros.

**Edge Functions**: `contrato-gerar`, `efetivar-substituicao` e `efetivar-troca-titularidade` gravam carência geral, mas não gravam carência de vidros.

---

## Implementação

### 1. Criar configuração `carencia_beneficio_vidros_dias` (valor padrão: 120)
- INSERT na tabela `configuracoes` via migration
- Adicionar campo editável na aba Regras de Venda (`RegrasVendaContent.tsx`), no bloco de Taxas/Carências, com label "Carência do benefício de vidros e faróis em dias"

### 2. Migration: adicionar colunas no contrato
```sql
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS data_carencia_vidros_inicio date;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS data_carencia_vidros_fim date;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS carencia_vidros_isenta boolean DEFAULT false;
ALTER TABLE contratos ADD COLUMN IF NOT EXISTS carencia_vidros_motivo_isencao text;
```

### 3. Gravar carência de vidros em todos os fluxos de geração de contrato

**`contrato-gerar/index.ts`**: Ler `carencia_beneficio_vidros_dias` via config-helper. Para todos os `tipo_entrada` (nova, adesao, inclusao, substituicao_placa, reativacao), calcular e gravar `data_carencia_vidros_inicio` e `data_carencia_vidros_fim`. Para migração com isenção, gravar `carencia_vidros_isenta = true` com motivo.

**`efetivar-substituicao/index.ts`**: Mesma lógica — ler config, calcular datas, gravar no insert do novo contrato.

**`efetivar-troca-titularidade/index.ts`**: Mesma lógica — ler config, calcular datas, gravar no insert.

**`useSolicitacoesMigracaoAdmin.ts`**: Quando migração é aprovada com isenção, gravar `carencia_vidros_isenta: true`, `carencia_vidros_motivo_isencao: 'Migração aprovada'`, datas nulas.

### 4. Hook utilitário `useCarenciaVidrosDias`
- Criar em `useConteudosSistema.ts`: `useCarenciaVidrosDias()` → lê `carencia_beneficio_vidros_dias` da config (fallback 120)

### 5. Ficha do associado — exibir status de carência de vidros
- `OrigemCadastroCard.tsx`: buscar as 4 novas colunas do contrato. Renderizar seção "Carência Vidros e Faróis":
  - Em carência → "Em carência — X dias restantes (término em DD/MM/AAAA)"
  - Cumprida → "Disponível sem restrição"
  - Isenta → "Isento — origem: migração aprovada"

### 6. App do associado — indicar status no benefício
- `AppPlano.tsx`: Para o benefício `VIDROS_FAROIS`, buscar contrato ativo do associado e mostrar badge:
  - Em carência → badge amarelo "Em carência — X dias restantes"
  - Disponível → badge verde "Disponível"
  - Isenta → badge verde "Isento — migração"

### 7. Proposta PDF — incluir informação de carência de vidros
- `useGerarProposta.ts`: Adicionar seção "CARÊNCIA DE VIDROS E FARÓIS" no PDF com data de início e término calculadas a partir dos dados da cotação
- `DadosProposta` (types/proposta.ts): Adicionar campo `carenciaVidros?: { inicio: string; fim: string; isenta?: boolean }`
- `Cotador.tsx`: Popular o campo ao montar `dadosProposta`

### 8. Corrigir validação hardcoded no sinistro
- `NovoSinistroModal.tsx` linha 284: substituir `120` por `carenciaDiasVal` (que já é lido da config geral). Idealmente, trocar para ler do contrato do associado (`data_carencia_vidros_fim`) em vez de recalcular.
- `src/types/sinistros.ts` linha 376: remover `carencia_vidros: 120` hardcoded

---

## Arquivos afetados
- **Migration SQL**: nova config + 4 colunas em `contratos`
- `src/components/gestao-comercial/RegrasVendaContent.tsx` — campo configurável
- `src/hooks/useConteudosSistema.ts` — novo hook `useCarenciaVidrosDias`
- `supabase/functions/contrato-gerar/index.ts` — gravar carência vidros
- `supabase/functions/efetivar-substituicao/index.ts` — idem
- `supabase/functions/efetivar-troca-titularidade/index.ts` — idem
- `src/hooks/useSolicitacoesMigracaoAdmin.ts` — isenção migração
- `src/components/associados/detalhe/OrigemCadastroCard.tsx` — exibir status
- `src/pages/app/AppPlano.tsx` — badge no benefício
- `src/hooks/useGerarProposta.ts` + `src/types/proposta.ts` — seção no PDF
- `src/pages/vendas/Cotador.tsx` — popular dados
- `src/components/eventos/NovoSinistroModal.tsx` — usar config em vez de hardcoded
- `src/types/sinistros.ts` — remover constante hardcoded

