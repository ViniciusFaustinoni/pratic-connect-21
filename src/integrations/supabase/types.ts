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
      associados: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          contrato_id: string | null
          cpf: string
          created_at: string
          data_nascimento: string | null
          email: string
          estado_civil: string | null
          id: string
          logradouro: string | null
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
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contrato_id?: string | null
          cpf: string
          created_at?: string
          data_nascimento?: string | null
          email: string
          estado_civil?: string | null
          id?: string
          logradouro?: string | null
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
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          contrato_id?: string | null
          cpf?: string
          created_at?: string
          data_nascimento?: string | null
          email?: string
          estado_civil?: string | null
          id?: string
          logradouro?: string | null
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
      chamados_assistencia: {
        Row: {
          associado_id: string
          atendente_id: string | null
          avaliacao_nota: number | null
          canal: string
          created_at: string
          data_abertura: string
          data_conclusao: string | null
          descricao: string | null
          destino_cep: string | null
          destino_cidade: string | null
          destino_lat: number | null
          destino_lng: number | null
          destino_logradouro: string | null
          destino_uf: string | null
          id: string
          origem_cep: string | null
          origem_cidade: string | null
          origem_lat: number | null
          origem_lng: number | null
          origem_logradouro: string | null
          origem_uf: string | null
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
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
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
          avaliacao_nota?: number | null
          canal?: string
          created_at?: string
          data_abertura?: string
          data_conclusao?: string | null
          descricao?: string | null
          destino_cep?: string | null
          destino_cidade?: string | null
          destino_lat?: number | null
          destino_lng?: number | null
          destino_logradouro?: string | null
          destino_uf?: string | null
          id?: string
          origem_cep?: string | null
          origem_cidade?: string | null
          origem_lat?: number | null
          origem_lng?: number | null
          origem_logradouro?: string | null
          origem_uf?: string | null
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
            foreignKeyName: "chamados_assistencia_atendente_id_fkey"
            columns: ["atendente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chamados_assistencia_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          associado_id: string | null
          cotacao_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
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
          cotacao_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
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
          cotacao_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
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
        ]
      }
      cotacoes: {
        Row: {
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
          valor_cota: number
          valor_fipe: number
          valor_rastreamento: number
          valor_total_mensal: number
          vendedor_id: string | null
        }
        Insert: {
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
          valor_cota: number
          valor_fipe: number
          valor_rastreamento?: number
          valor_total_mensal: number
          vendedor_id?: string | null
        }
        Update: {
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
          valor_cota?: number
          valor_fipe?: number
          valor_rastreamento?: number
          valor_total_mensal?: number
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
            foreignKeyName: "documentos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
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
          cpf: string | null
          created_at: string
          email: string | null
          etapa: Database["public"]["Enums"]["etapa_lead"]
          fonte_id: string | null
          id: string
          motivo_perda: string | null
          nome: string
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
          cpf?: string | null
          created_at?: string
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          motivo_perda?: string | null
          nome: string
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
          cpf?: string | null
          created_at?: string
          email?: string | null
          etapa?: Database["public"]["Enums"]["etapa_lead"]
          fonte_id?: string | null
          id?: string
          motivo_perda?: string | null
          nome?: string
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
            foreignKeyName: "leads_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "lead_fontes"
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
      profiles: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          cpf: string | null
          created_at: string
          email: string
          id: string
          nome: string
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
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_usuario"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          ultima_posicao_lat: number | null
          ultima_posicao_lng: number | null
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
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
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
          ultima_posicao_lat?: number | null
          ultima_posicao_lng?: number | null
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
      sinistros: {
        Row: {
          analista_id: string | null
          associado_id: string
          bo_arquivo_url: string | null
          bo_numero: string | null
          canal: string
          created_at: string
          data_ocorrencia: string
          descricao: string | null
          id: string
          local_descricao: string | null
          protocolo: string
          status: Database["public"]["Enums"]["status_sinistro"]
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at: string
          valor_fipe: number | null
          valor_indenizacao: number | null
          veiculo_id: string
        }
        Insert: {
          analista_id?: string | null
          associado_id: string
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          canal?: string
          created_at?: string
          data_ocorrencia: string
          descricao?: string | null
          id?: string
          local_descricao?: string | null
          protocolo: string
          status?: Database["public"]["Enums"]["status_sinistro"]
          tipo: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at?: string
          valor_fipe?: number | null
          valor_indenizacao?: number | null
          veiculo_id: string
        }
        Update: {
          analista_id?: string | null
          associado_id?: string
          bo_arquivo_url?: string | null
          bo_numero?: string | null
          canal?: string
          created_at?: string
          data_ocorrencia?: string
          descricao?: string | null
          id?: string
          local_descricao?: string | null
          protocolo?: string
          status?: Database["public"]["Enums"]["status_sinistro"]
          tipo?: Database["public"]["Enums"]["tipo_sinistro"]
          updated_at?: string
          valor_fipe?: number | null
          valor_indenizacao?: number | null
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
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
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
          renavam: string | null
          updated_at: string
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
          renavam?: string | null
          updated_at?: string
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
          renavam?: string | null
          updated_at?: string
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
          id: string
          instalacao_id: string | null
          km_atual: number | null
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
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
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
          id?: string
          instalacao_id?: string | null
          km_atual?: number | null
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
            foreignKeyName: "vistorias_instalacao_id_fkey"
            columns: ["instalacao_id"]
            isOneToOne: false
            referencedRelation: "instalacoes"
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
      [_ in never]: never
    }
    Functions: {
      can_access_api_settings: { Args: { _user_id: string }; Returns: boolean }
      get_my_associado_id: { Args: { _user_id: string }; Returns: string }
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
        | "ganho"
        | "perdido"
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
        | "documentacao_pendente"
        | "aguardando_instalacao"
        | "ativo"
        | "inadimplente"
        | "suspenso"
        | "cancelado"
      status_chamado:
        | "aberto"
        | "em_atendimento"
        | "em_deslocamento"
        | "concluido"
        | "cancelado"
      status_contrato: "pendente" | "ativo" | "suspenso" | "cancelado"
      status_cotacao:
        | "rascunho"
        | "enviada"
        | "aceita"
        | "recusada"
        | "expirada"
      status_documento: "pendente" | "em_analise" | "aprovado" | "reprovado"
      status_instalacao:
        | "agendada"
        | "em_rota"
        | "em_andamento"
        | "concluida"
        | "reagendada"
        | "cancelada"
      status_rastreador: "estoque" | "instalado" | "manutencao" | "baixado"
      status_rota: "pendente" | "em_andamento" | "concluida" | "cancelada"
      status_sinistro:
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "indenizado"
        | "cancelado"
      status_vistoria: "pendente" | "aprovada" | "reprovada" | "em_analise"
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
      tipo_sinistro:
        | "roubo"
        | "furto"
        | "colisao"
        | "incendio"
        | "alagamento"
        | "outro"
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
        "ganho",
        "perdido",
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
        "documentacao_pendente",
        "aguardando_instalacao",
        "ativo",
        "inadimplente",
        "suspenso",
        "cancelado",
      ],
      status_chamado: [
        "aberto",
        "em_atendimento",
        "em_deslocamento",
        "concluido",
        "cancelado",
      ],
      status_contrato: ["pendente", "ativo", "suspenso", "cancelado"],
      status_cotacao: ["rascunho", "enviada", "aceita", "recusada", "expirada"],
      status_documento: ["pendente", "em_analise", "aprovado", "reprovado"],
      status_instalacao: [
        "agendada",
        "em_rota",
        "em_andamento",
        "concluida",
        "reagendada",
        "cancelada",
      ],
      status_rastreador: ["estoque", "instalado", "manutencao", "baixado"],
      status_rota: ["pendente", "em_andamento", "concluida", "cancelada"],
      status_sinistro: [
        "em_analise",
        "aprovado",
        "reprovado",
        "indenizado",
        "cancelado",
      ],
      status_vistoria: ["pendente", "aprovada", "reprovada", "em_analise"],
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
      tipo_sinistro: [
        "roubo",
        "furto",
        "colisao",
        "incendio",
        "alagamento",
        "outro",
      ],
      tipo_usuario: ["funcionario", "associado", "prestador"],
      tipo_vistoria: ["entrada", "saida", "sinistro"],
    },
  },
} as const
