

# Importação em Massa de Rastreadores (Formato Placa/IMEI)

## Contexto
A planilha enviada tem 3 colunas: **Placa**, **Imei**, **Local da instalação do equipamento**. O dialog atual (`ImportarRastreadoresDialog`) aceita apenas o formato de entrada de estoque (IMEI + plataforma obrigatória na planilha). Precisa ser adaptado para:
- Aceitar o formato da planilha (Placa, Imei, Local)
- Perguntar a plataforma antes do upload (seletor global)
- Fazer upsert: atualizar rastreadores existentes pelo IMEI
- Vincular automaticamente ao veículo pela placa
- Local de instalação opcional

## Alterações

### Arquivo: `src/components/monitoramento/estoque/ImportarRastreadoresDialog.tsx`

**1. Adicionar seleção de plataforma como primeiro passo**
- Novo step `selecionar_plataforma` antes do upload
- Select com as plataformas disponíveis do hook `usePlataformasOptions`
- A plataforma escolhida aplica-se a todos os registros do lote

**2. Adaptar parser para aceitar o formato da planilha**
- Mapear colunas: `Placa` -> placa, `Imei` -> imei, `Local da instalação do equipamento` -> local_instalacao
- Manter compatibilidade com o formato antigo (imei, plataforma, numero_serie...)
- Tratar "Não informado" como null para local_instalacao

**3. Adaptar validação para upsert + vínculo por placa**
- Ao validar, se IMEI já existe: marcar como "atualização" em vez de erro
- Buscar veículos por placa em batch (`supabase.from('veiculos').select('id, placa').in('placa', placas)`)
- Se placa não encontrada no sistema: warning (não erro bloqueante), importa sem vínculo
- Se placa encontrada: vincular `veiculo_id`

**4. Adaptar importação (mutação) para upsert**
- IMEI novo: insert com status `instalado` (se tem placa/veículo) ou `estoque` (sem placa)
- IMEI existente: update dos campos `veiculo_id`, `local_instalacao`, `plataforma`
- Preencher `local_instalacao` no rastreador

**5. Atualizar preview/tabela**
- Mostrar colunas: Linha, Placa, IMEI, Local, Status (Novo/Atualização/Erro)
- Mostrar se veículo foi encontrado no sistema

**6. Atualizar template de download**
- Gerar template com colunas: Placa, Imei, Local da instalação do equipamento

## Fluxo do usuário
1. Clica "Importar"
2. Seleciona a plataforma (ex: rede_veiculos)
3. Faz upload da planilha ou arrasta
4. Vê preview com status de cada linha (novo/atualização, veículo encontrado/não)
5. Confirma importação
6. Sistema cria/atualiza rastreadores e vincula aos veículos

## Detalhes Tecnicas

```text
Step flow: selecionar_plataforma → upload → preview → importing → result

Parser mapping:
  row.Placa || row.placa → placa
  row.Imei  || row.imei  || row.IMEI → imei
  row['Local da instalação do equipamento'] || row.local_instalacao → local_instalacao
  "Não informado" → null

Validation:
  - Fetch veiculos by placa batch: .in('placa', uniquePlacas)
  - Fetch rastreadores by imei batch: .in('imei', uniqueImeis)
  - Mark each row: { acao: 'criar' | 'atualizar', veiculo_encontrado: boolean }

Import logic per row:
  if existing IMEI:
    UPDATE rastreadores SET veiculo_id, local_instalacao, plataforma WHERE imei = ?
  else:
    INSERT rastreadores { codigo, imei, plataforma, veiculo_id, local_instalacao, status }
  
  status = veiculo_id ? 'instalado' : 'estoque'
```

