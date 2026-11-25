import { PieceType } from '../engine/types';

export type GuideTopicId =
  | 'basics'
  | 'pieces'
  | 'promotion'
  | 'drops-rules'
  | 'tutorial-tips';

export interface GuideTopicMeta {
  id: GuideTopicId;
  badge: string;
  title: string;
  subtitle: string;
}

export const GUIDE_TOPICS: GuideTopicMeta[] = [
  {
    id: 'basics',
    badge: 'Bab 1',
    title: 'Pengenalan & Dasar Shogi',
    subtitle: 'Papan 9×9, Sente vs Gote, Koordinat & 3 Fase',
  },
  {
    id: 'pieces',
    badge: 'Bab 2',
    title: 'Gerakan 8 Bidak & Promosi',
    subtitle: 'Diagram langkah tiap bidak normal & promosi',
  },
  {
    id: 'promotion',
    badge: 'Bab 3',
    title: 'Aturan Promosi (Nari)',
    subtitle: 'Zona promosi 3 baris, syarat & promosi wajib',
  },
  {
    id: 'drops-rules',
    badge: 'Bab 4',
    title: 'Aturan Drop & 3 Larangan',
    subtitle: 'Mochigoma, Nifu, Uchifuzume & Kinjite',
  },
  {
    id: 'tutorial-tips',
    badge: 'Bab 5',
    title: 'Tutorial Puzzle, Tips & Glosarium',
    subtitle: 'Cara main Tsume-Shogi, 5 tips emas & istilah',
  },
];

// 5x5 movement diagram legend:
// '.' = empty, 'C' = piece center, 'S' = 1-square step, 'R' = sliding ray, 'J' = knight jump
export interface PieceGuideEntry {
  type: PieceType;
  promotedType?: PieceType;
  nameId: string;
  nameJp: string;
  kanji: string;
  promotedNameId?: string;
  promotedKanji?: string;
  valuePoints: string;
  summary: string;
  promotedSummary?: string;
  normalGrid: string[];
  promotedGrid?: string[];
}

export const PIECE_GUIDE_LIST: PieceGuideEntry[] = [
  {
    type: 'K',
    nameId: 'Raja (King)',
    nameJp: 'Ōshō / Gyokushō',
    kanji: '玉 / 王',
    valuePoints: '∞ (Kunci Kemenangan)',
    summary:
      'Bergerak 1 petak ke segala arah (8 arah). Tidak bisa promosi. Jika Raja tidak dapat menghindar dari ancaman (skakmat / Tsumi), permainan berakhir.',
    normalGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '.SSS.',
      '.....',
    ],
  },
  {
    type: 'R',
    promotedType: '+R',
    nameId: 'Benteng (Rook)',
    nameJp: 'Hisha',
    kanji: '飛',
    promotedNameId: 'Naga (Dragon King / Ryū)',
    promotedKanji: '龍',
    valuePoints: '10 poin (Bidak Terkuat)',
    summary:
      'Meluncur sejauh mungkin secara vertikal (atas-bawah) atau horizontal (kiri-kanan) selama tidak terhalang.',
    promotedSummary:
      'Tetap meluncur vertikal/horizontal + mendapat tambahan langkah 1 petak ke 4 arah diagonal. Sangat mematikan di area Raja lawan!',
    normalGrid: [
      '..R..',
      '..R..',
      'RRCRR',
      '..R..',
      '..R..',
    ],
    promotedGrid: [
      '..R..',
      '.SRS.',
      'RRCRR',
      '.SRS.',
      '..R..',
    ],
  },
  {
    type: 'B',
    promotedType: '+B',
    nameId: 'Gajah (Bishop)',
    nameJp: 'Kaku',
    kanji: '角',
    promotedNameId: 'Kuda Naga (Horse / Uma)',
    promotedKanji: '馬',
    valuePoints: '9 poin',
    summary:
      'Meluncur sejauh mungkin ke 4 arah diagonal. Sangat kuat untuk mengontrol pusat dan menembus dari jarak jauh.',
    promotedSummary:
      'Tetap meluncur diagonal + mendapat tambahan langkah 1 petak ke atas, bawah, kiri, dan kanan. Sangat tangguh untuk menyerang sekaligus bertahan.',
    normalGrid: [
      'R...R',
      '.R.R.',
      '..C..',
      '.R.R.',
      'R...R',
    ],
    promotedGrid: [
      'R...R',
      '.RSR.',
      '.SCS.',
      '.RSR.',
      'R...R',
    ],
  },
  {
    type: 'G',
    nameId: 'Jenderal Emas (Gold)',
    nameJp: 'Kinshō',
    kanji: '金',
    valuePoints: '6 poin',
    summary:
      'Bergerak 1 petak ke 6 arah: depan, serong depan (kiri/kanan), samping (kiri/kanan), dan lurus belakang. Tidak bisa mundur diagonal & tidak bisa promosi. Bidak andalan untuk benteng pertahanan dan skakmat!',
    normalGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '..S..',
      '.....',
    ],
  },
  {
    type: 'S',
    promotedType: '+S',
    nameId: 'Jenderal Perak (Silver)',
    nameJp: 'Ginshō',
    kanji: '銀',
    promotedNameId: 'Perak Promosi (Narigin)',
    promotedKanji: '全',
    valuePoints: '5 poin',
    summary:
      'Bergerak 1 petak ke 5 arah: lurus depan dan keempat arah diagonal. Lincah untuk menyerang maju & mundur diagonal.',
    promotedSummary:
      'Saat promosi, bergerak persis seperti Jenderal Emas (6 arah). Kadang Perak sengaja TIDAK dipromosikan agar tetap bisa mundur diagonal.',
    normalGrid: [
      '.....',
      '.SSS.',
      '..C..',
      '.S.S.',
      '.....',
    ],
    promotedGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '..S..',
      '.....',
    ],
  },
  {
    type: 'N',
    promotedType: '+N',
    nameId: 'Kuda (Knight)',
    nameJp: 'Keima',
    kanji: '桂',
    promotedNameId: 'Kuda Promosi (Narikei)',
    promotedKanji: '圭',
    valuePoints: '4 poin',
    summary:
      'Satu-satunya bidak yang bisa melompati bidak lain! Melompat 2 petak ke depan lalu 1 petak ke kiri atau kanan (hanya ke depan, tidak bisa mundur).',
    promotedSummary:
      'Saat promosi, kehilangan kemampuan lompat tetapi bergerak persis seperti Jenderal Emas (6 arah).',
    normalGrid: [
      '.J.J.',
      '.....',
      '..C..',
      '.....',
      '.....',
    ],
    promotedGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '..S..',
      '.....',
    ],
  },
  {
    type: 'L',
    promotedType: '+L',
    nameId: 'Tombak (Lance)',
    nameJp: 'Kyōsha',
    kanji: '香',
    promotedNameId: 'Tombak Promosi (Narikyō)',
    promotedKanji: '杏',
    valuePoints: '4 poin',
    summary:
      'Meluncur lurus ke depan sejauh mungkin tanpa batas selama jalur kosong. Tidak bisa mundur atau ke samping.',
    promotedSummary:
      'Saat promosi, bergerak persis seperti Jenderal Emas (6 arah).',
    normalGrid: [
      '..R..',
      '..R..',
      '..C..',
      '.....',
      '.....',
    ],
    promotedGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '..S..',
      '.....',
    ],
  },
  {
    type: 'P',
    promotedType: '+P',
    nameId: 'Pion (Pawn)',
    nameJp: 'Fuhyō',
    kanji: '歩',
    promotedNameId: 'Tokin (Pion Promosi)',
    promotedKanji: 'と',
    valuePoints: '1 poin (Tokin ≈ 6 poin!)',
    summary:
      'Bergerak dan menangkap 1 petak lurus ke depan saja (berbeda dengan Catur Barat yang menangkap diagonal!).',
    promotedSummary:
      'Menjadi Tokin yang bergerak persis seperti Jenderal Emas! Jika tertangkap lawan hanya kembali menjadi 1 Pion biasa — senjata paling efisien di Shogi.',
    normalGrid: [
      '.....',
      '..S..',
      '..C..',
      '.....',
      '.....',
    ],
    promotedGrid: [
      '.....',
      '.SSS.',
      '.SCS.',
      '..S..',
      '.....',
    ],
  },
];

