export interface PuzzleLevelMeta {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  category: string;
  sublabel: string;
  cognitiveFocus: string;
  realWorldRelevance: string;
  byoyomiSeconds?: number;
}

export const PUZZLE_LEVELS: PuzzleLevelMeta[] = [
  {
    level: 1,
    category: '1-te & 3-te Tsume',
    sublabel: 'Skakmat 1–3 langkah',
    cognitiveFocus:
      'Pengenalan pola dasar skakmat dan penggunaan bidak drop (jatuhan) langsung di sekitar Raja lawan.',
    realWorldRelevance:
      'Eksekusi Dasar: Mengenali peluang penyelesaian langsung saat semua syarat sudah terpenuhi.',
  },
  {
    level: 2,
    category: '5-te Tsume',
    sublabel: 'Skakmat 5 langkah',
    cognitiveFocus:
      'Kalkulasi urutan langkah (move order) agar Raja lawan tidak punya ruang kabur ke samping atau atas.',
    realWorldRelevance:
      'Urutan Prioritas: Memahami bahwa melakukan aksi B sebelum aksi A membuat target lolos.',
  },
  {
    level: 3,
    category: '7-te Tsume',
    sublabel: 'Skakmat 7 langkah',
    cognitiveFocus:
      'Menggabungkan pengorbanan bidak untuk memancing Raja lawan keluar dari zona aman (luring).',
    realWorldRelevance:
      'Pengorbanan Terhitung: Melepas aset jangka pendek untuk membuka titik lemah utama lawan.',
  },
  {
    level: 4,
    category: 'Hisshi (Brinkmate)',
    sublabel: 'Ancaman skakmat mutlak',
    cognitiveFocus:
      'Berpikir melampaui skak langsung—menutup semua jalur pelarian terlebih dahulu agar serangan berikutnya tidak terbendung.',
    realWorldRelevance:
      'Pengepungan Sistemik: Mengunci semua opsi lawan sebelum melakukan langkah eksekusi akhir.',
  },
  {
    level: 5,
    category: '9-te hingga 11-te Tsume',
    sublabel: 'Skakmat 9–11 langkah',
    cognitiveFocus:
      'Visualisasi papan mental tanpa menggerakkan bidak dan memfilter langkah pertahanan terbaik lawan (defensive drops).',
    realWorldRelevance:
      'Simulasi Skenario: Memprediksi respons terkuat pihak lawan sebelum mengambil keputusan berisiko.',
  },
  {
    level: 6,
    category: '13-te+ Tsume & Endgame Race',
    sublabel: 'Kompleks & Tekanan Waktu',
    cognitiveFocus:
      'Kalkulasi cabang variasi dalam di bawah tekanan waktu (Byoyomi), termasuk menentukan apakah harus menyerang atau bertahan dulu.',
    realWorldRelevance:
      'Keputusan di Bawah Tekanan: Tetap jernih dan presisi saat menghadapi situasi kritis dengan waktu terbatas.',
    byoyomiSeconds: 45,
  },
];

export interface ShogiPuzzle {
  id: string;
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  theme: string;
  difficulty: 'Level 1' | 'Level 2' | 'Level 3' | 'Level 4' | 'Level 5' | 'Level 6';
  rating: number;
  movesToMate: number;
  sfen: string;
  solutionUsi: string[];
  hint: string;
}

