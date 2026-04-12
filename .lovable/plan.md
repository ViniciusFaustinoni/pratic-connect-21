
## Plano: Gerar relatório Markdown completo com todas as elegibilidades

### O que será feito
Executar um script Python que consolida todos os dados já coletados do banco em um Markdown estruturado com:

1. **Por Linha de Produto**: nome, elegibilidades (ano_range, modelos aceitos/limitados/negados)
2. **Por Plano**: nome, elegibilidades do plano (região, tipo de uso, combustível, tipo de placa)
3. **Coberturas de cada plano**: nome, tipo, carência, e todas as elegibilidades configuradas:
   - Região (resolvendo UUID → nome)
   - Tipo de uso
   - Combustível
   - Tipo de placa
   - Faixa FIPE (min/max e tabela de valores variáveis)
4. **Benefícios de cada plano**: nome, valor customizado, carência, e todas as elegibilidades configuradas

### Mapeamento de regiões
- `6f99685d...` → Rio de Janeiro - Capital e Metropolitana
- `5a0f58fe...` → Região dos Lagos
- `b507f9c7...` → São Paulo - Capital e Metropolitana

### Implementação
Um script Python único que:
- Busca todos os dados via as queries já executadas (replicando-as via psql)
- Gera o arquivo `/mnt/documents/estrutura_completa_v2.md`
- Organiza hierarquicamente: Linha → Plano → Coberturas → Benefícios
- Inclui tabelas de valores variáveis por faixa FIPE quando existirem
