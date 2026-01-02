
import { Member, Position, ClubRole } from './types';

export const INITIAL_MEMBERS: Member[] = Array.from({ length: 80 }).map((_, i) => ({
  id: `mem-${i + 1}`,
  name: `회원 ${i + 1}`,
  phone: `010-1234-${String(5000 + i).padStart(4, '0')}`,
  position: i % 4 === 0 ? Position.FW : i % 4 === 1 ? Position.MF : i % 4 === 2 ? Position.DF : Position.GK,
  clubRole: ClubRole.MEMBER,
  photo: `https://picsum.photos/seed/${i + 1}/200`
}));

export const FORMATIONS = {
  '4-4-2': [
    { x: 50, y: 90 }, // GK
    { x: 20, y: 70 }, { x: 40, y: 70 }, { x: 60, y: 70 }, { x: 80, y: 70 }, // DF
    { x: 20, y: 40 }, { x: 40, y: 40 }, { x: 60, y: 40 }, { x: 80, y: 40 }, // MF
    { x: 40, y: 15 }, { x: 60, y: 15 } // FW
  ],
  '4-3-3': [
    { x: 50, y: 90 }, // GK
    { x: 20, y: 70 }, { x: 40, y: 70 }, { x: 60, y: 70 }, { x: 80, y: 70 }, // DF
    { x: 30, y: 45 }, { x: 50, y: 45 }, { x: 70, y: 45 }, // MF
    { x: 20, y: 20 }, { x: 50, y: 15 }, { x: 80, y: 20 } // FW
  ],
  '3-5-2': [
    { x: 50, y: 90 }, // GK
    { x: 30, y: 70 }, { x: 50, y: 70 }, { x: 70, y: 70 }, // DF
    { x: 15, y: 45 }, { x: 32, y: 40 }, { x: 50, y: 40 }, { x: 68, y: 40 }, { x: 85, y: 45 }, // MF
    { x: 40, y: 15 }, { x: 60, y: 15 } // FW
  ]
};
