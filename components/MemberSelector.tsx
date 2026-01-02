
import React, { useState } from 'react';
import { Member } from '../types';

interface Props {
  members: Member[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  maxSelection?: number;
}

export const MemberSelector: React.FC<Props> = ({ members, selectedIds, onToggle, maxSelection }) => {
  const [search, setSearch] = useState('');

  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.phone.includes(search)
  );

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="sticky top-0 bg-white z-10 border-b">
        <input 
          type="text"
          placeholder="회원 검색..."
          className="w-full p-3 outline-none focus:bg-gray-50 text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        <div className="grid grid-cols-2 gap-2">
          {filtered.map(member => {
            const isSelected = selectedIds.includes(member.id);
            return (
              <button
                key={member.id}
                onClick={() => onToggle(member.id)}
                disabled={!isSelected && maxSelection !== undefined && selectedIds.length >= maxSelection}
                className={`flex items-center p-2 rounded-xl transition-all border text-left ${
                  isSelected 
                    ? 'bg-[#073763]/10 border-[#073763]/30 shadow-sm ring-1 ring-[#073763]/10' 
                    : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="relative">
                  <img 
                    src={member.photo} 
                    alt="" 
                    className="w-7 h-7 rounded-full object-cover border border-gray-100" 
                  />
                  {isSelected && (
                    <div className="absolute -top-1 -right-1 bg-[#073763] text-white rounded-full w-3.5 h-3.5 flex items-center justify-center border border-white shadow-sm">
                      <span className="text-[8px] font-bold">✓</span>
                    </div>
                  )}
                </div>
                <div className="ml-2 flex-1 min-w-0">
                  <div className={`font-bold text-[11px] truncate ${isSelected ? 'text-[#073763]' : 'text-gray-700'}`}>
                    {member.name}
                  </div>
                  <div className="text-[9px] text-gray-400 font-medium truncate">
                    {member.position}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-xs font-medium">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
};
