
export interface Player {
  id: string;
  nickname: string;
  bpm: number;
  accuracy: number;
  lastTap: number;
  isHost: boolean;
  totalScore: number;
  roundScore: number;
}

export type GameStatus = 'LOBBY' | 'ROOM' | 'PLAYING';
export type RoundStatus = 'CONFIG' | 'ACTIVE' | 'RESULTS_BPM' | 'RESULTS_SCORES' | 'FINAL';

export interface GameState {
  targetBpm: number;
  players: Player[];
  status: GameStatus;
  roundStatus: RoundStatus;
  roundDuration: number;
  timer: number;
}

export type MessageType = 
  | 'PLAYER_JOIN_REQUEST'
  | 'PLAYER_JOIN_RESPONSE'
  | 'STATE_UPDATE' 
  | 'TAP_EVENT' 
  | 'PLAYER_STAT_UPDATE'
  | 'START_GAME'
  | 'RESET_GAME'
  | 'START_ROUND'
  | 'END_ROUND'
  | 'SHOW_SCORES'
  | 'SHOW_FINAL'
  | 'ROOM_CLOSED';

export interface PeerMessage {
  type: MessageType;
  payload: any;
  senderId: string;
}
