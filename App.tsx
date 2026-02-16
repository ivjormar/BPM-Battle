
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
  const [pendingPlayers, setPendingPlayers] = useState<{id: string, nickname: string}[]>([]);
  const [targetBpm, setTargetBpm] = useState(120);
  const [roundDuration, setRoundDuration] = useState(15);
  const [timer, setTimer] = useState(0);
  const [lastLocalTap, setLastLocalTap] = useState(0);
  const [joinError, setJoinError] = useState<string | null>(null);

  const connectionsRef = useRef<Map<string, any>>(new Map());
  const playersRef = useRef<Player[]>([]);
  const stateRef = useRef({ status, roundStatus, targetBpm, roundDuration, timer });

  // Sync refs for stable message handling
  useEffect(() => {
    playersRef.current = players;
    stateRef.current = { status, roundStatus, targetBpm, roundDuration, timer };
  }, [players, status, roundStatus, targetBpm, roundDuration, timer]);

  const broadcast = useCallback((msg: PeerMessage) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) conn.send(msg);
    });
  }, []);

  const handleMessage = useCallback((msg: PeerMessage) => {
    console.log("Mensaje recibido:", msg.type, msg.payload);
    const { status, roundStatus, targetBpm, roundDuration, timer } = stateRef.current;

    switch (msg.type) {
      case 'PLAYER_JOIN_REQUEST':
        setPendingPlayers(prev => {
          if (prev.find(p => p.id === msg.senderId)) return prev;
          return [...prev, { id: msg.senderId, nickname: msg.payload.nickname }];
        });
        break;

      case 'PLAYER_JOIN_RESPONSE':
        if (msg.payload.accepted) {
          setStatus('ROOM');
          setJoinError(null);
        } else {
          setJoinError(msg.payload.message || 'Entrada denegada.');
          setTimeout(() => leaveGame(), 2000);
        }
        break;

      case 'STATE_UPDATE':
        setPlayers(msg.payload.players);
        setTargetBpm(msg.payload.targetBpm);
        setStatus(msg.payload.status);
        setRoundStatus(msg.payload.roundStatus);
        setRoundDuration(msg.payload.roundDuration);
        setTimer(msg.payload.timer);
        break;

      case 'PLAYER_STAT_UPDATE':
        const updatedPlayers = playersRef.current.map(p => 
          p.id === msg.senderId ? { ...p, ...msg.payload } : p
        );
        setPlayers(updatedPlayers);
        if (isHost) {
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
  }, [isHost, peerId, broadcast]);

  const setupPeer = (id: string, isHostRole: boolean) => {
    if (peer) peer.destroy();
    
    const p = new Peer(id);
    
    p.on('open', (newId: string) => {
      setPeerId(newId);
    });

    p.on('connection', (conn: any) => {
      conn.on('open', () => {
        connectionsRef.current.set(conn.peer, conn);
      });
      conn.on('data', (data: PeerMessage) => handleMessage(data));
      conn.on('close', () => {
        setPendingPlayers(prev => prev.filter(p => p.id !== conn.peer));
        const filtered = playersRef.current.filter(p => p.id !== conn.peer);
        setPlayers(filtered);
        if (isHostRole) {
          const { targetBpm, status, roundStatus, roundDuration, timer } = stateRef.current;
          broadcast({ type: 'STATE_UPDATE', payload: { players: filtered, targetBpm, status, roundStatus, roundDuration, timer }, senderId: id });
        }
      });
    });

    p.on('error', (err: any) => {
      console.error("PeerJS Error:", err.type);
      if (err.type === 'peer-unavailable') {
        setJoinError("La sala no existe o el ID es incorrecto.");
      }
    });

    setPeer(p);
    return p;
  };

  const createGame = (nick: string) => {
    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(true);
    const hostId = `bpm-${Math.random().toString(36).substring(2, 8)}`;
    setRoomId(hostId);
    setupPeer(hostId, true);
    setPlayers([{ id: hostId, nickname: nick, bpm: 0, accuracy: 0, lastTap: 0, isHost: true, totalScore: 0, roundScore: 0 }]);
    setStatus('ROOM');
    window.location.hash = hostId;
  };

  const joinGame = (nick: string, targetRoomId: string) => {
    // Normalizar ID
    let normalized = targetRoomId.trim().toLowerCase();
    if (!normalized.startsWith('bpm-')) normalized = 'bpm-' + normalized;

    setNickname(nick);
    localStorage.setItem('bpm-nick', nick);
    setIsHost(false);
    setRoomId(normalized);
    setJoinError('Solicitando entrada al Host...');

    const myId = `bpm-client-${Math.random().toString(36).substring(2, 8)}`;
    const p = setupPeer(myId, false);

    p.on('open', () => {
      const conn = p.connect(normalized, { reliable: true });
      conn.on('open', () => {
        connectionsRef.current.set(normalized, conn);
        conn.send({ type: 'PLAYER_JOIN_REQUEST', payload: { nickname: nick }, senderId: myId });
      });
      conn.on('data', (data: PeerMessage) => handleMessage(data));
      conn.on('close', () => leaveGame());
    });
  };

  const acceptPlayer = (requestId: string) => {
    const pending = pendingPlayers.find(p => p.id === requestId);
    if (!pending) return;

    const newPlayer: Player = {
      id: pending.id,
      nickname: pending.nickname,
      bpm: 0, accuracy: 0, lastTap: 0, isHost: false, totalScore: 0, roundScore: 0
    };

    const updatedPlayers = [...playersRef.current, newPlayer];
    setPlayers(updatedPlayers);
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));

    const conn = connectionsRef.current.get(requestId);
    if (conn) {
      conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: true }, senderId: peerId });
    }

    const { targetBpm, status, roundStatus, roundDuration, timer } = stateRef.current;
    broadcast({ 
      type: 'STATE_UPDATE', 
      payload: { players: updatedPlayers, targetBpm, status, roundStatus, roundDuration, timer },
      senderId: peerId 
    });
  };

  const rejectPlayer = (requestId: string) => {
    const conn = connectionsRef.current.get(requestId);
    if (conn) {
      conn.send({ type: 'PLAYER_JOIN_RESPONSE', payload: { accepted: false, message: 'El host ha rechazado tu entrada.' }, senderId: peerId });
      setTimeout(() => conn.close(), 500);
    }
    setPendingPlayers(prev => prev.filter(p => p.id !== requestId));
  };

  const leaveGame = () => {
    if (peer) peer.destroy();
    connectionsRef.current.clear();
    setPeer(null);
    setPeerId('');
    setRoomId('');
    setStatus('LOBBY');
    setPlayers([]);
    setPendingPlayers([]);
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

    const interval = window.setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
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
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_BPM', roundDuration, timer: 0 }, senderId: peerId });
  };

  const showScores = () => {
    const scoredPlayers = playersRef.current.map(p => {
      const diff = Math.abs(p.bpm - targetBpm);
      let points = 0;
      if (diff === 0) points = 3;
      else if (diff <= 1) points = 2;
      else if (diff <= 2) points = 1;
      return { ...p, roundScore: points, totalScore: p.totalScore + points };
    });
    setPlayers(scoredPlayers);
    setRoundStatus('RESULTS_SCORES');
    broadcast({ type: 'STATE_UPDATE', payload: { players: scoredPlayers, targetBpm, status: 'PLAYING', roundStatus: 'RESULTS_SCORES', roundDuration, timer: 0 }, senderId: peerId });
  };

  const showFinalStandings = () => {
    setRoundStatus('FINAL');
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'FINAL', roundDuration, timer: 0 }, senderId: peerId });
  };

  const nextRoundConfig = () => {
    setRoundStatus('CONFIG');
    broadcast({ type: 'STATE_UPDATE', payload: { players: playersRef.current, targetBpm, status: 'PLAYING', roundStatus: 'CONFIG', roundDuration, timer: 0 }, senderId: peerId });
  };

  const updateMyStats = (bpm: number) => {
    if (isHost) {
      const updated = playersRef.current.map(p => p.id === peerId ? { ...p, bpm } : p);
      setPlayers(updated);
      const { status, roundStatus, targetBpm, roundDuration, timer } = stateRef.current;
      broadcast({ type: 'STATE_UPDATE', payload: { players: updated, targetBpm, status, roundStatus, roundDuration, timer }, senderId: peerId });
    } else {
      const hostConn = connectionsRef.current.get(roomId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'PLAYER_STAT_UPDATE', payload: { bpm }, senderId: peerId });
      }
    }
  };

  const sendLocalTap = () => {
    setLastLocalTap(Date.now());
    if (!isHost) {
      const hostConn = connectionsRef.current.get(roomId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: 'TAP_EVENT', payload: {}, senderId: peerId });
      }
    } else {
      broadcast({ type: 'TAP_EVENT', payload: {}, senderId: peerId });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {status === 'LOBBY' ? (
        <div className="flex flex-col items-center">
          <Lobby initialNickname={nickname} initialRoomId={roomId} onCreate={createGame} onJoin={joinGame} />
          {joinError && (
            <div className="mt-6 bg-indigo-50 border border-indigo-100 px-6 py-3 rounded-2xl animate-pulse">
              <p className="text-indigo-600 font-bold text-sm">{joinError}</p>
            </div>
          )}
        </div>
      ) : (
        <GameRoom 
          peerId={peerId} roomId={roomId} isHost={isHost} players={players} status={status} 
          roundStatus={roundStatus} targetBpm={targetBpm} timer={timer}
          pendingPlayers={pendingPlayers} onAccept={acceptPlayer} onReject={rejectPlayer}
          onStartSession={startGameSession} onStartRound={startRound} onShowScores={showScores} 
          onShowFinal={showFinalStandings} onNextRound={nextRoundConfig} onStatUpdate={updateMyStats} 
          onTap={sendLocalTap} onLeave={leaveGame} lastLocalTap={lastLocalTap} nickname={nickname}
        />
      )}
    </div>
  );
};

export default App;
