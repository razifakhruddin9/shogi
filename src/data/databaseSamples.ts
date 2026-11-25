import { ParsedDatabaseGame, parseDatabaseImport } from '../engine/kifuParser';

const SAMPLE_KIF = `開始日時：2026/05/12
棋戦：Meijin Title League (KIF)
先手：Habu_9Dan
後手：Fujii_Meijin
手合割：平手
1 ７六歩(77)
2 ３四歩(33)
3 ２六歩(27)
4 ８四歩(83)
5 ２五歩(26)
6 ８五歩(84)
7 ７八金(69)
8 ３二金(41)
9 ２四歩(25)
10 同　歩(23)
11 同　飛(28)
12 ８六歩(85)
13 同　歩(87)
14 同　飛(82)
15 投了`;

const SAMPLE_KI2 = `棋戦：Aigakari Classic (KI2)
先手：Watanabe
後手：Nagase
▲７六歩 △８四歩 ▲６八銀 △３四歩 ▲７七銀 △８五歩 ▲２六歩 △３二金 ▲２五歩 △３三角 ▲４八銀`;

const SAMPLE_CSA = `V2.2
N+Sato_Master
N-Toyoshima
$EVENT:Ryuo Qualifier (CSA)
$START_TIME:2026/04/18
PI
+
+7776FU
-3334FU
+8822UM
-3122GI
+0045KA
-5142OU
%TORYO`;

const SAMPLE_SFEN = `Tsume Endgame Study | 4k4/9/4P4/9/9/9/9/9/4K4 b G 1 moves G*5b
Yagura Middlegame | lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1 moves 7g7f 8c8d 7i6h 3c3d 6g6f`;

export function createSampleDatabaseGames(): ParsedDatabaseGame[] {
  return [
    ...parseDatabaseImport(SAMPLE_KIF, 'meijin_sample.kif', 'kif'),
    ...parseDatabaseImport(SAMPLE_KI2, 'aigakari_sample.ki2', 'ki2'),
    ...parseDatabaseImport(SAMPLE_CSA, 'ryuo_sample.csa', 'csa'),
    ...parseDatabaseImport(SAMPLE_SFEN, 'studies_sample.sfen', 'sfen'),
  ];
}
