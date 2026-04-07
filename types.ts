
export enum Position {
  FW = 'FW',
  MF = 'MF',
  DF = 'DF',
  GK = 'GK'
}

export enum ClubRole {
  CHAIRMAN = '회장',
  MANAGER = '감독',
  COACH = '코치',
  SECRETARY_GENERAL = '사무국장',
  ASSISTANT_SECRETARY = '사무차장',
  MEMBER = '회원'
}

export enum FormationType {
  F442 = '4-4-2',
  F433 = '4-3-3',
  F352 = '3-5-2',
  F343 = '3-4-3'
}

export interface Member {
  id: string;
  name: string;
  phone: string;
  position: Position;
  clubRole: ClubRole;
  photo?: string;
}

export interface MatchRecord {
  memberId: string;
  name?: string;
  goals: number;
  assists: number;
  ownGoals: number;
  isMvp: boolean;
}

export interface Match {
  id: string;
  date: string;
  category: string;
  venue: string;
  teamA: string[]; // member IDs
  teamB: string[]; // member IDs
  scoreA: number;
  scoreB: number;
  records: MatchRecord[];
  photo?: string;
  memo?: string; // 경기 메모 필드 추가
}

export interface PersonalStats {
  memberId: string;
  name: string;
  goals: number;
  assists: number;
  ownGoals: number;
  mvpCount: number;
  wins: number;
  draws: number;
  losses: number;
  winsA: number;
  drawsA: number;
  lossesA: number;
  winsB: number;
  drawsB: number;
  lossesB: number;
  points: number; // 3 for win, 1 for draw
  appearances: number; // 출전수 추가
}
