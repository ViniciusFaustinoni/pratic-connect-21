

# Auditoria: Regras de Anexação de Aditivos a Termos

## Estado Atual do Sistema

O sistema possui **4 tipos de regra** implementados no código (tanto frontend quanto edge functions):

| Tipo de Regra | Código | Status |
|---|---|---|
| Veículo 0KM | `veiculo_0km` | ✅ Implementado |
| FIPE acima do limite | `fipe_acima_de` | ✅ Implementado (limite configurável) |
| Evento Vidros e Faróis | `evento_vidros` | ✅ Implementado (avaliado no backend por tipo de sinistro) |
| Veículo Blindado | `veiculo_blindado` | ✅ Implementado |

A avaliação ocorre em dois pontos:
- **Frontend** (`useAvaliarAditivos.ts`): pré-seleciona aditivos na tela de geração de termo
- **Backend** (`template-utils.ts > buscarEGerarAditivos`): avalia e injeta aditivos no HTML do contrato Autentique

---

## Comparação: Regras Solicitadas vs Implementadas

### POR CARACTERÍSTICA DO VEÍCULO

| Regra | Status | Observação |
|---|---|---|
| **Rastreador obrigatório (passeio, FIPE ≥ R$ 30k)** | ⚠️ Parcial | A lógica de `exigeRastreador()` existe em `termo-filiacao.ts` e `template-utils.ts`, mas NÃO é um tipo de regra de aditivo. O Termo de Comodato do Rastreador é injetado via `generateSecaoRastreador()` separadamente, não pelo motor de aditivos. Funciona, mas por caminho paralelo. |
| **Rastreador obrigatório (diesel)** | ⚠️ Parcial | Mesma situação: `exigeRastreador()` já cobre diesel, mas fora do motor de aditivos. |
| **Rastreador obrigatório (moto, FIPE ≥ R$ 9k)** | ⚠️ Parcial | Mesma situação: `exigeRastreador()` cobre motos com limite configurável. |
| **Rastreador Móvel (provisório)** | ❌ Não existe | Nenhuma lógica para rastreador provisório/móvel. Não há campo `instalacao_mesmo_dia` nem tipo de regra correspondente. |
| **Veículo de Aplicativo** | ❌ Não existe | O campo `uso_aplicativo` existe no veículo e é usado para cota de participação, mas NÃO existe tipo de regra de aditivo para anexar o Termo de Veículo de Aplicativo. |

### POR BENEFÍCIO CONTRATADO

| Regra | Status | Observação |
|---|---|---|
| **Proteção Vidros e Faróis** | ⚠️ Parcial | `evento_vidros` existe como regra, mas avalia pelo tipo de sinistro, não pela contratação do benefício na proposta. São duas coisas diferentes. |
| **Proteção Kit Gás** | ❌ Não existe | Sem tipo de regra nem lógica. |
| **Danos a Terceiros** | ❌ Não existe | Sem tipo de regra. O sistema não avalia faixa contratada. |
| **Carro Reserva** | ❌ Não existe | Sem tipo de regra. |
| **Reboque Excedente** | ❌ Não existe | Sem tipo de regra. |
| **Carência Zero** | ❌ Não existe | Sem tipo de regra. |
| **Apólice de Passageiros (APP)** | ❌ Não existe | Sem lógica de envio automático pós-30 dias. |

---

## Plano de Implementação

### 1. Expandir os tipos de regra de aditivo

Atualizar `RegraAditivo.tipo` para incluir novos valores:

```text
Existentes:  veiculo_0km, fipe_acima_de, evento_vidros, veiculo_blindado
Novos:       rastreador_obrigatorio, rastreador_movel, veiculo_aplicativo,
             beneficio_vidros, beneficio_kit_gas, beneficio_danos_terceiros,
             beneficio_carro_reserva, beneficio_reboque_excedente,
             beneficio_carencia_zero
```

*(APP é tratado separadamente — envio agendado, não anexação de aditivo)*

### 2. Atualizar a lógica de avaliação

**Frontend** (`useAvaliarAditivos.ts`): Expandir `avaliarRegra()` com os novos casos, recebendo dados adicionais (combustível, tipo veículo, uso, benefícios contratados).

**Backend** (`template-utils.ts > avaliarRegraEdge`): Mesma expansão, com acesso aos dados do contrato/cotação (benefícios adicionais selecionados, combustível, uso).

### 3. Atualizar o formulário de aditivos

Em `AditivoForm.tsx`, adicionar os novos tipos de regra no array `TIPOS_REGRA` com labels e descrições.

### 4. Unificar rastreador no motor de aditivos

Migrar a lógica de `generateSecaoRastreador()` para ser um aditivo cadastrado no banco com regra `rastreador_obrigatorio`, eliminando o caminho paralelo.

### 5. APP — Envio automático pós-30 dias

Criar um cron job (`cron-app-apolice`) que:
- Busca contratos com 30 dias de assinatura
- Gera e envia a apólice de passageiros automaticamente

### 6. Passar contexto de benefícios para avaliação

Tanto no frontend (tela de proposta/termo) quanto no backend (geração de contrato Autentique), passar a lista de benefícios adicionais contratados para que as regras `beneficio_*` possam ser avaliadas.

### Arquivos a modificar

- `src/hooks/useAditivos.ts` — expandir tipo `RegraAditivo`
- `src/hooks/useAvaliarAditivos.ts` — novos casos + interface expandida
- `src/pages/documentos/AditivoForm.tsx` — novos tipos no formulário
- `supabase/functions/_shared/template-utils.ts` — novos casos no `avaliarRegraEdge` + contexto de benefícios
- `supabase/functions/autentique-create/index.ts` — passar benefícios contratados
- `supabase/functions/autentique-create-by-token/index.ts` — idem
- Nova edge function `cron-app-apolice` para APP automático

