import { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Info, AlertTriangle, Lightbulb, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import type { VistoriaFotoConfig } from '@/data/vistoriaConfigCompleta';

interface FotoEnviada {
  tipo: string;
  arquivo_url: string;
}

interface VistoriaFotoSequencialProps {
  fotos: VistoriaFotoConfig[];
  fotosEnviadas: FotoEnviada[];
  uploadingFoto: string | null;
  onUpload: (fotoId: string, file: File) => void;
}

export function VistoriaFotoSequencial({
  fotos,
  fotosEnviadas,
  uploadingFoto,
  onUpload,
}: VistoriaFotoSequencialProps) {
  const [fotoAtualIndex, setFotoAtualIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const prevUploadingRef = useRef<string | null>(null);

  const fotoAtual = fotos[fotoAtualIndex];
  const totalFotos = fotos.length;
  const fotosCompletasCount = fotos.filter(f => fotosEnviadas.some(e => e.tipo === f.id)).length;
  const todasCompletas = fotosCompletasCount === totalFotos;

  const isFotoEnviada = useCallback((fotoId: string) => {
    return fotosEnviadas.some(f => f.tipo === fotoId);
  }, [fotosEnviadas]);

  const getFotoUrl = useCallback((fotoId: string) => {
    return fotosEnviadas.find(f => f.tipo === fotoId)?.arquivo_url;
  }, [fotosEnviadas]);

  // Auto-avanço: quando upload completa, avança para próxima pendente
  useEffect(() => {
    if (prevUploadingRef.current && !uploadingFoto) {
      const uploadedId = prevUploadingRef.current;
      const timer = setTimeout(() => {
        const nextIndex = fotos.findIndex((f, i) => i > fotoAtualIndex && f.id !== uploadedId && !isFotoEnviada(f.id));
        if (nextIndex >= 0) {
          setFotoAtualIndex(nextIndex);
        } else {
          const fromStart = fotos.findIndex(f => f.id !== uploadedId && !isFotoEnviada(f.id));
          if (fromStart >= 0) setFotoAtualIndex(fromStart);
        }
      }, 600);
      prevUploadingRef.current = uploadingFoto;
      return () => clearTimeout(timer);
    }
    prevUploadingRef.current = uploadingFoto;
  }, [uploadingFoto, fotos, fotoAtualIndex, isFotoEnviada]);

  // Scroll thumbnail ativa para o centro
  useEffect(() => {
    if (thumbnailsRef.current) {
      const activeThumb = thumbnailsRef.current.children[fotoAtualIndex] as HTMLElement;
      if (activeThumb) {
        activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [fotoAtualIndex]);

  // Inicializar na primeira foto pendente
  useEffect(() => {
    const firstPending = fotos.findIndex(f => !isFotoEnviada(f.id));
    if (firstPending >= 0) {
      setFotoAtualIndex(firstPending);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && fotoAtual) {
      onUpload(fotoAtual.id, file);
    }
    if (e.target) e.target.value = '';
  };

  const goTo = (index: number) => {
    if (index >= 0 && index < totalFotos) {
      setFotoAtualIndex(index);
    }
  };

  const fotoUrl = fotoAtual ? getFotoUrl(fotoAtual.id) : undefined;
  const isCurrentUploading = uploadingFoto === fotoAtual?.id;
  const isCurrentEnviada = fotoAtual ? isFotoEnviada(fotoAtual.id) : false;
  const IconeAtual = fotoAtual?.icone;

  return (
    <div className="space-y-4">
      {/* Progresso */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">
          Foto <span className="text-white font-bold">{fotoAtualIndex + 1}</span> de {totalFotos}
        </span>
        <span className={cn(
          "font-medium px-2 py-0.5 rounded-full text-xs",
          todasCompletas 
            ? "bg-emerald-900/50 text-emerald-300" 
            : "bg-slate-700 text-slate-300"
        )}>
          {fotosCompletasCount}/{totalFotos} enviadas
        </span>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div
          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(fotosCompletasCount / totalFotos) * 100}%` }}
        />
      </div>

      {/* Thumbnails horizontais */}
      <div
        ref={thumbnailsRef}
        className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {fotos.map((foto, index) => {
          const enviada = isFotoEnviada(foto.id);
          const isActive = index === fotoAtualIndex;
          const url = getFotoUrl(foto.id);

          return (
            <button
              key={foto.id}
              onClick={() => goTo(index)}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-lg border-2 transition-all overflow-hidden relative",
                isActive
                  ? "border-blue-500 ring-2 ring-blue-500/30 scale-110"
                  : enviada
                    ? "border-emerald-600"
                    : "border-slate-600 opacity-60 hover:opacity-100"
              )}
            >
              {url ? (
                <img src={url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 text-xs font-bold">
                  {index + 1}
                </div>
              )}
              {enviada && (
                <div className="absolute inset-0 bg-emerald-600/20 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Todas completas */}
      {todasCompletas && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-950/40 border border-emerald-700 rounded-xl p-6 text-center"
        >
          <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-emerald-300">Todas as fotos foram enviadas!</h3>
          <p className="text-sm text-emerald-400/70 mt-1">
            Você pode tocar nas miniaturas acima para revisar ou substituir qualquer foto.
          </p>
        </motion.div>
      )}

      {/* Conteúdo principal da foto atual */}
      {fotoAtual && !todasCompletas && (
        <AnimatePresence mode="wait">
          <motion.div
            key={fotoAtual.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Título e ícone */}
            <div className="flex items-start gap-3">
              {IconeAtual && (
                <div className={cn(
                  "p-2.5 rounded-xl flex-shrink-0",
                  isCurrentEnviada ? "bg-emerald-900/50" : "bg-blue-900/50"
                )}>
                  <IconeAtual className={cn(
                    "h-6 w-6",
                    isCurrentEnviada ? "text-emerald-400" : "text-blue-400"
                  )} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-base leading-tight">{fotoAtual.nome}</h3>
                {fotoAtual.descricao && (
                  <p className="text-slate-400 text-sm mt-0.5">{fotoAtual.descricao}</p>
                )}
              </div>
              {isCurrentEnviada && (
                <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              )}
            </div>

            {/* Card de instruções */}
            {(fotoAtual.instrucoes?.length || fotoAtual.evitar?.length) && (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-3 space-y-2.5">
                {/* Como tirar */}
                {fotoAtual.instrucoes && fotoAtual.instrucoes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Info className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Como tirar</span>
                    </div>
                    <ul className="space-y-1">
                      {fotoAtual.instrucoes.map((inst, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                          <span className="text-blue-400 mt-1 flex-shrink-0">•</span>
                          <span>{inst}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* O que evitar */}
                {fotoAtual.evitar && fotoAtual.evitar.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Evitar</span>
                    </div>
                    <ul className="space-y-1">
                      {fotoAtual.evitar.map((ev, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-400">
                          <span className="text-amber-400 mt-1 flex-shrink-0">✕</span>
                          <span>{ev}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Dica extra */}
                {fotoAtual.dicaExtra && (
                  <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2.5">
                    <Lightbulb className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-300/90">{fotoAtual.dicaExtra}</p>
                  </div>
                )}
              </div>
            )}

            {/* Área de preview/captura */}
            <div className="relative">
              {isCurrentUploading ? (
                <div className="aspect-[4/3] bg-slate-800 rounded-xl border-2 border-dashed border-blue-500/50 flex flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 text-blue-400 animate-spin mb-3" />
                  <span className="text-sm text-blue-300 font-medium">Enviando foto...</span>
                </div>
              ) : fotoUrl ? (
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-emerald-600">
                  <img src={fotoUrl} alt={fotoAtual.nome} className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 right-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleCapture}
                      className="gap-1.5 bg-black/70 hover:bg-black/90 text-white border-0"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Refazer
                    </Button>
                  </div>
                  <div className="absolute top-3 left-3 bg-emerald-600 text-white px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Enviada
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleCapture}
                  className="w-full aspect-[4/3] bg-slate-800 rounded-xl border-2 border-dashed border-slate-600 hover:border-blue-500 transition-all flex flex-col items-center justify-center gap-3 group"
                >
                  <div className="p-4 rounded-full bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors">
                    <Camera className="h-10 w-10 text-blue-400" />
                  </div>
                  <div className="text-center">
                    <span className="text-white font-semibold text-base block">Tirar Foto</span>
                    <span className="text-slate-400 text-xs">Toque para abrir a câmera</span>
                  </div>
                </button>
              )}
            </div>

            {/* Input escondido */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Navegação anterior/próxima */}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goTo(fotoAtualIndex - 1)}
                disabled={fotoAtualIndex === 0}
                className="gap-1 border-slate-600 text-slate-300"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>

              <span className="text-xs text-slate-500 font-medium">
                {fotoAtual.categoria && fotos.filter(f => f.categoria === fotoAtual.categoria).findIndex(f => f.id === fotoAtual.id) + 1}/
                {fotos.filter(f => f.categoria === fotoAtual.categoria).length} na categoria
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => goTo(fotoAtualIndex + 1)}
                disabled={fotoAtualIndex === totalFotos - 1}
                className="gap-1 border-slate-600 text-slate-300"
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
