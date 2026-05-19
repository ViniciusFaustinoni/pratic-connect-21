## Diagnóstico (raiz do problema)

A proposta de filiação (PDF gerado pelo Edge `contrato-gerar` → template `supabase/functions/_shared/termo-afiliacao-template.ts`) não imprime **Câmbio**, **Portas** nem **Tipo do veículo (Carro/Moto)** — apesar de os dados existirem em todo o pipeline.

Rastreamento de ponta a ponta:

| Camada | Câmbio | Portas | Tipo (carro/moto) |
|---|---|---|---|
| `plate-lookup` (CRLV) | `cambio` + `cambio_normalizado` | `numero_portas` | derivado de marca/modelo |
| `CotacaoFormDialog` salva na cotação | `veiculo_cambio` ✅ | `numero_portas` ✅ | `veiculo_categoria` (mas confunde com categoria CRLV) |
| `contrato-gerar` faz snapshot no contrato | `contratos.veiculo_cambio` ✅ | `contratos.veiculo_numero_portas` ✅ | `contratos.veiculo_categoria` ⚠️ |
| `termo-afiliacao-utils.ts` monta `data.veiculo` | `cambio` ✅ (linha 470-474) | `portas` ✅ (linha 476-479) | `tipo_veiculo` ⚠️ (linha 463 — usa `veiculo_categoria`, conflita com "Categoria CRLV") |
| `termo-afiliacao-template.ts` (HTML que vira PDF) | ❌ **nunca renderiza** | ❌ **nunca renderiza** | ❌ **nunca renderiza** |
| `TermoFiliacaoTemplate.tsx` (preview React) | ❌ não tem | ❌ não tem | ❌ não tem |

**Conclusão:** o dado chega até a função de montagem, mas o template HTML/React não tem as linhas. Para `tipo_veiculo` há um bug adicional: `termo-afiliacao-utils.ts` usa `contrato.veiculo_categoria` tanto para "Categoria CRLV (Particular/Aluguel)" quanto para "Tipo (carro/moto)" — fonte ambígua.

---

## Plano de correção

### 1. Resolver fonte canônica de `tipo_veiculo` (carro/moto)
Em `supabase/functions/_shared/termo-afiliacao-utils.ts`, separar `tipo_veiculo` de `veiculo_categoria`:
- Buscar `veiculos.tipo_veiculo` direto do registro do veículo (já carregado em `veiculoDB`), com fallback via `marcas_modelos.tipo_veiculo` por marca+modelo (consulta já usada no resto do sistema — ver `mem://logic/operations/vehicle-type-detection-source`).
- Normalizar para rótulo amigável: `Carro` / `Moto` / `Caminhão` / `Utilitário`.

### 2. Renderizar os 3 campos no template HTML do PDF
Em `supabase/functions/_shared/termo-afiliacao-template.ts`, dentro da seção **VEÍCULO PROTEGIDO** (após "Combustível/Categoria", linhas ~438-447), adicionar uma nova `field-row`:

```text
[ Tipo: Carro       ] [ Câmbio: Manual      ]
[ Portas: 4         ] [ Categoria CRLV: ... ]  (reaproveita)
```

Estrutura concreta:
- Linha nova: **Tipo** + **Câmbio**
- Linha nova: **Portas** (oculta/`—` quando moto, já que `portas = 0`)
- Manter linhas existentes intactas.

Regras de exibição:
- `Câmbio`: imprime valor formatado (`Manual` / `Automático`); `—` se `null`.
- `Portas`: imprime número; oculta a linha inteira quando `tipo = moto` (não faz sentido).
- `Tipo`: sempre imprime (`Carro` por default).

### 3. Espelhar no preview React
Em `src/components/cadastro/TermoFiliacaoTemplate.tsx` (após linha 251, bloco Combustível/Categoria) adicionar as mesmas 3 linhas usando os campos já existentes em `VeiculoData` (`tipo`, `combustivel`) e estendendo o type com `cambio?: string` e `portas?: number | null` em `src/types/termo-filiacao.ts`.

### 4. Backfill leve (opcional, pode ficar para depois)
Contratos antigos podem ter `veiculo_cambio = null` e `veiculo_numero_portas = null` por terem sido criados antes do snapshot. Como o template já trata `null → '—'`, **nenhuma migração é obrigatória** para o fix funcionar. Documentar isso na resposta final.

### 5. Validação
- Gerar proposta de teste para 1 carro com câmbio conhecido (ex: o Ford Fiesta do print) e 1 moto.
- Conferir PDF: deve mostrar `Tipo: Carro`, `Câmbio: Manual`, `Portas: 4` para o Fiesta; e `Tipo: Moto` sem linha de Portas para a moto.

---

## Detalhes técnicos

**Arquivos a editar:**
1. `supabase/functions/_shared/termo-afiliacao-utils.ts` — corrigir resolução de `tipo_veiculo` (separar de categoria CRLV) e formatar.
2. `supabase/functions/_shared/termo-afiliacao-template.ts` — adicionar 3 campos na seção 2 (VEÍCULO PROTEGIDO).
3. `src/components/cadastro/TermoFiliacaoTemplate.tsx` — espelhar no preview React.
4. `src/types/termo-filiacao.ts` — adicionar `cambio?: string` e `portas?: number | null` em `VeiculoData`.

**Sem migrations.** Sem mudanças em fluxo, RLS, triggers ou edge functions de negócio. Mudança puramente de apresentação + 1 correção de mapeamento.

**Riscos:** mínimos — campos opcionais, fallback `—` quando ausente, não quebra contratos antigos.
