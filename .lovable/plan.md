## Skill: `rede-veiculos-api`

Mesmo padrão da `sga-hinova-api`: SKILL.md + `assets/collection.json` (raw Postman) + `references/` por grupo funcional.

### Coleta de dados
Já baixei o JSON oficial da coleção Postman via `https://documenter.gw.postman.com/api/collections/15619634/TzRLmr9r` (48 KB, 22 endpoints, todos POST `application/x-www-form-urlencoded` com payload `json=...`). Cobre os 22 endpoints listados:

vincularClienteVeiculo, desvincularClienteVeiculo, atualizarDadosCliente, preCadastroCliente, atualizarDadosVeiculo, preCadastroVeiculo, permitirAcessoSistema, removerAcessoSistema, obterUltimaPosicaoValida, informarVeiculoAdimplente, informarVeiculoInadimplente, ativarVeiculo, inativarVeiculo, ativarCliente, inativarCliente, obterStatusCliente, obterStatusVeiculo, obterDadosCliente, obterDadosVeiculo, obterLinkCompartilhamento, acionamentoRouboFurto, redefinirSenhaCliente.

### Estrutura de arquivos
```
.agents/skills/rede-veiculos-api/
├── SKILL.md
├── assets/
│   └── collection.json         (coleção Postman bruta)
└── references/
    ├── _index.md               (tabela de 22 endpoints)
    ├── vinculo.md              (vincular/desvincularClienteVeiculo)
    ├── cliente.md              (atualizar/preCadastro/ativar/inativar/obterStatus/obterDados/permitirAcesso/removerAcesso/redefinirSenha)
    ├── veiculo.md              (atualizar/preCadastro/ativar/inativar/informar(In)adimplente/obterStatus/obterDados)
    └── operacional.md          (obterUltimaPosicaoValida/obterLinkCompartilhamento/acionamentoRouboFurto)
```

Cada arquivo de referência traz, por endpoint: método, URL, descrição, headers, body completo + body mínimo obrigatório, cURL de exemplo e response 200 oficiais.

### SKILL.md — conteúdo canônico
- Base URL sandbox: `https://integracao.redeveiculos.com/api/v2/sandbox/`
- Base URL produção: `https://integracao.redeveiculos.com/api/v2/prod/`
- Auth: `Authorization: Bearer <token>` (token fixo por integrador, secret `REDE_VEICULOS_API_TOKEN`)
- Content-Type: `application/x-www-form-urlencoded` com payload `json=<json-stringificado>` (formato peculiar — não é JSON puro no body)
- Resposta padrão: `{ "error": "false"|"true", "message": "..." }` (strings, não booleanos!)
- Convenções do projeto: usar sempre `redeVeiculosClient` em `supabase/functions/_shared/rede-veiculos-client.ts` (se não existir, criar); sync canônica via `rede-veiculos-backfill-veiculos`, `rede-veiculos-atualizar-equipamento`; fluxo de instalação/troca/substituição segue memórias `tri-fonte`, `rede-atualizar-local-instalacao` e `softtruck-desvinculo-bidirecional`.
- Pitfalls upstream: 
  - `error` vem como string `"false"`/`"true"` — comparar com string
  - Body é form-urlencoded com a chave `json` (não `Content-Type: application/json`)
  - CPF/CNPJ já cadastrado: dados do cliente são IGNORADOS no vincular, precisa chamar `atualizarDadosCliente` separadamente
  - Tipos de veículo permitidos enumerados (CARRO, ONIBUS, MOTO, CAMINHAO, JETSKI, BARCO, BICICLETA, TRATOR, RETRO, PET, PESSOAL)
  - Permissões/equipamento têm defaults sensíveis ("Modifique com cautela")
  - 0KM: campo `ZeroKM: "S"` (string, não boolean)
  - Identificação: maioria dos endpoints aceita CHASSI e/ou PLACA e/ou IMEI + CPF/CNPJ do cliente
  - `localInstalacao` é editável pós-vínculo via `atualizarDadosVeiculo` (caso Anderson/RJH0C29 da memória)

### Geração
Script Python único que lê `assets/collection.json` e gera os `references/*.md` agrupados por grupo funcional, com helpers `fmt_body()` e `fmt_examples()`. Sem dependências extras.

### Após criação
Chamar `skills--apply_draft` em `.agents/skills/rede-veiculos-api`.