use serde::{Deserialize, Serialize};

pub const INITIAL_SFEN: &str = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Side {
    #[serde(rename = "b")]
    Black,
    #[serde(rename = "w")]
    White,
}

impl Side {
    pub const fn opponent(self) -> Self {
        match self {
            Side::Black => Side::White,
            Side::White => Side::Black,
        }
    }

    pub const fn as_str(self) -> &'static str {
        match self {
            Side::Black => "b",
            Side::White => "w",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BasePieceType {
    K,
    R,
    B,
    G,
    S,
    N,
    L,
    P,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum PieceType {
    K,
    R,
    B,
    G,
    S,
    N,
    L,
    P,
    #[serde(rename = "+R")]
    PromR,
    #[serde(rename = "+B")]
    PromB,
    #[serde(rename = "+S")]
    PromS,
    #[serde(rename = "+N")]
    PromN,
    #[serde(rename = "+L")]
    PromL,
    #[serde(rename = "+P")]
    PromP,
}

impl PieceType {
    pub const fn base(self) -> BasePieceType {
        match self {
            PieceType::K => BasePieceType::K,
            PieceType::R | PieceType::PromR => BasePieceType::R,
            PieceType::B | PieceType::PromB => BasePieceType::B,
            PieceType::G => BasePieceType::G,
            PieceType::S | PieceType::PromS => BasePieceType::S,
            PieceType::N | PieceType::PromN => BasePieceType::N,
            PieceType::L | PieceType::PromL => BasePieceType::L,
            PieceType::P | PieceType::PromP => BasePieceType::P,
        }
    }

    pub const fn from_base(base: BasePieceType) -> Self {
        match base {
            BasePieceType::K => PieceType::K,
            BasePieceType::R => PieceType::R,
            BasePieceType::B => PieceType::B,
            BasePieceType::G => PieceType::G,
            BasePieceType::S => PieceType::S,
            BasePieceType::N => PieceType::N,
            BasePieceType::L => PieceType::L,
            BasePieceType::P => PieceType::P,
        }
    }

    pub const fn is_promoted(self) -> bool {
        matches!(
            self,
            PieceType::PromR
                | PieceType::PromB
                | PieceType::PromS
                | PieceType::PromN
                | PieceType::PromL
                | PieceType::PromP
        )
    }

    pub const fn can_promote(self) -> bool {
        !self.is_promoted() && !matches!(self, PieceType::K | PieceType::G)
    }

    pub const fn promote(self) -> Self {
        match self {
            PieceType::R => PieceType::PromR,
            PieceType::B => PieceType::PromB,
            PieceType::S => PieceType::PromS,
            PieceType::N => PieceType::PromN,
            PieceType::L => PieceType::PromL,
            PieceType::P => PieceType::PromP,
            other => other,
        }
    }

    pub const fn kanji(self) -> &'static str {
        match self {
            PieceType::K => "玉",
            PieceType::R => "飛",
            PieceType::B => "角",
            PieceType::G => "金",
            PieceType::S => "銀",
            PieceType::N => "桂",
            PieceType::L => "香",
            PieceType::P => "歩",
            PieceType::PromR => "龍",
            PieceType::PromB => "馬",
            PieceType::PromS => "全",
            PieceType::PromN => "圭",
            PieceType::PromL => "杏",
            PieceType::PromP => "と",
        }
    }

    pub const fn short_en(self) -> &'static str {
        match self {
            PieceType::K => "K",
            PieceType::R => "R",
            PieceType::B => "B",
            PieceType::G => "G",
            PieceType::S => "S",
            PieceType::N => "N",
            PieceType::L => "L",
            PieceType::P => "P",
            PieceType::PromR => "+R",
            PieceType::PromB => "+B",
            PieceType::PromS => "+S",
            PieceType::PromN => "+N",
            PieceType::PromL => "+L",
            PieceType::PromP => "+P",
        }
    }
}

pub const HAND_ORDER: [BasePieceType; 7] = [
    BasePieceType::R,
    BasePieceType::B,
    BasePieceType::G,
    BasePieceType::S,
    BasePieceType::N,
    BasePieceType::L,
    BasePieceType::P,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Piece {
    #[serde(rename = "type")]
    pub piece_type: PieceType,
    pub side: Side,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct HandCounts {
    #[serde(rename = "R")]
    pub r: u8,
    #[serde(rename = "B")]
    pub b: u8,
    #[serde(rename = "G")]
    pub g: u8,
    #[serde(rename = "S")]
    pub s: u8,
    #[serde(rename = "N")]
    pub n: u8,
    #[serde(rename = "L")]
    pub l: u8,
    #[serde(rename = "P")]
    pub p: u8,
}

impl HandCounts {
    pub const fn get(&self, piece: BasePieceType) -> u8 {
        match piece {
            BasePieceType::R => self.r,
            BasePieceType::B => self.b,
            BasePieceType::G => self.g,
            BasePieceType::S => self.s,
            BasePieceType::N => self.n,
            BasePieceType::L => self.l,
            BasePieceType::P => self.p,
            BasePieceType::K => 0,
        }
    }

    pub fn add(&mut self, piece: BasePieceType, delta: u8) {
        match piece {
            BasePieceType::R => self.r = self.r.saturating_add(delta),
            BasePieceType::B => self.b = self.b.saturating_add(delta),
            BasePieceType::G => self.g = self.g.saturating_add(delta),
            BasePieceType::S => self.s = self.s.saturating_add(delta),
            BasePieceType::N => self.n = self.n.saturating_add(delta),
            BasePieceType::L => self.l = self.l.saturating_add(delta),
            BasePieceType::P => self.p = self.p.saturating_add(delta),
            BasePieceType::K => {}
        }
    }

    pub fn dec(&mut self, piece: BasePieceType) {
        match piece {
            BasePieceType::R => self.r = self.r.saturating_sub(1),
            BasePieceType::B => self.b = self.b.saturating_sub(1),
            BasePieceType::G => self.g = self.g.saturating_sub(1),
            BasePieceType::S => self.s = self.s.saturating_sub(1),
            BasePieceType::N => self.n = self.n.saturating_sub(1),
            BasePieceType::L => self.l = self.l.saturating_sub(1),
            BasePieceType::P => self.p = self.p.saturating_sub(1),
            BasePieceType::K => {}
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct Hands {
    pub b: HandCounts,
    pub w: HandCounts,
}

impl Hands {
    pub const fn for_side(&self, side: Side) -> &HandCounts {
        match side {
            Side::Black => &self.b,
            Side::White => &self.w,
        }
    }

    pub fn for_side_mut(&mut self, side: Side) -> &mut HandCounts {
        match side {
            Side::Black => &mut self.b,
            Side::White => &mut self.w,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShogiPosition {
    pub board: [[Option<Piece>; 9]; 9],
    pub hands: Hands,
    pub turn: Side,
    #[serde(rename = "moveNumber")]
    pub move_number: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct Square {
    pub row: usize,
    pub col: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ShogiMove {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub from: Option<Square>,
    pub to: Square,
    pub piece: PieceType,
    pub promote: bool,
    pub drop: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub captured: Option<PieceType>,
    pub usi: String,
    pub kifu: String,
    pub western: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EngineEvaluation {
    #[serde(rename = "scoreCp")]
    pub score_cp: i32,
    #[serde(rename = "mateIn", skip_serializing_if = "Option::is_none")]
    pub mate_in: Option<i32>,
    #[serde(rename = "bestMove", skip_serializing_if = "Option::is_none")]
    pub best_move: Option<ShogiMove>,
    pub pv: Vec<String>,
    pub depth: u32,
    pub nodes: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaterialBalance {
    pub b: i32,
    pub w: i32,
    pub diff: i32,
}
