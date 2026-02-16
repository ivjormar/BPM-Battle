
import React, { useState, useEffect } from 'react';

interface LobbyProps {
  initialNickname: string;
  initialRoomId: string;
  onCreate: (nick: string) => void;
  onJoin: (nick: string, roomId: string) => void;
}

const Lobby: React.FC<LobbyProps> = ({ initialNickname, initialRoomId, onCreate, onJoin }) => {
  const [nick, setNick] = useState(initialNickname);
  const [joinId, setJoinId] = useState(initialRoomId);

  // Auto-detect Room ID from Hash if present
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.startsWith('bpm-')) {
      setJoinId(hash);
    }
  }, []);

  const isValid = nick.trim().length >= 2;

  return (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="mb-8 text-center">
          <div className="inline-block p-3 rounded-2xl bg-indigo-50 mb-4">
            <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">BPM Battle</h1>
          <p className="text-slate-500">Compite por el mejor ritmo en tiempo real.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 px-1">Tu Apodo</label>
            <input 
              type="text" 
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              placeholder="Ej: RitmoMaster"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              maxLength={15}
            />
          </div>

          <div className="pt-2 grid grid-cols-1 gap-4">
            <button 
              disabled={!isValid}
              onClick={() => onCreate(nick)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/10 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-60H6" /></svg>
              Crear Nueva Partida
            </button>
            
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-slate-100"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">o unirse a una</span>
              <div className="flex-1 h-px bg-slate-100"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="ID de Sala"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
              />
              <button 
                disabled={!isValid || !joinId}
                onClick={() => onJoin(nick, joinId)}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-bold px-6 py-3 rounded-xl active:scale-95 transition-all"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-8 flex flex-col items-center gap-4">
        <p className="text-center text-slate-400 text-sm">
          P2P puro. Sin servidores.
        </p>
      </div>
    </div>
  );
};

export default Lobby;
