export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      acordo_parcelas: {
        Row: {
          acordo_id: string
          cobranca_id: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string
          id: string
          numero_parcela: number
          status: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          acordo_id: string
          cobranca_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          id?: string
          numero_parcela: number
          status?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          acordo_id?: string
          cobranca_id?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          id?: string
          numero_parcela?: number
          status?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "acordo_parcelas_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordo_parcelas_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      acordos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          associado_id: string
          cobrancas_ids: string[]
          created_at: string | null
          criado_por: string | null
          dia_vencimento: number
          entrada_data_pagamento: string | null
          entrada_paga: boolean | null
          id: string
          motivo_quebra: string | null
          numero: string | null
          primeira_parcela_data: string
          qtd_parcelas: number
          status: string | null
          updated_at: string | null
          valor_acordo: number
          valor_desconto: number | null
          valor_entrada: number | null
          valor_juros: number | null
          valor_original: number
          valor_parcela: number
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id: string
          cobrancas_ids: string[]
          created_at?: string | null
          criado_por?: string | null
          dia_vencimento: number
          entrada_data_pagamento?: string | null
          entrada_paga?: boolean | null
          id?: string
          motivo_quebra?: string | null
          numero?: string | null
          primeira_parcela_data: string
          qtd_parcelas?: number
          status?: string | null
          updated_at?: string | null
          valor_acordo: number
          valor_desconto?: number | null
          valor_entrada?: number | null
          valor_juros?: number | null
          valor_original: number
          valor_parcela: number
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          associado_id?: string
          cobrancas_ids?: string[]
          created_at?: string | null
          criado_por?: string | null
          dia_vencimento?: number
          entrada_data_pagamento?: string | null
          entrada_paga?: boolean | null
          id?: string
          motivo_quebra?: string | null
          numero?: string | null
          primeira_parcela_data?: string
          qtd_parcelas?: number
          status?: string | null
          updated_at?: string | null
          valor_acordo?: number
          valor_desconto?: number | null
          valor_entrada?: number | null
          valor_juros?: number | null
          valor_original?: number
          valor_parcela?: number
        }
        Relationships: [
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "acordos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      advogados: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          conta: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          estado: string | null
          id: string
          logradouro: string | null
          nome: string
          numero: string | null
          oab: string | null
          oab_estado: string | null
          percentual_exito: number | null
          pix_chave: string | null
          pix_tipo: string | null
          telefone: string | null
          tipo: string
          tipo_contrato: string | null
          updated_at: string | null
          valor_fixo: number | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome: string
          numero?: string | null
          oab?: string | null
          oab_estado?: string | null
          percentual_exito?: number | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          tipo: string
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          nome?: string
          numero?: string | null
          oab?: string | null
          oab_estado?: string | null
          percentual_exito?: number | null
          pix_chave?: string | null
          pix_tipo?: string | null
          telefone?: string | null
          tipo?: string
          tipo_contrato?: string | null
          updated_at?: string | null
          valor_fixo?: number | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      afastamentos: {
        Row: {
          cid: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string
          dias_afastamento: number | null
          documento_url: string | null
          funcionario_id: string
          id: string
          motivo: string
          registrado_por: string | null
          status: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          cid?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio: string
          dias_afastamento?: number | null
          documento_url?: string | null
          funcionario_id: string
          id?: string
          motivo: string
          registrado_por?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          cid?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string
          dias_afastamento?: number | null
          documento_url?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string
          registrado_por?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "afastamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          nome: string
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          nome: string
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          nome?: string
        }
        Relationships: []
      }
      api_leads_config: {
        Row: {
          api_key_id: string | null
          ativo: boolean | null
          configuracoes: Json | null
          cor: string | null
          created_at: string | null
          icone: string | null
          id: string
          leads_recebidos: number | null
          nome: string
          slug: string
          tipo: string
          ultimo_lead_em: string | null
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key_id?: string | null
          ativo?: boolean | null
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          leads_recebidos?: number | null
          nome: string
          slug: string
          tipo: string
          ultimo_lead_em?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key_id?: string | null
          ativo?: boolean | null
          configuracoes?: Json | null
          cor?: string | null
          created_at?: string | null
          icone?: string | null
          id?: string
          leads_recebidos?: number | null
          nome?: string
          slug?: string
          tipo?: string
          ultimo_lead_em?: string | null
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_leads_config_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_leads_logs: {
        Row: {
          api_config_id: string | null
          created_at: string | null
          erro: string | null
          id: string
          ip_origem: string | null
          lead_id: string | null
          origem: string | null
          payload: Json | null
          status: string
          tempo_resposta_ms: number | null
        }
        Insert: {
          api_config_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          origem?: string | null
          payload?: Json | null
          status: string
          tempo_resposta_ms?: number | null
        }
        Update: {
          api_config_id?: string | null
          created_at?: string | null
          erro?: string | null
          id?: string
          ip_origem?: string | null
          lead_id?: string | null
          origem?: string | null
          payload?: Json | null
          status?: string
          tempo_resposta_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "api_leads_logs_api_config_id_fkey"
            columns: ["api_config_id"]
            isOneToOne: false
            referencedRelation: "api_leads_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leads_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_leads_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      asaas_clientes: {
        Row: {
          asaas_id: string
          associado_id: string
          ativo: boolean | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf_cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          logradouro: string | null
          nome: string | null
          numero: string | null
          sincronizado_em: string | null
          telefone: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          asaas_id: string
          associado_id: string
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          asaas_id?: string
          associado_id?: string
          ativo?: boolean | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf_cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          sincronizado_em?: string | null
          telefone?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_clientes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      asaas_cobrancas: {
        Row: {
          asaas_cliente_id: string | null
          asaas_id: string
          associado_id: string
          boleto_codigo_barras: string | null
          boleto_nosso_numero: string | null
          boleto_url: string | null
          cancelado_por: string | null
          competencia: string | null
          contrato_id: string | null
          created_at: string | null
          criado_por: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          forma_pagamento: string | null
          id: string
          juros: number | null
          lembrete_vencimento_enviado: boolean | null
          linha_digitavel: string | null
          motivo_cancelamento: string | null
          multa: number | null
          notificacao_data: string | null
          notificacao_enviada: boolean | null
          pagamento_data: string | null
          pagamento_forma: string | null
          pagamento_transacao_id: string | null
          pagamento_valor: number | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_qrcode: string | null
          referencia: string | null
          sincronizado_em: string | null
          status: string
          tipo: string
          updated_at: string | null
          valor: number
          valor_liquido: number | null
          veiculo_id: string | null
        }
        Insert: {
          asaas_cliente_id?: string | null
          asaas_id: string
          associado_id: string
          boleto_codigo_barras?: string | null
          boleto_nosso_numero?: string | null
          boleto_url?: string | null
          cancelado_por?: string | null
          competencia?: string | null
          contrato_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_emissao: string
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          lembrete_vencimento_enviado?: boolean | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          notificacao_data?: string | null
          notificacao_enviada?: boolean | null
          pagamento_data?: string | null
          pagamento_forma?: string | null
          pagamento_transacao_id?: string | null
          pagamento_valor?: number | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia?: string | null
          sincronizado_em?: string | null
          status: string
          tipo: string
          updated_at?: string | null
          valor: number
          valor_liquido?: number | null
          veiculo_id?: string | null
        }
        Update: {
          asaas_cliente_id?: string | null
          asaas_id?: string
          associado_id?: string
          boleto_codigo_barras?: string | null
          boleto_nosso_numero?: string | null
          boleto_url?: string | null
          cancelado_por?: string | null
          competencia?: string | null
          contrato_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          lembrete_vencimento_enviado?: boolean | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          notificacao_data?: string | null
          notificacao_enviada?: boolean | null
          pagamento_data?: string | null
          pagamento_forma?: string | null
          pagamento_transacao_id?: string | null
          pagamento_valor?: number | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia?: string | null
          sincronizado_em?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
          valor?: number
          valor_liquido?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "asaas_cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      asaas_config: {
        Row: {
          chave: string
          created_at: string | null
          descricao: string | null
          id: string
          tipo: string | null
          updated_at: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          tipo?: string | null
          updated_at?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      asaas_pagamentos: {
        Row: {
          asaas_cobranca_id: string | null
          asaas_id: string
          associado_id: string
          cobranca_id: string | null
          comprovante_url: string | null
          created_at: string | null
          data_credito: string | null
          data_pagamento: string
          forma_pagamento: string
          id: string
          status: string
          taxa: number | null
          transacao_id: string | null
          valor: number
          valor_liquido: number | null
        }
        Insert: {
          asaas_cobranca_id?: string | null
          asaas_id: string
          associado_id: string
          cobranca_id?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento: string
          forma_pagamento: string
          id?: string
          status: string
          taxa?: number | null
          transacao_id?: string | null
          valor: number
          valor_liquido?: number | null
        }
        Update: {
          asaas_cobranca_id?: string | null
          asaas_id?: string
          associado_id?: string
          cobranca_id?: string | null
          comprovante_url?: string | null
          created_at?: string | null
          data_credito?: string | null
          data_pagamento?: string
          forma_pagamento?: string
          id?: string
          status?: string
          taxa?: number | null
          transacao_id?: string | null
          valor?: number
          valor_liquido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "asaas_pagamentos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "asaas_cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      asaas_webhooks_log: {
        Row: {
          asaas_cliente_id: string | null
          asaas_cobranca_id: string | null
          asaas_pagamento_id: string | null
          created_at: string | null
          erro: string | null
          evento: string
          id: string
          payload: Json
          processado: boolean | null
          processado_em: string | null
        }
        Insert: {
          asaas_cliente_id?: string | null
          asaas_cobranca_id?: string | null
          asaas_pagamento_id?: string | null
          created_at?: string | null
          erro?: string | null
          evento: string
          id?: string
          payload: Json
          processado?: boolean | null
          processado_em?: string | null
        }
        Update: {
          asaas_cliente_id?: string | null
          asaas_cobranca_id?: string | null
          asaas_pagamento_id?: string | null
          created_at?: string | null
          erro?: string | null
          evento?: string
          id?: string
          payload?: Json
          processado?: boolean | null
          processado_em?: string | null
        }
        Relationships: []
      }
      associados: {
        Row: {
          avatar_url: string | null
          bairro: string | null
          bloqueado: boolean | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          contrato_id: string | null
          cpf: string
          created_at: string
          data_adesao: string | null
          data_bloqueio: string | null
          data_nascimento: string | null
          dia_vencimento: number | null
          email: string
          estado_civil: string | null
          id: string
          logradouro: string | null
          motivo_bloqueio: string | null
          nome: string
          numero: string | null
          plano_id: string | null
          profissao: string | null
          rg: string | null
          sexo: string | null
          status: Database["public"]["Enums"]["status_associado"]
          telefone: string
          telefone_secundario: string | null
          uf: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          bairro?: string | null
          bloqueado?: boolean | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contrato_id?: string | null
          cpf: string
          created_at?: string
          data_adesao?: string | null
          data_bloqueio?: string | null
          data_nascimento?: string | null
          dia_vencimento?: number | null
          email: string
          estado_civil?: string | null
          id?: string
          logradouro?: string | null
          motivo_bloqueio?: string | null
          nome: string
          numero?: string | null
          plano_id?: string | null
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_associado"]
          telefone: string
          telefone_secundario?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          bairro?: string | null
          bloqueado?: boolean | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contrato_id?: string | null
          cpf?: string
          created_at?: string
          data_adesao?: string | null
          data_bloqueio?: string | null
          data_nascimento?: string | null
          dia_vencimento?: number | null
          email?: string
          estado_civil?: string | null
          id?: string
          logradouro?: string | null
          motivo_bloqueio?: string | null
          nome?: string
          numero?: string | null
          plano_id?: string | null
          profissao?: string | null
          rg?: string | null
          sexo?: string | null
          status?: Database["public"]["Enums"]["status_associado"]
          telefone?: string
          telefone_secundario?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associados_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      associados_historico: {
        Row: {
          associado_id: string
          contrato_id: string | null
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string
          documento_id: string | null
          id: string
          instalacao_id: string | null
          metadata: Json | null
          tipo: string
          usuario_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          associado_id: string
          contrato_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao: string
          documento_id?: string | null
          id?: string
          instalacao_id?: string | null
          metadata?: Json | null
          tipo: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          associado_id?: string
          contrato_id?: string | null
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string
          documento_id?: string | null
          id?: string
          instalacao_id?: string | null
          metadata?: Json | null
          tipo?: string
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "associados_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "documentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "associados_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "associados_historico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      auth_bloqueios: {
        Row: {
          bloqueado_ate: string | null
          bloqueio_permanente: boolean
          created_at: string
          desbloqueado_em: string | null
          desbloqueado_por: string | null
          email: string
          id: string
          ip: unknown
          motivo: string | null
          nivel: number
        }
        Insert: {
          bloqueado_ate?: string | null
          bloqueio_permanente?: boolean
          created_at?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          email: string
          id?: string
          ip?: unknown
          motivo?: string | null
          nivel?: number
        }
        Update: {
          bloqueado_ate?: string | null
          bloqueio_permanente?: boolean
          created_at?: string
          desbloqueado_em?: string | null
          desbloqueado_por?: string | null
          email?: string
          id?: string
          ip?: unknown
          motivo?: string | null
          nivel?: number
        }
        Relationships: [
          {
            foreignKeyName: "auth_bloqueios_desbloqueado_por_fkey"
            columns: ["desbloqueado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_logs: {
        Row: {
          acao: string
          cidade: string | null
          created_at: string | null
          dispositivo: string | null
          email: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          navegador: string | null
          pais: string | null
          profile_id: string | null
          sistema_operacional: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          cidade?: string | null
          created_at?: string | null
          dispositivo?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          navegador?: string | null
          pais?: string | null
          profile_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          cidade?: string | null
          created_at?: string | null
          dispositivo?: string | null
          email?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          navegador?: string | null
          pais?: string | null
          profile_id?: string | null
          sistema_operacional?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_sessoes: {
        Row: {
          ativo: boolean
          created_at: string
          expira_em: string
          id: string
          ip: unknown
          navegador: string | null
          profile_id: string
          sistema_operacional: string | null
          tipo_dispositivo: string
          token_hash: string
          ultimo_acesso: string
          user_agent: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          expira_em: string
          id?: string
          ip?: unknown
          navegador?: string | null
          profile_id: string
          sistema_operacional?: string | null
          tipo_dispositivo: string
          token_hash: string
          ultimo_acesso?: string
          user_agent?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          expira_em?: string
          id?: string
          ip?: unknown
          navegador?: string | null
          profile_id?: string
          sistema_operacional?: string | null
          tipo_dispositivo?: string
          token_hash?: string
          ultimo_acesso?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessoes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_tentativas: {
        Row: {
          created_at: string
          email: string
          id: string
          ip: unknown
          motivo_falha: string | null
          sucesso: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip?: unknown
          motivo_falha?: string | null
          sucesso?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip?: unknown
          motivo_falha?: string | null
          sucesso?: boolean
        }
        Relationships: []
      }
      auth_tokens_primeiro_acesso: {
        Row: {
          associado_id: string
          created_at: string | null
          expira_em: string
          id: string
          token: string
          usado: boolean | null
          usado_em: string | null
        }
        Insert: {
          associado_id: string
          created_at?: string | null
          expira_em: string
          id?: string
          token: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Update: {
          associado_id?: string
          created_at?: string | null
          expira_em?: string
          id?: string
          token?: string
          usado?: boolean | null
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "auth_tokens_primeiro_acesso_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          avaliador_id: string
          created_at: string | null
          feedback_funcionario: string | null
          funcionario_id: string
          id: string
          nota_competencias: number | null
          nota_comportamento: number | null
          nota_final: number | null
          nota_resultados: number | null
          periodo_fim: string
          periodo_inicio: string
          plano_desenvolvimento: string | null
          pontos_fortes: string | null
          pontos_melhoria: string | null
          status: string | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          avaliador_id: string
          created_at?: string | null
          feedback_funcionario?: string | null
          funcionario_id: string
          id?: string
          nota_competencias?: number | null
          nota_comportamento?: number | null
          nota_final?: number | null
          nota_resultados?: number | null
          periodo_fim: string
          periodo_inicio: string
          plano_desenvolvimento?: string | null
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          avaliador_id?: string
          created_at?: string | null
          feedback_funcionario?: string | null
          funcionario_id?: string
          id?: string
          nota_competencias?: number | null
          nota_comportamento?: number | null
          nota_final?: number | null
          nota_resultados?: number | null
          periodo_fim?: string
          periodo_inicio?: string
          plano_desenvolvimento?: string | null
          pontos_fortes?: string | null
          pontos_melhoria?: string | null
          status?: string | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      banco_horas: {
        Row: {
          ano: number
          created_at: string | null
          fechado: boolean | null
          fechado_em: string | null
          fechado_por: string | null
          funcionario_id: string
          horas_compensadas: unknown
          horas_extras: unknown
          id: string
          mes: number
          saldo_anterior: unknown
          saldo_atual: unknown
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          funcionario_id: string
          horas_compensadas?: unknown
          horas_extras?: unknown
          id?: string
          mes: number
          saldo_anterior?: unknown
          saldo_atual?: unknown
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          fechado?: boolean | null
          fechado_em?: string | null
          fechado_por?: string | null
          funcionario_id?: string
          horas_compensadas?: unknown
          horas_extras?: unknown
          id?: string
          mes?: number
          saldo_anterior?: unknown
          saldo_atual?: unknown
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banco_horas_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "banco_horas_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          descricao: string | null
          fornecedor: string | null
          id: string
          nome: string
          percentual_desconto: number | null
          tipo: string
          valor_empresa: number | null
          valor_funcionario: number | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          nome: string
          percentual_desconto?: number | null
          tipo: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          descricao?: string | null
          fornecedor?: string | null
          id?: string
          nome?: string
          percentual_desconto?: number | null
          tipo?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Relationships: []
      }
      campanhas: {
        Row: {
          canal_id: string | null
          codigo: string | null
          created_at: string | null
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          id: string
          meta_conversoes: number | null
          meta_cpl: number | null
          meta_leads: number | null
          nome: string
          observacoes: string | null
          orcamento_diario: number | null
          orcamento_total: number | null
          publico_alvo: string | null
          regioes: string[] | null
          responsavel_id: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          valor_gasto: number | null
        }
        Insert: {
          canal_id?: string | null
          codigo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio: string
          id?: string
          meta_conversoes?: number | null
          meta_cpl?: number | null
          meta_leads?: number | null
          nome: string
          observacoes?: string | null
          orcamento_diario?: number | null
          orcamento_total?: number | null
          publico_alvo?: string | null
          regioes?: string[] | null
          responsavel_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_gasto?: number | null
        }
        Update: {
          canal_id?: string | null
          codigo?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          id?: string
          meta_conversoes?: number | null
          meta_cpl?: number | null
          meta_leads?: number | null
          nome?: string
          observacoes?: string | null
          orcamento_diario?: number | null
          orcamento_total?: number | null
          publico_alvo?: string | null
          regioes?: string[] | null
          responsavel_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          valor_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "canais_marketing"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_canal_id_fkey"
            columns: ["canal_id"]
            isOneToOne: false
            referencedRelation: "view_performance_canais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campanhas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campanhas_metricas: {
        Row: {
          campanha_id: string
          cliques: number | null
          conversoes: number | null
          cpa: number | null
          cpl: number | null
          created_at: string | null
          ctr: number | null
          data: string
          id: string
          impressoes: number | null
          leads: number | null
          taxa_conversao: number | null
          valor_gasto: number | null
        }
        Insert: {
          campanha_id: string
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          data: string
          id?: string
          impressoes?: number | null
          leads?: number | null
          taxa_conversao?: number | null
          valor_gasto?: number | null
        }
        Update: {
          campanha_id?: string
          cliques?: number | null
          conversoes?: number | null
          cpa?: number | null
          cpl?: number | null
          created_at?: string | null
          ctr?: number | null
          data?: string
          id?: string
          impressoes?: number | null
          leads?: number | null
          taxa_conversao?: number | null
          valor_gasto?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "campanhas_metricas_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
        ]
      }
      canais_marketing: {
        Row: {
          api_key: string | null
          ativo: boolean | null
          created_at: string | null
          custo_por_lead: number | null
          descricao: string | null
          id: string
          meta_leads_mes: number | null
          nome: string
          tipo: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          descricao?: string | null
          id?: string
          meta_leads_mes?: number | null
          nome: string
          tipo: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          ativo?: boolean | null
          created_at?: string | null
          custo_por_lead?: number | null
          descricao?: string | null
          id?: string
          meta_leads_mes?: number | null
          nome?: string
          tipo?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      cargos: {
        Row: {
          ativo: boolean | null
          cbo: string | null
          created_at: string | null
          departamento_id: string | null
          descricao: string | null
          id: string
          nivel: number | null
          nome: string
          salario_base: number | null
        }
        Insert: {
          ativo?: boolean | null
          cbo?: string | null
          created_at?: string | null
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nivel?: number | null
          nome: string
          salario_base?: number | null
        }
        Update: {
          ativo?: boolean | null
          cbo?: string | null
          created_at?: string | null
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nivel?: number | null
          nome?: string
          salario_base?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      centros_custo: {
        Row: {
          ativo: boolean | null
          centro_pai_id: string | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
        }
        Insert: {
          ativo?: boolean | null
          centro_pai_id?: string | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
        }
        Update: {
          ativo?: boolean | null
          centro_pai_id?: string | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "centros_custo_centro_pai_id_fkey"
            columns: ["centro_pai_id"]
            isOneToOne: false
            referencedRelation: "centros_custo"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_assistencia: {
        Row: {
          associado_id: string
          atendente_id: string | null
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          canal: string
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          descricao: string | null
          destino_cep: string | null
          destino_cidade: string | null
          destino_endereco: string | null
          destino_lat: number | null
          destino_lng: number | null
          destino_logradouro: string | null
          destino_uf: string | null
          id: string
          origem_cep: string | null
          origem_cidade: string | null
          origem_endereco: string | null
          origem_lat: number | null
          origem_lng: number | null
          origem_logradouro: string | null
          origem_uf: string | null
          prestador_id: string | null
          prestador_nome: string | null
          prestador_telefone: string | null
          protocolo: string
          status: Database["public"]["Enums"]["status_chamado"]
          tipo_servico: string
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          associado_id: string
          atendente_id?: string | null
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_endereco?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_endereco?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
          prestador_id?: string | null
          prestador_nome?: string | null
          prestador_telefone?: string | null
          protocolo: string
          status?: Database["public"]["Enums"]["status_chamado"]
          tipo_servico: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          associado_id?: string
          atendente_id?: string | null
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_endereco?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_endereco?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
          prestador_id?: string | null
          prestador_nome?: string | null
          prestador_telefone?: string | null
          protocolo?: string
          status?: Database["public"]["Enums"]["status_chamado"]
          tipo_servico?: string
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      chamados_assistencia_atendimentos: {
        Row: {
          chamado_id: string
          created_at: string | null
          hora_aceite: string | null
          hora_acionamento: string | null
          hora_chegada: string | null
          hora_conclusao: string | null
          id: string
          km_extra: number | null
          km_origem_destino: number | null
          motivo_recusa: string | null
          observacao: string | null
          prestador_id: string | null
          status: string | null
          valor_km_extra: number | null
          valor_servico: number | null
          valor_total: number | null
        }
        Insert: {
          chamado_id: string
          created_at?: string | null
          hora_aceite?: string | null
          hora_acionamento?: string | null
          hora_chegada?: string | null
          hora_conclusao?: string | null
          id?: string
          km_extra?: number | null
          km_origem_destino?: number | null
          motivo_recusa?: string | null
          observacao?: string | null
          prestador_id?: string | null
          status?: string | null
          valor_km_extra?: number | null
          valor_servico?: number | null
          valor_total?: number | null
        }
        Update: {
          chamado_id?: string
          created_at?: string | null
          hora_aceite?: string | null
          hora_acionamento?: string | null
          hora_chegada?: string | null
          hora_conclusao?: string | null
          id?: string
          km_extra?: number | null
          km_origem_destino?: number | null
          motivo_recusa?: string | null
          observacao?: string | null
          prestador_id?: string | null
          status?: string | null
          valor_km_extra?: number | null
          valor_servico?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_atendimentos_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_atendimentos_prestador_id_fkey"
            columns: ["prestador_id"]
            isOneToOne: false
            referencedRelation: "prestadores_assistencia"
            referencedColumns: ["id"]
          },
        ]
      }
      chamados_assistencia_historico: {
        Row: {
          chamado_id: string
          created_at: string | null
          id: string
          observacao: string | null
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          chamado_id: string
          created_at?: string | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          chamado_id?: string
          created_at?: string | null
          id?: string
          observacao?: string | null
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chamados_assistencia_historico_chamado_id_fkey"
            columns: ["chamado_id"]
            isOneToOne: false
            referencedRelation: "chamados_assistencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coberturas: {
        Row: {
          ativo: boolean | null
          carencia_dias: number | null
          codigo: string
          created_at: string | null
          descricao: string | null
          franquia_percentual: number | null
          franquia_valor: number | null
          id: string
          nome: string
          percentual_cobertura: number | null
          tipo: string
          valor_limite: number | null
        }
        Insert: {
          ativo?: boolean | null
          carencia_dias?: number | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          nome: string
          percentual_cobertura?: number | null
          tipo: string
          valor_limite?: number | null
        }
        Update: {
          ativo?: boolean | null
          carencia_dias?: number | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          nome?: string
          percentual_cobertura?: number | null
          tipo?: string
          valor_limite?: number | null
        }
        Relationships: []
      }
      cobranca_contatos: {
        Row: {
          associado_id: string
          atendente_id: string | null
          cobranca_id: string | null
          created_at: string | null
          duracao_segundos: number | null
          id: string
          observacao: string | null
          promessa_data: string | null
          promessa_valor: number | null
          resultado: string
          tipo: string
        }
        Insert: {
          associado_id: string
          atendente_id?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          duracao_segundos?: number | null
          id?: string
          observacao?: string | null
          promessa_data?: string | null
          promessa_valor?: number | null
          resultado: string
          tipo: string
        }
        Update: {
          associado_id?: string
          atendente_id?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          duracao_segundos?: number | null
          id?: string
          observacao?: string | null
          promessa_data?: string | null
          promessa_valor?: number | null
          resultado?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_contatos_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobranca_fila: {
        Row: {
          associado_id: string
          atribuido_para: string | null
          cobranca_id: string | null
          concluido_em: string | null
          created_at: string | null
          data_agendamento: string | null
          id: string
          motivo: string
          prioridade: number | null
          resultado: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          associado_id: string
          atribuido_para?: string | null
          cobranca_id?: string | null
          concluido_em?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          id?: string
          motivo: string
          prioridade?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          associado_id?: string
          atribuido_para?: string | null
          cobranca_id?: string | null
          concluido_em?: string | null
          created_at?: string | null
          data_agendamento?: string | null
          id?: string
          motivo?: string
          prioridade?: number | null
          resultado?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobranca_fila_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      cobrancas: {
        Row: {
          associado_id: string
          boleto_url: string | null
          cancelado_por: string | null
          codigo_barras: string | null
          comprovante_url: string | null
          contrato_id: string | null
          created_at: string
          criado_por: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          descricao: string | null
          forma_pagamento: string | null
          id: string
          juros: number | null
          linha_digitavel: string | null
          motivo_cancelamento: string | null
          multa: number | null
          nosso_numero: string | null
          pix_copia_cola: string | null
          pix_expiracao: string | null
          pix_qrcode: string | null
          referencia_ano: number | null
          referencia_mes: number | null
          status: string
          tipo: string
          updated_at: string
          valor: number
          valor_final: number
          valor_pago: number | null
          veiculo_id: string | null
        }
        Insert: {
          associado_id: string
          boleto_url?: string | null
          cancelado_por?: string | null
          codigo_barras?: string | null
          comprovante_url?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia_ano?: number | null
          referencia_mes?: number | null
          status?: string
          tipo: string
          updated_at?: string
          valor: number
          valor_final: number
          valor_pago?: number | null
          veiculo_id?: string | null
        }
        Update: {
          associado_id?: string
          boleto_url?: string | null
          cancelado_por?: string | null
          codigo_barras?: string | null
          comprovante_url?: string | null
          contrato_id?: string | null
          created_at?: string
          criado_por?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          descricao?: string | null
          forma_pagamento?: string | null
          id?: string
          juros?: number | null
          linha_digitavel?: string | null
          motivo_cancelamento?: string | null
          multa?: number | null
          nosso_numero?: string | null
          pix_copia_cola?: string | null
          pix_expiracao?: string | null
          pix_qrcode?: string | null
          referencia_ano?: number | null
          referencia_mes?: number | null
          status?: string
          tipo?: string
          updated_at?: string
          valor?: number
          valor_final?: number
          valor_pago?: number | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "cobrancas_cancelado_por_fkey"
            columns: ["cancelado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "cobrancas_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          categoria: string
          chave: string
          descricao: string | null
          editavel: boolean | null
          id: string
          tipo: string
          updated_at: string | null
          updated_by: string | null
          valor: string
        }
        Insert: {
          categoria: string
          chave: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          tipo: string
          updated_at?: string | null
          updated_by?: string | null
          valor: string
        }
        Update: {
          categoria?: string
          chave?: string
          descricao?: string | null
          editavel?: boolean | null
          id?: string
          tipo?: string
          updated_at?: string | null
          updated_by?: string | null
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      consultas_juridicas: {
        Row: {
          associado_id: string | null
          assunto: string
          created_at: string | null
          departamento: string | null
          descricao: string
          id: string
          numero: string | null
          parecer: string | null
          prioridade: string | null
          processo_id: string | null
          respondido_em: string | null
          respondido_por: string | null
          sinistro_id: string | null
          solicitante_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          associado_id?: string | null
          assunto: string
          created_at?: string | null
          departamento?: string | null
          descricao: string
          id?: string
          numero?: string | null
          parecer?: string | null
          prioridade?: string | null
          processo_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          sinistro_id?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          associado_id?: string | null
          assunto?: string
          created_at?: string | null
          departamento?: string | null
          descricao?: string
          id?: string
          numero?: string | null
          parecer?: string | null
          prioridade?: string | null
          processo_id?: string | null
          respondido_em?: string | null
          respondido_por?: string | null
          sinistro_id?: string | null
          solicitante_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "consultas_juridicas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_respondido_por_fkey"
            columns: ["respondido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultas_juridicas_solicitante_id_fkey"
            columns: ["solicitante_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string
          ativo: boolean | null
          banco_codigo: string
          banco_nome: string
          conta: string
          created_at: string | null
          data_saldo: string | null
          descricao: string | null
          digito: string | null
          id: string
          saldo_atual: number | null
          tipo: string | null
          updated_at: string | null
        }
        Insert: {
          agencia: string
          ativo?: boolean | null
          banco_codigo: string
          banco_nome: string
          conta: string
          created_at?: string | null
          data_saldo?: string | null
          descricao?: string | null
          digito?: string | null
          id?: string
          saldo_atual?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string
          ativo?: boolean | null
          banco_codigo?: string
          banco_nome?: string
          conta?: string
          created_at?: string | null
          data_saldo?: string | null
          descricao?: string | null
          digito?: string | null
          id?: string
          saldo_atual?: number | null
          tipo?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          agencia: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          banco: string | null
          categoria: string
          comprovante_url: string | null
          conta: string | null
          created_at: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          forma_pagamento: string | null
          fornecedor_documento: string | null
          fornecedor_nome: string
          id: string
          observacao: string | null
          pago_por: string | null
          pix_chave: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string | null
          subcategoria: string | null
          updated_at: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          agencia?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco?: string | null
          categoria: string
          comprovante_url?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          pix_chave?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          agencia?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          banco?: string | null
          categoria?: string
          comprovante_url?: string | null
          conta?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          forma_pagamento?: string | null
          fornecedor_documento?: string | null
          fornecedor_nome?: string
          id?: string
          observacao?: string | null
          pago_por?: string | null
          pix_chave?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string | null
          subcategoria?: string | null
          updated_at?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contas_pagar_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          adesao_cobranca_id: string | null
          adesao_paga: boolean | null
          adesao_paga_em: string | null
          associado_id: string | null
          autentique_documento_id: string | null
          autentique_status: string | null
          autentique_url: string | null
          cliente_cep: string | null
          cliente_cidade: string | null
          cliente_cpf: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_nome: string | null
          cliente_telefone: string | null
          cliente_uf: string | null
          cotacao_id: string | null
          created_at: string
          created_by: string | null
          data_assinatura: string | null
          data_ativacao: string | null
          data_cancelamento: string | null
          data_envio: string | null
          data_fim: string | null
          data_inicio: string
          data_visualizacao: string | null
          dia_vencimento: number | null
          documentos_completos: boolean | null
          id: string
          lead_id: string | null
          link_gerado_em: string | null
          link_token: string | null
          numero: string
          pdf_assinado_url: string | null
          pdf_url: string | null
          plano_id: string
          status: Database["public"]["Enums"]["status_contrato"]
          tipo_vistoria: string | null
          updated_at: string
          validade_link: string | null
          valor_adesao: number
          valor_mensal: number
          veiculo_ano: number | null
          veiculo_chassi: string | null
          veiculo_cor: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_renavam: string | null
          veiculo_valor_fipe: number | null
          vendedor_id: string | null
        }
        Insert: {
          adesao_cobranca_id?: string | null
          adesao_paga?: boolean | null
          adesao_paga_em?: string | null
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_status?: string | null
          autentique_url?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cliente_uf?: string | null
          cotacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_ativacao?: string | null
          data_cancelamento?: string | null
          data_envio?: string | null
          data_fim?: string | null
          data_inicio?: string
          data_visualizacao?: string | null
          dia_vencimento?: number | null
          documentos_completos?: boolean | null
          id?: string
          lead_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          numero: string
          pdf_assinado_url?: string | null
          pdf_url?: string | null
          plano_id: string
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_vistoria?: string | null
          updated_at?: string
          validade_link?: string | null
          valor_adesao: number
          valor_mensal: number
          veiculo_ano?: number | null
          veiculo_chassi?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_renavam?: string | null
          veiculo_valor_fipe?: number | null
          vendedor_id?: string | null
        }
        Update: {
          adesao_cobranca_id?: string | null
          adesao_paga?: boolean | null
          adesao_paga_em?: string | null
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_status?: string | null
          autentique_url?: string | null
          cliente_cep?: string | null
          cliente_cidade?: string | null
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_nome?: string | null
          cliente_telefone?: string | null
          cliente_uf?: string | null
          cotacao_id?: string | null
          created_at?: string
          created_by?: string | null
          data_assinatura?: string | null
          data_ativacao?: string | null
          data_cancelamento?: string | null
          data_envio?: string | null
          data_fim?: string | null
          data_inicio?: string
          data_visualizacao?: string | null
          dia_vencimento?: number | null
          documentos_completos?: boolean | null
          id?: string
          lead_id?: string | null
          link_gerado_em?: string | null
          link_token?: string | null
          numero?: string
          pdf_assinado_url?: string | null
          pdf_url?: string | null
          plano_id?: string
          status?: Database["public"]["Enums"]["status_contrato"]
          tipo_vistoria?: string | null
          updated_at?: string
          validade_link?: string | null
          valor_adesao?: number
          valor_mensal?: number
          veiculo_ano?: number | null
          veiculo_chassi?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          veiculo_renavam?: string | null
          veiculo_valor_fipe?: number | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "contratos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "fk_contratos_associado"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      contratos_documentos: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string
          contrato_id: string | null
          cotacao_id: string | null
          created_at: string | null
          id: string
          ocr_resultado: Json | null
          status: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url: string
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          id?: string
          ocr_resultado?: Json | null
          status?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string
          contrato_id?: string | null
          cotacao_id?: string | null
          created_at?: string | null
          id?: string
          ocr_resultado?: Json | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_documentos_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_documentos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_historico: {
        Row: {
          contrato_id: string
          created_at: string | null
          dados: Json | null
          descricao: string | null
          evento: string
          id: string
          usuario_id: string | null
        }
        Insert: {
          contrato_id: string
          created_at?: string | null
          dados?: Json | null
          descricao?: string | null
          evento: string
          id?: string
          usuario_id?: string | null
        }
        Update: {
          contrato_id?: string
          created_at?: string | null
          dados?: Json | null
          descricao?: string | null
          evento?: string
          id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_historico_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          adicionais_selecionados: Json | null
          categoria: string | null
          cidade: string | null
          codigo_fipe: string | null
          combustivel: string | null
          created_at: string
          dados_extras: Json | null
          desagio_aplicado: number | null
          email_enviado_em: string | null
          id: string
          lead_id: string | null
          numero: string
          plano_id: string | null
          regiao: string | null
          status: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa: number
          token_publico: string | null
          updated_at: string
          uso_aplicativo: boolean | null
          validade_dias: number
          valor_adesao: number
          valor_adesao_original: number | null
          valor_assistencia: number | null
          valor_cota: number
          valor_fipe: number
          valor_mensal_original: number | null
          valor_rastreamento: number
          valor_total_mensal: number
          veiculo_ano: number | null
          veiculo_combustivel: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
        }
        Insert: {
          adicionais_selecionados?: Json | null
          categoria?: string | null
          cidade?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          created_at?: string
          dados_extras?: Json | null
          desagio_aplicado?: number | null
          email_enviado_em?: string | null
          id?: string
          lead_id?: string | null
          numero: string
          plano_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa?: number
          token_publico?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_dias?: number
          valor_adesao: number
          valor_adesao_original?: number | null
          valor_assistencia?: number | null
          valor_cota: number
          valor_fipe: number
          valor_mensal_original?: number | null
          valor_rastreamento?: number
          valor_total_mensal: number
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Update: {
          adicionais_selecionados?: Json | null
          categoria?: string | null
          cidade?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          created_at?: string
          dados_extras?: Json | null
          desagio_aplicado?: number | null
          email_enviado_em?: string | null
          id?: string
          lead_id?: string | null
          numero?: string
          plano_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa?: number
          token_publico?: string | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          validade_dias?: number
          valor_adesao?: number
          valor_adesao_original?: number | null
          valor_assistencia?: number | null
          valor_cota?: number
          valor_fipe?: number
          valor_mensal_original?: number | null
          valor_rastreamento?: number
          valor_total_mensal?: number
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "cotacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cotacoes_lead_id"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cotacoes_lead_id"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      cotacoes_publicas: {
        Row: {
          adicionais_selecionados: Json | null
          asaas_boleto_url: string | null
          asaas_charge_id: string | null
          asaas_customer_id: string | null
          asaas_pix_copiacola: string | null
          asaas_pix_qrcode: string | null
          codigo_fipe: string | null
          concluido_em: string | null
          created_at: string | null
          dados_cnh: Json | null
          dados_comprovante: Json | null
          dados_crlv: Json | null
          doc_cnh_frente: string | null
          doc_cnh_verso: string | null
          doc_comprovante: string | null
          doc_crlv: string | null
          doc_selfie: string | null
          documentos_ok_em: string | null
          expires_at: string | null
          face_aprovada: boolean | null
          face_match_score: number | null
          face_verificada_em: string | null
          id: string
          ip_address: string | null
          lead_id: string | null
          pagamento_confirmado_em: string | null
          pagamento_metodo: string | null
          pagamento_status: string | null
          pendencias: Json | null
          pendencias_observacoes: string | null
          plano_escolhido: string | null
          plano_escolhido_em: string | null
          proposta_aceita_em: string | null
          rastreador_agendado_para: string | null
          rastreador_id: string | null
          rastreador_instalado_em: string | null
          selfie_ok_em: string | null
          status: string | null
          termos_aceitos: boolean | null
          termos_aceitos_em: string | null
          tipo_vistoria: string | null
          token: string
          updated_at: string | null
          user_agent: string | null
          uso_aplicativo: boolean | null
          uso_definido_em: string | null
          valor_adesao_final: number | null
          valor_fipe: number | null
          valor_mensal_final: number | null
          valor_primeira_parcela: number | null
          veiculo_ano: number | null
          veiculo_combustivel: string | null
          veiculo_cor: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
          vistoria_agendada_para: string | null
          vistoria_concluida_em: string | null
          vistoria_endereco: string | null
          vistoria_observacoes: string | null
          vistoria_ok_em: string | null
          visualizado_em: string | null
        }
        Insert: {
          adicionais_selecionados?: Json | null
          asaas_boleto_url?: string | null
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          asaas_pix_copiacola?: string | null
          asaas_pix_qrcode?: string | null
          codigo_fipe?: string | null
          concluido_em?: string | null
          created_at?: string | null
          dados_cnh?: Json | null
          dados_comprovante?: Json | null
          dados_crlv?: Json | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          documentos_ok_em?: string | null
          expires_at?: string | null
          face_aprovada?: boolean | null
          face_match_score?: number | null
          face_verificada_em?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencias?: Json | null
          pendencias_observacoes?: string | null
          plano_escolhido?: string | null
          plano_escolhido_em?: string | null
          proposta_aceita_em?: string | null
          rastreador_agendado_para?: string | null
          rastreador_id?: string | null
          rastreador_instalado_em?: string | null
          selfie_ok_em?: string | null
          status?: string | null
          termos_aceitos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_vistoria?: string | null
          token?: string
          updated_at?: string | null
          user_agent?: string | null
          uso_aplicativo?: boolean | null
          uso_definido_em?: string | null
          valor_adesao_final?: number | null
          valor_fipe?: number | null
          valor_mensal_final?: number | null
          valor_primeira_parcela?: number | null
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
          vistoria_agendada_para?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco?: string | null
          vistoria_observacoes?: string | null
          vistoria_ok_em?: string | null
          visualizado_em?: string | null
        }
        Update: {
          adicionais_selecionados?: Json | null
          asaas_boleto_url?: string | null
          asaas_charge_id?: string | null
          asaas_customer_id?: string | null
          asaas_pix_copiacola?: string | null
          asaas_pix_qrcode?: string | null
          codigo_fipe?: string | null
          concluido_em?: string | null
          created_at?: string | null
          dados_cnh?: Json | null
          dados_comprovante?: Json | null
          dados_crlv?: Json | null
          doc_cnh_frente?: string | null
          doc_cnh_verso?: string | null
          doc_comprovante?: string | null
          doc_crlv?: string | null
          doc_selfie?: string | null
          documentos_ok_em?: string | null
          expires_at?: string | null
          face_aprovada?: boolean | null
          face_match_score?: number | null
          face_verificada_em?: string | null
          id?: string
          ip_address?: string | null
          lead_id?: string | null
          pagamento_confirmado_em?: string | null
          pagamento_metodo?: string | null
          pagamento_status?: string | null
          pendencias?: Json | null
          pendencias_observacoes?: string | null
          plano_escolhido?: string | null
          plano_escolhido_em?: string | null
          proposta_aceita_em?: string | null
          rastreador_agendado_para?: string | null
          rastreador_id?: string | null
          rastreador_instalado_em?: string | null
          selfie_ok_em?: string | null
          status?: string | null
          termos_aceitos?: boolean | null
          termos_aceitos_em?: string | null
          tipo_vistoria?: string | null
          token?: string
          updated_at?: string | null
          user_agent?: string | null
          uso_aplicativo?: boolean | null
          uso_definido_em?: string | null
          valor_adesao_final?: number | null
          valor_fipe?: number | null
          valor_mensal_final?: number | null
          valor_primeira_parcela?: number | null
          veiculo_ano?: number | null
          veiculo_combustivel?: string | null
          veiculo_cor?: string | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
          vistoria_agendada_para?: string | null
          vistoria_concluida_em?: string | null
          vistoria_endereco?: string | null
          vistoria_observacoes?: string | null
          vistoria_ok_em?: string | null
          visualizado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "cotacoes_publicas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_publicas_fotos: {
        Row: {
          aprovada: boolean | null
          cotacao_id: string
          created_at: string | null
          descricao: string | null
          id: string
          latitude: number | null
          longitude: number | null
          motivo_rejeicao: string | null
          tipo: string
          url: string
        }
        Insert: {
          aprovada?: boolean | null
          cotacao_id: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          tipo: string
          url: string
        }
        Update: {
          aprovada?: boolean | null
          cotacao_id?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motivo_rejeicao?: string | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_fotos_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      cotacoes_publicas_historico: {
        Row: {
          acao: string
          cotacao_id: string
          created_at: string | null
          detalhes: Json | null
          id: string
          ip_address: string | null
          status_anterior: string | null
          status_novo: string | null
          user_agent: string | null
        }
        Insert: {
          acao: string
          cotacao_id: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_agent?: string | null
        }
        Update: {
          acao?: string
          cotacao_id?: string
          created_at?: string | null
          detalhes?: Json | null
          id?: string
          ip_address?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cotacoes_publicas_historico_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes_publicas"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          departamento_pai_id: string | null
          descricao: string | null
          id: string
          nome: string
          responsavel_id: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          departamento_pai_id?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          responsavel_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_departamento_pai_id_fkey"
            columns: ["departamento_pai_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamentos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicao_config: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          distribuir_fins_semana: boolean | null
          fallback_usuario_id: string | null
          id: string
          limite_diario_padrao: number | null
          resetar_contadores_hora: number | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          distribuir_fins_semana?: boolean | null
          fallback_usuario_id?: string | null
          id?: string
          limite_diario_padrao?: number | null
          resetar_contadores_hora?: number | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          distribuir_fins_semana?: boolean | null
          fallback_usuario_id?: string | null
          id?: string
          limite_diario_padrao?: number | null
          resetar_contadores_hora?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_config_fallback_usuario_id_fkey"
            columns: ["fallback_usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distribuicao_historico: {
        Row: {
          atribuido_automaticamente: boolean | null
          created_at: string | null
          id: string
          lead_id: string
          motivo: string | null
          vendedor_id: string | null
        }
        Insert: {
          atribuido_automaticamente?: boolean | null
          created_at?: string | null
          id?: string
          lead_id: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Update: {
          atribuido_automaticamente?: boolean | null
          created_at?: string | null
          id?: string
          lead_id?: string
          motivo?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribuicao_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribuicao_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      distribuicao_vendedores: {
        Row: {
          created_at: string | null
          id: string
          leads_hoje: number | null
          limite_diario: number | null
          ordem: number | null
          status: string | null
          total_leads: number | null
          ultima_atribuicao: string | null
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          leads_hoje?: number | null
          limite_diario?: number | null
          ordem?: number | null
          status?: string | null
          total_leads?: number | null
          ultima_atribuicao?: string | null
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          leads_hoje?: number | null
          limite_diario?: number | null
          ordem?: number | null
          status?: string | null
          total_leads?: number | null
          ultima_atribuicao?: string | null
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: []
      }
      documentos: {
        Row: {
          analista_id: string | null
          arquivo_url: string
          associado_id: string
          created_at: string
          data_analise: string | null
          id: string
          motivo_reprovacao: string | null
          nome_arquivo: string
          status: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id: string | null
        }
        Insert: {
          analista_id?: string | null
          arquivo_url: string
          associado_id: string
          created_at?: string
          data_analise?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo: string
          status?: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes?: number | null
          tipo: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id?: string | null
        }
        Update: {
          analista_id?: string | null
          arquivo_url?: string
          associado_id?: string
          created_at?: string
          data_analise?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string
          status?: Database["public"]["Enums"]["status_documento"]
          tamanho_bytes?: number | null
          tipo?: Database["public"]["Enums"]["tipo_documento"]
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          fornecedor: string | null
          id: string
          instalacao_id: string | null
          motivo: string | null
          nota_fiscal: string | null
          observacoes: string | null
          quantidade: number
          rastreador_id: string | null
          status_anterior: string | null
          status_novo: string | null
          tipo: string
          updated_at: string | null
          usuario_id: string | null
          veiculo_id: string | null
        }
        Insert: {
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          instalacao_id?: string | null
          motivo?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade?: number
          rastreador_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo: string
          updated_at?: string | null
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Update: {
          created_at?: string | null
          fornecedor?: string | null
          id?: string
          instalacao_id?: string | null
          motivo?: string | null
          nota_fiscal?: string | null
          observacoes?: string | null
          quantidade?: number
          rastreador_id?: string | null
          status_anterior?: string | null
          status_novo?: string | null
          tipo?: string
          updated_at?: string | null
          usuario_id?: string | null
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      extratos_bancarios: {
        Row: {
          arquivo_nome: string
          arquivo_path: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          erro_mensagem: string | null
          id: string
          importado_por: string | null
          qtd_conciliados: number | null
          qtd_lancamentos: number | null
          saldo_final: number | null
          saldo_inicial: number | null
          status: string | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          qtd_conciliados?: number | null
          qtd_lancamentos?: number | null
          saldo_final?: number | null
          saldo_inicial?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          erro_mensagem?: string | null
          id?: string
          importado_por?: string | null
          qtd_conciliados?: number | null
          qtd_lancamentos?: number | null
          saldo_final?: number | null
          saldo_inicial?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "extratos_bancarios_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "extratos_bancarios_importado_por_fkey"
            columns: ["importado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faturamentos: {
        Row: {
          created_at: string | null
          data_envio: string | null
          data_fechamento: string | null
          data_geracao: string | null
          data_vencimento: string | null
          gerado_por: string | null
          id: string
          referencia_ano: number
          referencia_mes: number
          status: string | null
          total_associados: number | null
          total_cobrancas: number | null
          updated_at: string | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_total: number | null
        }
        Insert: {
          created_at?: string | null
          data_envio?: string | null
          data_fechamento?: string | null
          data_geracao?: string | null
          data_vencimento?: string | null
          gerado_por?: string | null
          id?: string
          referencia_ano: number
          referencia_mes: number
          status?: string | null
          total_associados?: number | null
          total_cobrancas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Update: {
          created_at?: string | null
          data_envio?: string | null
          data_fechamento?: string | null
          data_geracao?: string | null
          data_vencimento?: string | null
          gerado_por?: string | null
          id?: string
          referencia_ano?: number
          referencia_mes?: number
          status?: string | null
          total_associados?: number | null
          total_cobrancas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_pendente?: number | null
          valor_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "faturamentos_gerado_por_fkey"
            columns: ["gerado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_contabeis: {
        Row: {
          ano: number
          created_at: string | null
          data_fechamento: string | null
          data_reabertura: string | null
          fechado_por: string | null
          id: string
          mes: number
          motivo_reabertura: string | null
          qtd_lancamentos: number | null
          reaberto_por: string | null
          resultado_periodo: number | null
          status: string | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          data_fechamento?: string | null
          data_reabertura?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          motivo_reabertura?: string | null
          qtd_lancamentos?: number | null
          reaberto_por?: string | null
          resultado_periodo?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          data_fechamento?: string | null
          data_reabertura?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          motivo_reabertura?: string | null
          qtd_lancamentos?: number | null
          reaberto_por?: string | null
          resultado_periodo?: number | null
          status?: string | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_contabeis_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_contabeis_reaberto_por_fkey"
            columns: ["reaberto_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ferias: {
        Row: {
          adiantamento_13: boolean | null
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          data_fim: string
          data_inicio: string
          dias_abono: number | null
          dias_gozados: number
          funcionario_id: string
          id: string
          observacoes: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status: string | null
          updated_at: string | null
          valor_abono: number | null
        }
        Insert: {
          adiantamento_13?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fim: string
          data_inicio: string
          dias_abono?: number | null
          dias_gozados: number
          funcionario_id: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim: string
          periodo_aquisitivo_inicio: string
          status?: string | null
          updated_at?: string | null
          valor_abono?: number | null
        }
        Update: {
          adiantamento_13?: boolean | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data_fim?: string
          data_inicio?: string
          dias_abono?: number | null
          dias_gozados?: number
          funcionario_id?: string
          id?: string
          observacoes?: string | null
          periodo_aquisitivo_fim?: string
          periodo_aquisitivo_inicio?: string
          status?: string | null
          updated_at?: string | null
          valor_abono?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ferias_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ferias_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          celular: string | null
          cep: string | null
          certificado_reservista: string | null
          cidade: string | null
          cnh: string | null
          cnh_categoria: string | null
          cnh_validade: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          ctps_uf: string | null
          data_admissao: string
          data_demissao: string | null
          data_nascimento: string | null
          departamento_id: string | null
          email_pessoal: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          gestor_id: string | null
          horario_entrada: string | null
          horario_saida: string | null
          id: string
          intervalo_minutos: number | null
          logradouro: string | null
          matricula: string | null
          motivo_demissao: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          numero: string | null
          pis: string | null
          pix_chave: string | null
          pix_tipo: string | null
          rg: string | null
          rg_orgao: string | null
          salario_atual: number | null
          secao_eleitoral: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          titulo_eleitor: string | null
          updated_at: string | null
          usuario_id: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          celular?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          cidade?: string | null
          cnh?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          ctps_uf?: string | null
          data_admissao: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          email_pessoal?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          gestor_id?: string | null
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          intervalo_minutos?: number | null
          logradouro?: string | null
          matricula?: string | null
          motivo_demissao?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo: string
          numero?: string | null
          pis?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          rg?: string | null
          rg_orgao?: string | null
          salario_atual?: number | null
          secao_eleitoral?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          titulo_eleitor?: string | null
          updated_at?: string | null
          usuario_id?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          celular?: string | null
          cep?: string | null
          certificado_reservista?: string | null
          cidade?: string | null
          cnh?: string | null
          cnh_categoria?: string | null
          cnh_validade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          ctps_uf?: string | null
          data_admissao?: string
          data_demissao?: string | null
          data_nascimento?: string | null
          departamento_id?: string | null
          email_pessoal?: string | null
          estado?: string | null
          estado_civil?: string | null
          foto_url?: string | null
          gestor_id?: string | null
          horario_entrada?: string | null
          horario_saida?: string | null
          id?: string
          intervalo_minutos?: number | null
          logradouro?: string | null
          matricula?: string | null
          motivo_demissao?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string
          numero?: string | null
          pis?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          rg?: string | null
          rg_orgao?: string | null
          salario_atual?: number | null
          secao_eleitoral?: string | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          tipo_conta?: string | null
          tipo_contrato?: string | null
          titulo_eleitor?: string | null
          updated_at?: string | null
          usuario_id?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_beneficios: {
        Row: {
          ativo: boolean | null
          beneficio_id: string
          created_at: string | null
          dados_adicionais: Json | null
          data_fim: string | null
          data_inicio: string
          funcionario_id: string
          id: string
          valor_empresa: number | null
          valor_funcionario: number | null
        }
        Insert: {
          ativo?: boolean | null
          beneficio_id: string
          created_at?: string | null
          dados_adicionais?: Json | null
          data_fim?: string | null
          data_inicio: string
          funcionario_id: string
          id?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Update: {
          ativo?: boolean | null
          beneficio_id?: string
          created_at?: string | null
          dados_adicionais?: Json | null
          data_fim?: string | null
          data_inicio?: string
          funcionario_id?: string
          id?: string
          valor_empresa?: number | null
          valor_funcionario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_beneficios_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_beneficios_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_dependentes: {
        Row: {
          cpf: string | null
          created_at: string | null
          data_nascimento: string | null
          funcionario_id: string
          id: string
          inclui_ir: boolean | null
          inclui_plano_saude: boolean | null
          nome: string
          parentesco: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          funcionario_id: string
          id?: string
          inclui_ir?: boolean | null
          inclui_plano_saude?: boolean | null
          nome: string
          parentesco?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          funcionario_id?: string
          id?: string
          inclui_ir?: boolean | null
          inclui_plano_saude?: boolean | null
          nome?: string
          parentesco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_dependentes_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_documentos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          data_validade: string | null
          enviado_por: string | null
          funcionario_id: string
          id: string
          nome: string
          observacoes: string | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          data_validade?: string | null
          enviado_por?: string | null
          funcionario_id: string
          id?: string
          nome: string
          observacoes?: string | null
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          data_validade?: string | null
          enviado_por?: string | null
          funcionario_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_documentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_historico: {
        Row: {
          cargo_anterior_id: string | null
          cargo_novo_id: string | null
          created_at: string | null
          data_vigencia: string
          departamento_anterior_id: string | null
          departamento_novo_id: string | null
          funcionario_id: string
          id: string
          motivo: string | null
          registrado_por: string | null
          salario_anterior: number | null
          salario_novo: number | null
          tipo: string
        }
        Insert: {
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string | null
          data_vigencia: string
          departamento_anterior_id?: string | null
          departamento_novo_id?: string | null
          funcionario_id: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo: string
        }
        Update: {
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string | null
          data_vigencia?: string
          departamento_anterior_id?: string | null
          departamento_novo_id?: string | null
          funcionario_id?: string
          id?: string
          motivo?: string | null
          registrado_por?: string | null
          salario_anterior?: number | null
          salario_novo?: number | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_historico_cargo_anterior_id_fkey"
            columns: ["cargo_anterior_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_departamento_anterior_id_fkey"
            columns: ["departamento_anterior_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_departamento_novo_id_fkey"
            columns: ["departamento_novo_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_historico_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_treinamentos: {
        Row: {
          certificado_url: string | null
          created_at: string | null
          data_conclusao: string | null
          data_inscricao: string | null
          funcionario_id: string
          id: string
          nota: number | null
          observacoes: string | null
          status: string | null
          treinamento_id: string
        }
        Insert: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inscricao?: string | null
          funcionario_id: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          status?: string | null
          treinamento_id: string
        }
        Update: {
          certificado_url?: string | null
          created_at?: string | null
          data_conclusao?: string | null
          data_inscricao?: string | null
          funcionario_id?: string
          id?: string
          nota?: number | null
          observacoes?: string | null
          status?: string | null
          treinamento_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_treinamentos_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_treinamentos_treinamento_id_fkey"
            columns: ["treinamento_id"]
            isOneToOne: false
            referencedRelation: "treinamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      indicacoes: {
        Row: {
          associado_id: string | null
          codigo: string | null
          created_at: string | null
          data_contato: string | null
          data_conversao: string | null
          data_indicacao: string | null
          data_recompensa: string | null
          id: string
          indicado_email: string | null
          indicado_nome: string
          indicado_telefone: string
          indicador_id: string | null
          indicador_nome: string | null
          indicador_telefone: string | null
          lead_id: string | null
          observacoes: string | null
          programa_id: string | null
          recompensa_paga: boolean | null
          status: string | null
          updated_at: string | null
          valor_recompensa: number | null
        }
        Insert: {
          associado_id?: string | null
          codigo?: string | null
          created_at?: string | null
          data_contato?: string | null
          data_conversao?: string | null
          data_indicacao?: string | null
          data_recompensa?: string | null
          id?: string
          indicado_email?: string | null
          indicado_nome: string
          indicado_telefone: string
          indicador_id?: string | null
          indicador_nome?: string | null
          indicador_telefone?: string | null
          lead_id?: string | null
          observacoes?: string | null
          programa_id?: string | null
          recompensa_paga?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_recompensa?: number | null
        }
        Update: {
          associado_id?: string | null
          codigo?: string | null
          created_at?: string | null
          data_contato?: string | null
          data_conversao?: string | null
          data_indicacao?: string | null
          data_recompensa?: string | null
          id?: string
          indicado_email?: string | null
          indicado_nome?: string
          indicado_telefone?: string
          indicador_id?: string | null
          indicador_nome?: string | null
          indicador_telefone?: string | null
          lead_id?: string | null
          observacoes?: string | null
          programa_id?: string | null
          recompensa_paga?: boolean | null
          status?: string | null
          updated_at?: string | null
          valor_recompensa?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "indicacoes_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programa_indicacao"
            referencedColumns: ["id"]
          },
        ]
      }
      indicadores_atuariais: {
        Row: {
          ano: number
          cancelamentos: number | null
          churn_rate: number | null
          cobertura_sinistros_meses: number | null
          created_at: string | null
          crescimento_liquido: number | null
          despesas_operacionais: number | null
          despesas_sinistros: number | null
          frequencia_sinistros: number | null
          id: string
          margem_operacional: number | null
          mes: number
          novos_associados: number | null
          receita_bruta: number | null
          receita_liquida: number | null
          resultado_operacional: number | null
          saldo_fundo_reserva: number | null
          sinistralidade_bruta: number | null
          sinistralidade_liquida: number | null
          taxa_cancelamento: number | null
          taxa_crescimento: number | null
          taxa_retencao: number | null
          ticket_medio_mensalidade: number | null
          ticket_medio_sinistro: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          cancelamentos?: number | null
          churn_rate?: number | null
          cobertura_sinistros_meses?: number | null
          created_at?: string | null
          crescimento_liquido?: number | null
          despesas_operacionais?: number | null
          despesas_sinistros?: number | null
          frequencia_sinistros?: number | null
          id?: string
          margem_operacional?: number | null
          mes: number
          novos_associados?: number | null
          receita_bruta?: number | null
          receita_liquida?: number | null
          resultado_operacional?: number | null
          saldo_fundo_reserva?: number | null
          sinistralidade_bruta?: number | null
          sinistralidade_liquida?: number | null
          taxa_cancelamento?: number | null
          taxa_crescimento?: number | null
          taxa_retencao?: number | null
          ticket_medio_mensalidade?: number | null
          ticket_medio_sinistro?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          cancelamentos?: number | null
          churn_rate?: number | null
          cobertura_sinistros_meses?: number | null
          created_at?: string | null
          crescimento_liquido?: number | null
          despesas_operacionais?: number | null
          despesas_sinistros?: number | null
          frequencia_sinistros?: number | null
          id?: string
          margem_operacional?: number | null
          mes?: number
          novos_associados?: number | null
          receita_bruta?: number | null
          receita_liquida?: number | null
          resultado_operacional?: number | null
          saldo_fundo_reserva?: number | null
          sinistralidade_bruta?: number | null
          sinistralidade_liquida?: number | null
          taxa_cancelamento?: number | null
          taxa_crescimento?: number | null
          taxa_retencao?: number | null
          ticket_medio_mensalidade?: number | null
          ticket_medio_sinistro?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      instalacao_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          instalacao_id: string
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          instalacao_id: string
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          instalacao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalacao_fotos_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacao_fotos_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
        ]
      }
      instalacoes: {
        Row: {
          assinatura_cliente_url: string | null
          associado_id: string
          bairro: string | null
          cep: string | null
          checklist_data: Json | null
          cidade: string | null
          complemento: string | null
          concluida_em: string | null
          created_at: string
          data_agendada: string
          hora_agendada: string | null
          id: string
          iniciada_em: string | null
          instalador_id: string | null
          lead_id: string | null
          logradouro: string | null
          numero: string | null
          observacoes: string | null
          periodo: Database["public"]["Enums"]["periodo_instalacao"]
          quilometragem: number | null
          rastreador_id: string | null
          rota_id: string | null
          status: Database["public"]["Enums"]["status_instalacao"]
          uf: string | null
          updated_at: string
          veiculo_id: string
        }
        Insert: {
          assinatura_cliente_url?: string | null
          associado_id: string
          bairro?: string | null
          cep?: string | null
          checklist_data?: Json | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          created_at?: string
          data_agendada: string
          hora_agendada?: string | null
          id?: string
          iniciada_em?: string | null
          instalador_id?: string | null
          lead_id?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
          quilometragem?: number | null
          rastreador_id?: string | null
          rota_id?: string | null
          status?: Database["public"]["Enums"]["status_instalacao"]
          uf?: string | null
          updated_at?: string
          veiculo_id: string
        }
        Update: {
          assinatura_cliente_url?: string | null
          associado_id?: string
          bairro?: string | null
          cep?: string | null
          checklist_data?: Json | null
          cidade?: string | null
          complemento?: string | null
          concluida_em?: string | null
          created_at?: string
          data_agendada?: string
          hora_agendada?: string | null
          id?: string
          iniciada_em?: string | null
          instalador_id?: string | null
          lead_id?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
          quilometragem?: number | null
          rastreador_id?: string | null
          rota_id?: string | null
          status?: Database["public"]["Enums"]["status_instalacao"]
          uf?: string | null
          updated_at?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "instalacoes_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "instalacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "instalacoes_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "instalacoes_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      lancamentos_contabeis: {
        Row: {
          complemento: string | null
          created_at: string | null
          criado_por: string | null
          data_competencia: string
          data_lancamento: string
          documento_numero: string | null
          documento_tipo: string | null
          estornado_em: string | null
          estornado_por: string | null
          historico: string
          id: string
          lancamento_estorno_id: string | null
          lote_id: string | null
          motivo_estorno: string | null
          numero: string | null
          origem: string
          origem_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          complemento?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_competencia: string
          data_lancamento: string
          documento_numero?: string | null
          documento_tipo?: string | null
          estornado_em?: string | null
          estornado_por?: string | null
          historico: string
          id?: string
          lancamento_estorno_id?: string | null
          lote_id?: string | null
          motivo_estorno?: string | null
          numero?: string | null
          origem: string
          origem_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          complemento?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_competencia?: string
          data_lancamento?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          estornado_em?: string | null
          estornado_por?: string | null
          historico?: string
          id?: string
          lancamento_estorno_id?: string | null
          lote_id?: string | null
          motivo_estorno?: string | null
          numero?: string | null
          origem?: string
          origem_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estornado_por_fkey"
            columns: ["estornado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_lancamento_estorno_id_fkey"
            columns: ["lancamento_estorno_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_partidas: {
        Row: {
          conta_id: string
          created_at: string | null
          id: string
          lancamento_id: string
          ordem: number | null
          tipo: string
          valor: number
        }
        Insert: {
          conta_id: string
          created_at?: string | null
          id?: string
          lancamento_id: string
          ordem?: number | null
          tipo: string
          valor: number
        }
        Update: {
          conta_id?: string
          created_at?: string | null
          id?: string
          lancamento_id?: string
          ordem?: number | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_partidas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_partidas_lancamento_id_fkey"
            columns: ["lancamento_id"]
            isOneToOne: false
            referencedRelation: "lancamentos_contabeis"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_pages: {
        Row: {
          campanha_id: string | null
          conversoes: number | null
          created_at: string | null
          criado_por: string | null
          id: string
          nome: string
          slug: string
          status: string | null
          taxa_conversao: number | null
          updated_at: string | null
          url: string | null
          url_preview: string | null
          visitas: number | null
        }
        Insert: {
          campanha_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome: string
          slug: string
          status?: string | null
          taxa_conversao?: number | null
          updated_at?: string | null
          url?: string | null
          url_preview?: string | null
          visitas?: number | null
        }
        Update: {
          campanha_id?: string | null
          conversoes?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
          slug?: string
          status?: string | null
          taxa_conversao?: number | null
          updated_at?: string | null
          url?: string | null
          url_preview?: string | null
          visitas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "landing_pages_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_fontes: {
        Row: {
          ativa: boolean | null
          codigo: string
          created_at: string | null
          descricao: string | null
          etapa_inicial: Database["public"]["Enums"]["etapa_lead"] | null
          id: string
          nome: string
          total_leads: number | null
          updated_at: string | null
          vendedor_padrao_id: string | null
        }
        Insert: {
          ativa?: boolean | null
          codigo: string
          created_at?: string | null
          descricao?: string | null
          etapa_inicial?: Database["public"]["Enums"]["etapa_lead"] | null
          id?: string
          nome: string
          total_leads?: number | null
          updated_at?: string | null
          vendedor_padrao_id?: string | null
        }
        Update: {
          ativa?: boolean | null
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          etapa_inicial?: Database["public"]["Enums"]["etapa_lead"] | null
          id?: string
          nome?: string
          total_leads?: number | null
          updated_at?: string | null
          vendedor_padrao_id?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          associado_id: string | null
          ativo: boolean
          campanha_id: string | null
          codigo_fipe: string | null
          contrato_assinado_em: string | null
          contrato_enviado_em: string | null
          contrato_id: string | null
          contrato_status: string | null
          cotacao_id: string | null
          cpf: string | null
          created_at: string
          data_conversao: string | null
          data_perda: string | null
          data_primeiro_contato: string | null
          data_proxima_acao: string | null
          data_ultimo_contato: string | null
          email: string | null
          etapa: Database["public"]["Enums"]["etapa_lead"]
          fonte_id: string | null
          id: string
          indicador_id: string | null
          motivo_perda: string | null
          nome: string
          observacao_perda: string | null
          observacoes: string | null
          origem: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id: string | null
          plano_escolhido_nome: string | null
          plano_escolhido_valor: number | null
          planos_interesse: string[] | null
          proposta_assinada_em: string | null
          proposta_enviada_em: string | null
          telefone: string
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          veiculo_ano: number | null
          veiculo_fipe: number | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
        }
        Insert: {
          associado_id?: string | null
          ativo?: boolean
          campanha_id?: string | null
          codigo_fipe?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          contrato_id?: string | null
          contrato_status?: string | null
          cotacao_id?: string | null
          cpf?: string | null
          created_at?: string
          data_conversao?: string | null
          data_perda?: string | null
          data_primeiro_contato?: string | null
          data_proxima_acao?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          indicador_id?: string | null
          motivo_perda?: string | null
          nome: string
          observacao_perda?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id?: string | null
          plano_escolhido_nome?: string | null
          plano_escolhido_valor?: number | null
          planos_interesse?: string[] | null
          proposta_assinada_em?: string | null
          proposta_enviada_em?: string | null
          telefone: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          veiculo_ano?: number | null
          veiculo_fipe?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Update: {
          associado_id?: string | null
          ativo?: boolean
          campanha_id?: string | null
          codigo_fipe?: string | null
          contrato_assinado_em?: string | null
          contrato_enviado_em?: string | null
          contrato_id?: string | null
          contrato_status?: string | null
          cotacao_id?: string | null
          cpf?: string | null
          created_at?: string
          data_conversao?: string | null
          data_perda?: string | null
          data_primeiro_contato?: string | null
          data_proxima_acao?: string | null
          data_ultimo_contato?: string | null
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          indicador_id?: string | null
          motivo_perda?: string | null
          nome?: string
          observacao_perda?: string | null
          observacoes?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"]
          plano_escolhido_id?: string | null
          plano_escolhido_nome?: string | null
          plano_escolhido_valor?: number | null
          planos_interesse?: string[] | null
          proposta_assinada_em?: string | null
          proposta_enviada_em?: string | null
          telefone?: string
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          veiculo_ano?: number | null
          veiculo_fipe?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_cotacao_id_fkey"
            columns: ["cotacao_id"]
            isOneToOne: false
            referencedRelation: "cotacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "lead_fontes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_plano_escolhido_id_fkey"
            columns: ["plano_escolhido_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_historico: {
        Row: {
          acao: string
          created_at: string | null
          dados_extras: Json | null
          descricao: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          lead_id: string
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_extras?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_extras?: Json | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id?: string
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_historico_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      leads_interesse_planos: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          plano_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          plano_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_interesse_planos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_interesse_planos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "leads_interesse_planos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      logs_auditoria: {
        Row: {
          acao: string
          created_at: string | null
          dados_anteriores: Json | null
          dados_novos: Json | null
          descricao: string | null
          id: string
          ip_address: string | null
          modulo: string | null
          registro_id: string | null
          tabela: string | null
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          descricao?: string | null
          id?: string
          ip_address?: string | null
          modulo?: string | null
          registro_id?: string | null
          tabela?: string | null
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logs_auditoria_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      materiais_marketing: {
        Row: {
          altura: number | null
          arquivo_url: string | null
          campanha_id: string | null
          created_at: string | null
          criado_por: string | null
          downloads: number | null
          formato: string | null
          id: string
          largura: number | null
          nome: string
          status: string | null
          thumbnail_url: string | null
          tipo: string
        }
        Insert: {
          altura?: number | null
          arquivo_url?: string | null
          campanha_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          downloads?: number | null
          formato?: string | null
          id?: string
          largura?: number | null
          nome: string
          status?: string | null
          thumbnail_url?: string | null
          tipo: string
        }
        Update: {
          altura?: number | null
          arquivo_url?: string | null
          campanha_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          downloads?: number | null
          formato?: string | null
          id?: string
          largura?: number | null
          nome?: string
          status?: string | null
          thumbnail_url?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "materiais_marketing_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materiais_marketing_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_vendas: {
        Row: {
          ano: number
          created_at: string | null
          id: string
          mes: number
          meta_contratos: number | null
          meta_cotacoes: number | null
          meta_leads: number | null
          meta_valor: number | null
          realizado_contratos: number | null
          realizado_cotacoes: number | null
          realizado_leads: number | null
          realizado_valor: number | null
          updated_at: string | null
          vendedor_id: string
        }
        Insert: {
          ano: number
          created_at?: string | null
          id?: string
          mes: number
          meta_contratos?: number | null
          meta_cotacoes?: number | null
          meta_leads?: number | null
          meta_valor?: number | null
          realizado_contratos?: number | null
          realizado_cotacoes?: number | null
          realizado_leads?: number | null
          realizado_valor?: number | null
          updated_at?: string | null
          vendedor_id: string
        }
        Update: {
          ano?: number
          created_at?: string | null
          id?: string
          mes?: number
          meta_contratos?: number | null
          meta_cotacoes?: number | null
          meta_leads?: number | null
          meta_valor?: number | null
          realizado_contratos?: number | null
          realizado_cotacoes?: number | null
          realizado_leads?: number | null
          realizado_valor?: number | null
          updated_at?: string | null
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "metas_vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_bancarias: {
        Row: {
          categoria: string | null
          cobranca_id: string | null
          conciliado: boolean | null
          conciliado_em: string | null
          conciliado_por: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          data_lancamento: string
          data_origem: string | null
          descricao: string
          documento: string | null
          documento_pagador: string | null
          extrato_id: string | null
          hash_lancamento: string | null
          id: string
          nome_pagador: string | null
          observacao_conciliacao: string | null
          origem_pagamento: string | null
          saldo_apos: number | null
          subcategoria: string | null
          tipo: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          categoria?: string | null
          cobranca_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_lancamento: string
          data_origem?: string | null
          descricao: string
          documento?: string | null
          documento_pagador?: string | null
          extrato_id?: string | null
          hash_lancamento?: string | null
          id?: string
          nome_pagador?: string | null
          observacao_conciliacao?: string | null
          origem_pagamento?: string | null
          saldo_apos?: number | null
          subcategoria?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          categoria?: string | null
          cobranca_id?: string | null
          conciliado?: boolean | null
          conciliado_em?: string | null
          conciliado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          data_origem?: string | null
          descricao?: string
          documento?: string | null
          documento_pagador?: string | null
          extrato_id?: string | null
          hash_lancamento?: string | null
          id?: string
          nome_pagador?: string | null
          observacao_conciliacao?: string | null
          origem_pagamento?: string | null
          saldo_apos?: number | null
          subcategoria?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_bancarias_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conciliado_por_fkey"
            columns: ["conciliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_bancarias_extrato_id_fkey"
            columns: ["extrato_id"]
            isOneToOne: false
            referencedRelation: "extratos_bancarios"
            referencedColumns: ["id"]
          },
        ]
      }
      movimentacoes_financeiras: {
        Row: {
          categoria: string
          created_at: string | null
          data_competencia: string | null
          data_movimentacao: string
          descricao: string
          id: string
          observacao: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          registrado_por: string | null
          tipo: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          data_competencia?: string | null
          data_movimentacao: string
          descricao: string
          id?: string
          observacao?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_por?: string | null
          tipo: string
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          data_competencia?: string | null
          data_movimentacao?: string
          descricao?: string
          id?: string
          observacao?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          registrado_por?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_financeiras_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      negativacoes: {
        Row: {
          acordo_id: string | null
          associado_id: string
          baixado_por: string | null
          cobranca_id: string | null
          created_at: string | null
          data_baixa: string | null
          data_divida: string
          data_envio: string | null
          data_negativacao: string | null
          enviado_por: string | null
          id: string
          motivo_baixa: string | null
          orgao: string
          protocolo_baixa: string | null
          protocolo_envio: string | null
          status: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          acordo_id?: string | null
          associado_id: string
          baixado_por?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          data_baixa?: string | null
          data_divida: string
          data_envio?: string | null
          data_negativacao?: string | null
          enviado_por?: string | null
          id?: string
          motivo_baixa?: string | null
          orgao: string
          protocolo_baixa?: string | null
          protocolo_envio?: string | null
          status?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          acordo_id?: string | null
          associado_id?: string
          baixado_por?: string | null
          cobranca_id?: string | null
          created_at?: string | null
          data_baixa?: string | null
          data_divida?: string
          data_envio?: string | null
          data_negativacao?: string | null
          enviado_por?: string | null
          id?: string
          motivo_baixa?: string | null
          orgao?: string
          protocolo_baixa?: string | null
          protocolo_envio?: string | null
          status?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "negativacoes_acordo_id_fkey"
            columns: ["acordo_id"]
            isOneToOne: false
            referencedRelation: "acordos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "negativacoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          canal_email: boolean | null
          canal_push: boolean | null
          canal_sistema: boolean | null
          canal_whatsapp: boolean | null
          categoria: string | null
          created_at: string
          data_expiracao: string | null
          destino: string | null
          destino_id: string | null
          icone: string | null
          id: string
          lida: boolean
          lida_em: string | null
          link: string | null
          mensagem: string
          modulo: string | null
          prioridade: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          categoria?: string | null
          created_at?: string
          data_expiracao?: string | null
          destino?: string | null
          destino_id?: string | null
          icone?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem: string
          modulo?: string | null
          prioridade?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          canal_email?: boolean | null
          canal_push?: boolean | null
          canal_sistema?: boolean | null
          canal_whatsapp?: boolean | null
          categoria?: string | null
          created_at?: string
          data_expiracao?: string | null
          destino?: string | null
          destino_id?: string | null
          icone?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem?: string
          modulo?: string | null
          prioridade?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      notificacoes_lidas: {
        Row: {
          id: string
          lida_em: string | null
          notificacao_id: string
          usuario_id: string
        }
        Insert: {
          id?: string
          lida_em?: string | null
          notificacao_id: string
          usuario_id: string
        }
        Update: {
          id?: string
          lida_em?: string | null
          notificacao_id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_lidas_notificacao_id_fkey"
            columns: ["notificacao_id"]
            isOneToOne: false
            referencedRelation: "notificacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_lidas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_preferencias: {
        Row: {
          created_at: string | null
          email_alertas_criticos: boolean | null
          email_ativo: boolean | null
          email_resumo_diario: boolean | null
          horario_resumo: string | null
          id: string
          notif_comunicados: boolean | null
          notif_financeiro: boolean | null
          notif_veiculo: boolean | null
          onboarding_completo: boolean | null
          push_ativo: boolean | null
          som_notificacao: boolean | null
          tipo_usuario: string
          updated_at: string | null
          usuario_id: string
          whatsapp_ativo: boolean | null
          whatsapp_horario_fim: string | null
          whatsapp_horario_inicio: string | null
        }
        Insert: {
          created_at?: string | null
          email_alertas_criticos?: boolean | null
          email_ativo?: boolean | null
          email_resumo_diario?: boolean | null
          horario_resumo?: string | null
          id?: string
          notif_comunicados?: boolean | null
          notif_financeiro?: boolean | null
          notif_veiculo?: boolean | null
          onboarding_completo?: boolean | null
          push_ativo?: boolean | null
          som_notificacao?: boolean | null
          tipo_usuario?: string
          updated_at?: string | null
          usuario_id: string
          whatsapp_ativo?: boolean | null
          whatsapp_horario_fim?: string | null
          whatsapp_horario_inicio?: string | null
        }
        Update: {
          created_at?: string | null
          email_alertas_criticos?: boolean | null
          email_ativo?: boolean | null
          email_resumo_diario?: boolean | null
          horario_resumo?: string | null
          id?: string
          notif_comunicados?: boolean | null
          notif_financeiro?: boolean | null
          notif_veiculo?: boolean | null
          onboarding_completo?: boolean | null
          push_ativo?: boolean | null
          som_notificacao?: boolean | null
          tipo_usuario?: string
          updated_at?: string | null
          usuario_id?: string
          whatsapp_ativo?: boolean | null
          whatsapp_horario_fim?: string | null
          whatsapp_horario_inicio?: string | null
        }
        Relationships: []
      }
      notificacoes_sistema: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          criado_por: string | null
          destino: string
          destino_id: string | null
          destino_role: Database["public"]["Enums"]["app_role"] | null
          expira_em: string | null
          id: string
          link: string | null
          mensagem: string
          tipo: string | null
          titulo: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          destino: string
          destino_id?: string | null
          destino_role?: Database["public"]["Enums"]["app_role"] | null
          expira_em?: string | null
          id?: string
          link?: string | null
          mensagem: string
          tipo?: string | null
          titulo: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          criado_por?: string | null
          destino?: string
          destino_id?: string | null
          destino_role?: Database["public"]["Enums"]["app_role"] | null
          expira_em?: string | null
          id?: string
          link?: string | null
          mensagem?: string
          tipo?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_sistema_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes_vendas: {
        Row: {
          created_at: string | null
          dados_extras: Json | null
          id: string
          lead_id: string | null
          lida: boolean | null
          lida_em: string | null
          mensagem: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          lead_id?: string | null
          lida?: boolean | null
          lida_em?: string | null
          mensagem?: string | null
          tipo: string
          titulo: string
          usuario_id: string
        }
        Update: {
          created_at?: string | null
          dados_extras?: Json | null
          id?: string
          lead_id?: string | null
          lida?: boolean | null
          lida_em?: string | null
          mensagem?: string | null
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "notificacoes_vendas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      oficinas: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string
          cnpj: string
          complemento: string | null
          conta: string | null
          created_at: string | null
          email: string | null
          especialidades: string[] | null
          estado: string
          id: string
          inscricao_estadual: string | null
          logradouro: string | null
          nome_fantasia: string | null
          nota_media: number | null
          numero: string | null
          pix_chave: string | null
          pix_tipo: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social: string
          status: Database["public"]["Enums"]["status_oficina"] | null
          telefone: string | null
          total_avaliacoes: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade: string
          cnpj: string
          complemento?: string | null
          conta?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado: string
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social: string
          status?: Database["public"]["Enums"]["status_oficina"] | null
          telefone?: string | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string
          cnpj?: string
          complemento?: string | null
          conta?: string | null
          created_at?: string | null
          email?: string | null
          especialidades?: string[] | null
          estado?: string
          id?: string
          inscricao_estadual?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: Database["public"]["Enums"]["tipo_pix"] | null
          razao_social?: string
          status?: Database["public"]["Enums"]["status_oficina"] | null
          telefone?: string | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      oficinas_pagamentos: {
        Row: {
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          forma_pagamento:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id: string
          observacao: string | null
          oficina_id: string
          ordem_servico_id: string | null
          pago_por: string | null
          status: Database["public"]["Enums"]["status_pagamento_oficina"] | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id?: string
          observacao?: string | null
          oficina_id: string
          ordem_servico_id?: string | null
          pago_por?: string | null
          status?:
            | Database["public"]["Enums"]["status_pagamento_oficina"]
            | null
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento_oficina"]
            | null
          id?: string
          observacao?: string | null
          oficina_id?: string
          ordem_servico_id?: string | null
          pago_por?: string | null
          status?:
            | Database["public"]["Enums"]["status_pagamento_oficina"]
            | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "oficinas_pagamentos_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oficinas_pagamentos_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          aprovado_por: string | null
          associado_id: string
          created_at: string | null
          criado_por: string | null
          data_conclusao: string | null
          data_entrada: string | null
          data_previsao: string | null
          id: string
          numero: string
          observacoes: string | null
          observacoes_internas: string | null
          oficina_id: string
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_ordem_servico"] | null
          updated_at: string | null
          valor_aprovado: number | null
          valor_orcamento: number | null
          valor_pago: number | null
          veiculo_id: string
        }
        Insert: {
          aprovado_por?: string | null
          associado_id: string
          created_at?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_entrada?: string | null
          data_previsao?: string | null
          id?: string
          numero: string
          observacoes?: string | null
          observacoes_internas?: string | null
          oficina_id: string
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_ordem_servico"] | null
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          veiculo_id: string
        }
        Update: {
          aprovado_por?: string | null
          associado_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_conclusao?: string | null
          data_entrada?: string | null
          data_previsao?: string | null
          id?: string
          numero?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          oficina_id?: string
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_ordem_servico"] | null
          updated_at?: string | null
          valor_aprovado?: number | null
          valor_orcamento?: number | null
          valor_pago?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ordens_servico_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "ordens_servico_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      ordens_servico_fotos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          descricao: string | null
          id: string
          ordem_servico_id: string
          tipo: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem_servico_id: string
          tipo: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          ordem_servico_id?: string
          tipo?: Database["public"]["Enums"]["tipo_foto_os"]
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_fotos_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_historico: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          ordem_servico_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          ordem_servico_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          ordem_servico_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_historico_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_servico_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_servico_itens: {
        Row: {
          aprovado: boolean | null
          created_at: string | null
          descricao: string
          id: string
          marca: string | null
          numero_peca: string | null
          ordem_servico_id: string
          quantidade: number | null
          tipo: Database["public"]["Enums"]["tipo_item_os"]
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          aprovado?: boolean | null
          created_at?: string | null
          descricao: string
          id?: string
          marca?: string | null
          numero_peca?: string | null
          ordem_servico_id: string
          quantidade?: number | null
          tipo: Database["public"]["Enums"]["tipo_item_os"]
          valor_total: number
          valor_unitario: number
        }
        Update: {
          aprovado?: boolean | null
          created_at?: string | null
          descricao?: string
          id?: string
          marca?: string | null
          numero_peca?: string | null
          ordem_servico_id?: string
          quantidade?: number | null
          tipo?: Database["public"]["Enums"]["tipo_item_os"]
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_itens_ordem_servico_id_fkey"
            columns: ["ordem_servico_id"]
            isOneToOne: false
            referencedRelation: "ordens_servico"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_anexos: {
        Row: {
          created_at: string | null
          id: string
          manifestacao_id: string
          nome_arquivo: string
          tamanho_bytes: number | null
          tipo_arquivo: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          manifestacao_id: string
          nome_arquivo: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          manifestacao_id?: string
          nome_arquivo?: string
          tamanho_bytes?: number | null
          tipo_arquivo?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_anexos_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_config: {
        Row: {
          chave: string
          descricao: string | null
          id: string
          updated_at: string | null
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          id?: string
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      ouvidoria_ia_logs: {
        Row: {
          confianca: number | null
          created_at: string | null
          departamento_sugerido: string | null
          entrada: string | null
          id: string
          manifestacao_id: string
          palavras_chave_detectadas: string[] | null
          prioridade_sugerida: string | null
          saida: string | null
          sentimento: string | null
          tempo_resposta_ms: number | null
          tipo_acao: string
          tokens_entrada: number | null
          tokens_saida: number | null
        }
        Insert: {
          confianca?: number | null
          created_at?: string | null
          departamento_sugerido?: string | null
          entrada?: string | null
          id?: string
          manifestacao_id: string
          palavras_chave_detectadas?: string[] | null
          prioridade_sugerida?: string | null
          saida?: string | null
          sentimento?: string | null
          tempo_resposta_ms?: number | null
          tipo_acao: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Update: {
          confianca?: number | null
          created_at?: string | null
          departamento_sugerido?: string | null
          entrada?: string | null
          id?: string
          manifestacao_id?: string
          palavras_chave_detectadas?: string[] | null
          prioridade_sugerida?: string | null
          saida?: string | null
          sentimento?: string | null
          tempo_resposta_ms?: number | null
          tipo_acao?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_ia_logs_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_interacoes: {
        Row: {
          anexo_url: string | null
          created_at: string | null
          id: string
          manifestacao_id: string
          mensagem: string
          tipo: string
          usuario_id: string | null
          visivel_associado: boolean | null
        }
        Insert: {
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          manifestacao_id: string
          mensagem: string
          tipo: string
          usuario_id?: string | null
          visivel_associado?: boolean | null
        }
        Update: {
          anexo_url?: string | null
          created_at?: string | null
          id?: string
          manifestacao_id?: string
          mensagem?: string
          tipo?: string
          usuario_id?: string | null
          visivel_associado?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_interacoes_manifestacao_id_fkey"
            columns: ["manifestacao_id"]
            isOneToOne: false
            referencedRelation: "ouvidoria_manifestacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_interacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ouvidoria_manifestacoes: {
        Row: {
          anonimo: boolean | null
          associado_id: string | null
          assunto: string
          avaliacao_comentario: string | null
          avaliacao_nota: number | null
          canal: string
          categoria: string | null
          created_at: string | null
          data_encerramento: string | null
          data_limite: string | null
          data_primeira_resposta: string | null
          departamento: string | null
          descricao: string
          id: string
          prioridade: string | null
          protocolo: string
          responsavel_id: string | null
          status: string | null
          tipo: string
          updated_at: string | null
          vinculo_juridico_id: string | null
        }
        Insert: {
          anonimo?: boolean | null
          associado_id?: string | null
          assunto: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal: string
          categoria?: string | null
          created_at?: string | null
          data_encerramento?: string | null
          data_limite?: string | null
          data_primeira_resposta?: string | null
          departamento?: string | null
          descricao: string
          id?: string
          prioridade?: string | null
          protocolo: string
          responsavel_id?: string | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          vinculo_juridico_id?: string | null
        }
        Update: {
          anonimo?: boolean | null
          associado_id?: string | null
          assunto?: string
          avaliacao_comentario?: string | null
          avaliacao_nota?: number | null
          canal?: string
          categoria?: string | null
          created_at?: string | null
          data_encerramento?: string | null
          data_limite?: string | null
          data_primeira_resposta?: string | null
          departamento?: string | null
          descricao?: string
          id?: string
          prioridade?: string | null
          protocolo?: string
          responsavel_id?: string | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          vinculo_juridico_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ouvidoria_manifestacoes_vinculo_juridico_id_fkey"
            columns: ["vinculo_juridico_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      plano_contas: {
        Row: {
          aceita_lancamento: boolean | null
          ativa: boolean | null
          codigo: string
          conta_padrao_para: string | null
          conta_pai_id: string | null
          created_at: string | null
          descricao: string
          id: string
          natureza: string
          nivel: number
          ordem: number | null
          sintetica: boolean | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          aceita_lancamento?: boolean | null
          ativa?: boolean | null
          codigo: string
          conta_padrao_para?: string | null
          conta_pai_id?: string | null
          created_at?: string | null
          descricao: string
          id?: string
          natureza: string
          nivel: number
          ordem?: number | null
          sintetica?: boolean | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          aceita_lancamento?: boolean | null
          ativa?: boolean | null
          codigo?: string
          conta_padrao_para?: string | null
          conta_pai_id?: string | null
          created_at?: string | null
          descricao?: string
          id?: string
          natureza?: string
          nivel?: number
          ordem?: number | null
          sintetica?: boolean | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plano_contas_conta_pai_id_fkey"
            columns: ["conta_pai_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          adicional_mensal: number | null
          ano_fabricacao_maximo: number | null
          ano_fabricacao_minimo: number | null
          ano_minimo_veiculo: number | null
          ativo: boolean
          categoria: string | null
          cobertura_fipe: number | null
          coberturas: string[] | null
          codigo: string
          cota_desagio: number | null
          cota_minima: number | null
          cota_minima_desagio: number | null
          cota_participacao: number | null
          created_at: string
          descricao: string | null
          destaque: boolean | null
          fipe_maxima: number | null
          fipe_minima: number | null
          id: string
          linha: string | null
          nivel: string | null
          nome: string
          ordem: number | null
          ordem_exibicao: number | null
          tipo_uso: string
          tipo_veiculo: string | null
          updated_at: string
          uso: string | null
          valor_adesao: number
        }
        Insert: {
          adicional_mensal?: number | null
          ano_fabricacao_maximo?: number | null
          ano_fabricacao_minimo?: number | null
          ano_minimo_veiculo?: number | null
          ativo?: boolean
          categoria?: string | null
          cobertura_fipe?: number | null
          coberturas?: string[] | null
          codigo: string
          cota_desagio?: number | null
          cota_minima?: number | null
          cota_minima_desagio?: number | null
          cota_participacao?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          id?: string
          linha?: string | null
          nivel?: string | null
          nome: string
          ordem?: number | null
          ordem_exibicao?: number | null
          tipo_uso?: string
          tipo_veiculo?: string | null
          updated_at?: string
          uso?: string | null
          valor_adesao: number
        }
        Update: {
          adicional_mensal?: number | null
          ano_fabricacao_maximo?: number | null
          ano_fabricacao_minimo?: number | null
          ano_minimo_veiculo?: number | null
          ativo?: boolean
          categoria?: string | null
          cobertura_fipe?: number | null
          coberturas?: string[] | null
          codigo?: string
          cota_desagio?: number | null
          cota_minima?: number | null
          cota_minima_desagio?: number | null
          cota_participacao?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          id?: string
          linha?: string | null
          nivel?: string | null
          nome?: string
          ordem?: number | null
          ordem_exibicao?: number | null
          tipo_uso?: string
          tipo_veiculo?: string | null
          updated_at?: string
          uso?: string | null
          valor_adesao?: number
        }
        Relationships: []
      }
      planos_beneficios: {
        Row: {
          beneficio: string
          created_at: string | null
          descricao: string | null
          id: string
          incluso: boolean | null
          observacao: string | null
          ordem: number | null
          plano_id: string
        }
        Insert: {
          beneficio: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          incluso?: boolean | null
          observacao?: string | null
          ordem?: number | null
          plano_id: string
        }
        Update: {
          beneficio?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          incluso?: boolean | null
          observacao?: string | null
          ordem?: number | null
          plano_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_beneficios_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_coberturas: {
        Row: {
          carencia_dias: number | null
          cobertura_id: string
          created_at: string | null
          franquia_percentual: number | null
          franquia_valor: number | null
          id: string
          obrigatoria: boolean | null
          percentual_cobertura: number | null
          plano_id: string
          valor_limite: number | null
        }
        Insert: {
          carencia_dias?: number | null
          cobertura_id: string
          created_at?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          obrigatoria?: boolean | null
          percentual_cobertura?: number | null
          plano_id: string
          valor_limite?: number | null
        }
        Update: {
          carencia_dias?: number | null
          cobertura_id?: string
          created_at?: string | null
          franquia_percentual?: number | null
          franquia_valor?: number | null
          id?: string
          obrigatoria?: boolean | null
          percentual_cobertura?: number | null
          plano_id?: string
          valor_limite?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_coberturas_cobertura_id_fkey"
            columns: ["cobertura_id"]
            isOneToOne: false
            referencedRelation: "coberturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planos_coberturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_restricoes: {
        Row: {
          categoria_veiculo: string
          cobertura_removida: string | null
          created_at: string | null
          id: string
          mensagem_alerta: string | null
          plano_id: string
          tipo_restricao: string
        }
        Insert: {
          categoria_veiculo: string
          cobertura_removida?: string | null
          created_at?: string | null
          id?: string
          mensagem_alerta?: string | null
          plano_id: string
          tipo_restricao: string
        }
        Update: {
          categoria_veiculo?: string
          cobertura_removida?: string | null
          created_at?: string | null
          id?: string
          mensagem_alerta?: string | null
          plano_id?: string
          tipo_restricao?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_restricoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      ponto_registros: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          data: string
          documento_url: string | null
          entrada_1: string | null
          entrada_2: string | null
          entrada_3: string | null
          funcionario_id: string
          horas_extras: unknown
          horas_faltantes: unknown
          horas_trabalhadas: unknown
          id: string
          justificativa: string | null
          saida_1: string | null
          saida_2: string | null
          saida_3: string | null
          status: string | null
          tipo_dia: string | null
          updated_at: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data: string
          documento_url?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          funcionario_id: string
          horas_extras?: unknown
          horas_faltantes?: unknown
          horas_trabalhadas?: unknown
          id?: string
          justificativa?: string | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          data?: string
          documento_url?: string | null
          entrada_1?: string | null
          entrada_2?: string | null
          entrada_3?: string | null
          funcionario_id?: string
          horas_extras?: unknown
          horas_faltantes?: unknown
          horas_trabalhadas?: unknown
          id?: string
          justificativa?: string | null
          saida_1?: string | null
          saida_2?: string | null
          saida_3?: string | null
          status?: string | null
          tipo_dia?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ponto_registros_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ponto_registros_funcionario_id_fkey"
            columns: ["funcionario_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
        ]
      }
      prestadores_assistencia: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cep: string | null
          cidade: string
          cidades_atendidas: string[] | null
          cnpj: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          disponivel: boolean | null
          email: string | null
          estado: string
          id: string
          logradouro: string | null
          nome_fantasia: string | null
          nota_media: number | null
          numero: string | null
          pix_chave: string | null
          pix_tipo: string | null
          raio_atendimento_km: number | null
          razao_social: string
          status: string | null
          telefone: string
          tipo_pessoa: string | null
          tipos_servico: string[] | null
          total_atendimentos: number | null
          total_avaliacoes: number | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade: string
          cidades_atendidas?: string[] | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          disponivel?: boolean | null
          email?: string | null
          estado: string
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          raio_atendimento_km?: number | null
          razao_social: string
          status?: string | null
          telefone: string
          tipo_pessoa?: string | null
          tipos_servico?: string[] | null
          total_atendimentos?: number | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cep?: string | null
          cidade?: string
          cidades_atendidas?: string[] | null
          cnpj?: string | null
          conta?: string | null
          cpf?: string | null
          created_at?: string | null
          disponivel?: boolean | null
          email?: string | null
          estado?: string
          id?: string
          logradouro?: string | null
          nome_fantasia?: string | null
          nota_media?: number | null
          numero?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          raio_atendimento_km?: number | null
          razao_social?: string
          status?: string | null
          telefone?: string
          tipo_pessoa?: string | null
          tipos_servico?: string[] | null
          total_atendimentos?: number | null
          total_avaliacoes?: number | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      processos: {
        Row: {
          advogado_id: string | null
          associado_id: string | null
          comarca: string | null
          created_at: string | null
          criado_por: string | null
          data_audiencia: string | null
          data_citacao: string | null
          data_distribuicao: string | null
          data_encerramento: string | null
          data_sentenca: string | null
          data_transito_julgado: string | null
          fase: string | null
          id: string
          natureza: string
          numero: string | null
          numero_processo: string | null
          objeto: string
          observacoes: string | null
          parte_contraria_advogado: string | null
          parte_contraria_cpf_cnpj: string | null
          parte_contraria_nome: string
          parte_contraria_oab: string | null
          responsavel_id: string | null
          rito: string | null
          sinistro_id: string | null
          status: string | null
          tipo: string
          tribunal: string | null
          updated_at: string | null
          valor_acordo: number | null
          valor_causa: number | null
          valor_condenacao: number | null
          vara: string | null
        }
        Insert: {
          advogado_id?: string | null
          associado_id?: string | null
          comarca?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_audiencia?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_sentenca?: string | null
          data_transito_julgado?: string | null
          fase?: string | null
          id?: string
          natureza: string
          numero?: string | null
          numero_processo?: string | null
          objeto: string
          observacoes?: string | null
          parte_contraria_advogado?: string | null
          parte_contraria_cpf_cnpj?: string | null
          parte_contraria_nome: string
          parte_contraria_oab?: string | null
          responsavel_id?: string | null
          rito?: string | null
          sinistro_id?: string | null
          status?: string | null
          tipo: string
          tribunal?: string | null
          updated_at?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Update: {
          advogado_id?: string | null
          associado_id?: string | null
          comarca?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_audiencia?: string | null
          data_citacao?: string | null
          data_distribuicao?: string | null
          data_encerramento?: string | null
          data_sentenca?: string | null
          data_transito_julgado?: string | null
          fase?: string | null
          id?: string
          natureza?: string
          numero?: string | null
          numero_processo?: string | null
          objeto?: string
          observacoes?: string | null
          parte_contraria_advogado?: string | null
          parte_contraria_cpf_cnpj?: string | null
          parte_contraria_nome?: string
          parte_contraria_oab?: string | null
          responsavel_id?: string | null
          rito?: string | null
          sinistro_id?: string | null
          status?: string | null
          tipo?: string
          tribunal?: string | null
          updated_at?: string | null
          valor_acordo?: number | null
          valor_causa?: number | null
          valor_condenacao?: number | null
          vara?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_advogado_id_fkey"
            columns: ["advogado_id"]
            isOneToOne: false
            referencedRelation: "advogados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "processos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_andamentos: {
        Row: {
          created_at: string | null
          data: string
          descricao: string
          gera_prazo: boolean | null
          id: string
          prazo_cumprido: boolean | null
          prazo_cumprido_em: string | null
          prazo_data: string | null
          prazo_descricao: string | null
          prazo_dias: number | null
          processo_id: string
          registrado_por: string | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao: string
          gera_prazo?: boolean | null
          id?: string
          prazo_cumprido?: boolean | null
          prazo_cumprido_em?: string | null
          prazo_data?: string | null
          prazo_descricao?: string | null
          prazo_dias?: number | null
          processo_id: string
          registrado_por?: string | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string
          gera_prazo?: boolean | null
          id?: string
          prazo_cumprido?: boolean | null
          prazo_cumprido_em?: string | null
          prazo_data?: string | null
          prazo_descricao?: string | null
          prazo_dias?: number | null
          processo_id?: string
          registrado_por?: string | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_andamentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_andamentos_registrado_por_fkey"
            columns: ["registrado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_audiencias: {
        Row: {
          advogado_presente: boolean | null
          created_at: string | null
          data_hora: string
          id: string
          link_videoconferencia: string | null
          local: string | null
          observacoes: string | null
          parte_presente: boolean | null
          pauta: string | null
          processo_id: string
          resultado: string | null
          status: string | null
          testemunhas: string | null
          tipo: string
          updated_at: string | null
        }
        Insert: {
          advogado_presente?: boolean | null
          created_at?: string | null
          data_hora: string
          id?: string
          link_videoconferencia?: string | null
          local?: string | null
          observacoes?: string | null
          parte_presente?: boolean | null
          pauta?: string | null
          processo_id: string
          resultado?: string | null
          status?: string | null
          testemunhas?: string | null
          tipo: string
          updated_at?: string | null
        }
        Update: {
          advogado_presente?: boolean | null
          created_at?: string | null
          data_hora?: string
          id?: string
          link_videoconferencia?: string | null
          local?: string | null
          observacoes?: string | null
          parte_presente?: boolean | null
          pauta?: string | null
          processo_id?: string
          resultado?: string | null
          status?: string | null
          testemunhas?: string | null
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_audiencias_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_custas: {
        Row: {
          comprovante_url: string | null
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string
          id: string
          pago_por: string | null
          processo_id: string
          status: string | null
          tipo: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao: string
          id?: string
          pago_por?: string | null
          processo_id: string
          status?: string | null
          tipo: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string
          id?: string
          pago_por?: string | null
          processo_id?: string
          status?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "processos_custas_pago_por_fkey"
            columns: ["pago_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_custas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_documentos: {
        Row: {
          andamento_id: string | null
          arquivo_tamanho: number | null
          arquivo_url: string | null
          created_at: string | null
          descricao: string | null
          enviado_por: string | null
          id: string
          nome: string
          processo_id: string
          tipo: string
        }
        Insert: {
          andamento_id?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          nome: string
          processo_id: string
          tipo: string
        }
        Update: {
          andamento_id?: string | null
          arquivo_tamanho?: number | null
          arquivo_url?: string | null
          created_at?: string | null
          descricao?: string | null
          enviado_por?: string | null
          id?: string
          nome?: string
          processo_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "processos_documentos_andamento_id_fkey"
            columns: ["andamento_id"]
            isOneToOne: false
            referencedRelation: "processos_andamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos_prazos: {
        Row: {
          alerta_enviado_1d: boolean | null
          alerta_enviado_3d: boolean | null
          alerta_enviado_hoje: boolean | null
          andamento_id: string | null
          created_at: string | null
          cumprido_em: string | null
          cumprido_por: string | null
          data_fim: string
          data_inicio: string
          descricao: string
          dias_uteis: boolean | null
          id: string
          observacao_cumprimento: string | null
          prioridade: string | null
          processo_id: string
          responsavel_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          alerta_enviado_1d?: boolean | null
          alerta_enviado_3d?: boolean | null
          alerta_enviado_hoje?: boolean | null
          andamento_id?: string | null
          created_at?: string | null
          cumprido_em?: string | null
          cumprido_por?: string | null
          data_fim: string
          data_inicio: string
          descricao: string
          dias_uteis?: boolean | null
          id?: string
          observacao_cumprimento?: string | null
          prioridade?: string | null
          processo_id: string
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          alerta_enviado_1d?: boolean | null
          alerta_enviado_3d?: boolean | null
          alerta_enviado_hoje?: boolean | null
          andamento_id?: string | null
          created_at?: string | null
          cumprido_em?: string | null
          cumprido_por?: string | null
          data_fim?: string
          data_inicio?: string
          descricao?: string
          dias_uteis?: boolean | null
          id?: string
          observacao_cumprimento?: string | null
          prioridade?: string | null
          processo_id?: string
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_prazos_andamento_id_fkey"
            columns: ["andamento_id"]
            isOneToOne: false
            referencedRelation: "processos_andamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_cumprido_por_fkey"
            columns: ["cumprido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          bloqueado: boolean | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_ultimo_acesso: string | null
          email: string
          id: string
          motivo_bloqueio: string | null
          nome: string
          notif_documentos_pendentes: boolean | null
          notif_novos_leads: boolean | null
          notif_resumo_diario: boolean | null
          primeiro_acesso: boolean
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          bloqueado?: boolean | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_ultimo_acesso?: string | null
          email: string
          id?: string
          motivo_bloqueio?: string | null
          nome: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          primeiro_acesso?: boolean
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          bloqueado?: boolean | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_ultimo_acesso?: string | null
          email?: string
          id?: string
          motivo_bloqueio?: string | null
          nome?: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          primeiro_acesso?: boolean
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      programa_indicacao: {
        Row: {
          ativo: boolean | null
          condicao_pagamento: string | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          limite_indicacoes_mes: number | null
          nome: string
          prazo_validade_dias: number | null
          tipo_recompensa: string | null
          updated_at: string | null
          valor_indicado: number | null
          valor_indicador: number
        }
        Insert: {
          ativo?: boolean | null
          condicao_pagamento?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          limite_indicacoes_mes?: number | null
          nome: string
          prazo_validade_dias?: number | null
          tipo_recompensa?: string | null
          updated_at?: string | null
          valor_indicado?: number | null
          valor_indicador: number
        }
        Update: {
          ativo?: boolean | null
          condicao_pagamento?: string | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          limite_indicacoes_mes?: number | null
          nome?: string
          prazo_validade_dias?: number | null
          tipo_recompensa?: string | null
          updated_at?: string | null
          valor_indicado?: number | null
          valor_indicador?: number
        }
        Relationships: []
      }
      rastreador_alertas: {
        Row: {
          created_at: string | null
          dados: Json | null
          id: string
          mensagem: string
          observacao_tratamento: string | null
          rastreador_id: string
          severidade: string
          status: string | null
          tipo: string
          tratado_em: string | null
          tratado_por: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dados?: Json | null
          id?: string
          mensagem: string
          observacao_tratamento?: string | null
          rastreador_id: string
          severidade: string
          status?: string | null
          tipo: string
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dados?: Json | null
          id?: string
          mensagem?: string
          observacao_tratamento?: string | null
          rastreador_id?: string
          severidade?: string
          status?: string | null
          tipo?: string
          tratado_em?: string | null
          tratado_por?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
          {
            foreignKeyName: "rastreador_alertas_tratado_por_fkey"
            columns: ["tratado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreador_posicoes: {
        Row: {
          altitude: number | null
          bateria_nivel: number | null
          created_at: string | null
          data_posicao: string
          direcao: number | null
          endereco: string | null
          id: string
          ignicao: boolean | null
          latitude: number
          longitude: number
          odometro: number | null
          rastreador_id: string
          sinal_gsm: number | null
          velocidade: number | null
        }
        Insert: {
          altitude?: number | null
          bateria_nivel?: number | null
          created_at?: string | null
          data_posicao: string
          direcao?: number | null
          endereco?: string | null
          id?: string
          ignicao?: boolean | null
          latitude: number
          longitude: number
          odometro?: number | null
          rastreador_id: string
          sinal_gsm?: number | null
          velocidade?: number | null
        }
        Update: {
          altitude?: number | null
          bateria_nivel?: number | null
          created_at?: string | null
          data_posicao?: string
          direcao?: number | null
          endereco?: string | null
          id?: string
          ignicao?: boolean | null
          latitude?: number
          longitude?: number
          odometro?: number | null
          rastreador_id?: string
          sinal_gsm?: number | null
          velocidade?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_posicoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_posicoes_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      rastreadores: {
        Row: {
          bloqueado: boolean | null
          chip_iccid: string | null
          codigo: string
          config_plataforma: Json | null
          created_at: string
          dados_extras: Json | null
          id: string
          id_plataforma: string | null
          imei: string | null
          numero_serie: string | null
          plataforma: string
          plataforma_device_id: string | null
          plataforma_user_id: string | null
          status: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao: string | null
          ultima_ignicao: boolean | null
          ultima_posicao_lat: number | null
          ultima_posicao_lng: number | null
          ultima_velocidade: number | null
          updated_at: string
          veiculo_id: string | null
        }
        Insert: {
          bloqueado?: boolean | null
          chip_iccid?: string | null
          codigo: string
          config_plataforma?: Json | null
          created_at?: string
          dados_extras?: Json | null
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          numero_serie?: string | null
          plataforma?: string
          plataforma_device_id?: string | null
          plataforma_user_id?: string | null
          status?: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao?: string | null
          ultima_ignicao?: boolean | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          ultima_velocidade?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Update: {
          bloqueado?: boolean | null
          chip_iccid?: string | null
          codigo?: string
          config_plataforma?: Json | null
          created_at?: string
          dados_extras?: Json | null
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          numero_serie?: string | null
          plataforma?: string
          plataforma_device_id?: string | null
          plataforma_user_id?: string | null
          status?: Database["public"]["Enums"]["status_rastreador"]
          ultima_comunicacao?: string | null
          ultima_ignicao?: boolean | null
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
          ultima_velocidade?: number | null
          updated_at?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "rastreadores_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      rastreadores_config_plataformas: {
        Row: {
          ambiente_atual: string | null
          api_url_producao: string
          api_url_sandbox: string
          ativa: boolean | null
          auth_type: string
          config: Json | null
          created_at: string | null
          id: string
          nome_exibicao: string
          plataforma: string
          suporta_acionamento_roubo: boolean | null
          suporta_bloqueio: boolean | null
          suporta_historico_trajeto: boolean | null
          suporta_posicao_tempo_real: boolean | null
          suporta_redefinir_senha: boolean | null
          suporta_webhooks: boolean | null
          updated_at: string | null
        }
        Insert: {
          ambiente_atual?: string | null
          api_url_producao: string
          api_url_sandbox: string
          ativa?: boolean | null
          auth_type: string
          config?: Json | null
          created_at?: string | null
          id?: string
          nome_exibicao: string
          plataforma: string
          suporta_acionamento_roubo?: boolean | null
          suporta_bloqueio?: boolean | null
          suporta_historico_trajeto?: boolean | null
          suporta_posicao_tempo_real?: boolean | null
          suporta_redefinir_senha?: boolean | null
          suporta_webhooks?: boolean | null
          updated_at?: string | null
        }
        Update: {
          ambiente_atual?: string | null
          api_url_producao?: string
          api_url_sandbox?: string
          ativa?: boolean | null
          auth_type?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          nome_exibicao?: string
          plataforma?: string
          suporta_acionamento_roubo?: boolean | null
          suporta_bloqueio?: boolean | null
          suporta_historico_trajeto?: boolean | null
          suporta_posicao_tempo_real?: boolean | null
          suporta_redefinir_senha?: boolean | null
          suporta_webhooks?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rastreadores_credenciais: {
        Row: {
          bearer_token: string | null
          configurado: boolean | null
          created_at: string | null
          id: string
          password_hash: string | null
          plataforma_id: string
          public_key: string | null
          testado_em: string | null
          teste_mensagem: string | null
          teste_sucesso: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          bearer_token?: string | null
          configurado?: boolean | null
          created_at?: string | null
          id?: string
          password_hash?: string | null
          plataforma_id: string
          public_key?: string | null
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          bearer_token?: string | null
          configurado?: boolean | null
          created_at?: string | null
          id?: string
          password_hash?: string | null
          plataforma_id?: string
          public_key?: string | null
          testado_em?: string | null
          teste_mensagem?: string | null
          teste_sucesso?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_credenciais_plataforma_id_fkey"
            columns: ["plataforma_id"]
            isOneToOne: true
            referencedRelation: "rastreadores_config_plataformas"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreadores_logs: {
        Row: {
          created_at: string | null
          erro_mensagem: string | null
          id: string
          operacao: string
          plataforma: string
          rastreador_id: string | null
          request: Json | null
          response: Json | null
          status: string | null
          tempo_resposta_ms: number | null
        }
        Insert: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          operacao: string
          plataforma: string
          rastreador_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
        }
        Update: {
          created_at?: string | null
          erro_mensagem?: string | null
          id?: string
          operacao?: string
          plataforma?: string
          rastreador_id?: string | null
          request?: Json | null
          response?: Json | null
          status?: string | null
          tempo_resposta_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreadores_logs_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreadores_logs_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      rastreadores_tokens_cache: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          plataforma: string
          refresh_token: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          plataforma: string
          refresh_token?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          plataforma?: string
          refresh_token?: string | null
          token?: string
        }
        Relationships: []
      }
      rateios: {
        Row: {
          ano: number
          aplicado_em: string | null
          aprovado_em: string | null
          aprovado_por: string | null
          codigo: string | null
          created_at: string | null
          formula_utilizada: string | null
          id: string
          mes: number
          observacoes: string | null
          percentual_fundo_reserva: number | null
          status: string | null
          total_associados: number | null
          total_sinistros: number | null
          updated_at: string | null
          valor_fundo_reserva: number | null
          valor_rateio_por_associado: number | null
          valor_total_sinistros: number | null
        }
        Insert: {
          ano: number
          aplicado_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo?: string | null
          created_at?: string | null
          formula_utilizada?: string | null
          id?: string
          mes: number
          observacoes?: string | null
          percentual_fundo_reserva?: number | null
          status?: string | null
          total_associados?: number | null
          total_sinistros?: number | null
          updated_at?: string | null
          valor_fundo_reserva?: number | null
          valor_rateio_por_associado?: number | null
          valor_total_sinistros?: number | null
        }
        Update: {
          ano?: number
          aplicado_em?: string | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo?: string | null
          created_at?: string | null
          formula_utilizada?: string | null
          id?: string
          mes?: number
          observacoes?: string | null
          percentual_fundo_reserva?: number | null
          status?: string | null
          total_associados?: number | null
          total_sinistros?: number | null
          updated_at?: string | null
          valor_fundo_reserva?: number | null
          valor_rateio_por_associado?: number | null
          valor_total_sinistros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateios_aprovado_por_fkey"
            columns: ["aprovado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rateios_detalhes: {
        Row: {
          created_at: string | null
          id: string
          plano_id: string
          rateio_id: string
          total_associados: number | null
          total_sinistros: number | null
          valor_rateio: number | null
          valor_sinistros: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plano_id: string
          rateio_id: string
          total_associados?: number | null
          total_sinistros?: number | null
          valor_rateio?: number | null
          valor_sinistros?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plano_id?: string
          rateio_id?: string
          total_associados?: number | null
          total_sinistros?: number | null
          valor_rateio?: number | null
          valor_sinistros?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rateios_detalhes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rateios_detalhes_rateio_id_fkey"
            columns: ["rateio_id"]
            isOneToOne: false
            referencedRelation: "rateios"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_categorizacao: {
        Row: {
          ativo: boolean | null
          categoria: string
          created_at: string | null
          id: string
          origem_pagamento: string | null
          padrao_texto: string
          prioridade: number | null
          subcategoria: string | null
          tipo_match: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          created_at?: string | null
          id?: string
          origem_pagamento?: string | null
          padrao_texto: string
          prioridade?: number | null
          subcategoria?: string | null
          tipo_match?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          created_at?: string | null
          id?: string
          origem_pagamento?: string | null
          padrao_texto?: string
          prioridade?: number | null
          subcategoria?: string | null
          tipo_match?: string | null
        }
        Relationships: []
      }
      regua_execucoes: {
        Row: {
          acao: string
          associado_id: string
          cobranca_id: string
          created_at: string | null
          erro: string | null
          etapa_dias: number
          executado_em: string | null
          id: string
          regua_id: string
          resultado: string | null
          status: string | null
          template: string | null
        }
        Insert: {
          acao: string
          associado_id: string
          cobranca_id: string
          created_at?: string | null
          erro?: string | null
          etapa_dias: number
          executado_em?: string | null
          id?: string
          regua_id: string
          resultado?: string | null
          status?: string | null
          template?: string | null
        }
        Update: {
          acao?: string
          associado_id?: string
          cobranca_id?: string
          created_at?: string | null
          erro?: string | null
          etapa_dias?: number
          executado_em?: string | null
          id?: string
          regua_id?: string
          resultado?: string | null
          status?: string | null
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "regua_execucoes_cobranca_id_fkey"
            columns: ["cobranca_id"]
            isOneToOne: false
            referencedRelation: "cobrancas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regua_execucoes_regua_id_fkey"
            columns: ["regua_id"]
            isOneToOne: false
            referencedRelation: "reguas_cobranca"
            referencedColumns: ["id"]
          },
        ]
      }
      reguas_cobranca: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          etapas: Json
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          etapas?: Json
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          etapas?: Json
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rotas: {
        Row: {
          cidade: string | null
          codigo: string
          coordenador_id: string | null
          created_at: string
          data_rota: string
          id: string
          instalador_id: string | null
          regiao: string | null
          status: Database["public"]["Enums"]["status_rota"]
          total_concluidos: number
          total_servicos: number
          updated_at: string
        }
        Insert: {
          cidade?: string | null
          codigo: string
          coordenador_id?: string | null
          created_at?: string
          data_rota: string
          id?: string
          instalador_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_rota"]
          total_concluidos?: number
          total_servicos?: number
          updated_at?: string
        }
        Update: {
          cidade?: string | null
          codigo?: string
          coordenador_id?: string | null
          created_at?: string
          data_rota?: string
          id?: string
          instalador_id?: string | null
          regiao?: string | null
          status?: Database["public"]["Enums"]["status_rota"]
          total_concluidos?: number
          total_servicos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_coordenador_id_fkey"
            columns: ["coordenador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rotas_instalador_id_fkey"
            columns: ["instalador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saldos_contas: {
        Row: {
          ano: number
          conta_id: string
          created_at: string | null
          id: string
          mes: number
          saldo_anterior: number | null
          saldo_atual: number | null
          total_creditos: number | null
          total_debitos: number | null
          updated_at: string | null
        }
        Insert: {
          ano: number
          conta_id: string
          created_at?: string | null
          id?: string
          mes: number
          saldo_anterior?: number | null
          saldo_atual?: number | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Update: {
          ano?: number
          conta_id?: string
          created_at?: string | null
          id?: string
          mes?: number
          saldo_anterior?: number | null
          saldo_atual?: number | null
          total_creditos?: number | null
          total_debitos?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saldos_contas_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "plano_contas"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_documentos: {
        Row: {
          arquivo_url: string
          created_at: string | null
          id: string
          motivo_reprovacao: string | null
          nome_arquivo: string | null
          sinistro_id: string
          status: string | null
          tipo: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string | null
          sinistro_id: string
          status?: string | null
          tipo: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string | null
          id?: string
          motivo_reprovacao?: string | null
          nome_arquivo?: string | null
          sinistro_id?: string
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_documentos_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistro_historico: {
        Row: {
          created_at: string | null
          id: string
          observacao: string | null
          sinistro_id: string
          status_anterior: string | null
          status_novo: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          sinistro_id: string
          status_anterior?: string | null
          status_novo: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          observacao?: string | null
          sinistro_id?: string
          status_anterior?: string | null
          status_novo?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sinistro_historico_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistro_historico_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      sinistros: {
        Row: {
          analista_id: string | null
          associado_id: string
          bo_arquivo_url: string | null
          bo_numero: string | null
          canal: string
          cidade_ocorrencia: string | null
          created_at: string
          data_ocorrencia: string
          data_parecer: string | null
          descricao: string | null
          estado_ocorrencia: string | null
          id: string
          local_descricao: string | null
          local_ocorrencia: string | null
          parecer: string | null
          protocolo: string
          status: Database["public"]["Enums"]["status_sinistro"]
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at: string
          valor_fipe: number | null
          valor_indenizacao: number | null
          valor_pago: number | null
          veiculo_id: string
        }
        Insert: {
          analista_id?: string | null
          associado_id: string
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          canal?: string
          cidade_ocorrencia?: string | null
          created_at?: string
          data_ocorrencia: string
          data_parecer?: string | null
          descricao?: string | null
          estado_ocorrencia?: string | null
          id?: string
          local_descricao?: string | null
          local_ocorrencia?: string | null
          parecer?: string | null
          protocolo: string
          status?: Database["public"]["Enums"]["status_sinistro"]
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at?: string
          valor_fipe?: number | null
          valor_indenizacao?: number | null
          valor_pago?: number | null
          veiculo_id: string
        }
        Update: {
          analista_id?: string | null
          associado_id?: string
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          canal?: string
          cidade_ocorrencia?: string | null
          created_at?: string
          data_ocorrencia?: string
          data_parecer?: string | null
          descricao?: string | null
          estado_ocorrencia?: string | null
          id?: string
          local_descricao?: string | null
          local_ocorrencia?: string | null
          parecer?: string | null
          protocolo?: string
          status?: Database["public"]["Enums"]["status_sinistro"]
          tipo?: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at?: string
          valor_fipe?: number | null
          valor_indenizacao?: number | null
          valor_pago?: number | null
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
        ]
      }
      solicitacoes_permissao: {
        Row: {
          aprovado_em: string | null
          aprovador_id: string | null
          created_at: string | null
          dados: Json | null
          expira_em: string | null
          id: string
          motivo: string | null
          motivo_rejeicao: string | null
          perfil_alvo: string | null
          solicitante_id: string
          status: string | null
          tipo: string
          usuario_alvo_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          created_at?: string | null
          dados?: Json | null
          expira_em?: string | null
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          perfil_alvo?: string | null
          solicitante_id: string
          status?: string | null
          tipo: string
          usuario_alvo_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovador_id?: string | null
          created_at?: string | null
          dados?: Json | null
          expira_em?: string | null
          id?: string
          motivo?: string | null
          motivo_rejeicao?: string | null
          perfil_alvo?: string | null
          solicitante_id?: string
          status?: string | null
          tipo?: string
          usuario_alvo_id?: string | null
        }
        Relationships: []
      }
      tabela_precos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          faixa_valor_max: number
          faixa_valor_min: number
          id: string
          plano_id: string
          updated_at: string | null
          valor_adesao: number | null
          valor_mensalidade: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          faixa_valor_max: number
          faixa_valor_min: number
          id?: string
          plano_id: string
          updated_at?: string | null
          valor_adesao?: number | null
          valor_mensalidade: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          faixa_valor_max?: number
          faixa_valor_min?: number
          id?: string
          plano_id?: string
          updated_at?: string | null
          valor_adesao?: number | null
          valor_mensalidade?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabela_precos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco: {
        Row: {
          ativo: boolean
          created_at: string
          fipe_ate: number
          fipe_de: number
          id: string
          nome: string | null
          plano_id: string
          regiao: string | null
          taxa_administrativa: number
          taxa_aplicativo: number | null
          taxa_comercial: number | null
          tipo_uso: string | null
          valor_adesao: number | null
          valor_assistencia: number | null
          valor_cota: number
          valor_rastreamento: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fipe_ate: number
          fipe_de: number
          id?: string
          nome?: string | null
          plano_id: string
          regiao?: string | null
          taxa_administrativa?: number
          taxa_aplicativo?: number | null
          taxa_comercial?: number | null
          tipo_uso?: string | null
          valor_adesao?: number | null
          valor_assistencia?: number | null
          valor_cota: number
          valor_rastreamento?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fipe_ate?: number
          fipe_de?: number
          id?: string
          nome?: string | null
          plano_id?: string
          regiao?: string | null
          taxa_administrativa?: number
          taxa_aplicativo?: number | null
          taxa_comercial?: number | null
          tipo_uso?: string | null
          valor_adesao?: number | null
          valor_assistencia?: number | null
          valor_cota?: number
          valor_rastreamento?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_preco_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco_adesao: {
        Row: {
          categoria: string
          created_at: string | null
          fipe_max: number
          fipe_min: number
          id: string
          is_active: boolean | null
          tipo_uso: string
          valor_adesao: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          fipe_max: number
          fipe_min: number
          id?: string
          is_active?: boolean | null
          tipo_uso: string
          valor_adesao: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          fipe_max?: number
          fipe_min?: number
          id?: string
          is_active?: boolean | null
          tipo_uso?: string
          valor_adesao?: number
        }
        Relationships: []
      }
      tabelas_preco_historico: {
        Row: {
          created_at: string | null
          fipe_ate: number
          fipe_de: number
          id: string
          tabela_preco_id: string
          valor_adesao: number | null
          valor_cota: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          created_at?: string | null
          fipe_ate: number
          fipe_de: number
          id?: string
          tabela_preco_id: string
          valor_adesao?: number | null
          valor_cota: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Update: {
          created_at?: string | null
          fipe_ate?: number
          fipe_de?: number
          id?: string
          tabela_preco_id?: string
          valor_adesao?: number | null
          valor_cota?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_preco_historico_tabela_preco_id_fkey"
            columns: ["tabela_preco_id"]
            isOneToOne: false
            referencedRelation: "tabelas_preco"
            referencedColumns: ["id"]
          },
        ]
      }
      tabelas_preco_mensalidade: {
        Row: {
          categoria: string
          created_at: string | null
          fipe_max: number
          fipe_min: number
          id: string
          is_active: boolean | null
          regiao: string | null
          tipo_uso: string
          valor_mensal: number
        }
        Insert: {
          categoria: string
          created_at?: string | null
          fipe_max: number
          fipe_min: number
          id?: string
          is_active?: boolean | null
          regiao?: string | null
          tipo_uso: string
          valor_mensal: number
        }
        Update: {
          categoria?: string
          created_at?: string | null
          fipe_max?: number
          fipe_min?: number
          id?: string
          is_active?: boolean | null
          regiao?: string | null
          tipo_uso?: string
          valor_mensal?: number
        }
        Relationships: []
      }
      treinamentos: {
        Row: {
          ativo: boolean | null
          carga_horaria: number | null
          created_at: string | null
          custo_por_pessoa: number | null
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          instituicao: string | null
          instrutor: string | null
          modalidade: string | null
          nome: string
          tipo: string | null
          vagas: number | null
        }
        Insert: {
          ativo?: boolean | null
          carga_horaria?: number | null
          created_at?: string | null
          custo_por_pessoa?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          modalidade?: string | null
          nome: string
          tipo?: string | null
          vagas?: number | null
        }
        Update: {
          ativo?: boolean | null
          carga_horaria?: number | null
          created_at?: string | null
          custo_por_pessoa?: number | null
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          instituicao?: string | null
          instrutor?: string | null
          modalidade?: string | null
          nome?: string
          tipo?: string | null
          vagas?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      utms: {
        Row: {
          ativo: boolean | null
          campanha_id: string | null
          cliques: number | null
          created_at: string | null
          criado_por: string | null
          id: string
          leads_gerados: number | null
          url_completa: string | null
          url_curta: string | null
          url_destino: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string
          utm_term: string | null
        }
        Insert: {
          ativo?: boolean | null
          campanha_id?: string | null
          cliques?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          leads_gerados?: number | null
          url_completa?: string | null
          url_curta?: string | null
          url_destino: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source: string
          utm_term?: string | null
        }
        Update: {
          ativo?: boolean | null
          campanha_id?: string | null
          cliques?: number | null
          created_at?: string | null
          criado_por?: string | null
          id?: string
          leads_gerados?: number | null
          url_completa?: string | null
          url_curta?: string | null
          url_destino?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "utms_campanha_id_fkey"
            columns: ["campanha_id"]
            isOneToOne: false
            referencedRelation: "campanhas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utms_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      veiculos: {
        Row: {
          ano_fabricacao: number
          ano_modelo: number
          associado_id: string
          ativo: boolean
          chassi: string | null
          codigo_fipe: string | null
          combustivel: string | null
          cor: string | null
          created_at: string
          id: string
          marca: string
          modelo: string
          placa: string
          plataforma_app: string | null
          renavam: string | null
          status: Database["public"]["Enums"]["status_veiculo"] | null
          updated_at: string
          uso_aplicativo: boolean | null
          valor_fipe: number | null
        }
        Insert: {
          ano_fabricacao: number
          ano_modelo: number
          associado_id: string
          ativo?: boolean
          chassi?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          marca: string
          modelo: string
          placa: string
          plataforma_app?: string | null
          renavam?: string | null
          status?: Database["public"]["Enums"]["status_veiculo"] | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          valor_fipe?: number | null
        }
        Update: {
          ano_fabricacao?: number
          ano_modelo?: number
          associado_id?: string
          ativo?: boolean
          chassi?: string | null
          codigo_fipe?: string | null
          combustivel?: string | null
          cor?: string | null
          created_at?: string
          id?: string
          marca?: string
          modelo?: string
          placa?: string
          plataforma_app?: string | null
          renavam?: string | null
          status?: Database["public"]["Enums"]["status_veiculo"] | null
          updated_at?: string
          uso_aplicativo?: boolean | null
          valor_fipe?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "veiculos_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      vistoria_fotos: {
        Row: {
          arquivo_url: string
          created_at: string
          id: string
          tipo: string
          vistoria_id: string
        }
        Insert: {
          arquivo_url: string
          created_at?: string
          id?: string
          tipo: string
          vistoria_id: string
        }
        Update: {
          arquivo_url?: string
          created_at?: string
          id?: string
          tipo?: string
          vistoria_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vistoria_fotos_vistoria_id_fkey"
            columns: ["vistoria_id"]
            isOneToOne: false
            referencedRelation: "vistorias"
            referencedColumns: ["id"]
          },
        ]
      }
      vistorias: {
        Row: {
          associado_id: string
          avarias: string | null
          contrato_id: string | null
          created_at: string
          data_agendada: string | null
          endereco_cidade: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          horario_agendado: string | null
          id: string
          instalacao_id: string | null
          km_atual: number | null
          modalidade: string | null
          observacoes: string | null
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_vistoria"]
          tipo: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at: string
          veiculo_id: string | null
          vistoriador_id: string | null
        }
        Insert: {
          associado_id: string
          avarias?: string | null
          contrato_id?: string | null
          created_at?: string
          data_agendada?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          horario_agendado?: string | null
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
          modalidade?: string | null
          observacoes?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id?: string | null
          vistoriador_id?: string | null
        }
        Update: {
          associado_id?: string
          avarias?: string | null
          contrato_id?: string | null
          created_at?: string
          data_agendada?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          horario_agendado?: string | null
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
          modalidade?: string | null
          observacoes?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id?: string | null
          vistoriador_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "vistorias_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["instalacao_id"]
          },
          {
            foreignKeyName: "vistorias_sinistro_id_fkey"
            columns: ["sinistro_id"]
            isOneToOne: false
            referencedRelation: "sinistros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["veiculo_id"]
          },
          {
            foreignKeyName: "vistorias_vistoriador_id_fkey"
            columns: ["vistoriador_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instancias: {
        Row: {
          api_url: string
          ativa: boolean | null
          created_at: string | null
          descricao: string | null
          foto_perfil: string | null
          id: string
          instance_name: string
          nome: string
          nome_perfil: string | null
          principal: boolean | null
          status: string | null
          telefone: string | null
          ultima_conexao: string | null
          updated_at: string | null
          webhook_enabled: boolean | null
          webhook_events: string[] | null
          webhook_url: string | null
        }
        Insert: {
          api_url: string
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          foto_perfil?: string | null
          id?: string
          instance_name: string
          nome: string
          nome_perfil?: string | null
          principal?: boolean | null
          status?: string | null
          telefone?: string | null
          ultima_conexao?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: string[] | null
          webhook_url?: string | null
        }
        Update: {
          api_url?: string
          ativa?: boolean | null
          created_at?: string | null
          descricao?: string | null
          foto_perfil?: string | null
          id?: string
          instance_name?: string
          nome?: string
          nome_perfil?: string | null
          principal?: boolean | null
          status?: string | null
          telefone?: string | null
          ultima_conexao?: string | null
          updated_at?: string | null
          webhook_enabled?: boolean | null
          webhook_events?: string[] | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_logs: {
        Row: {
          created_at: string | null
          erro: string | null
          evento: string | null
          id: string
          instancia_id: string | null
          payload: Json | null
          resposta: Json | null
          tipo: string
        }
        Insert: {
          created_at?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          instancia_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          tipo: string
        }
        Update: {
          created_at?: string | null
          erro?: string | null
          evento?: string | null
          id?: string
          instancia_id?: string | null
          payload?: Json | null
          resposta?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          direcao: string | null
          enviado_por: string | null
          erro_codigo: string | null
          erro_mensagem: string | null
          id: string
          instancia_id: string | null
          media_filename: string | null
          media_mimetype: string | null
          media_url: string | null
          mensagem: string | null
          message_id: string | null
          nome_contato: string | null
          read_at: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          sent_at: string | null
          status: string | null
          telefone: string
          template_id: string | null
          template_variaveis: Json | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          direcao?: string | null
          enviado_por?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          instancia_id?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          mensagem?: string | null
          message_id?: string | null
          nome_contato?: string | null
          read_at?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sent_at?: string | null
          status?: string | null
          telefone: string
          template_id?: string | null
          template_variaveis?: Json | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          direcao?: string | null
          enviado_por?: string | null
          erro_codigo?: string | null
          erro_mensagem?: string | null
          id?: string
          instancia_id?: string | null
          media_filename?: string | null
          media_mimetype?: string | null
          media_url?: string | null
          mensagem?: string | null
          message_id?: string | null
          nome_contato?: string | null
          read_at?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          sent_at?: string | null
          status?: string | null
          telefone?: string
          template_id?: string | null
          template_variaveis?: Json | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_mensagens_instancia_id_fkey"
            columns: ["instancia_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instancias"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          ativo: boolean | null
          categoria: string
          codigo: string
          created_at: string | null
          descricao: string | null
          id: string
          mensagem: string
          nome: string
          updated_at: string | null
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          categoria: string
          codigo: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          mensagem: string
          nome: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string
          codigo?: string
          created_at?: string | null
          descricao?: string | null
          id?: string
          mensagem?: string
          nome?: string
          updated_at?: string | null
          variaveis?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      view_acompanhamento: {
        Row: {
          associado_id: string | null
          associado_status:
            | Database["public"]["Enums"]["status_associado"]
            | null
          cpf: string | null
          docs_aprovados: number | null
          docs_total: number | null
          fase_acompanhamento: string | null
          instalacao_data: string | null
          instalacao_id: string | null
          instalacao_status:
            | Database["public"]["Enums"]["status_instalacao"]
            | null
          lead_id: string | null
          nome: string | null
          telefone: string | null
          updated_at: string | null
          veiculo_ano: number | null
          veiculo_id: string | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          veiculo_status: Database["public"]["Enums"]["status_veiculo"] | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Relationships: []
      }
      view_alertas_ativos: {
        Row: {
          associado_email: string | null
          associado_id: string | null
          associado_nome: string | null
          associado_telefone: string | null
          created_at: string | null
          dados: Json | null
          horas_aberto: number | null
          id: string | null
          marca: string | null
          mensagem: string | null
          modelo: string | null
          placa: string | null
          plataforma: string | null
          rastreador_codigo: string | null
          rastreador_id: string | null
          severidade: string | null
          status: string | null
          tipo: string | null
          ultima_comunicacao: string | null
          updated_at: string | null
          veiculo_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "rastreadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreador_alertas_rastreador_id_fkey"
            columns: ["rastreador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["rastreador_id"]
          },
        ]
      }
      view_aniversariantes_mes: {
        Row: {
          cargo_nome: string | null
          data_nascimento: string | null
          departamento_nome: string | null
          dia: number | null
          foto_url: string | null
          id: string | null
          nome_completo: string | null
        }
        Relationships: []
      }
      view_associado_financeiro: {
        Row: {
          associado_id: string | null
          associado_status:
            | Database["public"]["Enums"]["status_associado"]
            | null
          cobrancas_pagas: number | null
          cobrancas_pendentes: number | null
          cobrancas_vencidas: number | null
          cpf: string | null
          dias_maior_atraso: number | null
          nome: string | null
          proximo_vencimento: string | null
          total_cobrancas: number | null
          valor_pago: number | null
          valor_pendente: number | null
          valor_vencido: number | null
        }
        Relationships: []
      }
      view_dashboard_diretoria: {
        Row: {
          assistencias_mes: number | null
          associados_ativos: number | null
          associados_inadimplentes: number | null
          conversoes_mes: number | null
          despesas_mes: number | null
          instalacoes_mes: number | null
          leads_mes: number | null
          receita_mes: number | null
          sinistros_mes: number | null
          valor_sinistros_mes: number | null
        }
        Relationships: []
      }
      view_funcionarios_ativos: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          cargo_nivel: number | null
          cargo_nome: string | null
          celular: string | null
          cep: string | null
          certificado_reservista: string | null
          cidade: string | null
          cnh: string | null
          cnh_categoria: string | null
          cnh_validade: string | null
          complemento: string | null
          conta: string | null
          cpf: string | null
          created_at: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          ctps_uf: string | null
          data_admissao: string | null
          data_demissao: string | null
          data_nascimento: string | null
          departamento_id: string | null
          departamento_nome: string | null
          email_corporativo: string | null
          email_pessoal: string | null
          estado: string | null
          estado_civil: string | null
          foto_url: string | null
          gestor_id: string | null
          gestor_nome: string | null
          horario_entrada: string | null
          horario_saida: string | null
          id: string | null
          intervalo_minutos: number | null
          logradouro: string | null
          matricula: string | null
          motivo_demissao: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string | null
          numero: string | null
          pis: string | null
          pix_chave: string | null
          pix_tipo: string | null
          rg: string | null
          rg_orgao: string | null
          salario_atual: number | null
          secao_eleitoral: string | null
          sexo: string | null
          status: string | null
          telefone: string | null
          tipo_conta: string | null
          tipo_contrato: string | null
          titulo_eleitor: string | null
          updated_at: string | null
          usuario_id: string | null
          zona_eleitoral: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "funcionarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_aniversariantes_mes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "view_funcionarios_ativos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_inadimplentes: {
        Row: {
          associado_id: string | null
          contatos_ultimos_30_dias: number | null
          cpf: string | null
          dias_atraso_maximo: number | null
          email: string | null
          faixa_atraso: string | null
          nome: string | null
          qtd_boletos_vencidos: number | null
          status_associado:
            | Database["public"]["Enums"]["status_associado"]
            | null
          telefone: string | null
          ultimo_contato: string | null
          valor_total_divida: number | null
          vencimento_mais_antigo: string | null
          vencimento_mais_recente: string | null
          whatsapp: string | null
        }
        Relationships: []
      }
      view_indicacoes_pendentes: {
        Row: {
          associado_id: string | null
          codigo: string | null
          created_at: string | null
          data_contato: string | null
          data_conversao: string | null
          data_indicacao: string | null
          data_recompensa: string | null
          id: string | null
          indicado_email: string | null
          indicado_nome: string | null
          indicado_telefone: string | null
          indicador_id: string | null
          indicador_nome: string | null
          indicador_nome_completo: string | null
          indicador_telefone: string | null
          indicador_telefone_completo: string | null
          lead_id: string | null
          observacoes: string | null
          programa_id: string | null
          programa_nome: string | null
          recompensa_paga: boolean | null
          status: string | null
          updated_at: string | null
          valor_indicador: number | null
          valor_recompensa: number | null
        }
        Relationships: [
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_associado_id_fkey"
            columns: ["associado_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "associados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_alertas_ativos"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_associado_financeiro"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_inadimplentes"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_indicador_id_fkey"
            columns: ["indicador_id"]
            isOneToOne: false
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "indicacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "view_acompanhamento"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "indicacoes_programa_id_fkey"
            columns: ["programa_id"]
            isOneToOne: false
            referencedRelation: "programa_indicacao"
            referencedColumns: ["id"]
          },
        ]
      }
      view_movimentacoes_diarias: {
        Row: {
          conta_bancaria_id: string | null
          data_lancamento: string | null
          qtd_conciliados: number | null
          qtd_lancamentos: number | null
          saldo_dia: number | null
          total_creditos: number | null
          total_debitos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_bancarias_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      view_performance_canais: {
        Row: {
          conversoes: number | null
          cpl_medio: number | null
          id: string | null
          investimento_total: number | null
          nome: string | null
          taxa_conversao: number | null
          tipo: string | null
          total_leads: number | null
        }
        Relationships: []
      }
      view_prazos_proximos: {
        Row: {
          data_fim: string | null
          descricao: string | null
          id: string | null
          parte_contraria_nome: string | null
          prioridade: string | null
          processo_cnj: string | null
          processo_numero: string | null
          processo_tipo: string | null
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string | null
          urgencia: string | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_prazos_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      view_rastreadores_posicao: {
        Row: {
          ano_modelo: number | null
          associado_email: string | null
          associado_id: string | null
          associado_nome: string | null
          associado_telefone: string | null
          codigo: string | null
          cor: string | null
          horas_sem_comunicacao: number | null
          id_plataforma: string | null
          ignicao: boolean | null
          imei: string | null
          latitude: number | null
          longitude: number | null
          marca: string | null
          modelo: string | null
          numero_serie: string | null
          placa: string | null
          plataforma: string | null
          rastreador_id: string | null
          status: Database["public"]["Enums"]["status_rastreador"] | null
          status_comunicacao: string | null
          ultima_comunicacao: string | null
          veiculo_id: string | null
          velocidade: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      adicionar_fila_cobranca: {
        Args: {
          p_associado_id: string
          p_cobranca_id: string
          p_motivo: string
          p_prioridade?: number
        }
        Returns: string
      }
      am_i_associado: { Args: never; Returns: boolean }
      am_i_funcionario: { Args: never; Returns: boolean }
      am_i_gerencia: { Args: never; Returns: boolean }
      am_i_prestador: { Args: never; Returns: boolean }
      am_i_vendedor: { Args: never; Returns: boolean }
      atribuir_lead_automaticamente: {
        Args: { p_lead_id: string }
        Returns: string
      }
      atualizar_cobrancas_vencidas: { Args: never; Returns: number }
      atualizar_parcelas_vencidas: { Args: never; Returns: number }
      atualizar_valor_os: { Args: { os_id: string }; Returns: undefined }
      calcular_sinistralidade: {
        Args: { p_ano: number; p_mes: number }
        Returns: {
          frequencia: number
          sinistralidade: number
          ticket_medio: number
        }[]
      }
      can_access_api_settings: { Args: { _user_id: string }; Returns: boolean }
      can_manage_juridico: { Args: { _user_id: string }; Returns: boolean }
      can_manage_marketing: { Args: { _user_id: string }; Returns: boolean }
      can_manage_permissions: { Args: { _user_id: string }; Returns: boolean }
      gerar_hash_lancamento: {
        Args: {
          p_conta_id: string
          p_data: string
          p_descricao: string
          p_documento: string
          p_valor: number
        }
        Returns: string
      }
      get_alertas_contagem: {
        Args: never
        Returns: {
          abertos: number
          criticos: number
          total: number
          visualizados: number
        }[]
      }
      get_current_profile_id: { Args: never; Returns: string }
      get_estatisticas_assistencia_dia: {
        Args: { p_data?: string }
        Returns: Json
      }
      get_estatisticas_cobrancas_mes: {
        Args: { p_ano: number; p_mes: number }
        Returns: Json
      }
      get_estatisticas_prestador: {
        Args: { p_prestador_id: string }
        Returns: Json
      }
      get_my_associado_id: { Args: { _user_id: string }; Returns: string }
      get_my_perfis: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_my_profile_id: { Args: never; Returns: string }
      get_my_tipo: {
        Args: never
        Returns: Database["public"]["Enums"]["tipo_usuario"]
      }
      get_proximo_vendedor_distribuicao: { Args: never; Returns: string }
      get_ultimas_posicoes: {
        Args: never
        Returns: {
          associado_nome: string
          associado_telefone: string
          codigo: string
          data_posicao: string
          horas_sem_comunicacao: number
          ignicao: boolean
          latitude: number
          longitude: number
          placa: string
          rastreador_id: string
          status_comunicacao: string
          velocidade: number
        }[]
      }
      get_user_perfis: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      get_user_tipo: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["tipo_usuario"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_master: { Args: { _user_id: string }; Returns: boolean }
      is_associado: { Args: { _user_id: string }; Returns: boolean }
      is_desenvolvedor: { Args: { _user_id: string }; Returns: boolean }
      is_diretor: { Args: { _user_id: string }; Returns: boolean }
      is_funcionario: { Args: { _user_id: string }; Returns: boolean }
      is_gerencia: { Args: { _user_id: string }; Returns: boolean }
      is_prestador: { Args: { _user_id: string }; Returns: boolean }
      is_vendedor: { Args: { _user_id: string }; Returns: boolean }
      log_auth_event: {
        Args: {
          p_acao: string
          p_email?: string
          p_ip?: string
          p_metadata?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      processar_template: {
        Args: { p_template_id: string; p_variaveis: Json }
        Returns: string
      }
      resetar_contadores_distribuicao: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      verificar_acordos_quebrados: { Args: never; Returns: number }
    }
    Enums: {
      app_role:
        | "diretor"
        | "gerente_comercial"
        | "supervisor_vendas"
        | "vendedor_clt"
        | "vendedor_externo"
        | "analista_cadastro"
        | "coordenador_monitoramento"
        | "analista_plataforma"
        | "instalador_vistoriador"
        | "associado"
        | "analista_marketing"
        | "analista_juridico"
        | "desenvolvedor"
        | "admin_master"
        | "agencia"
      etapa_lead:
        | "novo"
        | "contato_inicial"
        | "apresentacao"
        | "cotacao_enviada"
        | "negociacao"
        | "vistoria_agendada"
        | "contrato_enviado"
        | "contrato_assinado"
        | "instalacao_agendada"
        | "ganho"
        | "perdido"
        | "contato"
        | "qualificado"
      forma_pagamento_oficina: "pix" | "transferencia" | "boleto" | "cheque"
      motivo_perda:
        | "preco"
        | "concorrencia"
        | "desistiu"
        | "nao_qualificado"
        | "veiculo_reprovado"
        | "nao_respondeu"
        | "outro"
      origem_lead:
        | "indicacao"
        | "site"
        | "facebook"
        | "instagram"
        | "google"
        | "telefone"
        | "presencial"
        | "parceiro"
        | "outro"
        | "api"
        | "whatsapp"
      periodo_instalacao: "manha" | "tarde" | "noite"
      status_associado:
        | "em_analise"
        | "aprovado"
        | "documentacao_pendente"
        | "aguardando_instalacao"
        | "ativo"
        | "inadimplente"
        | "suspenso"
        | "cancelado"
        | "bloqueado"
      status_chamado:
        | "aberto"
        | "em_atendimento"
        | "em_deslocamento"
        | "concluido"
        | "cancelado"
        | "aguardando_prestador"
        | "prestador_despachado"
        | "prestador_a_caminho"
        | "cancelado_associado"
        | "cancelado_sistema"
      status_contrato:
        | "rascunho"
        | "pendente"
        | "enviado"
        | "assinado"
        | "ativo"
        | "suspenso"
        | "cancelado"
        | "visualizado"
        | "expirado"
        | "pendente_assinatura"
      status_cotacao:
        | "rascunho"
        | "enviada"
        | "aceita"
        | "recusada"
        | "expirada"
      status_documento:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "expirado"
      status_instalacao:
        | "agendada"
        | "em_rota"
        | "em_andamento"
        | "concluida"
        | "reagendada"
        | "cancelada"
      status_oficina: "ativo" | "inativo" | "suspenso" | "bloqueado"
      status_ordem_servico:
        | "rascunho"
        | "aguardando_orcamento"
        | "orcamento_enviado"
        | "aguardando_aprovacao"
        | "aprovado"
        | "em_execucao"
        | "aguardando_peca"
        | "concluido"
        | "aguardando_pagamento"
        | "pago"
        | "cancelado"
      status_pagamento_oficina:
        | "pendente"
        | "processando"
        | "pago"
        | "cancelado"
      status_rastreador: "estoque" | "instalado" | "manutencao" | "baixado"
      status_rota: "pendente" | "em_andamento" | "concluida" | "cancelada"
      status_sinistro:
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "indenizado"
        | "cancelado"
        | "comunicado"
        | "documentacao_pendente"
        | "aguardando_vistoria"
        | "em_vistoria"
        | "aguardando_parecer"
        | "negado"
        | "em_regulacao"
        | "em_reparo"
        | "pago"
        | "encerrado"
      status_veiculo:
        | "em_analise"
        | "aprovado"
        | "instalacao_pendente"
        | "ativo"
        | "suspenso"
        | "cancelado"
        | "sinistrado"
      status_vistoria:
        | "pendente"
        | "aprovada"
        | "reprovada"
        | "em_analise"
        | "agendada"
      tipo_documento:
        | "cnh"
        | "crlv"
        | "comprovante_residencia"
        | "foto_frontal_veiculo"
        | "foto_traseira_veiculo"
        | "foto_lateral_esquerda"
        | "foto_lateral_direita"
        | "foto_painel"
        | "foto_hodometro"
        | "outro"
      tipo_foto_os: "entrada" | "execucao" | "conclusao"
      tipo_item_os: "peca" | "mao_de_obra" | "servico_terceiro"
      tipo_pix: "cpf" | "cnpj" | "email" | "telefone" | "aleatoria"
      tipo_sinistro:
        | "roubo"
        | "furto"
        | "colisao"
        | "incendio"
        | "alagamento"
        | "outro"
        | "fenomeno_natural"
        | "vidros"
        | "terceiros"
      tipo_usuario: "funcionario" | "associado" | "prestador"
      tipo_vistoria: "entrada" | "saida" | "sinistro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "diretor",
        "gerente_comercial",
        "supervisor_vendas",
        "vendedor_clt",
        "vendedor_externo",
        "analista_cadastro",
        "coordenador_monitoramento",
        "analista_plataforma",
        "instalador_vistoriador",
        "associado",
        "analista_marketing",
        "analista_juridico",
        "desenvolvedor",
        "admin_master",
        "agencia",
      ],
      etapa_lead: [
        "novo",
        "contato_inicial",
        "apresentacao",
        "cotacao_enviada",
        "negociacao",
        "vistoria_agendada",
        "contrato_enviado",
        "contrato_assinado",
        "instalacao_agendada",
        "ganho",
        "perdido",
        "contato",
        "qualificado",
      ],
      forma_pagamento_oficina: ["pix", "transferencia", "boleto", "cheque"],
      motivo_perda: [
        "preco",
        "concorrencia",
        "desistiu",
        "nao_qualificado",
        "veiculo_reprovado",
        "nao_respondeu",
        "outro",
      ],
      origem_lead: [
        "indicacao",
        "site",
        "facebook",
        "instagram",
        "google",
        "telefone",
        "presencial",
        "parceiro",
        "outro",
        "api",
        "whatsapp",
      ],
      periodo_instalacao: ["manha", "tarde", "noite"],
      status_associado: [
        "em_analise",
        "aprovado",
        "documentacao_pendente",
        "aguardando_instalacao",
        "ativo",
        "inadimplente",
        "suspenso",
        "cancelado",
        "bloqueado",
      ],
      status_chamado: [
        "aberto",
        "em_atendimento",
        "em_deslocamento",
        "concluido",
        "cancelado",
        "aguardando_prestador",
        "prestador_despachado",
        "prestador_a_caminho",
        "cancelado_associado",
        "cancelado_sistema",
      ],
      status_contrato: [
        "rascunho",
        "pendente",
        "enviado",
        "assinado",
        "ativo",
        "suspenso",
        "cancelado",
        "visualizado",
        "expirado",
        "pendente_assinatura",
      ],
      status_cotacao: ["rascunho", "enviada", "aceita", "recusada", "expirada"],
      status_documento: [
        "pendente",
        "em_analise",
        "aprovado",
        "reprovado",
        "expirado",
      ],
      status_instalacao: [
        "agendada",
        "em_rota",
        "em_andamento",
        "concluida",
        "reagendada",
        "cancelada",
      ],
      status_oficina: ["ativo", "inativo", "suspenso", "bloqueado"],
      status_ordem_servico: [
        "rascunho",
        "aguardando_orcamento",
        "orcamento_enviado",
        "aguardando_aprovacao",
        "aprovado",
        "em_execucao",
        "aguardando_peca",
        "concluido",
        "aguardando_pagamento",
        "pago",
        "cancelado",
      ],
      status_pagamento_oficina: [
        "pendente",
        "processando",
        "pago",
        "cancelado",
      ],
      status_rastreador: ["estoque", "instalado", "manutencao", "baixado"],
      status_rota: ["pendente", "em_andamento", "concluida", "cancelada"],
      status_sinistro: [
        "em_analise",
        "aprovado",
        "reprovado",
        "indenizado",
        "cancelado",
        "comunicado",
        "documentacao_pendente",
        "aguardando_vistoria",
        "em_vistoria",
        "aguardando_parecer",
        "negado",
        "em_regulacao",
        "em_reparo",
        "pago",
        "encerrado",
      ],
      status_veiculo: [
        "em_analise",
        "aprovado",
        "instalacao_pendente",
        "ativo",
        "suspenso",
        "cancelado",
        "sinistrado",
      ],
      status_vistoria: [
        "pendente",
        "aprovada",
        "reprovada",
        "em_analise",
        "agendada",
      ],
      tipo_documento: [
        "cnh",
        "crlv",
        "comprovante_residencia",
        "foto_frontal_veiculo",
        "foto_traseira_veiculo",
        "foto_lateral_esquerda",
        "foto_lateral_direita",
        "foto_painel",
        "foto_hodometro",
        "outro",
      ],
      tipo_foto_os: ["entrada", "execucao", "conclusao"],
      tipo_item_os: ["peca", "mao_de_obra", "servico_terceiro"],
      tipo_pix: ["cpf", "cnpj", "email", "telefone", "aleatoria"],
      tipo_sinistro: [
        "roubo",
        "furto",
        "colisao",
        "incendio",
        "alagamento",
        "outro",
        "fenomeno_natural",
        "vidros",
        "terceiros",
      ],
      tipo_usuario: ["funcionario", "associado", "prestador"],
      tipo_vistoria: ["entrada", "saida", "sinistro"],
    },
  },
} as const
