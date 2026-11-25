import { INITIAL_SFEN } from '../engine/types';

export type RepertoirePhase = 'joban' | 'chuban' | 'shuban';

export interface PhaseMeta {
  id: RepertoirePhase;
  label: string;
  japanese: string;
  subtitle: string;
}

export const REPERTOIRE_PHASES: PhaseMeta[] = [
  {
    id: 'joban',
    label: 'Joban (Opening)',
    japanese: '序盤',
    subtitle: 'Pembentukan struktur benteng & pembukaan teori',
  },
  {
    id: 'chuban',
    label: 'Chūban (Middlegame)',
    japanese: '中盤',
    subtitle: 'Pertukaran bidak, taktik Drop, & pengorbanan kastil',
  },
  {
    id: 'shuban',
    label: 'Shūban (Endgame)',
    japanese: '終盤',
    subtitle: 'Tsume-Shogi, konsep Hisshi, & kalkulasi skakmat akhir',
  },
];

export interface JosekiLine {
  id: string;
  phase: RepertoirePhase;
  level: 1 | 2 | 3 | 4 | 5;
  levelTitle: string;
  name: string;
  japaneseName: string;
  category: string;
  ecoCode: string;
  summary: string;
  initialSfen: string;
  movesUsi: string[];
  keyIdeas: string[];
}

