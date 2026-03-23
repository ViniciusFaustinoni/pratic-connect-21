import { useEffect, useState } from 'react';
import { publicSupabase } from '@/integrations/supabase/publicClient';
import logoFullLight from '@/assets/logos/logo-full-light.png';
import {
  Users,
  Wrench,
  PhoneCall,
  Shield,
  MessageCircle,
  Car,
  ShieldCheck,
  Lock,
  Siren,
  MapPin,
  Smartphone,
  Check,
  ChevronRight,
} from 'lucide-react';

interface PlanoLanding {
  id: string;
  nome: string;
  descricao: string | null;
  coberturas: string[] | null;
  valor_adesao: number | null;
  destaque: boolean | null;
  imagem_landing_url: string | null;
  descricao_landing: string | null;
}

const WHATSAPP_NUMBER = '5511953221644';
const WHATSAPP_BASE = `https://wa.me/${WHATSAPP_NUMBER}`;

export default function LandingPlanos() {
  const [planos, setPlanos] = useState<PlanoLanding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    publicSupabase
      .from('planos')
      .select('id, nome, descricao, coberturas, valor_adesao, destaque, imagem_landing_url, descricao_landing')
      .eq('visivel_landing', true)
      .eq('ativo', true)
      .order('ordem_exibicao')
      .then(({ data }) => {
        setPlanos((data as PlanoLanding[]) || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 scroll-smooth">
      {/* ===== HERO ===== */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0A1628]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0f2240] to-[#0A1628]" />
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_60%_40%,rgba(196,18,48,0.4),transparent_70%)]" />
        <div className="relative z-10 mx-auto max-w-3xl px-6 py-20 text-center">
          <img src={logoFullLight} alt="Praticcar" className="mx-auto mb-8 h-14 md:h-20 w-auto" loading="eager" />
          <h1 className="text-3xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl">
            Proteja seu veículo com quem entende de proteção
          </h1>
          <p className="mt-5 text-base text-gray-300 md:text-lg max-w-xl mx-auto">
            Mais de 10.000 associados confiam na Praticcar. Proteção 360º, assistência 24h e rastreamento veicular.
          </p>
          <a
            href={WHATSAPP_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#C41230] px-8 py-4 text-lg font-bold text-white shadow-lg shadow-red-900/30 transition hover:bg-[#a50f28] hover:scale-105"
          >
            <MessageCircle className="h-5 w-5" />
            Falar com consultor no WhatsApp
          </a>
          <p className="mt-4 text-sm text-gray-400">
            Atendimento rápido • Sem burocracia • Proteção imediata
          </p>
        </div>
      </section>

      {/* ===== NÚMEROS ===== */}
      <section className="bg-[#0A1628] border-t border-white/10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-6 py-12 md:grid-cols-4 md:gap-8">
          {[
            { icon: Users, label: '+10.000', sub: 'Associados Ativos' },
            { icon: Wrench, label: '+600', sub: 'Instalações por Mês' },
            { icon: PhoneCall, label: '24h', sub: 'Assistência em Todo Brasil' },
            { icon: Shield, label: '100%', sub: 'Proteção 360º' },
          ].map((item) => (
            <div key={item.sub} className="flex flex-col items-center rounded-2xl bg-white/5 p-6 text-center backdrop-blur-sm">
              <item.icon className="mb-3 h-8 w-8 text-[#C41230]" />
              <span className="text-2xl font-extrabold text-white md:text-3xl">{item.label}</span>
              <span className="mt-1 text-xs text-gray-400 md:text-sm">{item.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== PLANOS ===== */}
      <section className="bg-gray-50 py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-extrabold text-[#0A1628] md:text-4xl">
            Escolha o plano ideal para você
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-gray-500">
            Proteção 360º a partir de uma contribuição mensal acessível
          </p>

          {loading ? (
            <div className="mt-12 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#C41230] border-t-transparent" />
            </div>
          ) : planos.length === 0 ? (
            <div className="mt-12 rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center">
              <Shield className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-lg font-semibold text-gray-400">Em breve</p>
              <p className="text-sm text-gray-400">Nossos planos estarão disponíveis aqui em breve.</p>
            </div>
          ) : (
            <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {planos.map((plano) => (
                <div
                  key={plano.id}
                  className={`relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg ${
                    plano.destaque ? 'border-[#C41230] ring-2 ring-[#C41230]/20' : 'border-gray-200'
                  }`}
                >
                  {plano.destaque && (
                    <div className="absolute right-4 top-4 rounded-full bg-[#C41230] px-3 py-1 text-xs font-bold text-white">
                      Mais Popular
                    </div>
                  )}
                  {/* Image */}
                  <div className="h-44 bg-gradient-to-br from-[#0A1628] to-[#1a3358] flex items-center justify-center">
                    {plano.imagem_landing_url ? (
                      <>
                        <img
                          src={plano.imagem_landing_url}
                          alt={plano.nome}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling;
                            if (fallback) fallback.classList.remove('hidden');
                          }}
                        />
                        <Car className="h-16 w-16 text-white/30 hidden" />
                      </>
                    ) : (
                      <Car className="h-16 w-16 text-white/30" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="text-xl font-bold text-[#0A1628]">{plano.nome}</h3>
                    {plano.descricao_landing && (
                      <p className="mt-2 text-sm text-gray-500">{plano.descricao_landing}</p>
                    )}
                    {plano.coberturas && plano.coberturas.length > 0 && (
                      <ul className="mt-4 space-y-2 flex-1">
                        {plano.coberturas.slice(0, 6).map((c, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <a
                      href={`${WHATSAPP_BASE}?text=${encodeURIComponent(`Olá! Tenho interesse no plano ${plano.nome}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-[#C41230] px-6 py-3 font-bold text-white transition hover:bg-[#a50f28]"
                    >
                      Quero este plano
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-extrabold text-[#0A1628] md:text-4xl">
            Como funciona a proteção Praticcar
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: MessageCircle,
                title: 'Fale com nosso consultor',
                desc: 'Entre em contato pelo WhatsApp e receba uma cotação personalizada para o seu veículo.',
              },
              {
                icon: Car,
                title: 'Faça sua vistoria',
                desc: 'Nossa equipe agenda a vistoria de forma rápida, na sua casa ou em nossa base.',
              },
              {
                icon: ShieldCheck,
                title: 'Proteção ativada',
                desc: 'Com a documentação aprovada, seu veículo já está protegido com todos os benefícios do seu plano.',
              },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0A1628]">
                  <step.icon className="h-7 w-7 text-white" />
                </div>
                <span className="mt-2 text-xs font-bold text-[#C41230]">Passo {i + 1}</span>
                <h3 className="mt-3 text-lg font-bold text-[#0A1628]">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BENEFÍCIOS GERAIS ===== */}
      <section className="bg-[#0A1628] py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-extrabold text-white md:text-4xl">
            O que está incluído na sua proteção
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Car, label: 'Proteção contra colisão' },
              { icon: Lock, label: 'Cobertura para roubo e furto' },
              { icon: Siren, label: 'Assistência 24 horas' },
              { icon: MapPin, label: 'Rastreamento veicular incluso' },
              { icon: Wrench, label: 'Rede de oficinas credenciadas' },
              { icon: Smartphone, label: 'Aplicativo exclusivo do associado' },
            ].map((b) => (
              <div key={b.label} className="flex items-center gap-4 rounded-xl bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#C41230]/20">
                  <b.icon className="h-5 w-5 text-[#C41230]" />
                </div>
                <span className="font-semibold text-white">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA FINAL ===== */}
      <section className="bg-gradient-to-r from-[#0A1628] to-[#C41230] py-16 md:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-extrabold text-white md:text-4xl">
            Pronto para proteger seu veículo?
          </h2>
          <p className="mt-4 text-gray-200">
            Nosso consultor está disponível agora mesmo para tirar suas dúvidas e fazer sua cotação.
          </p>
          <a
            href={WHATSAPP_BASE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-lg font-bold text-[#0A1628] shadow-lg transition hover:bg-gray-100 hover:scale-105"
          >
            <MessageCircle className="h-5 w-5 text-[#C41230]" />
            Falar com consultor agora
          </a>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="bg-[#060e1a] py-10">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <img src={logoFullLight} alt="Praticcar" className="mx-auto h-10 w-auto" loading="lazy" />
          <p className="mt-4 text-sm text-gray-400">
            ABP Praticcar — Associação de Proteção Veicular
          </p>
          <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-500">
            <a href="#planos-section" className="hover:text-white transition">Planos</a>
            <a href={WHATSAPP_BASE} target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Fale Conosco</a>
          </div>
          <p className="mt-6 text-xs text-gray-600">
            © 2026 Praticcar. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
