
import React from 'react';
import { Player } from '../types';

interface LeaderboardProps {
  players: Player[];
  targetBpm?: number;
  mode: 'BPM' | 'ROUND' | 'TOTAL';
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, targetBpm, mode }) => {
  // El Host nunca puntúa ni aparece en las clasificaciones
  const competingPlayers = players.filter(p => !p.isHost);

  const sortedPlayers = [...competingPlayers].sort((a, b) => {
    if (mode === 'BPM' && targetBpm) {
      return Math.abs(a.bpm - targetBpm) - Math.abs(b.bpm - targetBpm);
    }
    if (mode === 'ROUND') return b.roundScore - a.roundScore;
    return b.totalScore - a.totalScore;
  });

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
          {mode === 'BPM' ? 'Puntuación BPM' : mode === 'ROUND' ? 'Puntos Ronda' : 'Clasificación Total'}
        </h3>
      </div>
      
      {sortedPlayers.length === 0 && (
        <p className="text-slate-400 text-sm italic text-center py-8">Esperando datos de jugadores...</p>
      )}
      
      {sortedPlayers.map((player, idx) => {
        const diff = targetBpm ? Math.abs(player.bpm - targetBpm) : 0;
        
        return (
          <div 
            key={player.id} 
            className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:border-indigo-100"
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {idx + 1}
              </div>
              <div>
                <span className="font-bold text-slate-800 block leading-tight">{player.nickname}</span>
                {mode === 'BPM' && (
                  <span className={`text-[10px] font-black uppercase tracking-tighter ${diff === 0 ? 'text-green-500' : diff <= 2 ? 'text-orange-400' : 'text-slate-300'}`}>
                    Error: {diff} BPM
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              {mode === 'BPM' ? (
                <span className="text-xl font-black mono text-slate-900">
                  {player.bpm} <span className="text-[10px] text-slate-400">BPM</span>
                </span>
              ) : mode === 'ROUND' ? (
                <span className="text-xl font-black mono text-indigo-600">
                  +{player.roundScore} <span className="text-[10px] text-slate-400">PTS</span>
                </span>
              ) : (
                <span className="text-xl font-black mono text-slate-900">
                  {player.totalScore} <span className="text-[10px] text-slate-400">TOTAL</span>
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Leaderboard;