export const SHOGI_PUZZLES: ShogiPuzzle[] = [
  {
    id: 'tsume-l1-1',
    level: 1,
    title: 'Level 1A • Kepala Emas (Atamakin)',
    theme: '1-te Tsume • Gold Drop',
    difficulty: 'Level 1',
    rating: 850,
    movesToMate: 1,
    sfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1',
    solutionUsi: ['G*5b'],
    hint: 'Jatuhkan Emas (G) tepat di petak 5b di depan Raja lawan yang dijaga oleh pion 5c.',
  },
  {
    id: 'tsume-l1-2',
    level: 1,
    title: 'Level 1B • Umpan Sudut 3 Langkah',
    theme: '3-te Tsume • Corner Lure & Dragon',
    difficulty: 'Level 1',
    rating: 1050,
    movesToMate: 3,
    sfen: '8k/5R2l/6S2/9/9/9/9/9/4K4 b G 1',
    solutionUsi: ['G*2a', '1a2a', '4b2b+'],
    hint: 'Drop Emas di 2a untuk memancing Raja ke 2a, lalu promosikan Benteng di 2b.',
  },
  {
    id: 'tsume-l2',
    level: 2,
    title: 'Level 2 • Move Order 5-te Tsume',
    theme: '5-te Tsume • Urutan Prioritas',
    difficulty: 'Level 2',
    rating: 1320,
    movesToMate: 5,
    sfen: '6nkl/6g2/7Pp/5B3/9/9/9/9/4K4 b GS 1',
    solutionUsi: ['S*1b', '2a1b', 'G*2b', '3b2b', '4d2b+'],
    hint: 'Mulai dengan S*1b agar Raja tertarik ke 1b (2b dijaga Gajah 4d), lalu tekan G*2b diikuti 4d2b+.',
  },
  {
    id: 'tsume-l3',
    level: 3,
    title: 'Level 3 • Koridor Tombak 7-te Tsume',
    theme: '7-te Tsume • Pengorbanan & Luring',
    difficulty: 'Level 3',
    rating: 1540,
    movesToMate: 7,
    sfen: '4l3k/9/4PPPPP/9/9/9/9/9/4K4 b 3LG 1',
    solutionUsi: ['L*1b', '1a2a', 'L*2b', '2a3a', 'L*3b', '3a4a', 'G*4b'],
    hint: 'Giring Raja lawan menyusuri baris atas memakai 3 Tombak (L*1b → L*2b → L*3b) lalu kunci dengan G*4b.',
  },
  {
    id: 'tsume-l4',
    level: 4,
    title: 'Level 4 • Hisshi (Brinkmate)',
    theme: 'Hisshi • Ancaman Skakmat Mutlak',
    difficulty: 'Level 4',
    rating: 1720,
    movesToMate: 3,
    sfen: '3gkg3/3s1n3/1B2P4/9/9/9/9/9/4K4 b 2G 1',
    solutionUsi: ['G*4c', '6a5b', 'G*6a'],
    hint: 'Drop G*4c tanpa skak untuk mengancam skakmat G*5b. Jika Emas 6a menutup 5b, balas dengan G*6a!',
  },
  {
    id: 'tsume-l5',
    level: 5,
    title: 'Level 5 • Visualisasi 9-te Tsume',
    theme: '9-te Tsume • Simulasi Papan Mental',
    difficulty: 'Level 5',
    rating: 1940,
    movesToMate: 9,
    sfen: '3n4k/9/3PPPPPP/9/9/9/9/9/4K4 b 4LG 1',
    solutionUsi: [
      'L*1b',
      '1a2a',
      'L*2b',
      '2a3a',
      'L*3b',
      '3a4a',
      'L*4b',
      '4a5a',
      'G*5b',
    ],
    hint: 'Hitung seluruh jalur pelarian dari 1a hingga 5a menggunakan 4 Tombak (L*1b–4b) dan tutup di G*5b.',
  },
  {
    id: 'tsume-l6',
    level: 6,
    title: 'Level 6 • 13-te Tsume Under Byoyomi',
    theme: '13-te Tsume • Kompleks & Tekanan Waktu',
    difficulty: 'Level 6',
    rating: 2200,
    movesToMate: 13,
    sfen: '1ng5k/9/1GS1GPPPP/9/9/9/9/9/4K4 b 4LNG 1',
    solutionUsi: [
      'L*1b',
      '1a2a',
      'L*2b',
      '2a3a',
      'L*3b',
      '3a4a',
      'L*4b',
      '4a5a',
      'N*6c',
      '5a6a',
      'G*7b',
      '7a7b',
      '8c7b',
    ],
    hint: 'Giring Raja dengan 4 Tombak (L*1b–4b), lompatkan Kuda N*6c, korbankan Emas G*7b lalu rebut kembali dengan 8c7b!',
  },
];
