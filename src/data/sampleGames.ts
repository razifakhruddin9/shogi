export interface RecentGameRecord {
  id: string;
  title: string;
  senteName: string;
  senteElo: number;
  goteName: string;
  goteElo: number;
  result: '1-0' | '0-1' | '½-½' | '*';
  timeControl: string;
  dateLabel: string;
  movesUsi: string[];
  initialSfen?: string;
}

export const INITIAL_RECENT_GAMES: RecentGameRecord[] = [
  {
    id: 'sample-1',
    title: 'Yagura Classical Duel • Rapid 10+0',
    senteName: 'Sente_Studio',
    senteElo: 1580,
    goteName: 'KenshinBot',
    goteElo: 1600,
    result: '1-0',
    timeControl: '10+0',
    dateLabel: 'Today',
    movesUsi: [
      '7g7f',
      '8c8d',
      '7i6h',
      '3c3d',
      '6g6f',
      '7a6b',
      '5g5f',
      '5c5d',
      '4i4h',
      '4a3b',
      '6i7h',
      '6b5c',
      '2g2f',
      '8d8e',
      '8h7g',
      '3a4b',
    ],
  },
  {
    id: 'sample-2',
    title: 'Fourth-File Rook vs Static Rook',
    senteName: 'Akira_9Dan',
    senteElo: 1840,
    goteName: 'Sente_Studio',
    goteElo: 1580,
    result: '0-1',
    timeControl: '5+3',
    dateLabel: 'Yesterday',
    movesUsi: [
      '7g7f',
      '3c3d',
      '2g2f',
      '4c4d',
      '2f2e',
      '2b3c',
      '4i4h',
      '8b4b',
      '5i6h',
      '6a5b',
      '6h7h',
      '5a6b',
    ],
  },
  {
    id: 'sample-3',
    title: 'Bishop Exchange Tactical Clash',
    senteName: 'Sente_Studio',
    senteElo: 1575,
    goteName: 'MinoEngine',
    goteElo: 1450,
    result: '½-½',
    timeControl: '3+2',
    dateLabel: '2 days ago',
    movesUsi: [
      '7g7f',
      '8c8d',
      '2g2f',
      '8d8e',
      '8h7g',
      '3c3d',
      '7i8h',
      '2b7g+',
      '8h7g',
      '3a2b',
    ],
  },
];
