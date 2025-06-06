import React, { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { AnimatedBackground } from "./AnimatedBackground";

interface AuthLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AuthLayout({ children, className }: AuthLayoutProps) {
  // Estado para controlar quando o conteúdo principal deve ser exibido
  const [contentReady, setContentReady] = useState(false);

  // Efeito para garantir que as teias sejam carregadas antes do conteúdo principal
  useEffect(() => {
    // Verificar se o evento WebTeiasProntas já foi disparado anteriormente
    if (window._teiasReady === true) {
      setContentReady(true);
      return;
    }

    // Força renderização do conteúdo após um curto tempo
    // mesmo que as teias ainda não estejam prontas (para falha segura)
    const timer = setTimeout(() => {
      setContentReady(true);
      window._teiasReady = true;
    }, 150);

    // Escuta o evento personalizado que indica que as teias estão prontas
    const handleTeiasReady = () => {
      clearTimeout(timer);
      setContentReady(true);
      window._teiasReady = true;
    };

    document.addEventListener('WebTeiasProntas', handleTeiasReady);

    // Dispara um evento para solicitar atualização imediata das teias
    document.dispatchEvent(new CustomEvent('ForceWebTeiaUpdate'));

    return () => {
      clearTimeout(timer);
      document.removeEventListener('WebTeiasProntas', handleTeiasReady);
    };
  }, []);

  // Renderizar o componente com um fallback que garante a visibilidade mesmo se houver problemas
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#f7f9fa] dark:bg-[#001427] p-4 relative overflow-hidden">
      {/* Overlay para garantir fundo mínimo mesmo se AnimatedBackground falhar */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#001427] to-[#0A2540] z-0"></div>

      {/* Fundo com efeito de gradiente sofisticado apenas azul escuro (sem laranja) */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#001427] via-[#0A1A2A] to-[#051830] opacity-85 z-0 animate-gradient"></div>

      {/* Sem efeitos de luz/brilho laranjas no fundo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        {/* Efeitos de luz azul sutil no canto direito */}
        <div className="absolute bottom-0 right-0 w-[40%] h-[80%] rounded-tl-full bg-gradient-to-tl from-[#0A2540]/15 via-[#0A2540]/08 to-transparent blur-3xl transform animate-float-node"></div>
        <div className="absolute top-[30%] right-0 w-[25%] h-[40%] rounded-l-full bg-gradient-to-l from-[#0A2540]/10 to-transparent blur-2xl transform animate-pulse-soft"></div>
      </div>

      {/* AnimatedBackground agora está por cima do fundo gradiente */}
      <AnimatedBackground>
        {/* Conteúdo principal centralizado */}
        <div className="flex items-center justify-center w-full h-full z-10 relative">
          <div
            className={cn(
              "w-full max-w-[480px] rounded-2xl p-8 shadow-xl shadow-brand-primary/15 backdrop-blur-lg transition-all duration-300",
              "hover:shadow-2xl hover:shadow-brand-primary/25 animate-fadeIn",
              "relative mx-auto", // Centralização usando margin auto
              !contentReady ? "opacity-0" : "opacity-100", // Controle de visibilidade baseado no estado
              className,
            )}
            style={{ 
              transition: "opacity 0.3s ease-in-out, transform 0.3s ease-out, box-shadow 0.3s ease",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 107, 0, 0.2)",
              border: "1px solid rgba(255, 107, 0, 0.15)",
              borderRadius: "18px",
              background: "linear-gradient(135deg, rgba(0, 20, 39, 0.5) 0%, rgba(0, 12, 27, 0.7) 100%)"
            }}
          >
            {children}
          </div>
        </div>
      </AnimatedBackground>
    </div>
  );
}

// Adicionar a declaração de tipo para a propriedade global
declare global {
  interface Window {
    _teiasReady?: boolean;
  }
}