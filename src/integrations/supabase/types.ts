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
            foreignKeyName: "asaas_cobrancas_asaas_cliente_id_fkey"
            columns: ["asaas_cliente_id"]
            isOneToOne: false
            referencedRelation: "asaas_clientes"
            referencedColumns: ["id"]
          },
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
          associado_id: string | null
          autentique_documento_id: string | null
          autentique_url: string | null
          cotacao_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          dia_vencimento: number | null
          id: string
          lead_id: string | null
          numero: string
          plano_id: string
          status: Database["public"]["Enums"]["status_contrato"]
          updated_at: string
          valor_adesao: number
          valor_mensal: number
          vendedor_id: string | null
        }
        Insert: {
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_url?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dia_vencimento?: number | null
          id?: string
          lead_id?: string | null
          numero: string
          plano_id: string
          status?: Database["public"]["Enums"]["status_contrato"]
          updated_at?: string
          valor_adesao: number
          valor_mensal: number
          vendedor_id?: string | null
        }
        Update: {
          associado_id?: string | null
          autentique_documento_id?: string | null
          autentique_url?: string | null
          cotacao_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          dia_vencimento?: number | null
          id?: string
          lead_id?: string | null
          numero?: string
          plano_id?: string
          status?: Database["public"]["Enums"]["status_contrato"]
          updated_at?: string
          valor_adesao?: number
          valor_mensal?: number
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
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
        ]
      }
      cotacoes: {
        Row: {
          codigo_fipe: string | null
          created_at: string
          id: string
          lead_id: string | null
          numero: string
          plano_id: string
          status: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa: number
          updated_at: string
          validade_dias: number
          valor_adesao: number
          valor_assistencia: number | null
          valor_cota: number
          valor_fipe: number
          valor_rastreamento: number
          valor_total_mensal: number
          veiculo_ano: number | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          vendedor_id: string | null
        }
        Insert: {
          codigo_fipe?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          numero: string
          plano_id: string
          status?: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa?: number
          updated_at?: string
          validade_dias?: number
          valor_adesao: number
          valor_assistencia?: number | null
          valor_cota: number
          valor_fipe: number
          valor_rastreamento?: number
          valor_total_mensal: number
          veiculo_ano?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          vendedor_id?: string | null
        }
        Update: {
          codigo_fipe?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          numero?: string
          plano_id?: string
          status?: Database["public"]["Enums"]["status_cotacao"]
          taxa_administrativa?: number
          updated_at?: string
          validade_dias?: number
          valor_adesao?: number
          valor_assistencia?: number | null
          valor_cota?: number
          valor_fipe?: number
          valor_rastreamento?: number
          valor_total_mensal?: number
          veiculo_ano?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
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
        ]
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
          cidade: string | null
          complemento: string | null
          created_at: string
          data_agendada: string
          id: string
          instalador_id: string | null
          logradouro: string | null
          numero: string | null
          observacoes: string | null
          periodo: Database["public"]["Enums"]["periodo_instalacao"]
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
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_agendada: string
          id?: string
          instalador_id?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
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
          cidade?: string | null
          complemento?: string | null
          created_at?: string
          data_agendada?: string
          id?: string
          instalador_id?: string | null
          logradouro?: string | null
          numero?: string | null
          observacoes?: string | null
          periodo?: Database["public"]["Enums"]["periodo_instalacao"]
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
          codigo_fipe: string | null
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
          telefone: string
          updated_at: string
          veiculo_ano: number | null
          veiculo_fipe: number | null
          veiculo_marca: string | null
          veiculo_modelo: string | null
          veiculo_placa: string | null
          vendedor_id: string | null
        }
        Insert: {
          associado_id?: string | null
          codigo_fipe?: string | null
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
          telefone: string
          updated_at?: string
          veiculo_ano?: number | null
          veiculo_fipe?: number | null
          veiculo_marca?: string | null
          veiculo_modelo?: string | null
          veiculo_placa?: string | null
          vendedor_id?: string | null
        }
        Update: {
          associado_id?: string | null
          codigo_fipe?: string | null
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
          telefone?: string
          updated_at?: string
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
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
          },
          {
            foreignKeyName: "leads_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "lead_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      leads_historico: {
        Row: {
          acao: string
          created_at: string | null
          descricao: string | null
          etapa_anterior: string | null
          etapa_nova: string | null
          id: string
          lead_id: string
          usuario_id: string | null
        }
        Insert: {
          acao: string
          created_at?: string | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id: string
          usuario_id?: string | null
        }
        Update: {
          acao?: string
          created_at?: string | null
          descricao?: string | null
          etapa_anterior?: string | null
          etapa_nova?: string | null
          id?: string
          lead_id?: string
          usuario_id?: string | null
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
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
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
      planos: {
        Row: {
          ativo: boolean
          codigo: string
          created_at: string
          descricao: string | null
          fipe_maxima: number | null
          fipe_minima: number | null
          id: string
          nome: string
          tipo_uso: string
          updated_at: string
          valor_adesao: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          created_at?: string
          descricao?: string | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          id?: string
          nome: string
          tipo_uso?: string
          updated_at?: string
          valor_adesao: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          created_at?: string
          descricao?: string | null
          fipe_maxima?: number | null
          fipe_minima?: number | null
          id?: string
          nome?: string
          tipo_uso?: string
          updated_at?: string
          valor_adesao?: number
        }
        Relationships: []
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
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          nome: string
          notif_documentos_pendentes: boolean | null
          notif_novos_leads: boolean | null
          notif_resumo_diario: boolean | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_usuario"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email: string
          id?: string
          nome: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          cpf?: string | null
          created_at?: string
          email?: string
          id?: string
          nome?: string
          notif_documentos_pendentes?: boolean | null
          notif_novos_leads?: boolean | null
          notif_resumo_diario?: boolean | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          user_id?: string
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
          chip_iccid: string | null
          codigo: string
          created_at: string
          id: string
          id_plataforma: string | null
          imei: string | null
          numero_serie: string | null
          plataforma: string
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
          chip_iccid?: string | null
          codigo: string
          created_at?: string
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          numero_serie?: string | null
          plataforma?: string
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
          chip_iccid?: string | null
          codigo?: string
          created_at?: string
          id?: string
          id_plataforma?: string | null
          imei?: string | null
          numero_serie?: string | null
          plataforma?: string
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
      tabelas_preco: {
        Row: {
          ativo: boolean
          created_at: string
          fipe_ate: number
          fipe_de: number
          id: string
          nome: string | null
          plano_id: string
          taxa_administrativa: number
          tipo_uso: string | null
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
          taxa_administrativa?: number
          tipo_uso?: string | null
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
          taxa_administrativa?: number
          tipo_uso?: string | null
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
          created_at: string
          data_agendada: string | null
          endereco_cidade: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          id: string
          instalacao_id: string | null
          km_atual: number | null
          observacoes: string | null
          sinistro_id: string | null
          status: Database["public"]["Enums"]["status_vistoria"]
          tipo: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at: string
          veiculo_id: string
          vistoriador_id: string | null
        }
        Insert: {
          associado_id: string
          avarias?: string | null
          created_at?: string
          data_agendada?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
          observacoes?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id: string
          vistoriador_id?: string | null
        }
        Update: {
          associado_id?: string
          avarias?: string | null
          created_at?: string
          data_agendada?: string | null
          endereco_cidade?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
          observacoes?: string | null
          sinistro_id?: string | null
          status?: Database["public"]["Enums"]["status_vistoria"]
          tipo?: Database["public"]["Enums"]["tipo_vistoria"]
          updated_at?: string
          veiculo_id?: string
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
            referencedRelation: "view_rastreadores_posicao"
            referencedColumns: ["associado_id"]
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
      atualizar_cobrancas_vencidas: { Args: never; Returns: number }
      atualizar_valor_os: { Args: { os_id: string }; Returns: undefined }
      can_access_api_settings: { Args: { _user_id: string }; Returns: boolean }
      get_alertas_contagem: {
        Args: never
        Returns: {
          abertos: number
          criticos: number
          total: number
          visualizados: number
        }[]
      }
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
      is_associado: { Args: { _user_id: string }; Returns: boolean }
      is_funcionario: { Args: { _user_id: string }; Returns: boolean }
      is_gerencia: { Args: { _user_id: string }; Returns: boolean }
      is_vendedor: { Args: { _user_id: string }; Returns: boolean }
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
