
import React from 'react';
import { Player } from '../types';

interface LeaderboardProps {
  players: Player[];
  targetBpm?: number;
  mode: 'BPM' | 'ROUND' | 'TOTAL';
}

const Leaderboard: React.FC<LeaderboardProps> = ({ players, targetBpm, mode }) => {
  const sortedPlayers = [...players].sort((a, b) => {
    if (mode === 'BPM' && targetBpm) {
      return Math.abs(a.bpm - targetBpm) - Math.abs(b.bpm - targetBpm);
    }
    if (mode === 'ROUND') return b.roundScore - a.roundScore;
    return b.totalScore - a.totalScore;
  });

  return (
    <div className="space-y-3">
      {sortedPlayers.length === 0 && (
        <p className="text-slate-500 text-sm italic text-center py-8">Esperando jugadores...</p>
      )}
      {sortedPlayers.map((player, idx) => {
        const diff = targetBpm ? Math.abs(player.bpm - targetBpm) : 0;
        
        return (
          <div 
            key={player.id} 
            className="flex items-center justify-between p-5 rounded-2xl bg-slate-950/50 border border-slate-800"
          >
            <div className="flex items-center gap-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-yellow-500 text-yellow-950' : 'bg-slate-800 text-slate-400'}`}>
                {idx + 1}
              </div>
              <div>
                <span className="font-bold text-slate-200 block">{player.nickname}</span>
                {mode === 'BPM' && (
                  <span className={`text-[10px] font-bold uppercase ${diff === 0 ? 'text-green-400' : diff <= 2 ? 'text-yellow-400' : 'text-slate-500'}`}>
                    Diferencia: {diff}
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              {mode === 'BPM' ? (
                <span className="text-2xl font-black mono text-white">
                  {player.bpm} <span className="text-[10px] text-slate-600">BPM</span>
                </span>
              ) : mode === 'ROUND' ? (
                <span className="text-2xl font-black mono text-indigo-400">
                  +{player.roundScore} <span className="text-[10px] text-slate-600">PTS</span>
                </span>
              ) : (
                <span className="text-2xl font-black mono text-white">
                  {player.totalScore} <span className="text-[10px] text-slate-600">TOTAL</span>
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
