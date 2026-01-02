
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Trophy, PlayCircle, Shield, MessageCircle, Phone, Plus, Camera, Send, Edit2, Trash2, X, User, Hash, Calendar, RefreshCw, Loader2, Briefcase, WifiOff, CloudCheck, MapPin, Tag, AlertCircle, Info, Swords, Medal, Search, Filter, ChevronRight, Target, Award } from 'lucide-react';
import { Member, Match, MatchRecord, Position, ClubRole, PersonalStats } from './types';
import { INITIAL_MEMBERS } from './constants';
import { TacticsBoard } from './components/TacticsBoard';
import { MemberSelector } from './components/MemberSelector';

// 대한민국 시간(KST) YYYY-MM-DD 문자열을 반환하는 유틸리티
const getKSTDateString = () => {
  const now = new Date();
  // UTC 시간에 9시간을 더해 KST 날짜를 구함
  const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kstDate.toISOString().split('T')[0];
};

// 서버 날짜(UTC/ISO)를 KST YYYY-MM-DD로 변환하는 유틸리티
const parseToKSTDate = (dateInput: any) => {
  if (!dateInput) return getKSTDateString();
  try {
    const d = new Date(dateInput);
    // 시트에서 온 날짜가 UTC 00:00일 경우 KST로 바꾸면 09:00가 되어 날짜가 유지됨
    // 만약 시트에서 15:00 UTC로 왔다면 KST로 다음날 00:00가 됨
    const kstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return kstDate.toISOString().split('T')[0];
  } catch (e) {
    return String(dateInput).substring(0, 10);
  }
};

// 한국어 날짜 포맷 변환 유틸리티 (예: 2024년 12월 25일 (수))
const formatKoreanDate = (dateStr: string) => {
  if (!dateStr) return '날짜 없음';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  } catch (e) {
    return dateStr;
  }
};

// GAS 배포 URL
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweLgMusWlfUFJw5DrwOVb7Nxd2VQHV7Gzqja28FVjSNQSEeDi5WAnLqTrASEfNMnZw/exec';

type SortType = 'points' | 'appearances' | 'goals' | 'assists';

