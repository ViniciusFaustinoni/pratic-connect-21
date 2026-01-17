# Plano: Implementacao do Modelo Pratic de Precificacao

## Visao Geral do Modelo

O modelo Pratic define que:
- **Preco do Plano** = Soma dos Precos dos Beneficios + Valor Adicional
- **Custo Real do Beneficio** = Gasto Total (60 dias) / Quantidade de Cotas Ativas
- **Indicadores**: Vermelho (prejuizo), Amarelo (equilibrio), Verde (superavit)

---

## Analise do Estado Atual

### Tabelas Existentes (que serao REUTILIZADAS/ADAPTADAS)

| Tabela | Situacao | Acao Necessaria |
|--------|----------|-----------------|
| `beneficios_adicionais` | Existe com 14 registros | Adicionar campo `preco_sugerido` (renomear logica de `preco`) |
| `benefits` | Existe com 16 registros (coberturas) | Adicionar campos de precificacao |
| `planos` | Existe com ~15 planos | Ja tem `adicional_mensal` e `valor_adesao` |
| `plan_benefits` | Existe (relacao N:N) | Ja funciona |
| `sinistros` | Existe com `valor_pago` | Usar para calcular gastos de coberturas |
| `chamados_assistencia` | Existe | Usar para calcular gastos de assistencias |

### Tabelas que PRECISAM SER CRIADAS

| Tabela | Proposito |
|--------|-----------|
| `gastos_beneficios` | Registrar cada gasto associado a um beneficio (para calculo de custo real) |
| `vw_custo_real_beneficios` | View para calcular automaticamente custo real e indicador de saude |

---

## Etapas de Implementacao

### FASE 1: Banco de Dados (Migration)

#### 1.1 Adicionar campo `preco_sugerido` na tabela `benefits`
```sql
ALTER TABLE benefits 
ADD COLUMN IF NOT EXISTS preco_sugerido DECIMAL(10,2) DEFAULT 0;
```

#### 1.2 Criar tabela `gastos_beneficios`
```sql
CREATE TABLE IF NOT EXISTS gastos_beneficios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    beneficio_id UUID NOT NULL,
    beneficio_tipo VARCHAR(20) NOT NULL CHECK (beneficio_tipo IN ('benefit', 'adicional')),
    sinistro_id UUID REFERENCES sinistros(id),
    chamado_id UUID REFERENCES chamados_assistencia(id),
    associado_id UUID NOT NULL REFERENCES associados(id),
    contrato_id UUID REFERENCES contratos(id),
    descricao VARCHAR(255),
    valor_gasto DECIMAL(10,2) NOT NULL,
    data_ocorrencia DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gastos_beneficio ON gastos_beneficios(beneficio_id, beneficio_tipo);
CREATE INDEX idx_gastos_data ON gastos_beneficios(data_ocorrencia);
CREATE INDEX idx_gastos_associado ON gastos_beneficios(associado_id);
```

#### 1.3 Criar View `vw_custo_real_beneficios`
View que calcula automaticamente:
- Gasto total nos ultimos 60 dias
- Quantidade de cotas ativas
- Custo real por cota
- Indicador de saude (prejuizo/equilibrio/superavit)

#### 1.4 Criar funcao RPC `fn_calcular_custo_beneficio`
Para calculo sob demanda de um beneficio especifico.

---

### FASE 2: Hooks e Logica (Frontend)

#### 2.1 Criar `src/hooks/useCustoBeneficios.ts`
```typescript
// Hook para buscar custo real dos beneficios
export function useCustoBeneficios() {...}

// Funcao para calcular indicador de saude
export function calcularIndicadorSaude(preco: number, custoReal: number): 'prejuizo' | 'equilibrio' | 'superavit' | 'sem_dados'

// Funcao para calcular margem
export function calcularMargem(preco: number, custoReal: number): number
```

#### 2.2 Criar `src/hooks/usePlanosPrecificacao.ts`
```typescript
// Hook para calcular preco de um plano
export function usePrecoPlano(planoId: string) {...}

// Retorna: somaBeneficios, valorAdicional, mensalidadeFinal, adesao
```

---

### FASE 3: Componentes de UI

#### 3.1 Criar `src/components/beneficios/IndicadorSaude.tsx`
Componente visual que mostra:
- Icone colorido (verde/amarelo/vermelho/cinza)
- Valor da margem (+R$ X,XX ou -R$ X,XX)
- Tooltip com detalhes

