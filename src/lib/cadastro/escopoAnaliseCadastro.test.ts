import { describe, it, expect } from 'vitest';
import { resolverEscopoAnaliseCadastro } from './escopoAnaliseCadastro';

describe('resolverEscopoAnaliseCadastro — regra canônica', () => {
  it('autovistoria ENXUTA acima FIPE: Cadastro avalia fotos (libera R/F)', () => {
    const r = resolverEscopoAnaliseCadastro({
      plano_tem_roubo_furto: true,
      tipo_vistoria: 'autovistoria',
      vistoria: {
        modalidade: 'autovistoria',
        fotos: [{}, {}], // 2 fotos (motor + chassi)
        video_360_url: 'https://x',
      },
    });
    expect(r.isAutovistoriaEnxutaAcimaFipe).toBe(true);
    expect(r.cadastroAvaliaFotos).toBe(true);
    expect(r.aprovarApenasDocumentos).toBe(false);
    expect(r.aguardandoMonitoramentoVistoria).toBe(false);
  });

  it('autovistoria COMPLETA sub-FIPE (carro, 31 fotos): aprovação final do Monitoramento', () => {
    const fotos = Array.from({ length: 31 }, () => ({}));
    const r = resolverEscopoAnaliseCadastro({
      plano_tem_roubo_furto: true,
      tipo_vistoria: 'autovistoria',
      vistoria: { modalidade: 'autovistoria', fotos, video_360_url: 'https://x' },
    });
    expect(r.isAutovistoriaCompletaSubFipe).toBe(true);
    expect(r.cadastroAvaliaFotos).toBe(false);
    expect(r.aprovarApenasDocumentos).toBe(true);
    expect(r.aguardandoMonitoramentoVistoria).toBe(true);
  });

  it('autovistoria COMPLETA sub-FIPE (moto, 15 fotos): aprovação final do Monitoramento', () => {
    const fotos = Array.from({ length: 15 }, () => ({}));
    const r = resolverEscopoAnaliseCadastro(
      {
        plano_tem_roubo_furto: true,
        tipo_vistoria: 'autovistoria',
        vistoria: { modalidade: 'autovistoria', fotos, video_360_url: 'https://x' },
      },
      { isMoto: true }
    );
    expect(r.isAutovistoriaCompletaSubFipe).toBe(true);
    expect(r.cadastroAvaliaFotos).toBe(false);
    expect(r.aguardandoMonitoramentoVistoria).toBe(true);
  });

  it('vistoria presencial na BASE com 31 fotos: Cadastro só docs, Monitoramento aprova', () => {
    const fotos = Array.from({ length: 31 }, () => ({}));
    const r = resolverEscopoAnaliseCadastro({
      plano_tem_roubo_furto: true,
      tipo_vistoria: 'agendada_base',
      vistoria: { modalidade: 'presencial', fotos, video_360_url: 'https://x' },
      vistoria_base_info: { status: 'agendada' },
    });
    expect(r.isAutovistoria).toBe(false);
    expect(r.isVistoriaPresencialTecnica).toBe(true);
    expect(r.cadastroAvaliaFotos).toBe(false);
    expect(r.aprovarApenasDocumentos).toBe(true);
    expect(r.aguardandoMonitoramentoVistoria).toBe(true);
  });

  it('vistoria presencial NO CLIENTE (agendada): Cadastro só docs', () => {
    const r = resolverEscopoAnaliseCadastro({
      plano_tem_roubo_furto: true,
      tipo_vistoria: 'agendada',
      vistoria: { modalidade: 'presencial', fotos: [], video_360_url: null },
    });
    expect(r.isVistoriaPresencialTecnica).toBe(true);
    expect(r.aprovarApenasDocumentos).toBe(true);
    expect(r.aguardandoMonitoramentoVistoria).toBe(true);
  });

  it('plano SEM R/F: aprovação documental basta, sem banner de Monitoramento', () => {
    const r = resolverEscopoAnaliseCadastro({
      plano_tem_roubo_furto: false,
      tipo_vistoria: 'agendada_base',
      vistoria: { modalidade: 'presencial', fotos: [], video_360_url: null },
    });
    expect(r.aprovarApenasDocumentos).toBe(true);
    expect(r.cadastroAvaliaFotos).toBe(false);
  });

  it('proposta nula → tudo default seguro', () => {
    const r = resolverEscopoAnaliseCadastro(null);
    expect(r.cadastroAvaliaFotos).toBe(false);
    expect(r.aprovarApenasDocumentos).toBe(true); // sem R/F
    expect(r.aguardandoMonitoramentoVistoria).toBe(false);
  });
});
