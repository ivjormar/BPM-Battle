
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, PeerMessage, GameStatus, RoundStatus } from './types';
import Lobby from './components/Lobby';
import GameRoom from './components/GameRoom';

declare var Peer: any;

const App: React.FC = () => {
  const [nickname, setNickname] = useState<string>(localStorage.getItem('bpm-nick') || '');
  const [status, setStatus] = useState<GameStatus>('LOBBY');
  const [roundStatus, setRoundStatus] = useState<RoundStatus>('CONFIG');
  const [peer, setPeer] = useState<any>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [targetBpm, setTargetBpm] = useState(120);
  const [roundDuration, setRoundDuration] = useState(15);
  const [timer, setTimer] = useState(0);
  const [lastLocalTap, setLastLocalTap] = useState(0);

  const connectionsRef = useRef<Map<string, any>>(new Map());
  const playersRef = useRef<Player[]>([]);
  const timerIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const broadcast = useCallback((msg: PeerMessage) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }, []);

  const handleMessage = useCallback((msg: PeerMessage) => {
    switch (msg.type) {
      case 'STATE_UPDATE':
        setPlayers(msg.payload.players);
        setTargetBpm(msg.payload.targetBpm);
        setStatus(msg.payload.status);
        setRoundStatus(msg.payload.roundStatus);
        setRoundDuration(msg.payload.roundDuration);
        setTimer(msg.payload.timer);
        break;
      case 'PLAYER_STAT_UPDATE':
        if (isHost) {
          const playerExists = playersRef.current.some(p => p.id === msg.senderId);
          let updatedPlayers;
          
          if (playerExists) {
            updatedPlayers = playersRef.current.map(p => 
              p.id === msg.senderId ? { ...p, ...msg.payload } : p
            );
          } else {
            const newPlayer: Player = {
              id: msg.senderId,
              nickname: msg.payload.nickname || 'Anónimo',
              bpm: 0, accuracy: 0, lastTap: 0, isHost: false, totalScore: 0, roundScore: 0
            };
            updatedPlayers = [...playersRef.current, newPlayer];
          }
          
          setPlayers(updatedPlayers);
          broadcast({ 
            type: 'STATE_UPDATE', 
            payload: { players: updatedPlayers, targetBpm, status, roundStatus, roundDuration, timer },
            senderId: peerId 
          });
        }
        break;
      case 'TAP_EVENT':
        setPlayers(prev => prev.map(p => 
          p.id === msg.senderId ? { ...p, lastTap: Date.now() } : p
        ));
        break;
    }
  }, [isHost, peerId, targetBpm, status, roundStatus, roundDuration, timer, broadcast]);

  const setupPeer = (id: string) => {
    const p = new Peer(id);
    p.on('open', (id: string) => setPeerId(id));
    p.on('connection', (conn: any) => {
      conn.on('open', () => {
        connectionsRef.current.set(conn.peer, conn);
      });
      conn.on('data', (data: PeerMessage) => handleMessage(data));
      conn.on('close', () => {
        if (isHost) {
          const filtered = playersRef.current.filter(p => p.id !== conn.peer);
          setPlayers(filtered);
          broadcast({ type: 'STATE_UPDATE', payload: { players: filtered, targetBpm, status, roundStatus, roundDuration, timer }, senderId: peerId });
        }
      });
    });
    setPeer(p);
    return p;
  };

  const createGame = (nick: string) => {
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(true);
    const hostId = `bpm-${Math.random().toString(36).substring(2, 9)}`;
    setRoomId(hostId);
    setupPeer(hostId);
    setPlayers([]);
    setStatus('ROOM');
    window.location.hash = hostId;
  };

  const joinGame = (nick: string, targetRoomId: string) => {
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(false);
    setRoomId(targetRoomId);
    const p = setupPeer(`bpm-client-${Math.random().toString(36).substring(2, 9)}`);
    p.on('open', (myId: string) => {
      const conn = p.connect(targetRoomId);
      conn.on('open', () => {
        connectionsRef.current.set(targetRoomId, conn);
        conn.send({ type: 'PLAYER_STAT_UPDATE', payload: { nickname: nick }, senderId: myId });
      });
      conn.on('data', (data: PeerMessage) => handleMessage(data));
      conn.on('close', () => leaveGame());
    });
    setStatus('ROOM');
  };

  const leaveGame = () => {
    if (peer) peer.destroy();
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    connectionsRef.current.clear();
    setPeer(null);
    setPeerId('');
    setRoomId('');
    setStatus('LOBBY');
    setRoundStatus('CONFIG');
    setPlayers([]);
    setIsHost(false);
    window.location.hash = '';
  };

  const startGameSession = () => {
    if (!isHost) return;
    setStatus('PLAYING');
    setRoundStatus('CONFIG');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'CONFIG', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const startRound = (duration: number, target: number) => {
    if (!isHost) return;
    setTargetBpm(target);
    setRoundDuration(duration);
    setTimer(duration);
    
    const resetPlayers = playersRef.current.map(p => ({ ...p, bpm: 0, roundScore: 0 }));
    setPlayers(resetPlayers);
    setRoundStatus('ACTIVE');

    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: resetPlayers, targetBpm: target, status: 'PLAYING', roundStatus: 'ACTIVE', roundDuration: duration, timer: duration },
      senderId: peerId 
    });

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          endRound();
          return 0;
        }
        const nextTime = prev - 1;
        broadcast({ 
          type: 'STATE_UPDATE', 
          payload: { players: playersRef.current, targetBpm: target, status: 'PLAYING', roundStatus: 'ACTIVE', roundDuration: duration, timer: nextTime },
          senderId: peerId 
        });
        return nextTime;
      });
    }, 1000);
  };

  const endRound = () => {
    setRoundStatus('RESULTS_BPM');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_BPM', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const showScores = () => {
    const scoredPlayers = playersRef.current.map(p => {
      const diff = Math.abs(p.bpm - targetBpm);
      let points = 0;
      if (diff === 0) points = 3;
      else if (diff <= 1) points = 2;
      else if (diff <= 2) points = 1;
      
      return {
        ...p,
        roundScore: points,
        totalScore: p.totalScore + points
      };
    });
    setPlayers(scoredPlayers);
    setRoundStatus('RESULTS_SCORES');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: scoredPlayers, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_SCORES', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const showFinalStandings = () => {
    setRoundStatus('FINAL');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'FINAL', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const nextRoundConfig = () => {
    setRoundStatus('CONFIG');
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'CONFIG', roundDuration, timer: 0 },
      senderId: peerId 
    });
  };

  const updateMyStats = (bpm: number) => {
    const hostConn = connectionsRef.current.get(roomId);
    if (hostConn) {
      hostConn.send({ type: 'PLAYER_STAT_UPDATE', payload: { bpm }, senderId: peerId });
    }
  };

  const sendLocalTap = () => {
    setLastLocalTap(Date.now());
    broadcast({ type: 'TAP_EVENT', payload: {}, senderId: peerId });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {status === 'LOBBY' ? (
        <Lobby initialNickname={nickname} initialRoomId={roomId} onCreate={createGame} onJoin={joinGame} />
      ) : (
        <GameRoom 
          peerId={peerId} roomId={roomId} isHost={isHost} players={players} status={status} 
          roundStatus={roundStatus} targetBpm={targetBpm} timer={timer}
          onStartSession={startGameSession} onStartRound={startRound} onShowScores={showScores} 
          onShowFinal={showFinalStandings} onNextRound={nextRoundConfig} onStatUpdate={updateMyStats} 
          onTap={sendLocalTap} onLeave={leaveGame} lastLocalTap={lastLocalTap} nickname={nickname}
        />
      )}
    </div>
  );
};

export default App;