export const SHOGI_REPERTOIRE: JosekiLine[] = [
  // ==================== JOBAN (OPENING) LEVEL 1-5 ====================
  {
    id: 'joban-l1',
    phase: 'joban',
    level: 1,
    levelTitle: 'Level 1: Fondasi & Struktur',
    name: 'Ibisha vs Furibisha • Shikenbisha Mino',
    japaneseName: '四間飛車・美濃囲い',
    category: 'Joban • Level 1',
    ecoCode: 'JBN-L1',
    summary:
      'Memahami perbedaan Ibisha vs Furibisha dan membangun 1–2 benteng pertahanan dasar (seperti Yagura atau Mino).',
    initialSfen: INITIAL_SFEN,
    movesUsi: [
      '7g7f',
      '3c3d',
      '6g6f',
      '8c8d',
      '2h6h',
      '8d8e',
      '8h7g',
      '6a5b',
      '5i4h',
      '5a4b',
      '4h3h',
      '4b3b',
    ],
    keyIdeas: [
      'Bedakan Static Rook (Ibisha: Benteng tetap di jalur 2) vs Ranging Rook (Furibisha: Benteng digeser ke jalur 6/5/4).',
      'Tutup diagonal Gajah dengan P-6f sebelum menggeser Benteng ke 6h agar tidak terkena pertukaran prematur.',
      'Bangun benteng Mino (Raja ke 3h/2h, Emas & Perak saling menjaga) untuk keamanan Raja jangka panjang.',
    ],
  },
  {
    id: 'joban-l2',
    phase: 'joban',
    level: 2,
    levelTitle: 'Level 2: Efisiensi & Tempo',
    name: 'Koordinasi Bidak Penyerang • Yagura',
    japaneseName: '矢倉・駒組み',
    category: 'Joban • Level 2',
    ecoCode: 'JBN-L2',
    summary:
      'Mampu mengoordinasikan pergerakan bidak penyerang (Benteng, Gajah, Perak) tanpa menghalangi jalur satu sama lain.',
    initialSfen: INITIAL_SFEN,
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
    ],
    keyIdeas: [
      'Majukan Perak (S-6h → S-7g) sebelum menutup petak pelarian Gajah atau mengunci Benteng.',
      'Jaga jarak antarpion dan perwira berat agar Benteng di lajur 2 dan Gajah tetap memiliki ruang gerak.',
      'Susun Emas 7h dan Perak 6g secara berurutan tanpa membuang tempo langkah.',
    ],
  },
  {
    id: 'joban-l3',
    phase: 'joban',
    level: 3,
    levelTitle: 'Level 3: Adaptasi & Kontra-Strategi',
    name: 'Kontra Rapid Attack • Kakugawari',
    japaneseName: '角換わり・急戦対策',
    category: 'Joban • Level 3',
    ecoCode: 'JBN-L3',
    summary:
      'Mengubah formasi benteng secara dinamis saat lawan melakukan serangan cepat (Rapid Attack) sebelum benteng selesai dibangun.',
    initialSfen: INITIAL_SFEN,
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
    keyIdeas: [
      'Saat lawan mendorong pion Benteng dengan cepat (P-8e), segera lindungi 8f memakai Gajah (B-7g) dan Perak (S-8h → 7g).',
      'Terima pertukaran Gajah di 7g agar struktur pion sayap kiri tetap solid dan tidak bocor.',
      'Simpan Gajah di Komadai untuk ancaman drop balasan bila lawan terburu-buru menyerang.',
    ],
  },
  {
    id: 'joban-l4',
    phase: 'joban',
    level: 4,
    levelTitle: 'Level 4: Manajemen Krisis',
    name: 'Pembukaan Asimetris • Gokigen Nakabisha',
    japaneseName: 'ゴキゲン中飛車',
    category: 'Joban • Level 4',
    ecoCode: 'JBN-L4',
    summary:
      'Menguasai variasi pembukaan asimetris dan siap menghadapi posisi tidak standar di luar teori buku.',
    initialSfen: INITIAL_SFEN,
    movesUsi: [
      '7g7f',
      '3c3d',
      '2g2f',
      '5c5d',
      '2f2e',
      '8b5b',
      '5i4h',
      '5d5e',
    ],
    keyIdeas: [
      'Biarkan diagonal Gajah terbuka saat lawan memindahkan Benteng ke tengah (R-5b) dan dorong pion pusat P-5e.',
      'Waspadai taktik drop Gajah mendadak di kedua sisi ketika posisi menjadi asimetris.',
      'Evaluasi ruang tengah secara konkret alih-alih terpaku urutan hafalan buku.',
    ],
  },
  {
    id: 'joban-l5',
    phase: 'joban',
    level: 5,
    levelTitle: 'Level 5: Sintesis Strategis',
    name: 'Rencana Jangka Panjang • Ibisha vs Shikenbisha',
    japaneseName: '対抗形・大局観',
    category: 'Joban • Level 5',
    ecoCode: 'JBN-L5',
    summary:
      'Mampu memancing lawan masuk ke struktur pembukaan yang menguntungkan rencana jangka panjangmu sejak langkah awal.',
    initialSfen: INITIAL_SFEN,
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
    keyIdeas: [
      'Gunakan urutan dorongan pion P-2f–2e untuk mengarahkan lawan memilih struktur bertahan tertentu.',
      'Bangun benteng Raja sesuai orientasi serangan lawan (Boat Castle / Anaguma melawan Furibisha).',
      'Setiap langkah pembukaan sudah menyiapkan titik terobosan di Chūban.',
    ],
  },

  // ==================== CHUBAN (MIDDLEGAME) LEVEL 1-5 ====================
  {
    id: 'chuban-l1',
    phase: 'chuban',
    level: 1,
    levelTitle: 'Level 1: Fondasi & Struktur',
    name: 'Nilai Relatif Bidak & Pertukaran Bersih',
    japaneseName: '駒得と飛車先の歩交換',
    category: 'Chūban • Level 1',
    ecoCode: 'CHB-L1',
    summary:
      'Mengerti nilai relatif bidak dan cara menukar bidak tanpa rugi materi secara cuma-cuma.',
    initialSfen:
      'lnsgkgsnl/1r5b1/pppppp1pp/6p2/9/2P4P1/PP1PPPP1P/1B5R1/LNSGKGSNL b - 1',
    movesUsi: ['2f2e', '8c8d', '2e2d', '2c2d', '2h2d'],
    keyIdeas: [
      'Nilai relatif: Benteng > Gajah > Emas > Perak > Kuda/Tombak > Pion. Hindari menukar perwira besar tanpa kompensasi.',
      'Menukar pion di depan Benteng (2f–2e–2d) memberi pion di tangan (Mochigoma) dan membebaskan lajur Benteng.',
      'Pastikan petak tujuan dilindungi sebelum melakukan pertukaran agar tidak kehilangan tempo.',
    ],
  },
  {
    id: 'chuban-l2',
    phase: 'chuban',
    level: 2,
    levelTitle: 'Level 2: Efisiensi & Tempo',
    name: 'Taktik Drop Fork & Inisiatif Sente',
    japaneseName: '角打ちの両取り・先手維持',
    category: 'Chūban • Level 2',
    ecoCode: 'CHB-L2',
    summary:
      'Menggunakan aturan Drop untuk menciptakan ancaman ganda (fork) dan menjaga inisiatif (Sente).',
    initialSfen: '4k4/9/2r3g2/9/9/9/9/9/4K4 b B 1',
    movesUsi: ['B*5e', '7c7b', '5e3c+'],
    keyIdeas: [
      'Drop Gajah di petak pusat (B*5e) menyerang dua sasaran sekaligus (Benteng 7c & Emas 3c).',
      'Saat lawan hanya bisa menyelamatkan satu bidak, ambil bidak lainnya sambil promosi menjadi Kuda Naga (+B).',
      'Simpan bidak di Mochigoma untuk mencari titik lemah diagonal tanpa penghalang.',
    ],
  },
  {
    id: 'chuban-l3',
    phase: 'chuban',
    level: 3,
    levelTitle: 'Level 3: Adaptasi & Kontra-Strategi',
    name: 'Pengorbanan Membongkar Kastil Lawan',
    japaneseName: '飛車切り・美濃崩し',
    category: 'Chūban • Level 3',
    ecoCode: 'CHB-L3',
    summary:
      'Menilai kapan harus mengorbankan bidak demi membongkar struktur pertahanan kastil lawan.',
    initialSfen: '5gknl/6gs1/6pp1/9/6P2/9/9/6R2/6K2 b G 1',
    movesUsi: ['3e3d', '3c3d', '3h3d', '2b3c', '3d3c+', '3b3c', 'G*3d'],
    keyIdeas: [
      'Korbankan Benteng untuk memakan Perak pelindung (3d3c+) demi menghancurkan jaring pelindung Emas-Perak kastil Mino.',
      'Setelah struktur kastil runtuh, langsung tekan dengan drop Emas di kepala pertahanan (G*3d).',
      'Dalam Shogi, keamanan Raja dan kecepatan serangan di Chūban sering lebih berharga dari nilai materi mentah.',
    ],
  },
  {
    id: 'chuban-l4',
    phase: 'chuban',
    level: 4,
    levelTitle: 'Level 4: Manajemen Krisis',
    name: 'Bertahan & Serangan Balik Mochigoma',
    japaneseName: '受けと持ち駒の反撃',
    category: 'Chūban • Level 4',
    ecoCode: 'CHB-L4',
    summary:
      'Bertahan di bawah tekanan berat sambil mengumpulkan amunisi bidak di tangan (Mochigoma) untuk serangan balik.',
    initialSfen: '4k4/9/9/9/9/4+r4/4P4/3GK4/9 b GS 1',
    movesUsi: ['G*4g', '5f6f', 'S*5e'],
    keyIdeas: [
      'Gunakan Emas dari tangan (G*4g) untuk menutup celah pertahanan sambil mengusir Naga (+R) lawan.',
      'Jangan habiskan seluruh Mochigoma hanya untuk bertahan pasif—sisakan Perak atau Emas untuk membalikkan tempo.',
      'Segera lakukan serangan balik (S*5e) begitu ancaman langsung terhadap Raja berhasil diredam.',
    ],
  },
  {
    id: 'chuban-l5',
    phase: 'chuban',
    level: 5,
    levelTitle: 'Level 5: Sintesis Strategis',
    name: 'Kontrol Tempo & Konsolidasi Kastil',
    japaneseName: '緩急と手番の制御',
    category: 'Chūban • Level 5',
    ecoCode: 'CHB-L5',
    summary:
      'Mengendalikan tempo seluruh papan—tahu kapan harus memperlambat permainan untuk memperkuat pertahanan dan kapan meledakkan serangan.',
    initialSfen: '6knl/6gs1/6ppp/9/9/2P3PP1/PP1PPPP1P/1B5R1/3GKG3 b S 1',
    movesUsi: ['S*4h', '1c1d', '2f2e', '3c3d', '2e2d'],
    keyIdeas: [
      'Tambal celah Raja terlebih dahulu dengan S*4h sebelum membuka garis serangan Benteng.',
      'Setelah Raja aman dari serangan balik, baru ledakkan dorongan pion P-2e → P-2d.',
      'Keseimbangan antara konsolidasi (kanyu) dan agresivitas menentukan dominasi Chūban.',
    ],
  },

  // ==================== SHUBAN (ENDGAME) LEVEL 1-5 ====================
  {
    id: 'shuban-l1',
    phase: 'shuban',
    level: 1,
    levelTitle: 'Level 1: Fondasi & Struktur',
    name: '1-te Tsume • Kepala Emas (Atamakin)',
    japaneseName: '1手詰・頭金',
    category: 'Shūban • Level 1',
    ecoCode: 'SHB-L1',
    summary:
      'Menyelesaikan teka-teki skakmat 1 hingga 3 langkah (1-te & 3-te Tsume).',
    initialSfen: '4k4/9/4P4/9/9/9/9/9/4K4 b G 1',
    movesUsi: ['G*5b'],
    keyIdeas: [
      'Pola paling fundamental dalam Shūban: drop Emas tepat di depan Raja lawan (Atamakin) yang dijaga pion sendiri.',
      'Emas menjaga 6 petak di sekelilingnya termasuk kedua petak diagonal depan.',
      'Pastikan bidak yang di-drop terlindungi agar tidak langsung dimakan Raja lawan.',
    ],
  },
  {
    id: 'shuban-l2',
    phase: 'shuban',
    level: 2,
    levelTitle: 'Level 2: Efisiensi & Tempo',
    name: '3-te Tsume • Memotong Jalur Pelarian Raja',
    japaneseName: '3手詰・退路封鎖',
    category: 'Shūban • Level 2',
    ecoCode: 'SHB-L2',
    summary:
      'Menyelesaikan skakmat cepat dan memahami cara memotong jalur pelarian Raja.',
    initialSfen: '8k/5R2l/6S2/9/9/9/9/9/4K4 b G 1',
    movesUsi: ['G*2a', '1a2a', '4b2b+'],
    keyIdeas: [
      'Pancing Raja menjauh dari sudut aman dengan pengorbanan drop Emas (G*2a).',
      'Tutup seluruh jalur pelarian dengan promosi Benteng menjadi Naga (4b2b+) yang dijaga Perak.',
      'Selalu cek petak pelarian diagonal & samping Raja sebelum mengeksekusi skak.',
    ],
  },
  {
    id: 'shuban-l3',
    phase: 'shuban',
    level: 3,
    levelTitle: 'Level 3: Adaptasi & Kontra-Strategi',
    name: 'Konsep Hisshi • Ancaman Mat Tak Terhenti',
    japaneseName: '必至（必死）',
    category: 'Shūban • Level 3',
    ecoCode: 'SHB-L3',
    summary:
      'Memahami konsep Hisshi (ancaman skakmat yang tidak bisa dihentikan meskipun lawan punya giliran melangkah).',
    initialSfen: '3gkg3/3s1n3/1B2P4/9/9/9/9/9/4K4 b 2G 1',
    movesUsi: ['G*4c', '6a5b', 'G*6a'],
    keyIdeas: [
      'G*4c bukan skak langsung, tetapi menciptakan ancaman Hisshi karena G*5b (dan G*6a bila Emas 6a bergeser) tidak dapat dihentikan sekaligus.',
      'Hisshi efektif ketika Raja kita sendiri masih aman dari skak beruntun lawan (kecepatan Z-shape).',
      'Gunakan dua arah ancaman skakmat sekaligus agar pertahanan lawan runtuh.',
    ],
  },
  {
    id: 'shuban-l4',
    phase: 'shuban',
    level: 4,
    levelTitle: 'Level 4: Manajemen Krisis',
    name: 'Kalkulasi Pengorbanan • Zettai-Zetsumei',
    japaneseName: '捨て駒・詰めろ計算',
    category: 'Shūban • Level 4',
    ecoCode: 'SHB-L4',
    summary:
      'Menguasai Tsume menengah dan mampu menghitung balapan skakmat (Zettai-Zetsumei) secara akurat.',
    initialSfen: '6nkl/6g2/7P1/5B3/9/9/9/9/4K4 b G 1',
    movesUsi: ['G*2b', '3b2b', '4d2b+'],
    keyIdeas: [
      'Korbankan Emas di titik krusial (G*2b) untuk menarik Emas pelindung lawan menjauh dari petak kunci.',
      'Rebut kembali dengan Gajah promosi menjadi Kuda Naga (4d2b+) yang dijaga pion 2c.',
      'Dalam balapan skakmat, membuang satu tempo untuk langkah pasif bisa membalikkan hasil pertandingan.',
    ],
  },
  {
    id: 'shuban-l5',
    phase: 'shuban',
    level: 5,
    levelTitle: 'Level 5: Sintesis Strategis',
    name: 'Endgame Kompleks & Presisi Byoyomi',
    japaneseName: '終盤の精密計算・秒読み',
    category: 'Shūban • Level 5',
    ecoCode: 'SHB-L5',
    summary:
      'Kalkulasi endgame kompleks dengan manajemen waktu Byoyomi yang presisi di bawah tekanan.',
    initialSfen: '7nk/9/6BPp/9/9/9/9/9/4K4 b G 1',
    movesUsi: ['G*1b', '1a1b', '3c2b+'],
    keyIdeas: [
      'Visualisasikan posisi akhir setelah pengorbanan tepi (G*1b → Kx1b) sebelum melangkah di waktu Byoyomi.',
      'Perhatikan perbedaan antara Tombak vs Kuda lawan yang menjaga petak kritis (2a Kuda tidak menjaga 2b!).',
      'Kombinasikan skak paksa + promosi perwira berat (+B / +R) untuk mengunci seluruh petak pelarian.',
    ],
  },
];
