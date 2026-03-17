

## Plano: Cotação do Consultor 100% dinâmica via "Regras de Venda"

### Problemas encontrados

| Arquivo | Hardcoded | Correção |
|---|---|---|
| `Cotador.tsx` L1317 | `"R$ 50 descontado da adesão para cobrir a rota"` | Ler `taxa_repasse_volante` e interpolar |
| `Cotador.tsx` L390,659 | Usa `minimoAdesaoConfig` mas é sempre `MinimoBase` — ignora volante | Selecionar mínimo conforme `tipoInstalacao` |
| `Cotador.tsx` | Não exibe repasse, carência, migração, taxas de procedimento | Adicionar blocos informativos |
| `Cotador.tsx` | Sem validação de mínimo antes de enviar | Bloquear envio se adesão < mínimo |
| `CotacaoFormDialog.tsx` L1007 | `VALOR_ADESAO_MINIMO = 50` hardcoded | Ler mínimo dinâmico da config |
| `CotacaoFormDialog.tsx` L1748 | `"1% da FIPE (mín. R$ 100)"` texto fixo | Interpolar percentual e mínimo da config |
| `CotacaoFormDialog.tsx` | Não exibe repasse volante, carência, migração | Adicionar blocos informativos |
| Ambos | Sem hooks para migração/carência no contexto de cotação | Criar hooks que leem de `comissoes_parametros` |

### Alterações

#### 1. Novos hooks em `useConteudosSistema.ts`

Hooks para ler migração de `comissoes_parametros` (mesma tabela usada em RegrasVenda):

```typescript
export function useMigracaoConfig() → { comprovantes, prazo_horas, canal, isentar_carencia }
```

Usa `useQuery` com fetch direto de `comissoes_parametros` filtrando pelas 4 chaves de migração. Também expor `usePrazoReativacaoDias()` da mesma tabela.

#### 2. `Cotador.tsx` — 6 mudanças

**a)** Importar hooks: `useTaxaAdesaoMinimoVolante`, `useTaxaRepasseVolante`, `useCarenciaDiasPadrao`, `useMigracaoConfig`

**b)** Selecionar mínimo de adesão correto conforme tipo de instalação:
```typescript
const minimoAdesaoEfetivo = tipoInstalacao === 'rota' ? minimoVolante : minimoBase;
```

**c)** Substituir texto hardcoded `"R$ 50 descontado"` por valor dinâmico do repasse

**d)** No resumo da cotação (após plano selecionado), adicionar blocos informativos:
- **Repasse volante**: Se `tipoInstalacao === 'rota'`, exibir card read-only com valor do repasse
- **Carência**: Exibir dias de carência; se migração com isenção ativa, mostrar "Sem carência"
- **Alerta de adesão abaixo do mínimo**: Badge vermelho quando valor editado < mínimo

**e)** Validação antes de enviar (`handleSalvarEEnviarWhatsApp`):
- Se `valorAdesaoCustom < minimoAdesaoEfetivo` (e não cenário isento): bloquear com toast indicando mínimo
- Se `tipoInstalacao === 'rota'` e repasse não está considerado: alertar

**f)** Texto dinâmico no hint de adesão: `"Sugerido: {percentual}% da FIPE (mín. {formatCurrency(minimoEfetivo)})"`

#### 3. `CotacaoFormDialog.tsx` — 5 mudanças

**a)** Importar os mesmos hooks + `useTaxaAdesaoMinimoVolante`, `useTaxaRepasseVolante`, `useTaxaSubstituicaoPlaca`, `useTaxaTrocaTitularidade`, `useCarenciaDiasPadrao`, `useMigracaoConfig`

**b)** Substituir `VALOR_ADESAO_MINIMO = 50` (L1007) por mínimo dinâmico baseado no cenário (volante vs base)

**c)** Texto dinâmico em L1748: interpolar percentual e mínimo reais da config

**d)** Após bloco de taxa de filiação, adicionar:
- Card de **repasse volante** (read-only) quando cenário `rota`
- Card de **carência** com dias dinâmicos; indicação de isenção para migração
- Cards de **taxas de procedimento** (substituição placa, troca titularidade) quando aplicável — read-only

**e)** Sinalização visual (borda vermelha + texto) quando adesão editada manualmente está abaixo do mínimo

#### 4. Resumo de arquivos

| Arquivo | Alteração |
|---|---|
| `src/hooks/useConteudosSistema.ts` | +`useMigracaoConfig()`, +`usePrazoReativacaoDias()` |
| `src/pages/vendas/Cotador.tsx` | Hooks dinâmicos, blocos informativos, validação, textos interpolados |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | Hooks dinâmicos, remover hardcoded R$50, blocos informativos, validação |

Nenhuma migration necessária — todos os dados já existem nas tabelas `configuracoes` e `comissoes_parametros`.

