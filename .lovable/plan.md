

# Melhorar Layout do Local de Instalacao no Drawer

## Problema

Na secao "Local de Instalacao" do drawer, a foto aparece mas o texto descritivo (local padronizado e descricao) nao esta visivel. Dois motivos:

1. Para rastreadores ja instalados (como o do Vinicius Faustinoni), apenas a `foto_local_instalacao_url` foi preenchida via migracao. Os campos `local_instalacao` e `descricao_instalacao` estao vazios no banco.
2. O layout atual empilha os elementos verticalmente - o ideal e colocar a foto e o texto lado a lado para melhor aproveitamento do espaco.

## Solucao

### 1. Melhorar layout da secao (RastreadorDetailDrawer.tsx)

Reorganizar a secao para exibir foto e texto lado a lado:

```
+-----------------------------+
| Local de Instalacao         |
| +--------+  Local: Painel   |
| | FOTO   |  Descricao:      |
| |        |  "Sob o volante, |
| +--------+  lado esquerdo"  |
+-----------------------------+
```

- Foto a esquerda (miniatura clicavel)
- Ao lado: badge do local + descricao textual
- Se apenas foto sem texto: mostrar foto com aviso "Descricao pendente"
- Se apenas texto sem foto: mostrar texto com aviso "Foto pendente"

### 2. Backfill dos dados existentes (migracao SQL)

Criar migracao para preencher `local_instalacao` e `descricao_instalacao` dos rastreadores que ja foram instalados mas nao tiveram esses campos preenchidos (como o caso do Vinicius). Para esses casos, setar um valor padrao indicando que a informacao precisa ser atualizada manualmente.

## Arquivos modificados

1. **`src/components/rastreadores/RastreadorDetailDrawer.tsx`** -- Reorganizar layout da secao "Local de Instalacao" com foto e texto lado a lado, incluindo indicadores visuais para dados faltantes
2. **Nova migracao SQL** -- Atualizar rastreadores com status `instalado` que tem foto mas nao tem `local_instalacao`/`descricao_instalacao`, setando valor padrao "A preencher"

