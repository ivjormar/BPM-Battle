
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, GameStatus, RoundStatus } from '../types';
import Leaderboard from './Leaderboard';

interface GameRoomProps {
  peerId: string;
  roomId: string;
  isHost: boolean;
  players: Player[];
  status: GameStatus;
  roundStatus: RoundStatus;
  targetBpm: number;
  timer: number;
  pendingPlayers?: {id: string, nickname: string}[];
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onStartSession: () => void;
  onStartRound: (duration: number, target: number) => void;
  onShowScores: () => void;
  onShowFinal: () => void;
  onNextRound: () => void;
  onStatUpdate: (bpm: number) => void;
  onTap: () => void;
  onLeave: () => void;
  lastLocalTap: number;
  nickname: string;
  roomClosed?: boolean;
}

const GameRoom: React.FC<GameRoomProps> = ({ 
  peerId, roomId, isHost, players, status, roundStatus, targetBpm, timer,
  pendingPlayers = [], onAccept, onReject,
  onStartSession, onStartRound, onShowScores, onShowFinal, onNextRound, onStatUpdate, onTap, onLeave, lastLocalTap,
  nickname, roomClosed = false
}) => {
  const [localBpm, setLocalBpm] = useState(0);
  const [configDuration, setConfigDuration] = useState(15);
  const [configTarget, setConfigTarget] = useState(120);
  
  const lastTapTimeRef = useRef<number | null>(null);
  const currentBpmRef = useRef<number>(0);
  
  const [copied, setCopied] = useState(false);

  const calculateBpm = useCallback(() => {
    const now = Date.now();
    
    if (lastTapTimeRef.current !== null && now - lastTapTimeRef.current > 2500) {
      lastTapTimeRef.current = null;
    }

    if (lastTapTimeRef.current === null) {
      lastTapTimeRef.current = now;
      return;
    }

    const interval = now - lastTapTimeRef.current;
    if (interval > 0) {
      const instantBpm = 60000 / interval;
      let nextBpm: number;
      
      if (currentBpmRef.current === 0) {
        nextBpm = Math.round(instantBpm);
      } else {
        const alpha = 0.35; 
        nextBpm = Math.round((currentBpmRef.current * (1 - alpha)) + (instantBpm * alpha));
      }

      if (nextBpm > 20 && nextBpm < 400) {
        currentBpmRef.current = nextBpm;
        setLocalBpm(nextBpm);
        onStatUpdate(nextBpm);
      }
    }

    lastTapTimeRef.current = now;
  }, [onStatUpdate]);

  const handleReset = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    lastTapTimeRef.current = null;
    currentBpmRef.current = 0;
    setLocalBpm(0);
    onStatUpdate(0);
  }, [onStatUpdate]);

  const handleTap = useCallback((e?: React.MouseEvent | KeyboardEvent | React.PointerEvent) => {
    if (e && 'key' in e && (e.key !== ' ' && e.key !== 'Enter')) return;
    if (e && 'preventDefault' in e) e.preventDefault();
    
    if (roundStatus !== 'ACTIVE' || isHost) return;
    
    onTap();
    calculateBpm();
  }, [roundStatus, isHost, calculateBpm, onTap]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') handleReset();
      if (document.activeElement?.tagName !== 'INPUT') {
        handleTap(e);
      }
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [handleTap, handleReset]);

  useEffect(() => {
    if (roundStatus === 'CONFIG' || roundStatus === 'ACTIVE') {
      setLocalBpm(0);
      currentBpmRef.current = 0;
      lastTapTimeRef.current = null;
    }
  }, [roundStatus]);

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantPlayers = players.filter(p => !p.isHost);

  const RoomClosedOverlay = () => (
    <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-[50px] p-10 max-w-sm w-full text-center shadow-[0_30px_100px_rgba(0,0,0,0.3)] border border-white/20">
        <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto text-red-500 mb-8 border-4 border-white shadow-inner">
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-3xl font-black text-slate-900 mb-3">Conexión Finalizada</h3>
        <p className="text-slate-500 font-medium leading-relaxed mb-10 px-4">El Host ha cerrado la sala o se ha interrumpido la señal P2P.</p>
        <button 
          onClick={onLeave}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl shadow-[0_15px_40px_rgba(79,70,229,0.4)] transition-all active:scale-95 text-lg"
        >
          VOLVER AL LOBBY
        </button>
      </div>
    </div>
  );

  if (status === 'ROOM') {
    return (
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[40px] p-8 space-y-8 shadow-xl relative overflow-hidden animate-in fade-in duration-500">
        {roomClosed && <RoomClosedOverlay />}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Sala de Espera</h2>
            <p className="text-slate-500 mt-1">Comparte el ID para que otros compitan</p>
          </div>
          <button onClick={onLeave} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">Abandonar</button>
        </div>
        {isHost && pendingPlayers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-4 shadow-sm animate-in slide-in-from-top-2">
             <div className="flex items-center gap-2">
               <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
               <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest">Aspirantes ({pendingPlayers.length})</h3>
             </div>
             <div className="space-y-2">
               {pendingPlayers.map(req => (
                 <div key={req.id} className="flex items-center justify-between bg-white p-4 rounded-2xl border border-amber-100 shadow-sm">
                   <span className="font-bold text-slate-700">{req.nickname}</span>
                   <div className="flex gap-2">
                     <button onClick={() => onReject?.(req.id)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all">Ignorar</button>
                     <button onClick={() => onAccept?.(req.id)} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20">Aceptar</button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-8 flex flex-col items-center gap-4 text-center">
          <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Código de acceso</p>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-black mono text-indigo-600 tracking-widest">{roomId.replace('bpm-', '').toUpperCase()}</span>
            <button onClick={copyLink} className="p-3 bg-white hover:bg-indigo-50 rounded-2xl transition-all text-slate-400 border border-slate-200 shadow-sm group">
              {copied ? (
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-6 h-6 group-hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              )}
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">En la sala ({players.length})</h3>
          <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-indigo-100 transition-colors">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600">
                  {p.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-slate-800">{p.nickname}</span>
                {p.isHost && <span className="ml-auto text-[10px] bg-indigo-600 text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">Host</span>}
              </div>
            ))}
          </div>
        </div>
        {isHost ? (
          <button 
            disabled={participantPlayers.length === 0}
            onClick={onStartSession}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black py-6 rounded-3xl text-xl shadow-[0_20px_40px_rgba(79,70,229,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            LANZAR COMPETICIÓN
          </button>
        ) : (
          <div className="text-center py-6 bg-indigo-50/50 rounded-3xl border border-indigo-100/50">
            <p className="text-indigo-600 font-black animate-pulse uppercase tracking-widest text-sm">Esperando al Host...</p>
          </div>
        )}
      </div>
    );
  }

  if (isHost) {
    return (
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-[40px] p-8 space-y-8 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-100 pb-8">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Mesa de Control</h2>
            <p className="text-slate-500 font-medium">Gestiona la partida en curso</p>
          </div>
          <button onClick={onLeave} className="text-sm font-black text-red-500 hover:bg-red-50 px-6 py-3 rounded-2xl transition-all border border-transparent hover:border-red-100">Finalizar Todo</button>
        </div>
        {roundStatus === 'CONFIG' && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Tiempo de Ronda</label>
                <div className="relative">
                  <input type="number" value={configDuration} onChange={e => setConfigDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-8 py-6 text-slate-900 font-black text-3xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-bold">SEG</span>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">BPM Objetivo</label>
                <div className="relative">
                  <input type="number" value={configTarget} onChange={e => setConfigTarget(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-3xl px-8 py-6 text-slate-900 font-black text-3xl focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all" />
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 font-bold">BPM</span>
                </div>
              </div>
            </div>
            <button onClick={() => onStartRound(configDuration, configTarget)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-8 rounded-[40px] text-3xl shadow-[0_30px_60px_rgba(79,70,229,0.3)] transition-all active:scale-95">
              ¡EMPEZAR RONDA!
            </button>
          </div>
        )}
        {roundStatus === 'ACTIVE' && (
          <div className="text-center py-20 space-y-6">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-[0.4em]">PARTIDA EN DIRECTO</p>
            <h3 className="text-[12rem] font-black text-slate-900 mono leading-none tracking-tighter">{timer}s</h3>
            <div className="bg-indigo-600 inline-block px-10 py-4 rounded-3xl shadow-xl shadow-indigo-200">
              <p className="text-white font-black text-2xl tracking-widest uppercase">OBJETIVO: {targetBpm} BPM</p>
            </div>
          </div>
        )}
        {(roundStatus === 'RESULTS_BPM' || roundStatus === 'RESULTS_SCORES' || roundStatus === 'FINAL') && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-slate-50 border border-slate-200 rounded-[40px] p-10">
              <Leaderboard players={players} targetBpm={targetBpm} mode={roundStatus === 'RESULTS_BPM' ? 'BPM' : (roundStatus === 'FINAL' ? 'TOTAL' : 'ROUND')} />
            </div>
            <div className="flex gap-6">
              {roundStatus === 'RESULTS_BPM' && (
                <button onClick={onShowScores} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-3xl shadow-xl transition-all">Ver Puntuaciones</button>
              )}
              {roundStatus === 'RESULTS_SCORES' && (
                <>
                  <button onClick={onNextRound} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-3xl shadow-xl transition-all">Siguiente Ronda</button>
                  <button onClick={onShowFinal} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black py-6 rounded-3xl transition-all">Podio Final</button>
                </>
              )}
              {roundStatus === 'FINAL' && (
                 <button onClick={onLeave} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-3xl shadow-xl transition-all">Disolver Sala</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl flex flex-col items-center justify-center space-y-6 animate-in fade-in duration-500">
      {roomClosed && <RoomClosedOverlay />}
      
      {roundStatus === 'CONFIG' && (
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[50px] p-16 text-center space-y-8 shadow-2xl">
          <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg className="w-12 h-12 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-900">Esperando el Beat...</h2>
          <p className="text-slate-500 font-medium text-lg px-10 leading-relaxed">Ajusta tu metrónomo interno. El Host está configurando la velocidad de la ronda.</p>
        </div>
      )}

      {roundStatus === 'ACTIVE' && (
        <div 
          className="relative w-full aspect-[4/5] sm:aspect-square max-h-[85vh] bg-white border-4 border-slate-100 rounded-[50px] sm:rounded-[70px] flex flex-col items-center justify-center overflow-hidden transition-all duration-300 shadow-[0_40px_100px_rgba(0,0,0,0.1)] select-none touch-none"
        >
          {/* Flash visual sincronizado con el toque local */}
          <div className={`absolute inset-0 bg-indigo-600/10 transition-opacity duration-100 pointer-events-none ${Date.now() - lastLocalTap < 80 ? 'opacity-100' : 'opacity-0'}`}></div>
          
          <div className="absolute top-10 flex justify-between w-full px-14 sm:px-20">
            <div className="flex flex-col">
              <span className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">Crono</span>
              <span className="text-4xl sm:text-5xl font-black text-slate-900 mono tracking-tighter">{timer}s</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-[12px] font-black text-slate-300 uppercase tracking-[0.3em]">Target</span>
              <span className="text-4xl sm:text-5xl font-black text-slate-900 mono tracking-tighter">???</span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6 sm:gap-12 z-20 w-full">
            {/* VALOR DE BPM: Masivo y ultra-responsivo con clamp */}
            <div className="text-center w-full px-10">
              <div className="relative inline-block w-full">
                <span className="text-[clamp(110px,28vh,220px)] sm:text-[clamp(140px,22vw,280px)] font-black text-slate-900 leading-[0.8] mono tracking-tighter block drop-shadow-2xl animate-in zoom-in duration-200">
                  {localBpm}
                </span>
                <p className="text-[clamp(12px,2vh,16px)] font-black text-indigo-600 uppercase tracking-[0.4em] mt-4 sm:mt-0 bg-indigo-50/80 backdrop-blur-sm inline-block px-6 py-2 rounded-full border border-indigo-100 shadow-sm">
                  MI RITMO BPM
                </p>
              </div>
            </div>

            {/* BOTÓN TAP: Proporción áurea respecto al BPM */}
            <button 
              onPointerDown={(e) => handleTap(e)}
              className="group relative w-[clamp(160px,24vh,300px)] h-[clamp(160px,24vh,300px)] sm:w-[clamp(200px,38vw,340px)] sm:h-[clamp(200px,38vw,340px)] bg-indigo-600 hover:bg-indigo-700 active:scale-90 transition-all rounded-full shadow-[0_30px_80px_rgba(79,70,229,0.4)] flex items-center justify-center border-[12px] sm:border-[20px] border-white"
            >
              <span className="text-5xl sm:text-7xl font-black text-white tracking-[0.1em] drop-shadow-lg">TAP</span>
              {/* Onda expansiva decorativa */}
              <div className="absolute inset-[-20px] sm:inset-[-35px] rounded-full border-4 border-indigo-200 opacity-30 animate-ping pointer-events-none group-active:hidden"></div>
            </button>
          </div>
          
          <button 
            onPointerDown={(e) => { e.stopPropagation(); handleReset(); }}
            className="absolute bottom-10 right-10 bg-slate-50 hover:bg-red-50 hover:text-red-500 text-slate-400 p-5 sm:p-7 rounded-[30px] border border-slate-200 transition-all active:scale-95 z-30 shadow-sm"
            title="Resetear ritmo (R)"
          >
            <svg className="w-8 h-8 sm:w-10 sm:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>

          <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-[12px] font-black text-slate-300 uppercase tracking-[0.3em] pointer-events-none italic hidden sm:block">
            Usa el botón central o la Tecla Espacio
          </p>
        </div>
      )}

      {(roundStatus === 'RESULTS_BPM' || roundStatus === 'RESULTS_SCORES' || roundStatus === 'FINAL') && (
        <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[50px] p-10 space-y-8 shadow-2xl">
          <div className="text-center">
             <h2 className="text-3xl font-black text-slate-900">
               {roundStatus === 'FINAL' ? '🏆 Podio Final 🏆' : '📊 Resultados'}
             </h2>
             <div className="bg-indigo-600 inline-block px-6 py-2 rounded-full mt-4 shadow-lg shadow-indigo-100">
               <p className="text-xs font-black text-white uppercase tracking-widest">Objetivo: {targetBpm} BPM</p>
             </div>
          </div>
          <Leaderboard players={players} targetBpm={targetBpm} mode={roundStatus === 'RESULTS_BPM' ? 'BPM' : (roundStatus === 'FINAL' ? 'TOTAL' : 'ROUND')} />
          {roundStatus === 'FINAL' && (
            <button onClick={onLeave} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-black py-5 rounded-3xl mt-6 transition-all text-lg">SALIR DE LA SALA</button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameRoom;
