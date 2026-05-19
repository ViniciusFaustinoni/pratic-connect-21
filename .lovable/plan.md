## Limpeza de Trocas de Titularidade (estado atual)

### Inventário encontrado

**Veículo afetado:** `KOU6D37` (id `36e4ecc5…`)
- Já está `status=ativo`, `em_troca_titularidade=false`, vinculado ao associado antigo `7478196b…`
- Contrato original `0a6b82f1…` (`adesao`, `ativo`, `cadastro_aprovado=true`) — **preservado, intocado**

**Solicitações de troca (2):**

| id | status | cotação | termo Autentique |
|---|---|---|---|
| `560c0959…` | `cotacao_em_andamento` | — (sem cotação) | `dc220c3de79c…` |
| `c6fefc4e…` | `cancelada` | `e1a8903e…` (`dados_preenchidos`) | `59ee8eeed2c5…` |

Novo titular tentado em ambas: VInicius Faustinoni / viniciusfaustinoni@gmail.com.

### Ações de limpeza (em uma única migration)

1. `DELETE` em `solicitacoes_troca_titularidade` para os 2 IDs acima
2. `DELETE` em `cotacoes` `e1a8903e…` (e qualquer outra com `tipo_entrada='troca_titularidade'` órfã — varredura defensiva), incluindo dependências em cascata caso o schema não tenha ON DELETE (cotacoes_documentos, cotacoes_vistoria_fotos, vinculos)
3. Garantir veículo KOU6D37 com `em_troca_titularidade=false` e coberturas religadas (já está, mas reafirma — idempotente)
4. Cancelamento dos 2 documentos Autentique (`dc220c3d…` e `59ee8eee…`) via chamada manual à edge `autentique-cancel-document` **após** a migration — feito separadamente, fora da migration SQL

### Fora de escopo
- Contrato/associado/veículo originais — preservados
- Histórico de cobertura do veículo — preservado
- Qualquer outra cotação que não seja `tipo_entrada='troca_titularidade'`

Confirma execução?