export interface GlossaryItem {
  term: string;
  jp: string;
  meaning: string;
}

export const SHOGI_GLOSSARY: GlossaryItem[] = [
  {
    term: 'Sente (▲)',
    jp: '先手',
    meaning: 'Pemain yang jalan pertama (bidak menghadap ke atas, ikon segitiga hitam ▲).',
  },
  {
    term: 'Gote (△)',
    jp: '後手',
    meaning: 'Pemain yang jalan kedua (bidak menghadap ke bawah, ikon segitiga putih △).',
  },
  {
    term: 'Mochigoma / Komadai',
    jp: '持ち駒 / 駒台',
    meaning: 'Bidak hasil tangkapan yang disimpan di samping papan dan bisa dijatuhkan kembali sebagai milik Anda.',
  },
  {
    term: 'Nari (Promosi)',
    jp: '成り',
    meaning: 'Membalik bidak ke sisi merah saat masuk/bergerak/keluar dari 3 baris wilayah lawan.',
  },
  {
    term: 'Nifu (Larangan)',
    jp: '二歩',
    meaning: 'Pelanggaran menaruh 2 Pion belum promosi milik sendiri dalam satu kolom vertikal yang sama.',
  },
  {
    term: 'Uchifuzume (Larangan)',
    jp: '打ち歩詰め',
    meaning: 'Pelanggaran melakukan skakmat langsung dengan menjatuhkan (drop) Pion di depan Raja lawan.',
  },
  {
    term: 'Ōte (Skak)',
    jp: '王手',
    meaning: 'Ancaman langsung terhadap Raja lawan. Lawan wajib menyelamatkan Rajanya di langkah berikutnya.',
  },
  {
    term: 'Tsume-Shogi',
    jp: '詰将棋',
    meaning: 'Puzzle skakmat beruntun: setiap langkah penyerang harus berupa skak (Ōte) hingga skakmat.',
  },
  {
    term: 'Hisshi (Brinkmate)',
    jp: '必至',
    meaning: 'Langkah tenang (bukan skak) yang mengunci semua jalur kabur sehingga lawan pasti kena skakmat giliran berikutnya.',
  },
  {
    term: 'Kakoi (Benteng)',
    jp: '囲い',
    meaning: 'Formasi pertahanan di sekitar Raja memakai Emas & Perak (contoh: Mino, Yagura, Anaguma).',
  },
  {
    term: 'Joseki',
    jp: '定跡',
    meaning: 'Urutan langkah pembukaan standar yang sudah teruji secara teori (dipelajari di menu Repertoire).',
  },
  {
    term: 'Byoyomi',
    jp: '秒読み',
    meaning: 'Hitungan mundur detik per langkah setelah waktu utama habis (misal 30–45 detik per langkah).',
  },
];
