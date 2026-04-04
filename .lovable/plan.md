

# Coberturas e Benefícios do Plano na Aba Veículos

## Situação Atual

- `plano_id` está na tabela `associados`, não em `veiculos` — todos os veículos de um associado compartilham o mesmo plano
- O card de cada veículo na aba "Veículos" do modal mostra dados técnicos (placa, chassi, FIPE, rastreador) mas **não** mostra o plano, coberturas e benefícios
- O hook `useCoberturasBeneficiosPlano` já busca coberturas e benefícios a partir do `associadoId`

## Proposta — Fase 1 (sem migration)

Exibir dentro de cada card de veículo na aba "Veículos" do modal de detalhes do associado:
- **Nome do plano** do associado (já disponível em `associado.planos?.nome`)
- **Lista de coberturas** com ícones (Shield) e badges
- **Lista de benefícios** com ícones (Gift) e badges

Como atualmente 1 associado = 1 plano, todos os veículos mostrarão o mesmo plano. Isso já prepara a UI para quando a migração for feita.

## Proposta — Fase 2 (migration futura, NÃO incluída agora)

Adicionar `plano_id` na tabela `veiculos` para permitir planos diferentes por veículo. **Isso será feito em uma etapa separada** para não quebrar fluxos existentes.

## Alterações — Fase 1

### 1. `src/pages/cadastro/AssociadoDetalhe.tsx`

Na aba `veiculos` (linha ~559):
- Importar e usar `useCoberturasBeneficiosPlano(id)` para buscar coberturas e benefícios do plano do associado
- Dentro de cada card de veículo (após o bloco de dados técnicos e antes do `BlocoDepreciacaoVeiculo`), adicionar uma seção colapsável ou fixa com:

```text
┌─────────────────────────────────────────┐
│ 🚗 Toyota Corolla 2023     [Ativo]      │
│ Placa: ABC-1234  Chassi: ...            │
│ Valor FIPE: R$ 95.000                   │
│ ──────────────────────────────────────  │
│ 📋 Plano: Proteção Total Plus           │
│                                          │
│ 🛡️ Coberturas:                          │
│   • Colisão  • Roubo/Furto  • Incêndio  │
│   • Fenômenos Naturais  • Vidros         │
│                                          │
│ 🎁 Benefícios:                          │
│   • Assistência 24h  • Rastreador        │
│   • Carro Reserva                        │
└─────────────────────────────────────────┘
```

- Coberturas exibidas como badges compactos com ícone Shield
- Benefícios exibidos como badges compactos com ícone Gift/Star
- Se não houver plano, exibir "Sem plano atribuído"

### 2. Remover seção "Plano e Contrato" da aba Resumo

A seção de plano (linhas ~543-554) que atualmente fica na aba "resumo" será **movida** para dentro da aba "veiculos", já que o plano pertence conceptualmente ao veículo.

## Impacto
- 1 arquivo alterado (`AssociadoDetalhe.tsx`)
- 1 hook reutilizado (`useCoberturasBeneficiosPlano`)
- 0 migrations
- 0 dependências novas

