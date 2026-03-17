

## Plano: Aba "Migração" na página Regras de Venda

### Dados

Inserir 4 novos parâmetros em `comissoes_parametros` (via insert tool):

| chave | valor | descrição |
|---|---|---|
| `migracao_comprovantes_exigidos` | `3` | Quantidade de comprovantes de pagamento exigidos |
| `migracao_prazo_resposta_horas` | `48` | Prazo em horas úteis para resposta |
| `migracao_canal_oficial` | `e-mail` | Canal válido para solicitação |
| `migracao_isentar_carencia` | `true` | Se migrações aprovadas isentam carência |

### Frontend — `src/pages/diretoria/RegrasVenda.tsx`

1. Adicionar interface `MigracaoConfig` com os 4 campos
2. Adicionar nova `TabsTrigger` "Migração" (ícone `ArrowRightLeft`) e `TabsContent`
3. Estado local `migracao` + `savingMigracao`, inicializado a partir de `parametros`
4. Conteúdo da aba com 4 blocos (Cards):
   - **Bloco 1**: Campo inteiro para comprovantes exigidos
   - **Bloco 2**: Campo inteiro para prazo em horas úteis
   - **Bloco 3**: Campo texto para canal oficial + aviso fixo sobre canais inválidos
   - **Bloco 4**: Switch (toggle) para isenção de carência + nota informativa
5. Botão "Salvar configurações" ao final, mesmo padrão das abas existentes

### Arquivos afetados

- `src/pages/diretoria/RegrasVenda.tsx` — adicionar aba e formulário
- Dados: 4 rows em `comissoes_parametros`

