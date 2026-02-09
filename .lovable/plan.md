
# Plano de Migração: Preparação do Banco para Fluxo de Retirada de Rastreadores

## ✅ STATUS: CONCLUÍDO

Data de execução: 2026-02-09

---

## 1. SITUAÇÃO ATUAL

### Estrutura Existente
- **Tabela `servicos`**: Já tem o tipo `vistoria_retirada` definido no enum `tipo_servico` desde a migração de 2025-02-06
- **Tabela `rastreadores`**: Status anterior incluía 10 valores
- **Enum `tipo_servico`**: Já contém os 7 tipos de serviço, incluindo `vistoria_retirada`

### O que Foi Adicionado
✅ 24 colunas específicas para retirada na tabela `servicos`
✅ Status `retirada_pendente` no enum `status_rastreador`
✅ Tipos TypeScript customizados em `src/types/retirada.ts`
✅ Atualização dos tipos em `src/types/rastreadores.ts`

---

## 2. MUDANÇAS EXECUTADAS NO BANCO DE DADOS

### 2.1 Colunas Adicionadas à Tabela `servicos`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `motivo_retirada` | VARCHAR(50) | cancelamento_voluntario, inadimplencia, exclusao_diretoria, substituicao_veiculo, busca_apreensao |
| `sub_tipo_retirada` | VARCHAR(30) | somente_retirada, retirada_com_nova_instalacao |
| `tem_debitos_pendentes` | BOOLEAN | Se o associado tem débitos |
| `debitos_conferidos_por` | UUID FK → auth.users | Quem conferiu os débitos |
| `debitos_conferidos_em` | TIMESTAMPTZ | Quando foi feita a conferência |
| `multa_aplicada` | BOOLEAN | Se há multa de não devolução (default: false) |
| `multa_valor` | DECIMAL(10,2) | Valor da multa (R$400,00) |
| `multa_motivo` | VARCHAR(100) | Motivo da multa |
| `multa_cobrada_em` | TIMESTAMPTZ | Quando foi cobrada |
| `multa_forma_cobranca` | VARCHAR(20) | automatica_asaas, manual_financeiro |
| `multa_asaas_id` | VARCHAR(100) | ID da cobrança no Asaas |
| `localizacao_rastreador` | JSONB | Localização final para coleta |
| `checklist_retirada` | JSONB | Itens verificados na retirada |
| `integridade_aparelho` | VARCHAR(30) | integro, danificado, violado, molhado |
| `chip_presente` | BOOLEAN | Se o chip SIM estava presente |
| `fios_isolados` | BOOLEAN | Se os fios foram isolados |
| `acabamento_recolocado` | BOOLEAN | Se o acabamento foi recolocado |
| `retirada_video_360_url` | VARCHAR(500) | Vídeo 360° da retirada |
| `assinatura_devolucao_url` | VARCHAR(500) | Assinatura confirmando devolução |
| `plataforma_desativada` | BOOLEAN | Se foi desativado na plataforma (default: false) |
| `chip_cancelado` | BOOLEAN | Se o chip foi cancelado (default: false) |
| `solicitado_por_modulo` | VARCHAR(30) | cadastro, monitoramento, financeiro, diretoria |
| `cancelamento_bloqueado_ate_devolucao` | BOOLEAN | Flag de bloqueio (default: false) |
| `novo_veiculo_id` | UUID FK → veiculos | Para retirada com nova instalação |

### 2.2 Status Adicionado ao Enum `status_rastreador`

✅ `retirada_pendente` - Rastreador instalado mas com ordem de retirada aberta

**Status atuais após mudança** (11 valores):
1. `estoque` - Em estoque
2. `reservado` - Separado para instalação
3. `instalado` - No veículo
4. **`retirada_pendente`** ← NOVO
5. `manutencao` - Em manutenção (campo)
6. `reagendar_manutencao` - Aguardando reagendamento
7. `retorno_base` - Voltou para base
8. `triagem` - Em triagem
9. `em_analise_plataforma` - Na plataforma externa
10. `em_garantia` - Em garantia
11. `baixado` - Descartado (terminal)

---

## 3. ARQUIVOS TYPESCRIPT ATUALIZADOS

### 3.1 Novo arquivo: `src/types/retirada.ts`

Tipos customizados para o fluxo de retirada:
- `MotivoRetirada` - 5 valores
- `SubTipoRetirada` - 2 valores
- `IntegridadeAparelho` - 4 valores
- `FormaCobrancaMulta` - 2 valores
- `ModuloOrigem` - 4 valores
- `ChecklistRetirada` - interface
- `LocalizacaoRastreador` - interface
- Labels e cores para cada enum

### 3.2 Atualizado: `src/types/rastreadores.ts`

- Adicionado `retirada_pendente` ao type `StatusRastreador`
- Adicionado label e cor correspondentes
- Atualizado mapa de transições permitidas

### 3.3 Correções de queries (ambiguidade FK)

Após adicionar `novo_veiculo_id`, as queries que faziam JOIN com `veiculos` ficaram ambíguas. Corrigido com hint explícito `veiculos!servicos_veiculo_id_fkey`:

- `src/hooks/useServicos.ts` - useServicos() e useServico()
- `src/hooks/useVistoriaManutencao.ts` - useVistoriasManutencao() e useVistoriaManutencaoDetalhe()
- `src/hooks/useTarefaAtual.ts` - useTarefasHistorico()
- `src/pages/instalador/ExecutarRetirada.tsx` - query de carregamento

---

## 4. PRÓXIMOS PASSOS

Agora que a estrutura do banco está pronta, os próximos passos são:

1. **Atualizar `EnviarRetiradaModal.tsx`** - Adicionar campos de motivo, subtipo e validações
2. **Atualizar `ExecutarRetirada.tsx`** - Adicionar checklist específico de retirada
3. **Atualizar `useCriarRetirada.ts`** - Usar as novas colunas e validar débitos
4. **Integrar com módulo de Cancelamento** - Criar retirada automática ao cancelar associado
5. **Implementar cobrança de multa** - Integração com Asaas (opcional)

---

## 📋 Checklist Final

- [x] Migração SQL executada com sucesso
- [x] 24 colunas novas cadastradas na tabela `servicos`
- [x] Status `retirada_pendente` adicionado ao enum
- [x] Types TypeScript customizados criados (`src/types/retirada.ts`)
- [x] Tipos de rastreadores atualizados (`src/types/rastreadores.ts`)
- [x] Queries corrigidas para evitar ambiguidade de FK
- [x] Documentação de campos (comentários SQL) adicionada
- [x] Sem dados perdidos ou alterações em colunas existentes
- [x] RLS policies existentes compatíveis (não alteradas)
