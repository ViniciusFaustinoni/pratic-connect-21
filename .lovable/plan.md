

## Auditoria da linha LANÇAMENTO — Veículos Aceitos

### O que vou fazer

Mesmo procedimento das linhas SELECT e ESPECIAL, agora para **LANÇAMENTO** usando a tabela do Guia V12 (imagem anexa).

### Tabela de referência (imagem)

**Aceitação limitada** (vermelho):
- Jeep: COMPASS FLEX (Acima de 2024), RENEGADE FLEX (Acima de 2024)
- Chevrolet: EQUINOX TRACKER (Acima de 2024), MONTANA (Acima de 2024)
- Fiat: TORO (Acima de 2024), PULSE (Acima de 2024), CRONOS (Acima de 2024), FASTBACK (Acima de 2024)
- Renault: CAPTUR (Acima de 2020), OROCH (Acima de 2020), DUSTER (Acima de 2020), KARDIAN
- VW: T-CROSS (Acima de 2024), NIVUS (Acima de 2024), VIRTUS (Acima de 2024), AMAROK (Acima de 2013), TERA
- Citroën: C4 CACTUS C3 (Acima de 2020)
- Nissan: KICKS (Acima de 2024)
- Honda: CITY (Acima de 2024)
- Peugeot: 2008 (Acima de 2015)
- Toyota: COROLLA (Acima de 2024)
- Hyundai: CRETA (Acima de 2022)

**Acima de 2024** (azul): regra geral da linha — todo veículo > R$ 50k com ano >= 2024 entra automaticamente (já tratado na regra de linha).

### Plano

1. Login admin (`admin@teste.com` / `123456789`).
2. Consultar `entity_eligibility_rules` da linha LANÇAMENTO e fazer diff item-a-item contra a tabela.
3. Navegar: **Diretoria → Gestão Comercial → Linhas e Planos → LANÇAMENTO → Editar → Veículos Aceitos**.
4. Para cada item da imagem:
   - Existe e ano confere → manter.
   - Falta → adicionar via UI (Tipo: Carro → Marca → Modelo + ano mínimo).
   - Ano divergente → corrigir.
5. Validar que regra geral "Acima de 2024 + FIPE > R$ 50k" continua ativa (memória `architecture/products/exclusive-product-lines`).
6. Screenshot final do editor.

### Pontos a confirmar durante a execução

- "EQUINOX TRACKER" no guia parece dois modelos juntos (EQUINOX e TRACKER). Vou cadastrar separadamente se confirmado pela base de marcas/modelos.
- "C4 CACTUS C3" idem — provavelmente C4 CACTUS e C3 separados.
- "KARDIAN" e "TERA" são lançamentos sem ano mínimo na imagem — entram como "Acima de 2024" (regra padrão da linha).

### Garantias

- Nenhum hardcode — tudo via `entity_eligibility_rules` pela UI admin.
- Não mexe em SELECT nem ESPECIAL.
- Idempotente: se o item já existir com ano correto, não duplica.
- Aproveita o matching por prefixo já implementado (ex.: "CRETA" cobre "CRETA SPORT", "CRETA N LINE").

### Arquivos afetados

Nenhum. Apenas dados em `entity_eligibility_rules`.

