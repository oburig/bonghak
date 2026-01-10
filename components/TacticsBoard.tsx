
import React, { useState, useRef, useEffect } from 'react';
import { FORMATIONS } from '../constants';
import { FormationType, Member } from '../types';
import { RefreshCcw, X, Users } from 'lucide-react';
import { MemberSelector } from './MemberSelector';

interface Props {
  members: Member[];
}

interface PlayerPosition {
  id: number;
  x: number;
  y: number;
  assignedMemberId?: string;
}

export const TacticsBoard: React.FC<Props> = ({ members }) => {
  const [formation, setFormation] = useState<FormationType>(FormationType.F352);
  const [playerPositions, setPlayerPositions] = useState<PlayerPosition[]>([]);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [showMemberPicker, setShowMemberPicker] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0, time: 0 });

  useEffect(() => {
    const base = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['3-5-2'];
    setPlayerPositions(prev => {
      return base.map((pos, idx) => ({
        id: idx,
        x: pos.x,
        y: pos.y,
        assignedMemberId: prev[idx]?.assignedMemberId
      }));
    });
  }, [formation]);

  const handlePointerDown = (e: React.PointerEvent, id: number) => {
    // 캡처를 설정하여 요소 밖으로 나가도 이벤트를 추적
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    };
    setDraggingId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingId === null || !containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    
    // 이동 거리 계산
    const dist = Math.sqrt(
      Math.pow(e.clientX - dragStartPos.current.x, 2) + 
      Math.pow(e.clientY - dragStartPos.current.y, 2)
    );

    // 5px 이상 움직였을 때만 위치 업데이트
    if (dist > 5) {
      let x = ((e.clientX - container.left) / container.width) * 100;
      let y = ((e.clientY - container.top) / container.height) * 100;

      x = Math.max(5, Math.min(95, x));
      y = Math.max(5, Math.min(95, y));

      setPlayerPositions(prev => prev.map(p => 
        p.id === draggingId ? { ...p, x, y } : p
      ));
    }
  };

  const handlePointerUp = (e: React.PointerEvent, id: number) => {
    if (draggingId === null) return;
    
    const duration = Date.now() - dragStartPos.current.time;
    const dist = Math.sqrt(
      Math.pow(e.clientX - dragStartPos.current.x, 2) + 
      Math.pow(e.clientY - dragStartPos.current.y, 2)
    );

    // 짧게 누르고 거의 움직이지 않았다면 '클릭'으로 간주하여 선수 선택창 오픈
    if (dist < 10 && duration < 300) {
      setShowMemberPicker(id);
    }
    
    setDraggingId(null);
  };

  const handleReset = () => {
    const base = FORMATIONS[formation as keyof typeof FORMATIONS] || FORMATIONS['3-5-2'];
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
          <p className="text-[10px] text-gray-400 font-medium">번호 클릭: 선수 배정 / 드래그: 위치 이동</p>
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
          const isGK = p.id === playerPositions.length - 1 || (formation === FormationType.F352 && p.id === 0);
          // 3-5-2 등의 데이터 구조에 따라 GK 위치는 FORMATIONS 상의 인덱스를 따름. 
          // p.id === 0이 보통 GK인 경우가 많음 (constants.tsx 확인 결과)
          const displayLabel = p.id === 0 ? 'GK' : p.id;

          return (
            <div 
              key={p.id}
              onPointerDown={(e) => handlePointerDown(e, p.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, p.id)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-10 ${draggingId === p.id ? 'scale-125 z-20' : ''} transition-transform cursor-pointer select-none`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, touchAction: 'none' }}
            >
              <div className={`w-11 h-11 rounded-full border-2 flex items-center justify-center shadow-lg overflow-hidden transition-all ${
                assignedMember ? 'border-yellow-400 bg-white' : 'border-white bg-[#073763] hover:bg-[#0a4a84]'
              }`}>
                {assignedMember ? (
                  <img src={assignedMember.photo} className="w-full h-full object-cover pointer-events-none" alt={assignedMember.name} />
                ) : (
                  <span className="text-white text-xs font-black">{displayLabel}</span>
                )}
              </div>
              {assignedMember ? (
                <div className="bg-[#073763]/90 text-white text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 whitespace-nowrap shadow-sm border border-white/20">
                  {assignedMember.name}
                </div>
              ) : (
                <div className="bg-black/40 text-white text-[8px] font-bold px-1.5 rounded mt-1">
                  선택
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {showMemberPicker !== null && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-sm h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 flex justify-between items-center border-b">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#073763]" />
                <h3 className="text-lg font-black text-[#073763]">
                  {showMemberPicker === 0 ? '골키퍼' : `${showMemberPicker}번 포지션`} 선수 배정
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
            <div className="p-4 bg-gray-50 border-t flex gap-2">
              <button 
                onClick={() => {
                  setPlayerPositions(prev => prev.map(p => p.id === showMemberPicker ? { ...p, assignedMemberId: undefined } : p));
                  setShowMemberPicker(null);
                }}
                className="flex-1 py-3 bg-white text-red-500 border border-red-100 rounded-xl font-bold text-sm active:bg-red-50 transition-colors"
              >
                배정 취소
              </button>
              <button 
                onClick={() => setShowMemberPicker(null)}
                className="flex-1 py-3 bg-[#073763] text-white rounded-xl font-bold text-sm active:opacity-90"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
