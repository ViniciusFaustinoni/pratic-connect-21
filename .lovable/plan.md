

# Novas Regras de Anexação de Aditivos — Fase 2

## Resumo das novas categorias

O sistema atual possui regras para: característica do veículo, benefício contratado e evento de vidros. As novas regras expandem para 4 novos grupos:

| Grupo | Novas Regras | Gatilho |
|---|---|---|
| **Sinistro/Evento** | Sub-Rogação, Aprovação Conserto, Incêndio Próprio Punho | Tipo de sinistro/evento aberto |
| **Grupos Especiais** | Grupo Raridades/Especial, Depreciação (Leilão/Chassi/Ex-Táxi) | Categoria ou grupo do veículo |
| **Gestão Equipamento** | Fiel Depositário (já coberto por `rastreador_obrigatorio`), Rastreador de Terceiros | Tipo de rastreador |
| **Manutenção/Outros** | Atualização FIPE, Vistoria Reativação, Anuência Proprietário | Campos do contrato/associado |

## Novos tipos de regra a criar

```text
// Por Sinistro/Evento
evento_sub_rogacao        → Acionamento PSM (qualquer tipo)
evento_aprovacao_conserto → Sinistro com reparo aprovado (entrega veículo)
evento_incendio           → Sinistro tipo incêndio sem bombeiros

// Por Grupo/Categoria do Veículo
grupo_raridades_especial  → Veículo no grupo Raridades ou Especial
categoria_depreciacao     → Categoria: leilão, chassi_remarcado, ex_taxi, placa_vermelha

// Por Gestão de Equipamento
rastreador_terceiros      → Associado usa rastreador próprio (não homologado)

// Por Manutenção/Atualização
opcao_atualizacao_fipe    → Associado precisa formalizar opção de atualização FIPE
vistoria_reativacao       → Contrato em reativação após inadimplência > 5 dias

// Por Propriedade
anuencia_proprietario     → Veículo em nome de terceiro (associado ≠ proprietário)
```

**Nota:** "Fiel Depositário/Comodato" já é coberto pela regra `rastreador_obrigatorio` existente. "APP" já foi tratado na fase anterior (cron de 30 dias).

## Alterações por arquivo

### 1. `src/hooks/useAditivos.ts`
Expandir `TipoRegraAditivo` com os 9 novos tipos.

### 2. `src/hooks/useAvaliarAditivos.ts`
- Expandir `VeiculoParaAvaliacao` com: `grupo`, `categoriaVeiculo`, `rastreadorTerceiros`, `proprietarioNome`, `associadoNome`
- Adicionar novo interface `ContratoParaAvaliacao` com: `emReativacao`, `inadimplenciaDias`
- Expandir `avaliarRegra()` com os 9 novos cases

### 3. `src/pages/documentos/AditivoForm.tsx`
Adicionar os 9 novos tipos ao array `TIPOS_REGRA` organizados nos novos grupos visuais:
- "Por Procedimento de Sinistro/Evento"
- "Por Características e Grupos Especiais"
- "Por Gestão do Equipamento"
- "Por Atualização e Manutenção"
- "Por Propriedade Terceira"

### 4. `supabase/functions/_shared/template-utils.ts`
Expandir `avaliarRegraEdge()` com os 9 novos cases, lendo os campos correspondentes do veículo/contrato.

### 5. `src/pages/documentos/Aditivos.tsx`
Expandir `REGRA_LABELS` com labels e ícones para os novos tipos (exibição na listagem).

