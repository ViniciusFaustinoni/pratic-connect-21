

## Plano: Checklist Pré-Envio SGA (Diagnóstico)

### Objetivo
Criar um hook e um componente que, dado um `veiculoId` e `associadoId`, consulta os dados locais e informa visualmente quais campos estão OK, quais estão faltando e quais representam risco de falha no SGA — sem alterar o fluxo de envio.

### Arquitetura

```text
useChecklistSGA(veiculoId, associadoId)
  ├── Query: veiculos (placa, chassi, renavam, cor, combustivel, ...)
  ├── Query: associados (cpf, nome, rg, data_nascimento, endereco, ...)
  ├── Query: contratos (vendedor_id, veiculo_categoria)
  ├── Query: profiles (codigo_sga_voluntario) do vendedor
  ├── Query: hinova_mapeamentos (verificar se cor/combustivel tem mapeamento)
  ├── Query: integracoes_credenciais (hinova configurado?)
  └── Retorna: ChecklistItem[] com status ok/faltando/risco
```

### Itens do Checklist (baseados na auditoria)

**Associado — Obrigatórios:**
| Campo | Origem | Risco |
|---|---|---|
| `nome` | NOT NULL no banco | Baixo |
| `cpf` | NOT NULL no banco | Médio (formato) |
| `telefone` | NOT NULL no banco | Baixo |
| `email` | NOT NULL no banco | Baixo |

**Associado — Críticos (nullable):**
| Campo | Origem | Risco |
|---|---|---|
| `rg` | Contratação pública/OCR | Alto — enviado vazio se faltar |
| `data_nascimento` | Contratação pública | Alto — formatado vazio |
| `cep` | Contratação pública | Alto — endereço incompleto |
| `logradouro` | Contratação pública | Alto |
| `bairro` | Contratação pública | Alto |
| `cidade` | Contratação pública | Alto |
| `uf` | Contratação pública | Alto |

**Veículo — Críticos:**
| Campo | Origem | Risco |
|---|---|---|
| `placa` | NOT NULL | Baixo |
| `chassi` | Nullable — OCR/CRLV | **Crítico** — bloqueia envio |
| `renavam` | Nullable — OCR/CRLV | **Crítico** — bloqueia envio |
| `cor` | Nullable — cotação | Alto — sem mapeamento = null no payload |
| `combustivel` | Nullable — cotação | Alto — sem mapeamento = null no payload |

**Sistema — Dependências:**
| Item | Como verificar | Risco |
|---|---|---|
| Credenciais Hinova | `integracoes_credenciais` configurado | **Crítico** — 400 imediato |
| Mapeamento cor | `hinova_mapeamentos` existe para `veiculos.cor` | Alto |
| Mapeamento combustível | `hinova_mapeamentos` existe para combustível normalizado | Alto |
| Código voluntário vendedor | `profiles.codigo_sga_voluntario` do vendedor do contrato | Médio — fallback '1' |

### Arquivos a Criar/Editar

1. **`src/hooks/useChecklistSGA.ts`** (novo)
   - Hook que recebe `veiculoId` e `associadoId`
   - Executa queries paralelas em `veiculos`, `associados`, `contratos`, `profiles`, `hinova_mapeamentos`, `integracoes_credenciais`
   - Retorna array tipado `ChecklistSGAItem[]` com `{ campo, label, status: 'ok' | 'faltando' | 'risco', valor?, detalhe? }` e contadores `{ ok, faltando, risco, total, pronto: boolean }`

2. **`src/components/ativacao/ChecklistSGA.tsx`** (novo)
   - Componente visual que renderiza o checklist em seções (Associado, Veículo, Sistema)
   - Ícones: check verde (ok), X vermelho (faltando), alerta amarelo (risco)
   - Collapsible ou sempre visível — compacto, exibido dentro do `AlertDialog` do `BotaoEnviarSGA` antes de confirmar

3. **`src/components/ativacao/BotaoEnviarSGA.tsx`** (editar)
   - Importar `useChecklistSGA` e `ChecklistSGA`
   - No `AlertDialogContent`, antes do botão "Confirmar Envio", renderizar o `ChecklistSGA`
   - Se houver itens "faltando" críticos (chassi, renavam, credenciais), desabilitar o botão de confirmação com mensagem explicativa
   - Se houver apenas "risco", permitir envio mas com aviso visual

### O que NÃO muda
- Edge function `sga-hinova-sync` — zero alterações
- Fluxo de envio — continua igual
- Tabelas do banco — nenhuma migração
- Outros componentes — sem impacto

