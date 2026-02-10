
import React from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const Logo = () => (
  <div className="relative group flex items-center gap-2">
    <div className="relative w-10 h-10 flex items-center justify-center bg-gradient-to-br from-violet-600 via-red-500 to-yellow-500 rounded-lg shadow-[0_0_15px_rgba(139,92,246,0.5)] transform group-hover:rotate-6 transition-transform duration-300 overflow-hidden">
      <div className="absolute inset-0 bg-white/20 backdrop-blur-sm"></div>
      <span className="relative z-10 text-white font-black text-xl font-outfit tracking-tighter">L</span>
      <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full blur-[1px]"></div>
    </div>
    <div className="flex flex-col">
      <h1 className="text-2xl font-black font-outfit tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-yellow-200 to-red-200">
        LECTIA
      </h1>
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-400 to-transparent rounded-full"></div>
    </div>
    <Sparkles className="absolute -top-1 -right-3 w-4 h-4 text-yellow-300 animate-pulse" />
  </div>
);

const Layout: React.FC<LayoutProps> = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a] relative overflow-x-hidden">
      {/* Dynamic Background Light Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-600/20 blur-[120px] rounded-full animate-pulse"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-red-600/10 blur-[150px] rounded-full"></div>
        <div className="absolute top-[40%] left-[20%] w-[300px] h-[300px] bg-yellow-500/10 blur-[100px] rounded-full"></div>
      </div>

      <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/10 text-white p-4 shadow-2xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo />
          <div className="hidden md:block">
            <p className="text-violet-200/70 text-xs font-bold uppercase tracking-[0.2em]">IA Tutorat FLE</p>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-4xl w-full mx-auto p-4 md:p-8 relative z-10">
        {(title || subtitle) && (
          <div className="mb-6 text-center space-y-2">
            {title && (
              <h2 className="text-2xl md:text-3xl font-black text-white font-outfit drop-shadow-sm">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-violet-200/80 text-base font-medium max-w-xl mx-auto leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className="bg-white/95 backdrop-blur-md rounded-[2rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] p-6 md:p-10 border border-white/20 relative overflow-hidden">
          {/* Internal card glow */}
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-600 via-red-500 to-yellow-500"></div>
          {children}
        </div>
      </main>

      <footer className="bg-slate-950/80 backdrop-blur-md text-white p-6 mt-auto border-t border-white/5 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 text-slate-400 group cursor-help">
            <div className="p-1.5 bg-slate-800 rounded-full group-hover:bg-yellow-500/20 transition-colors">
              <HelpCircle className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-sm font-medium">Besoin d'aide ? <a href="mailto:minaalhiane13@gmail.com" className="text-violet-400 hover:text-violet-300 underline underline-offset-4">minaalhiane13@gmail.com</a></span>
          </div>
          <div className="text-slate-500 text-xs font-bold tracking-widest uppercase">
            © 2026 LECTIA FLE
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
