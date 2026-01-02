
import React, { useState, useRef, useEffect } from 'react';
import { FORMATIONS } from '../constants';
import { FormationType, Member } from '../types';
import { RefreshCcw, X, Users, UserPlus } from 'lucide-react';
import { MemberSelector } from './MemberSelector';

interface Props {
  members: Member[];
}

interface PlayerPosition {
  id: number;
  x: number;
  y: number;
  assignedMemberId?: string;
  lastTap?: number;
}

export const TacticsBoard: React.FC<Props> = ({ members }) => {
  const [formation, setFormation] = useState<FormationType>(FormationType.F442);
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState<number | null>(null);
  
  // 드래그와 클릭을 구분하기 위한 상태
  const dragInfo = useRef({ startX: 0, startY: 0, hasMoved: false, startTime: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize player positions based on formation
  useEffect(() => {
    const base = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2'];
    setPlayerPositions(prev => {
      return base.map((pos, idx) => ({
        id: idx,
        x: pos.x,
        y: pos.y,
        assignedMemberId: prev[idx]?.assignedMemberId
      }));
    });
  }, [formation]);

  const handleTouchStart = (e: React.TouchEvent, id: number) => {
    const touch = e.touches[0];
    dragInfo.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      hasMoved: false,
      startTime: Date.now()
    };
    setDraggingId(id);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggingId === null || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    
    // 이동 거리 계산 (임계값 이상 움직이면 드래그로 간주)
    const moveDist = Math.sqrt(
      Math.pow(touch.clientX - dragInfo.current.startX, 2) + 
      Math.pow(touch.clientY - dragInfo.current.startY, 2)
    );
    
    if (moveDist > 5) {
      dragInfo.current.hasMoved = true;
    }

    if (dragInfo.current.hasMoved) {
      let x = ((touch.clientX - container.left) / container.width) * 100;
      let y = ((touch.clientY - container.top) / container.height) * 100;

      // Constrain to field
      x = Math.max(5, Math.min(95, x));
      y = Math.max(5, Math.min(95, y));

      setPlayerPositions(prev => prev.map(p => 
        p.id === draggingId ? { ...p, x, y } : p
      ));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, id: number) => {
    const duration = Date.now() - dragInfo.current.startTime;
    
    // 짧게 터치하고 거의 움직이지 않았다면 클릭으로 간주
    if (!dragInfo.current.hasMoved && duration < 300) {
      setShowMemberPicker(id);
    }
    
    setDraggingId(null);
  };

  const handleReset = () => {
    const base = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['4-4-2'];
    setPlayerPositions(base.map((pos, idx) => ({
      id: idx,
      x: pos.x,
      y: pos.y,
      assignedMemberId: undefined
    })));
  };

  const assignMember = (memberId: string) => {
    if (showMemberPicker === null) return;
    setPlayerPositions(prev => prev.map(p => 
      p.id === showMemberPicker ? { ...p, assignedMemberId: memberId } : p
    ));
    setShowMemberPicker(null);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-[#073763]">전술 대형(친선게임용)</h2>
          <p className="text-[10px] text-gray-400 font-medium">드래그로 이동 / 번호 클릭으로 선수 배정</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReset} className="p-2 bg-gray-100 rounded-lg text-gray-500 active:scale-90 transition-transform">
            <RefreshCcw className="w-4 h-4" />
          </button>
          <select 
            className="p-2 border rounded-lg bg-gray-50 text-sm focus:ring-2 focus:ring-[#073763] outline-none font-bold text-[#073763]"
            value={formation}
            onChange={(e) => setFormation(e.target.value as FormationType)}
          >
            <option value={FormationType.F442}>4-4-2</option>
            <option value={FormationType.F433}>4-3-3</option>
            <option value={FormationType.F352}>3-5-2</option>
          </select>
        </div>
      </div>

      <div 
        ref={containerRef}
        className="relative w-full aspect-[3/4] soccer-field rounded-lg border-4 border-white/20 overflow-hidden shadow-inner touch-none"
      >
        {/* Field Markings */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-b-2 border-x-2 border-white/40" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-1/6 border-t-2 border-x-2 border-white/40" />
        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/40 -translate-y-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border-2 border-white/40 rounded-full" />

        {/* Players */}
        {playerPositions.map((p) => {
          const assignedMember = members.find(m => m.id === p.assignedMemberId);
          return (
            <div 
              key={p.id}
              onTouchStart={(e) => handleTouchStart(e, p.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={(e) => handleTouchEnd(e, p.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 ${draggingId === p.id ? 'scale-125 z-20' : ''} transition-transform duration-150 cursor-pointer`}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            >
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-lg overflow-hidden transition-colors ${
                assignedMember ? 'border-yellow-400 bg-white' : 'border-white bg-[#073763] active:bg-[#0a4a84]'
              }`}>
                {assignedMember ? (
                  <img src={assignedMember.photo} className="w-full h-full object-cover" alt={assignedMember.name} />
                ) : (
                  <span className="text-white text-[10px] font-black">{p.id === 0 ? 'GK' : p.id + 1}</span>
                )}
              </div>
              {assignedMember ? (
                <div className="bg-[#073763]/80 text-white text-[8px] font-bold px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap shadow-sm">
                  {assignedMember.name}
                </div>
              ) : (
                <div className="bg-black/20 text-white text-[6px] font-bold px-1 rounded mt-0.5">
                  선택
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Member Selection Modal for Tactical Position */}
      {showMemberPicker !== null && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex flex-col p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 flex justify-between items-center border-b">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#073763]" />
                <h3 className="text-lg font-black text-[#073763]">
                  {showMemberPicker === 0 ? '골키퍼' : `${showMemberPicker + 1}번 포지션`} 선수 배정
                </h3>
              </div>
              <button onClick={() => setShowMemberPicker(null)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <MemberSelector 
                members={members} 
                selectedIds={playerPositions.find(p => p.id === showMemberPicker)?.assignedMemberId ? [playerPositions.find(p => p.id === showMemberPicker)!.assignedMemberId!] : []} 
                onToggle={(id) => assignMember(id)}
              />
            </div>
            <div className="p-4 bg-gray-50 border-t">
               <button 
                onClick={() => {
                  setPlayerPositions(prev => prev.map(p => p.id === showMemberPicker ? { ...p, assignedMemberId: undefined } : p));
                  setShowMemberPicker(null);
                }}
                className="w-full py-3 bg-white text-red-500 border border-red-100 rounded-xl font-bold text-sm active:bg-red-50 transition-colors"
               >
                 배정 취소
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