const App: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(() => {
    const saved = localStorage.getItem('bh_members');
    return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
  });
  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('bh_matches');
    return saved ? JSON.parse(saved) : [];
  });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<Match | null>(null);
  
  // 통계 탭 검색 및 정렬 상태
  const [statsSearch, setStatsSearch] = useState('');
  const [statsSort, setStatsSort] = useState<SortType>('points');

  const [editingMember, setEditingMember] = useState<Partial<Member> | null>(null);

  const [newMatch, setNewMatch] = useState<Partial<Match>>({
    date: getKSTDateString(),
    category: '매일매일',
    venue: '대천초등',
    teamA: [],
    teamB: [],
    scoreA: 0,
    scoreB: 0,
    records: []
  });

  // 세부 기록 변경 시 점수 자동 계산
  useEffect(() => {
    if (showMatchForm) {
      const calculatedScoreA = (newMatch.records || [])
        .filter(r => newMatch.teamA?.includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0);
      
      const calculatedScoreB = (newMatch.records || [])
        .filter(r => newMatch.teamB?.includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0);

      if (calculatedScoreA !== newMatch.scoreA || calculatedScoreB !== newMatch.scoreB) {
        setNewMatch(prev => ({
          ...prev,
          scoreA: calculatedScoreA,
          scoreB: calculatedScoreB
        }));
      }
    }
  }, [newMatch.records, newMatch.teamA, newMatch.teamB, showMatchForm]);

  // 로컬 저장소 동기화
  useEffect(() => {
    localStorage.setItem('bh_members', JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem('bh_matches', JSON.stringify(matches));
  }, [matches]);

  const safeJsonParse = (data: any) => {
    if (!data) return [];
    if (typeof data === 'object' && Array.isArray(data)) return data;
    try {
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  };

  const fetchData = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setSyncStatus('idle');
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
        mode: 'cors'
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      const data = await response.json();
      
      if (data.members && Array.isArray(data.members) && data.members.length > 0) {
        setMembers(data.members.map((m: any) => ({ ...m, id: String(m.id) })));
      }
      
      if (data.matches && Array.isArray(data.matches)) {
        setMatches(data.matches.map((m: any) => ({
          ...m,
          id: String(m.id),
          teamA: safeJsonParse(m.teamA).map((id: any) => String(id)),
          teamB: safeJsonParse(m.teamB).map((id: any) => String(id)),
          records: safeJsonParse(m.records).map((r: any) => ({
            ...r,
            memberId: String(r.memberId || '')
          })),
          scoreA: Number(m.scoreA || 0),
          scoreB: Number(m.scoreB || 0),
          category: m.category || '매일매일',
          venue: m.venue || '대천초등',
          // 날짜 파싱 시 KST 변환 적용
          date: parseToKSTDate(m.date),
          photo: m.photo || ''
        })));
      }
      setSyncStatus('success');
    } catch (error: any) {
      console.warn('Data sync failed, using local cache:', error.message);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchData();
  }, []);

  const syncToSheet = async (payload: any) => {
    setLoading(true);
    setSyncStatus('idle');
    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      setSyncStatus('success');
      setTimeout(() => fetchData(), 2000);
    } catch (error) {
      console.error('Post failed:', error);
      setSyncStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const sMap: Record<string, PersonalStats> = {};
    members.forEach(m => {
      sMap[m.id] = { memberId: m.id, name: m.name, goals: 0, assists: 0, mvpCount: 0, wins: 0, draws: 0, losses: 0, points: 0, appearances: 0 };
    });

    matches.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      const isDraw = sA === sB;
      const teamAWon = sA > sB;

      (m.teamA || []).forEach(id => {
        const strId = String(id);
        if (!sMap[strId]) return;
        sMap[strId].appearances++;
        if (isDraw) { sMap[strId].draws++; sMap[strId].points += 1; }
        else if (teamAWon) { sMap[strId].wins++; sMap[strId].points += 3; }
        else { sMap[strId].losses++; }
      });

      (m.teamB || []).forEach(id => {
        const strId = String(id);
        if (!sMap[strId]) return;
        sMap[strId].appearances++;
        if (isDraw) { sMap[strId].draws++; sMap[strId].points += 1; }
        else if (!teamAWon) { sMap[strId].wins++; sMap[strId].points += 3; }
        else { sMap[strId].losses++; }
      });

      (m.records || []).forEach(rec => {
        const targetId = String(rec.memberId || '');
        const finalId = sMap[targetId] ? targetId : members.find(mem => mem.name === rec.name)?.id;
        
        if (finalId && sMap[finalId]) {
          sMap[finalId].goals += Number(rec.goals || 0);
          sMap[finalId].assists += Number(rec.assists || 0);
          if (rec.isMvp) sMap[finalId].mvpCount++;
        }
      });
    });

    let result = Object.values(sMap);

    // 검색 필터링
    if (statsSearch.trim()) {
      result = result.filter(s => s.name.includes(statsSearch.trim()));
    }

    // 정렬 처리
    return result.sort((a, b) => {
      if (statsSort === 'points') return b.points - a.points || b.goals - a.goals;
      if (statsSort === 'appearances') return b.appearances - a.appearances || b.points - a.points;
      if (statsSort === 'goals') return b.goals - a.goals || b.assists - a.assists;
      if (statsSort === 'assists') return b.assists - a.assists || b.goals - a.goals;
      return 0;
    });
  }, [matches, members, statsSearch, statsSort]);

  const teamTotalStats = useMemo(() => {
    let winsA = 0;
    let winsB = 0;
    let draws = 0;
    matches.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      if (sA > sB) winsA++;
      else if (sB > sA) winsB++;
      else draws++;
    });
    return { winsA, winsB, draws, total: matches.length };
  }, [matches]);

  const handleSaveMatch = () => {
    if (!newMatch.teamA?.length || !newMatch.teamB?.length) return alert("두 팀 모두 선수를 선택해주세요.");
    const matchId = Date.now().toString();

    const teamAIds = newMatch.teamA || [];
    const teamBIds = newMatch.teamB || [];
    const recordsWithIds = (newMatch.records || []).map(r => ({
      memberId: String(r.memberId),
      name: members.find(m => m.id === r.memberId)?.name || '',
      goals: r.goals,
      assists: r.assists,
      isMvp: r.isMvp
    }));

    const payload = {
      type: 'Matches', action: 'add',
      row: [
        matchId, 
        newMatch.date, 
        JSON.stringify(teamAIds), 
        JSON.stringify(teamBIds), 
        newMatch.scoreA, 
        newMatch.scoreB, 
        JSON.stringify(recordsWithIds), 
        newMatch.photo || '', 
        newMatch.category, 
        newMatch.venue
      ]
    };
    syncToSheet(payload);
    setShowMatchForm(false);
    setNewMatch({ date: getKSTDateString(), category: '매일매일', venue: '대천초등', teamA: [], teamB: [], scoreA: 0, scoreB: 0, records: [] });
  };

  const handleSaveMember = () => {
    if (!editingMember?.name || !editingMember?.phone) return alert("이름과 전화번호를 입력해주세요.");
    const isNew = !editingMember.id;
    const memberId = editingMember.id || `mem-${Date.now()}`;
    const row = [memberId, editingMember.name, editingMember.phone, editingMember.position || Position.MF, editingMember.photo || `https://picsum.photos/seed/${memberId}/200`, editingMember.clubRole || ClubRole.MEMBER];
    syncToSheet({ type: 'Members', action: isNew ? 'add' : 'update', id: memberId, row });
    setShowMemberForm(false);
    setEditingMember(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isMatch: boolean) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        alert("이미지 용량이 너무 큽니다. 500KB 이하의 사진을 선택해주세요.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (isMatch) setNewMatch(prev => ({ ...prev, photo: reader.result as string }));
        else setEditingMember(prev => ({ ...prev, photo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const renderPlayerRecordInput = (id: string, teamColor: 'blue' | 'red') => {
    const m = members.find(member => member.id === id);
    if (!m) return null;
    const record = newMatch.records?.find(r => r.memberId === id) || { memberId: id, goals: 0, assists: 0, isMvp: false };
    
    const bgColor = teamColor === 'blue' ? 'bg-blue-50/50' : 'bg-red-50/50';
    const borderColor = teamColor === 'blue' ? 'border-blue-100' : 'border-red-100';
    const textColor = teamColor === 'blue' ? 'text-blue-900' : 'text-red-900';

    return (
      <div key={id} className={`flex items-center gap-2 p-3 rounded-xl border ${bgColor} ${borderColor} shadow-sm transition-all`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <img src={m.photo} className="w-6 h-6 rounded-full object-cover border border-white/50" />
          <span className={`text-xs font-bold truncate ${textColor}`}>{m.name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-gray-400">G</span>
            <input type="number" className="w-12 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none focus:ring-1 focus:ring-gray-200" value={record.goals} onChange={(e) => {
              const otherRecords = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...otherRecords, { ...record, goals: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <div className="relative">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-gray-400">A</span>
            <input type="number" className="w-12 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none focus:ring-1 focus:ring-gray-200" value={record.assists} onChange={(e) => {
              const otherRecords = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...otherRecords, { ...record, assists: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <button 
            onClick={() => {
              const otherRecords = (newMatch.records || []).map(r => ({ ...r, isMvp: false }));
              setNewMatch({ ...newMatch, records: [...otherRecords.filter(r => r.memberId !== id), { ...record, isMvp: !record.isMvp }] });
            }} 
            className={`p-1.5 px-2.5 rounded-lg text-[9px] font-black transition-all ${record.isMvp ? 'bg-yellow-400 text-white shadow-md scale-105' : 'bg-white text-gray-300 border border-gray-50'}`}
          >
            MVP
          </button>
        </div>
      </div>
    );
  };

  const MatchDetailModal = ({ match, onClose }: { match: Match, onClose: () => void }) => {
    const mvp = match.records.find(r => r.isMvp);
    const mvpMember = mvp ? members.find(m => m.id === mvp.memberId) : null;
    
    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex flex-col p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="p-5 flex justify-between items-center border-b">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-black text-[#073763]">경기 상세 리포트</h3>
            </div>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            {/* Header Score Info */}
            <div className="bg-[#073763] rounded-2xl p-6 text-white text-center relative overflow-hidden">
               <div className="relative z-10">
                 <div className="text-[10px] font-bold opacity-60 mb-2">{formatKoreanDate(match.date)}</div>
                 <div className="flex justify-around items-center">
                   <div className="text-center">
                     <div className="text-4xl font-black text-blue-300">{match.scoreA}</div>
                     <div className="text-xs font-bold mt-1 opacity-80">봉팀</div>
                   </div>
                   <div className="text-lg font-black opacity-30">VS</div>
                   <div className="text-center">
                     <div className="text-4xl font-black text-red-300">{match.scoreB}</div>
                     <div className="text-xs font-bold mt-1 opacity-80">학팀</div>
                   </div>
                 </div>
                 <div className="mt-4 flex justify-center gap-2">
                   <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold border border-white/10">{match.venue}</span>
                   <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-bold border border-white/10">{match.category}</span>
                 </div>
               </div>
               <div className="absolute top-0 right-0 p-4 opacity-5">
                 <Shield className="w-24 h-24" />
               </div>
            </div>

            {/* MVP Section */}
            {mvpMember && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-center gap-4 relative overflow-hidden">
                <div className="bg-yellow-400 p-2 rounded-xl text-white">
                  <Award className="w-8 h-8" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-yellow-600 uppercase">Match MVP</div>
                  <div className="text-lg font-black text-yellow-900">{mvpMember.name}</div>
                  <div className="text-[10px] text-yellow-700 font-bold">
                    {mvp?.goals}골 {mvp?.assists}도움 기여
                  </div>
                </div>
                <div className="absolute -right-2 -bottom-2 opacity-10">
                  <Trophy className="w-16 h-16 text-yellow-500" />
                </div>
              </div>
            )}

            {/* Team Lists */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-blue-600 px-1 border-b pb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  BONG TEAM ({match.teamA.length})
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {match.teamA.map(id => {
                    const m = members.find(mem => mem.id === id);
                    const record = match.records.find(r => r.memberId === id);
                    return m ? (
                      <div key={id} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-xl border border-blue-100">
                        <img src={m.photo} className="w-6 h-6 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold truncate text-blue-900">{m.name}</div>
                          {record && (record.goals > 0 || record.assists > 0) && (
                            <div className="flex gap-1 mt-0.5">
                              {record.goals > 0 && <span className="text-[8px] px-1 bg-blue-200 text-blue-800 rounded font-black">G {record.goals}</span>}
                              {record.assists > 0 && <span className="text-[8px] px-1 bg-green-200 text-green-800 rounded font-black">A {record.assists}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-red-600 px-1 border-b pb-2">
                  <div className="w-2 h-2 rounded-full bg-red-600"></div>
                  HAK TEAM ({match.teamB.length})
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {match.teamB.map(id => {
                    const m = members.find(mem => mem.id === id);
                    const record = match.records.find(r => r.memberId === id);
                    return m ? (
                      <div key={id} className="flex items-center gap-2 p-2 bg-red-50/50 rounded-xl border border-red-100">
                        <img src={m.photo} className="w-6 h-6 rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] font-bold truncate text-red-900">{m.name}</div>
                          {record && (record.goals > 0 || record.assists > 0) && (
                            <div className="flex gap-1 mt-0.5">
                              {record.goals > 0 && <span className="text-[8px] px-1 bg-red-200 text-red-800 rounded font-black">G {record.goals}</span>}
                              {record.assists > 0 && <span className="text-[8px] px-1 bg-green-200 text-green-800 rounded font-black">A {record.assists}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            </div>

            {/* Detailed Stats List */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-black text-gray-400 ml-1 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> 전체 득점 현황
              </h4>
              <div className="space-y-2">
                {match.records.filter(r => r.goals > 0 || r.assists > 0).length === 0 ? (
                  <div className="text-center py-4 text-xs text-gray-400 font-medium bg-gray-50 rounded-xl">상세 기록이 없습니다.</div>
                ) : (
                  match.records.filter(r => r.goals > 0 || r.assists > 0).map(r => {
                    const m = members.find(mem => mem.id === r.memberId);
                    const isTeamA = match.teamA.includes(r.memberId);
                    return m ? (
                      <div key={r.memberId} className={`flex items-center justify-between p-3 rounded-xl border ${isTeamA ? 'bg-blue-50/20 border-blue-50' : 'bg-red-50/20 border-red-50'}`}>
                        <div className="flex items-center gap-3">
                          <img src={m.photo} className="w-8 h-8 rounded-full object-cover" />
                          <div className="font-bold text-sm">{m.name}</div>
                        </div>
                        <div className="flex gap-2">
                          {r.goals > 0 && (
                            <div className="flex flex-col items-center">
                              <Target className="w-4 h-4 text-gray-800 mb-0.5" />
                              <span className="text-[10px] font-black">{r.goals}</span>
                            </div>
                          )}
                          {r.assists > 0 && (
                            <div className="flex flex-col items-center">
                              <Send className="w-4 h-4 text-green-600 mb-0.5" />
                              <span className="text-[10px] font-black">{r.assists}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null;
                  })
                )}
              </div>
            </div>
          </div>
          
          <div className="p-5 border-t bg-gray-50">
            <button onClick={onClose} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black text-lg active:scale-95 transition-transform">닫기</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen pb-20 max-w-md mx-auto bg-gray-50 border-x relative">
      {loading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-[100] flex items-center justify-center">
          <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-[#073763]/10">
            <Loader2 className="w-6 h-6 animate-spin text-[#073763]" />
            <span className="font-bold text-sm text-[#073763]">데이터 동기화 중...</span>
          </div>
        </div>
      )}

      {syncStatus === 'error' && (
        <div className="bg-red-50 p-3 border-b border-red-100 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-[11px] font-bold text-red-600">
            <AlertCircle className="w-4 h-4" /> 서버 연결 안 됨 (로컬 모드 사용 중)
            <button onClick={fetchData} className="px-2 py-0.5 bg-red-100 rounded underline decoration-red-200">재시도</button>
          </div>
          <p className="text-[9px] text-gray-500">GAS 웹 앱 배포 시 '액세스 권한: 모든 사용자'를 확인하세요.</p>
        </div>
      )}

      <header className="bg-[#073763] text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> BongHak Manager</h1>
          <div className="text-[10px] flex items-center gap-1 mt-0.5 opacity-80">
            {syncStatus === 'success' ? (
              <span className="flex items-center gap-1 text-green-300"><CloudCheck className="w-3 h-3" /> 클라우드 동기화 완료</span>
            ) : (
              <span className="flex items-center gap-1 text-orange-200"><WifiOff className="w-3 h-3" /> 오프라인 모드</span>
            )}
          </div>
        </div>
        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-[#073763] rounded-3xl p-5 shadow-xl text-white relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Swords className="w-24 h-24" />
               </div>
               <div className="relative z-10">
                 <div className="text-xs font-black opacity-60 uppercase tracking-widest mb-1">Overall Rivalry Record</div>
                 <h2 className="text-lg font-bold flex items-center gap-2 mb-4">봉팀 vs 학팀 통산 전적</h2>
                 <div className="flex justify-between items-end gap-4">
                   <div className="flex-1 text-center">
                     <div className="text-3xl font-black text-blue-300">{teamTotalStats.winsA}</div>
                     <div className="text-[10px] font-bold opacity-60 mt-1">봉팀 승</div>
                   </div>
                   <div className="px-4 py-1 bg-white/10 rounded-full border border-white/10 text-xs font-black">
                     {teamTotalStats.draws} 무승부
                   </div>
                   <div className="flex-1 text-center">
                     <div className="text-3xl font-black text-red-300">{teamTotalStats.winsB}</div>
                     <div className="text-[10px] font-bold opacity-60 mt-1">학팀 승</div>
                   </div>
                 </div>
                 <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                   <div className="text-[10px] font-medium opacity-60">총 경기 수: {teamTotalStats.total}경기</div>
                   <div className="flex items-center gap-1">
                     <div className={`w-2 h-2 rounded-full ${
                       teamTotalStats.winsA > teamTotalStats.winsB ? 'bg-blue-400' : 
                       teamTotalStats.winsB > teamTotalStats.winsA ? 'bg-red-400' : 'bg-gray-400'
                     }`}></div>
                     <div className="text-[10px] font-bold">
                       {teamTotalStats.winsA > teamTotalStats.winsB ? 'Bong Team Leads' : 
                        teamTotalStats.winsB > teamTotalStats.winsA ? 'Hak Team Leads' : 'Teams are Tied'}
                     </div>
                   </div>
                 </div>
               </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#073763]"><PlayCircle className="w-5 h-5" /> 최근 경기 결과</h2>
              {matches.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <PlayCircle className="w-10 h-10 mx-auto opacity-20 mb-2" />
                  <p className="text-sm">아직 기록된 경기가 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {matches.slice(0, 3).map(m => (
                    <div key={m.id} className="border-b pb-3 last:border-0">
                      <div className="flex justify-between items-center mb-1">
                        <div className="text-[10px] text-gray-500 font-black tracking-tight">
                          {formatKoreanDate(m.date)}
                        </div>
                        <div className="flex gap-1">
                          <span className="bg-gray-100 text-gray-500 text-[9px] px-1.5 py-0.5 rounded font-black border border-gray-200">
                            {m.venue}
                          </span>
                          <span className="bg-[#073763]/5 text-[#073763] text-[9px] px-1.5 py-0.5 rounded font-black border border-[#073763]/10">
                            {m.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center px-4 mb-3">
                        <div className="text-center w-20">
                          <div className="text-2xl font-black text-blue-800">{m.scoreA}</div>
                          <div className="text-[10px] font-bold text-gray-400">봉팀</div>
                        </div>
                        <div className="font-bold text-gray-200 italic">VS</div>
                        <div className="text-center w-20">
                          <div className="text-2xl font-black text-red-800">{m.scoreB}</div>
                          <div className="text-[10px] font-bold text-gray-400">학팀</div>
                        </div>
                      </div>
                      <button 
                        onClick={() => setSelectedMatchDetail(m)}
                        className="w-full py-2 bg-gray-50 text-gray-500 text-[10px] font-black rounded-lg flex items-center justify-center gap-1 active:bg-gray-100 transition-colors"
                      >
                        상세보기 <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button 
                onClick={() => setShowMatchForm(true)}
                className="w-full mt-4 bg-[#073763] text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg shadow-[#073763]/20"
              >
                <Plus className="w-5 h-5" /> 새 경기 기록하기
              </button>
            </div>
            <TacticsBoard members={members} />
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold text-[#073763]">전체 회원 ({members.length})</h2>
              <button onClick={() => { setEditingMember({ position: Position.MF, clubRole: ClubRole.MEMBER }); setShowMemberForm(true); }} className="p-3 bg-[#073763] text-white rounded-2xl shadow-lg active:scale-95 transition-transform">
                <Plus className="w-6 h-6" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {members.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-gray-100">
                  <img src={m.photo || `https://picsum.photos/seed/${m.id}/200`} className="w-14 h-14 rounded-full border-2 border-gray-50 object-cover" />
                  <div className="flex-1">
                    <div className="font-bold text-gray-800">
                      <span className="text-[#073763] text-[10px] bg-gray-100 px-1.5 py-0.5 rounded mr-1.5">{m.clubRole}</span>
                      {m.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{m.position} | {m.phone}</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingMember(m); setShowMemberForm(true); }} className="p-2.5 bg-gray-50 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => window.location.href = `tel:${m.phone}`} className="p-2.5 bg-[#073763]/10 text-[#073763] rounded-xl active:bg-[#073763]/20">
                      <Phone className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="px-2">
              <h2 className="text-xl font-bold text-[#073763]">개인 기록 랭킹</h2>
              <p className="text-[10px] text-gray-400 font-bold mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" /> PTS(승점): 승리 3점, 무승부 1점
              </p>
            </div>

            {/* 검색 및 필터 영역 */}
            <div className="px-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="이름으로 검색..." 
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all"
                  value={statsSearch}
                  onChange={(e) => setStatsSearch(e.target.value)}
                />
                {statsSearch && (
                  <button 
                    onClick={() => setStatsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 bg-gray-100 rounded-full"
                  >
                    <X className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>

              <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'points', label: 'PTS순' },
                  { id: 'appearances', label: '출전순' },
                  { id: 'goals', label: '득점순' },
                  { id: 'assists', label: '도움순' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setStatsSort(item.id as SortType)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
                      statsSort === item.id 
                        ? 'bg-[#073763] text-white shadow-md' 
                        : 'bg-white text-gray-400 border border-gray-50'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left font-bold text-gray-500">순위</th>
                    <th className="p-4 text-left font-bold text-gray-500">이름</th>
                    <th className={`p-4 text-center font-bold transition-colors ${statsSort === 'appearances' ? 'text-[#073763] bg-[#073763]/5' : 'text-gray-500'}`}>출전</th>
                    <th className={`p-4 text-center font-bold transition-colors ${statsSort === 'goals' ? 'text-[#073763] bg-[#073763]/5' : 'text-gray-500'}`}>득점</th>
                    <th className={`p-4 text-center font-bold transition-colors ${statsSort === 'assists' ? 'text-[#073763] bg-[#073763]/5' : 'text-gray-500'}`}>도움</th>
                    <th className={`p-4 text-right font-bold transition-colors ${statsSort === 'points' ? 'text-[#073763] bg-[#073763]/5' : 'text-gray-500'}`}>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.length > 0 ? (
                    stats.slice(0, 50).map((s, idx) => {
                      const isTop3 = idx < 3 && !statsSearch;
                      const medalClass = idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400';
                      return (
                        <tr key={s.memberId} className={`border-b last:border-0 ${isTop3 ? 'bg-gray-50/50' : ''}`}>
                          <td className="p-4"><span className={`inline-block w-6 h-6 text-center rounded-lg text-xs font-bold leading-6 ${medalClass}`}>{idx + 1}</span></td>
                          <td className="p-4 font-bold text-gray-800">{s.name}</td>
                          <td className={`p-4 text-center font-medium ${statsSort === 'appearances' ? 'font-black text-[#073763]' : ''}`}>{s.appearances}</td>
                          <td className={`p-4 text-center font-medium ${statsSort === 'goals' ? 'font-black text-[#073763]' : ''}`}>{s.goals}</td>
                          <td className={`p-4 text-center font-medium ${statsSort === 'assists' ? 'font-black text-[#073763]' : ''}`}>{s.assists}</td>
                          <td className={`p-4 text-right font-black ${statsSort === 'points' ? 'text-[#073763]' : 'text-gray-400'}`}>{s.points}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-10 text-center text-gray-400 text-xs font-medium">
                        검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 max-w-md mx-auto z-20 pb-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: '홈' },
          { id: 'members', icon: Users, label: '회원' },
          { id: 'stats', icon: Trophy, label: '기록' }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id ? 'text-[#073763]' : 'text-gray-400'}`}>
            <tab.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Member Form Modal */}
      {showMemberForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="bg-white p-5 flex justify-between items-center border-b">
              <h3 className="text-xl font-black text-[#073763]">{editingMember?.id ? "회원 정보 수정" : "새 회원 등록"}</h3>
              <button onClick={() => { setShowMemberForm(false); setEditingMember(null); }} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <section className="flex flex-col items-center">
                <label className="w-28 h-28 rounded-3xl border-4 border-gray-50 cursor-pointer overflow-hidden bg-gray-100 shadow-inner group relative">
                  {editingMember?.photo ? (
                    <img src={editingMember.photo} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <Camera className="w-8 h-8 mb-1" />
                      <span className="text-[10px] font-bold">사진 선택</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="text-white w-6 h-6" />
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, false)} />
                </label>
              </section>
              <div className="space-y-4">
                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-800 focus:border-[#073763] focus:bg-white transition-all" placeholder="이름 (예: 홍길동)" value={editingMember?.name || ''} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} />
                <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-800 focus:border-[#073763] focus:bg-white transition-all" placeholder="전화번호 (010-0000-0000)" type="tel" value={editingMember?.phone || ''} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} />
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 ml-1 uppercase">직책</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-800 focus:border-[#073763]" value={editingMember?.clubRole || ClubRole.MEMBER} onChange={(e) => setEditingMember({...editingMember, clubRole: e.target.value as ClubRole})}>
                    {Object.values(ClubRole).map(role => <option key={role} value={role}>{role}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-400 mb-2 ml-1 uppercase">주 포지션</label>
                  <div className="flex gap-2">
                    {Object.values(Position).map(pos => (
                      <button key={pos} onClick={() => setEditingMember({...editingMember, position: pos})} className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${editingMember?.position === pos ? 'bg-[#073763] text-white border-[#073763]' : 'bg-white text-gray-400 border-gray-100'}`}>{pos}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 bg-white border-t">
              <button onClick={handleSaveMember} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-[#073763]/20 active:scale-95 transition-transform">저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* Match Form Modal */}
      {showMatchForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="bg-white p-5 flex justify-between items-center border-b">
              <h3 className="text-xl font-black text-[#073763]">경기 기록</h3>
              <button onClick={() => setShowMatchForm(false)} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-6 h-6"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Match Header Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">날짜</label>
                  <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#073763] outline-none" value={newMatch.date} onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">구분</label>
                  <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#073763] outline-none" value={newMatch.category} onChange={(e) => setNewMatch({...newMatch, category: e.target.value})}>
                    <option value="매일매일">매일매일</option>
                    <option value="토요더비">토요더비</option>
                    <option value="친선경기">친선경기</option>
                    <option value="대회">대회</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-black text-gray-400 ml-1 uppercase">장소</label>
                  <select 
                    className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-[#073763] outline-none" 
                    value={newMatch.venue} 
                    onChange={(e) => setNewMatch({...newMatch, venue: e.target.value})}
                  >
                    <option value="대천초등">대천초등</option>
                    <option value="시설공단">시설공단</option>
                    <option value="박지성센터">박지성센터</option>
                    <option value="기타">기타</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-3xl border border-blue-100">
                  <label className="block text-xs font-black text-blue-800 mb-2 text-center">봉팀 점수 (자동)</label>
                  <div className="w-full bg-transparent text-center text-4xl font-black text-blue-900">{newMatch.scoreA}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-3xl border border-red-100">
                  <label className="block text-xs font-black text-red-800 mb-2 text-center">학팀 점수 (자동)</label>
                  <div className="w-full bg-transparent text-center text-4xl font-black text-red-900">{newMatch.scoreB}</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="h-44 border rounded-2xl overflow-hidden bg-gray-50 flex flex-col">
                  <div className="p-2 bg-blue-100/50 text-[#073763] text-[10px] font-black uppercase tracking-wider text-center">
                    봉팀 선수 (A) {newMatch.teamA?.length ? `(${newMatch.teamA.length})` : ''}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <MemberSelector members={members} selectedIds={newMatch.teamA || []} onToggle={(id) => setNewMatch({ ...newMatch, teamA: newMatch.teamA?.includes(id) ? newMatch.teamA.filter(i => i !== id) : [...(newMatch.teamA || []), id] })} />
                  </div>
                </div>
                <div className="h-44 border rounded-2xl overflow-hidden bg-gray-50 flex flex-col">
                  <div className="p-2 bg-red-100/50 text-[#073763] text-[10px] font-black uppercase tracking-wider text-center">
                    학팀 선수 (B) {newMatch.teamB?.length ? `(${newMatch.teamB.length})` : ''}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <MemberSelector members={members} selectedIds={newMatch.teamB || []} onToggle={(id) => setNewMatch({ ...newMatch, teamB: newMatch.teamB?.includes(id) ? newMatch.teamB.filter(i => i !== id) : [...(newMatch.teamB || []), id] })} />
                  </div>
                </div>
              </div>

              {(newMatch.teamA?.length || 0) + (newMatch.teamB?.length || 0) > 0 && (
                <div className="space-y-6 pt-2">
                  <h4 className="text-sm font-black text-gray-400 ml-1 flex items-center gap-2">
                    <Medal className="w-4 h-4" /> 상세 기록 (득점 입력 시 점수 자동 합산)
                  </h4>
                  {newMatch.teamA && newMatch.teamA.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 px-1 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                        봉팀 상세 기록 (A)
                      </div>
                      <div className="space-y-2">
                        {newMatch.teamA.map(id => renderPlayerRecordInput(id, 'blue'))}
                      </div>
                    </div>
                  )}
                  {newMatch.teamB && newMatch.teamB.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-[10px] font-black text-red-600 px-1 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                        학팀 상세 기록 (B)
                      </div>
                      <div className="space-y-2">
                        {newMatch.teamB.map(id => renderPlayerRecordInput(id, 'red'))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-6 border-t bg-white">
              <div className="mb-4 text-center">
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                  newMatch.scoreA! > newMatch.scoreB! ? 'bg-blue-100 text-blue-700' : 
                  newMatch.scoreA! < newMatch.scoreB! ? 'bg-red-100 text-red-700' : 
                  'bg-gray-100 text-gray-700'
                }`}>
                  {newMatch.scoreA! > newMatch.scoreB! ? '봉팀 승리 예상' : 
                   newMatch.scoreA! < newMatch.scoreB! ? '학팀 승리 예상' : 
                   '무승부 예상'}
                </span>
              </div>
              <button onClick={handleSaveMatch} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-[#073763]/20 active:scale-95 transition-transform">경기 기록 저장</button>
            </div>
          </div>
        </div>
      )}

      {/* Match Detail Modal */}
      {selectedMatchDetail && (
        <MatchDetailModal 
          match={selectedMatchDetail} 
          onClose={() => setSelectedMatchDetail(null)} 
        />
      )}
    </div>
  );
};

export default App;