#### 3.2 Atualizar `BeneficioAdicionalModal.tsx`
Adicionar secao "Precificacao" mostrando:
- Preco sugerido (editavel)
- Custo real (somente leitura, calculado)
- Indicador de saude
- Detalhes: gasto total, total de cotas, custo por cota

#### 3.3 Criar nova Tab "Saude Financeira" em `/vendas/planos-beneficios`
- Resumo geral: X superavit, Y equilibrio, Z prejuizo
- Tabela com todos beneficios e seus indicadores
- Alertas para beneficios em prejuizo

#### 3.4 Atualizar visualizacao de Planos
- Mostrar soma dos beneficios
- Mostrar valor adicional
- Mostrar mensalidade final calculada
- Indicador de saude geral do plano

---

### FASE 4: Integracao com Sinistros/Chamados

#### 4.1 Trigger para popular `gastos_beneficios`
Quando um sinistro for pago ou um chamado de assistencia for concluido:
- Inserir registro em `gastos_beneficios`
- Vincular ao beneficio correspondente

```sql
CREATE OR REPLACE FUNCTION fn_registrar_gasto_sinistro()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status != 'pago' AND NEW.valor_pago > 0 THEN
    INSERT INTO gastos_beneficios (beneficio_id, beneficio_tipo, sinistro_id, associado_id, valor_gasto, data_ocorrencia, descricao)
    VALUES (
      -- mapear tipo de sinistro para beneficio
      (SELECT id FROM benefits WHERE slug = CASE NEW.tipo 
        WHEN 'roubo_furto' THEN 'roubo-furto'
        WHEN 'colisao' THEN 'colisao'
        -- etc
       END),
      'benefit',
      NEW.id,
      NEW.associado_id,
      NEW.valor_pago,
      NEW.data_ocorrencia::date,
      'Sinistro ' || NEW.protocolo
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## Diagrama de Relacionamentos

```
+-------------------+       +---------------------+
|    benefits       |       | beneficios_adicionais|
+-------------------+       +---------------------+
| id                |       | id                  |
| preco_sugerido    |       | preco (=sugerido)   |
+-------------------+       +---------------------+
         |                           |
         +-----------+---------------+
                     |
                     v
         +------------------------+
         |   gastos_beneficios    |
         +------------------------+
         | beneficio_id           |
         | beneficio_tipo         |
         | valor_gasto            |
         | data_ocorrencia        |
         +------------------------+
                     |
                     v
         +------------------------+
         | vw_custo_real_beneficios|
         +------------------------+
         | custo_real             |
         | indicador              |
         | gasto_total_60d        |
         | total_cotas            |
         +------------------------+
```

---

## Arquivos a Criar/Modificar

| Arquivo | Acao |
|---------|------|
| `supabase/migrations/XXXXX_modelo_pratic_precificacao.sql` | Criar - Migration completa |
| `src/hooks/useCustoBeneficios.ts` | Criar - Hook de custo real |
| `src/hooks/usePlanosPrecificacao.ts` | Criar - Hook de preco de planos |
| `src/components/beneficios/IndicadorSaude.tsx` | Criar - Componente visual |
| `src/components/beneficios/CustoBeneficioCard.tsx` | Criar - Card com detalhes financeiros |
| `src/components/planos/BeneficioAdicionalModal.tsx` | Modificar - Adicionar secao precificacao |
| `src/pages/vendas/PlanosBeneficios.tsx` | Modificar - Adicionar tab "Saude Financeira" |

---

## Resultado Esperado

1. **Gestao de Beneficios**: Cada beneficio mostra seu preco configurado, custo real calculado e indicador visual de saude

2. **Gestao de Planos**: Cada plano mostra a soma dos beneficios inclusos + valor adicional = mensalidade

3. **Dashboard de Saude**: Visao geral de quantos beneficios estao em superavit/equilibrio/prejuizo

4. **Alertas**: Notificacao visual quando beneficios estao com preco abaixo do custo real

---

## Observacoes Importantes

1. **O campo `preco` em `beneficios_adicionais` sera usado como "preco sugerido"** - nao precisa renomear a coluna

2. **A view `vw_custo_real_beneficios` unifica `benefits` e `beneficios_adicionais`** para ter uma visao consolidada

3. **Os gastos serao registrados automaticamente** via triggers quando sinistros forem pagos ou chamados concluidos

4. **O calculo de cotas usa o hook `useValorPorCota`** ja implementado anteriormente

5. **RLS necessario**: A tabela `gastos_beneficios` precisara de policies para visualizacao (diretores) e insercao (sistema/triggers)