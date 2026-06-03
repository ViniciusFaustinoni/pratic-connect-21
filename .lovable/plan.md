# Skill: SGA Hinova API v2

Já baixei e parseei o `api_data.json` oficial (`https://api.hinova.com.br/api/sga/v2/doc/api_data.json`, 399 KB). São **136 endpoints** em **15 grupos**:

- Autenticacao (1), Associado (20), Beneficiario (11), Beneficio (5), Boleto (12), Veiculo (30), Vistoria (5), Produto (10), Cota (2), Regional (2), Cooperativa (3), Fornecedor (2), Evento (6), Atendimento (5), MGF (12), Voluntario (10).

## O que vou criar

```
.agents/skills/sga-hinova-api/
├── SKILL.md
├── assets/
│   └── api_data.json           # cópia bruta do apidoc (lookup completo)
└── references/
    ├── _index.md               # tabela completa de 136 endpoints (método, URL, título)
    ├── autenticacao.md
    ├── associado.md
    ├── beneficiario.md
    ├── beneficio.md
    ├── boleto.md
    ├── cooperativa.md
    ├── cota.md
    ├── evento.md
    ├── fornecedor.md
    ├── mgf.md
    ├── produto.md
    ├── regional.md
    ├── veiculo.md
    ├── vistoria.md
    ├── voluntario.md
    └── atendimento.md
```

Cada arquivo de grupo terá, por endpoint: método + URL, descrição, todos os parâmetros (nome, tipo, obrigatório, descrição) e os exemplos oficiais de requisição e resposta extraídos do apidoc — sem perda. HTML descartado, formatação convertida pra Markdown.

## SKILL.md (conteúdo)

- **Quando dispara**: integrações ou debug com a API Hinova SGA v2 (associados, veículos, boletos, eventos, vistorias, etc.).
- **Base URL canônica**: `https://api.hinova.com.br/api/sga/v2` (override via `HINOVA_API_URL`).
- **Autenticação**: `POST /usuario/autenticar` → `token_usuario`; enviar em `Authorization: Bearer <token>` nas demais.
- **Aviso crítico (já confirmado no nosso `_shared/hinova-client.ts`)**: a Hinova é **stateful** — cada novo `/usuario/autenticar` invalida tokens anteriores. Reusar sessão via `getHinovaSession()` em vez de autenticar a cada chamada. Em 401/403 fora da janela horária, reautenticar **apenas uma vez**.
- **Convenções do projeto**: nunca chamar a Hinova direto do front; sempre via edge `sga-*` ou helpers em `supabase/functions/_shared/hinova-client.ts`. Fila canônica de sync = `sga_sync_queue` (memória já existente).
- **Pegadinhas do upstream que já mordemos** (link pras memórias):
  - Boletos vêm com `valor_boleto`/`situacao_boleto` (não `valor`/`situacao`); `/listar/boleto-associado-veiculo` precisa de `diasFuturo`.
  - "INADIMPLENTE" vem em `/buscar/situacao-financeira-veiculo/` — boletos sozinhos não bastam.
  - Troca de titularidade = `POST /alterar/veiculo`, nunca inativar+recriar (não libera índice de placas).
  - Pós-cadastro, forçar PENDENTE (3) via `/associado/alterar-situacao-para/3/...` e `/veiculo/alterar-situacao-para/3/...`.
  - RENAVAM opcional em 0KM; CPF duplicado pode coexistir com `buscar/cpf` 404/406.
- **Como navegar a skill**: índice de 136 endpoints em `references/_index.md`; detalhes por grupo em `references/<grupo>.md`; JSON bruto em `assets/api_data.json` para casos não cobertos.

## Geração

Script Python local (não comitado) lê `assets/api_data.json` e gera todos os `references/*.md`. Sem dependências externas — `html.unescape` + regex pra tirar `<p>/<b>/</br>`.

## Hand-off

Após popular os arquivos, chamo `skills--apply_draft` com `.agents/skills/sga-hinova-api` pra ativar.

Pode aprovar?
