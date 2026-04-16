

## Diagnóstico completo — Cotação Moto APP (Uber)

### O que está acontecendo

Os planos **Advanced Especial** e **Advanced Especial +** (passeio) têm regra `tipo_uso: [particular]` → são corretamente bloqueados quando o uso é APP/Uber.

Os planos **Advanced Especial Aplicativo** e **Advanced Especial + Aplicativo** existem e estão ativos, **mas** há problemas de dados que impedem a exibição correta:

### Problemas encontrados no banco

| # | Problema | Onde | Impacto |
|---|---------|------|---------|
| 1 | **`tipo_uso` conflitante** no "Advanced Especial Aplicativo" | `entity_eligibility_rules` id `2be237da-...` | `tipos_uso: [particular]` contradiz `values: [aplicativo]`. O código lê `cfg.valores` → pega `[aplicativo]` → **funciona por acaso**, mas a config está errada e pode quebrar em qualquer refactor |
| 2 | **Coberturas nomeadas "75% FIPE"** nos planos APP | Coberturas dos planos APP | Deveria ser "100% FIPE" segundo o requisito. O `cobertura_fipe` do plano está correto (100), mas o nome da cobertura induz erro ao cliente |
| 3 | **Assistência 400km APP tem preço R$ 15,90** | Benefit `Assistência 24h 400km - Advanced Especial Aplicativo` | Deveria ser R$ 15,00 (como no plano passeio) para fechar R$ 218,70. Atualmente daria **R$ 219,60** |
| 4 | **Cota de participação APP** não configurada | Planos APP têm `cota_participacao: null`, `cota_minima: null` | Vai cair no fallback global (6%, mín R$ 1.200). Deveria ser **10%, mín R$ 1.500** para motos APP |
| 5 | **Sem override `planos_cotas_categoria`** para APP | Tabela `planos_cotas_categoria` | Os planos passeio têm override para categoria `moto` (6%, R$ 1.200), mas os APP não têm override para `aplicativo` com 10%/R$ 1.500 |

### Ajustes necessários (todos são dados, não código)

**1. Corrigir `tipo_uso` do "Advanced Especial Aplicativo":**
```sql
UPDATE entity_eligibility_rules 
SET rule_config = '{"tipos_uso": ["aplicativo"], "values": ["aplicativo"]}'
WHERE id = '2be237da-d9f8-4a7a-89c8-fbf955cfd5b1';
```

**2. Corrigir preço da Assistência 400km APP** (de R$ 15,90 para R$ 15,00):
```sql
UPDATE benefits SET preco_sugerido = 15.00 
WHERE id = (SELECT benefit_id FROM planos_beneficios WHERE plano_id = '16b01086-4983-4f9d-8177-f98d021731a5' 
  AND benefit_id IN (SELECT id FROM benefits WHERE name ILIKE '%Assistência 24h 400km%Advanced Especial Aplicativo%'));
```

**3. Configurar cota APP (10%, mín R$ 1.500) nos planos APP:**
```sql
-- Via planos_cotas_categoria para categoria 'aplicativo'
INSERT INTO planos_cotas_categoria (plano_id, categoria_veiculo, cota_percentual, cota_minima_valor) VALUES
('16b01086-4983-4f9d-8177-f98d021731a5', 'aplicativo', 10, 1500),
('58a17bce-4362-4949-a68e-04f6592adde8', 'aplicativo', 10, 1500);
```

**4. (Opcional) Renomear coberturas "75% FIPE" para "100% FIPE"** nos planos APP, se a cobertura real é 100%.

### Resultado esperado após os ajustes

Para Moto, Uber, FIPE R$ 20.882, região RJ:
- **Advanced Especial Aplicativo** → R$ 218,70 (após correção do benefit)
- **Advanced Especial + Aplicativo** → R$ 238,70 ✅
- Cota: 10% do FIPE (mín R$ 1.500) → R$ 2.088,20
- Rastreador obrigatório: sim (FIPE > R$ 9.000)

### Escopo técnico

- 3-4 UPDATEs + 2 INSERTs no banco (via ferramenta de insert)
- 0 arquivos de código alterados
