
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
}

const GameRoom: React.FC<GameRoomProps> = ({ 
  peerId, roomId, isHost, players, status, roundStatus, targetBpm, timer,
  pendingPlayers = [], onAccept, onReject,
  onStartSession, onStartRound, onShowScores, onShowFinal, onNextRound, onStatUpdate, onTap, onLeave, lastLocalTap,
  nickname
}) => {
  const [localBpm, setLocalBpm] = useState(0);
  const [configDuration, setConfigDuration] = useState(15);
  const [configTarget, setConfigTarget] = useState(120);
  const tapTimesRef = useRef<number[]>([]);
  const [copied, setCopied] = useState(false);

  const calculateBpm = useCallback(() => {
    const now = Date.now();
    // Mantenemos una ventana de 2.5 segundos para el cálculo
    tapTimesRef.current = [...tapTimesRef.current, now].filter(t => now - t < 2500);
    
    if (tapTimesRef.current.length < 2) return;
    
    const intervals = [];
    for (let i = 1; i < tapTimesRef.current.length; i++) {
      intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i-1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = Math.round(60000 / avgInterval);
    
    setLocalBpm(bpm);
    onStatUpdate(bpm);
  }, [onStatUpdate]);

  const handleReset = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    tapTimesRef.current = [];
    setLocalBpm(0);
    onStatUpdate(0);
  }, [onStatUpdate]);

  const handleTap = useCallback((e?: React.MouseEvent | KeyboardEvent) => {
    if (e && 'key' in e && e.key !== ' ') return;
    // Solo permitimos tap si la ronda está activa y no somos el host
    if (roundStatus !== 'ACTIVE' || isHost) return;
    onTap();
    calculateBpm();
  }, [roundStatus, isHost, calculateBpm, onTap]);

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'r' || e.key === 'R') handleReset();
      handleTap(e);
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [handleTap, handleReset]);

  useEffect(() => {
    // Al empezar una nueva configuración o ronda, reseteamos el contador visual a 0
    if (roundStatus === 'CONFIG' || roundStatus === 'ACTIVE') {
      setLocalBpm(0);
      tapTimesRef.current = [];
    }
  }, [roundStatus]);

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const participantPlayers = players.filter(p => !p.isHost);

  if (status === 'ROOM') {
    return (
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-[40px] p-8 space-y-8 shadow-xl relative overflow-hidden animate-in fade-in duration-500">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
        
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Sala de Espera</h2>
            <p className="text-slate-500 mt-1">Invita a otros jugadores con el ID de sala</p>
          </div>
          <button onClick={onLeave} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">Salir</button>
        </div>

        {isHost && pendingPlayers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-4">
             <div className="flex items-center gap-2">
               <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
               <h3 className="text-sm font-black text-amber-800 uppercase tracking-widest">Solicitudes de Entrada ({pendingPlayers.length})</h3>
             </div>
             <div className="space-y-2">
               {pendingPlayers.map(req => (
                 <div key={req.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-amber-100 shadow-sm">
                   <span className="font-bold text-slate-700">{req.nickname}</span>
                   <div className="flex gap-2">
                     <button onClick={() => onReject?.(req.id)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all">Rechazar</button>
                     <button onClick={() => onAccept?.(req.id)} className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-500/20">Aceptar</button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        )}

        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 flex flex-col items-center gap-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ID de la Sala</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black mono text-indigo-600 tracking-wider">{roomId.replace('bpm-', '').toUpperCase()}</span>
            <button onClick={copyLink} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 border border-transparent hover:border-slate-200 shadow-sm">
              {copied ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Conectados ({players.length})</h3>
          <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
            {players.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center font-bold text-indigo-600 text-xs">
                  {p.nickname.charAt(0).toUpperCase()}
                </div>
                <span className="font-bold text-slate-700">{p.nickname}</span>
                {p.isHost && <span className="ml-auto text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-black uppercase tracking-tighter">Host</span>}
              </div>
            ))}
          </div>
        </div>

        {isHost ? (
          <button 
            disabled={participantPlayers.length === 0}
            onClick={onStartSession}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black py-5 rounded-3xl text-xl shadow-lg shadow-indigo-500/10 transition-all active:scale-95 flex items-center justify-center gap-3"
          >
            EMPEZAR PARTIDA
          </button>
        ) : (
          <div className="text-center py-4">
            <p className="text-slate-400 animate-pulse font-medium">El Host iniciará pronto...</p>
          </div>
        )}
      </div>
    );
  }

  if (isHost) {
    return (
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-[40px] p-8 space-y-8 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-100 pb-6">
          <h2 className="text-2xl font-black text-slate-900">Panel del Host</h2>
          <button onClick={onLeave} className="text-sm font-bold text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all">Finalizar Partida</button>
        </div>

        {roundStatus === 'CONFIG' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Duración (segundos)</label>
                <input type="number" value={configDuration} onChange={e => setConfigDuration(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold text-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">BPM Objetivo</label>
                <input type="number" value={configTarget} onChange={e => setConfigTarget(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-slate-900 font-bold text-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
            </div>
            <button onClick={() => onStartRound(configDuration, configTarget)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-6 rounded-3xl text-2xl shadow-lg transition-all active:scale-95">
              EMPEZAR RONDA
            </button>
          </div>
        )}

        {roundStatus === 'ACTIVE' && (
          <div className="text-center py-12 space-y-4">
            <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">Compitiendo...</p>
            <h3 className="text-9xl font-black text-slate-900 mono">{timer}s</h3>
            <p className="text-slate-500 font-bold">Objetivo: {targetBpm} BPM</p>
          </div>
        )}

        {(roundStatus === 'RESULTS_BPM' || roundStatus === 'RESULTS_SCORES' || roundStatus === 'FINAL') && (
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6">
              <Leaderboard players={players} targetBpm={targetBpm} mode={roundStatus === 'RESULTS_BPM' ? 'BPM' : (roundStatus === 'FINAL' ? 'TOTAL' : 'ROUND')} />
            </div>
            <div className="flex gap-4">
              {roundStatus === 'RESULTS_BPM' && (
                <button onClick={onShowScores} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-md">Ver Clasificación</button>
              )}
              {roundStatus === 'RESULTS_SCORES' && (
                <>
                  <button onClick={onNextRound} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-md">Siguiente Ronda</button>
                  <button onClick={onShowFinal} className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-4 rounded-2xl shadow-sm">Resultados Finales</button>
                </>
              )}
              {roundStatus === 'FINAL' && (
                 <button onClick={onLeave} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-md">Cerrar Sala</button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl space-y-6 animate-in fade-in duration-500">
      {roundStatus === 'CONFIG' && (
        <div className="bg-white border border-slate-200 rounded-[40px] p-12 text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900">Esperando configuración...</h2>
          <p className="text-slate-500">El Host está preparando la ronda.</p>
        </div>
      )}

      {roundStatus === 'ACTIVE' && (
        <div onClick={() => handleTap()} className="relative h-[400px] bg-white border-4 border-slate-100 hover:border-indigo-100 rounded-[60px] cursor-pointer flex flex-col items-center justify-center overflow-hidden transition-all duration-300 shadow-xl shadow-slate-200/50">
          <div className={`absolute inset-0 bg-indigo-50 transition-opacity duration-150 pointer-events-none ${Date.now() - lastLocalTap < 100 ? 'opacity-100' : 'opacity-0'}`}></div>
          <div className="absolute top-8 flex justify-between w-full px-12">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Tiempo: {timer}s</span>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Objetivo: {targetBpm}</span>
          </div>
          <div className="text-center space-y-2">
            <span className="text-9xl font-black text-slate-900 leading-none mono tracking-tighter">
              {localBpm}
            </span>
            <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Tu BPM actual</p>
          </div>
          
          <button 
            onClick={handleReset}
            className="absolute bottom-8 right-8 bg-slate-50 hover:bg-slate-100 text-slate-400 p-3 rounded-2xl border border-slate-200 transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      )}

      {(roundStatus === 'RESULTS_BPM' || roundStatus === 'RESULTS_SCORES' || roundStatus === 'FINAL') && (
        <div className="bg-white border border-slate-200 rounded-[40px] p-8 space-y-6 shadow-xl">
          <div className="text-center">
             <h2 className="text-2xl font-black text-slate-900">
               {roundStatus === 'FINAL' ? 'Resultados Finales' : 'Resultados de Ronda'}
             </h2>
             <p className="text-xs font-bold text-slate-400 mt-1">Objetivo: {targetBpm} BPM</p>
          </div>
          <Leaderboard players={players} targetBpm={targetBpm} mode={roundStatus === 'RESULTS_BPM' ? 'BPM' : (roundStatus === 'FINAL' ? 'TOTAL' : 'ROUND')} />
          {roundStatus === 'FINAL' && (
            <button onClick={onLeave} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl mt-4 transition-all">Regresar al Lobby</button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameRoom;
