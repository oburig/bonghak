
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Trophy, PlayCircle, Shield, MessageCircle, Phone, Plus, Camera, Send, Edit2, Trash2, X, User, Hash, Calendar, RefreshCw, Loader2, Briefcase, WifiOff, Cloud, MapPin, Tag, AlertCircle, Info, Swords, Medal, Search, Filter, ChevronRight, Target, Award } from 'lucide-react';
import { Member, Match, MatchRecord, Position, ClubRole, PersonalStats } from './types';
import { INITIAL_MEMBERS } from './constants';
import { TacticsBoard } from './components/TacticsBoard';
import { MemberSelector } from './components/MemberSelector';

const getKSTDateString = () => {
  const now = new Date();
  const kstDate = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  return kstDate.toISOString().split('T')[0];
};

const parseToKSTDate = (dateInput: any) => {
  if (!dateInput) return getKSTDateString();
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput).substring(0, 10);
    const kstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000));
    return kstDate.toISOString().split('T')[0];
  } catch (e) {
    return String(dateInput || '').substring(0, 10) || getKSTDateString();
  }
};

const formatKoreanDate = (dateStr: string) => {
  if (!dateStr || typeof dateStr !== 'string') return '날짜 없음';
  try {
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);
    if (isNaN(date.getTime())) return dateStr;
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

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweLgMusWlfUFJw5DrwOVb7Nxd2VQHV7Gzqja28FVjSNQSEeDi5WAnLqTrASEfNMnZw/exec';

type SortType = 'points' | 'appearances' | 'goals' | 'assists';

const App: React.FC = () => {
  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const saved = localStorage.getItem('bh_members');
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch (e) { return INITIAL_MEMBERS; }
  });
  const [matches, setMatches] = useState<Match[]>(() => {
    try {
      const saved = localStorage.getItem('bh_matches');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [selectedMatchDetail, setSelectedMatchDetail] = useState<Match | null>(null);
  const [statsSearch, setStatsSearch] = useState('');
  const [statsSort, setStatsSort] = useState<SortType>('points');
  const [editingMember, setEditingMember] = useState<Partial<Member> | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

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

  useEffect(() => {
    if (showMatchForm) {
      const calculatedScoreA = (newMatch.records || [])
        .filter(r => (newMatch.teamA || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0);
      const calculatedScoreB = (newMatch.records || [])
        .filter(r => (newMatch.teamB || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0);
      if (calculatedScoreA !== newMatch.scoreA || calculatedScoreB !== newMatch.scoreB) {
        setNewMatch(prev => ({ ...prev, scoreA: calculatedScoreA, scoreB: calculatedScoreB }));
      }
    }
  }, [newMatch.records, newMatch.teamA, newMatch.teamB, showMatchForm]);

  useEffect(() => { localStorage.setItem('bh_members', JSON.stringify(members)); }, [members]);
  useEffect(() => { localStorage.setItem('bh_matches', JSON.stringify(matches)); }, [matches]);

  const safeJsonParse = (data: any): any[] => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    try {
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
  };

  const fetchData = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setSyncStatus('idle');
    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, { method: 'GET', cache: 'no-store', mode: 'cors' });
      if (!response.ok) throw new Error("Fetch failed");
      
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.error("Server response is not valid JSON:", text);
        throw new Error("Invalid JSON");
      }
      
      if (data && data.members && Array.isArray(data.members)) {
        const validated = data.members.filter((m: any) => m && (m.id || m.name)).map((m: any) => ({
          ...m, id: String(m.id || Date.now() + Math.random())
        }));
        if (validated.length > 0) setMembers(validated);
      }
      
      if (data && data.matches && Array.isArray(data.matches)) {
        setMatches(data.matches.map((m: any) => ({
          ...m,
          id: String(m.id),
          teamA: safeJsonParse(m.teamA).map((id: any) => String(id)),
          teamB: safeJsonParse(m.teamB).map((id: any) => String(id)),
          records: safeJsonParse(m.records).map((r: any) => ({ ...r, memberId: String(r.memberId || '') })),
          scoreA: Number(m.scoreA || 0),
          scoreB: Number(m.scoreB || 0),
          category: m.category || '매일매일',
          venue: m.venue || '대천초등',
          date: parseToKSTDate(m.date),
        })));
      }
      setSyncStatus('success');
    } catch (error: any) {
      console.error('Data sync failed:', error.message);
      setSyncStatus('error');
    } finally { setLoading(false); }
  }, [loading]);

  useEffect(() => { fetchData(); }, []);

  const syncToSheet = async (payload: any) => {
    setLoading(true);
    setSyncStatus('idle');
    try {
      await fetch(GOOGLE_SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
      setSyncStatus('success');
      setTimeout(() => fetchData(), 2000);
    } catch (error) { setSyncStatus('error'); }
    finally { setLoading(false); }
  };

  const stats = useMemo(() => {
    const sMap: Record<string, PersonalStats> = {};
    members.forEach(m => {
      if (m && m.id) sMap[m.id] = { memberId: m.id, name: m.name, goals: 0, assists: 0, mvpCount: 0, wins: 0, draws: 0, losses: 0, points: 0, appearances: 0 };
    });
    matches.forEach(m => {
      if (!m) return;
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
        if (!rec) return;
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
    if (statsSearch.trim()) result = result.filter(s => s.name.includes(statsSearch.trim()));
    return result.sort((a, b) => {
      if (statsSort === 'points') return b.points - a.points || b.goals - a.goals;
      if (statsSort === 'appearances') return b.appearances - a.appearances || b.points - a.points;
      if (statsSort === 'goals') return b.goals - a.goals || b.assists - a.assists;
      if (statsSort === 'assists') return b.assists - a.assists || b.goals - a.goals;
      return 0;
    });
  }, [matches, members, statsSearch, statsSort]);

  const teamTotalStats = useMemo(() => {
    let winsA = 0, winsB = 0, draws = 0;
    matches.forEach(m => {
      if (!m) return;
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      if (sA > sB) winsA++; else if (sB > sA) winsB++; else draws++;
    });
    return { winsA, winsB, draws, total: matches.length };
  }, [matches]);

  const handleSaveMatch = () => {
    if (!newMatch.teamA?.length || !newMatch.teamB?.length) return alert("두 팀 모두 선수를 선택해주세요.");
    const isEdit = !!editingMatchId;
    const matchId = editingMatchId || Date.now().toString();
    const teamAIds = newMatch.teamA || [];
    const teamBIds = newMatch.teamB || [];
    const recordsWithIds = (newMatch.records || []).map(r => ({
      memberId: String(r.memberId),
      name: members.find(m => m.id === r.memberId)?.name || '',
      goals: r.goals, assists: r.assists, isMvp: r.isMvp
    }));
    const payload = {
      type: 'Matches', action: isEdit ? 'update' : 'add', id: matchId,
      row: [matchId, newMatch.date, JSON.stringify(teamAIds), JSON.stringify(teamBIds), newMatch.scoreA, newMatch.scoreB, JSON.stringify(recordsWithIds), newMatch.photo || '', newMatch.category, newMatch.venue]
    };
    syncToSheet(payload);
    setShowMatchForm(false); setEditingMatchId(null);
    setNewMatch({ date: getKSTDateString(), category: '매일매일', venue: '대천초등', teamA: [], teamB: [], scoreA: 0, scoreB: 0, records: [] });
  };

  const handleSaveMember = () => {
    if (!editingMember?.name || !editingMember?.phone) return alert("이름과 전화번호를 입력해주세요.");
    const isNew = !editingMember.id;
    const memberId = editingMember.id || `mem-${Date.now()}`;
    const row = [memberId, editingMember.name, editingMember.phone, editingMember.position || Position.MF, editingMember.photo || `https://picsum.photos/seed/${memberId}/200`, editingMember.clubRole || ClubRole.MEMBER];
    syncToSheet({ type: 'Members', action: isNew ? 'add' : 'update', id: memberId, row });
    setShowMemberForm(false); setEditingMember(null);
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
            <input type="number" className="w-16 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none" value={record.goals} onChange={(e) => {
              const other = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...other, { ...record, goals: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <div className="relative">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-gray-400">A</span>
            <input type="number" className="w-16 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none" value={record.assists} onChange={(e) => {
              const other = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...other, { ...record, assists: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <button onClick={() => {
            const other = (newMatch.records || []).map(r => ({ ...r, isMvp: false }));
            setNewMatch({ ...newMatch, records: [...other.filter(r => r.memberId !== id), { ...record, isMvp: !record.isMvp }] });
          }} className={`p-1.5 px-2.5 rounded-lg text-[9px] font-black transition-all ${record.isMvp ? 'bg-yellow-400 text-white' : 'bg-white text-gray-300'}`}>MVP</button>
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
            <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /><h3 className="text-lg font-black text-[#073763]">경기 상세 리포트</h3></div>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-8">
            <div className="bg-[#073763] rounded-2xl p-6 text-white text-center">
              <div className="text-[10px] font-bold opacity-60 mb-2">{formatKoreanDate(match.date)}</div>
              <div className="flex justify-around items-center">
                <div className="text-center"><div className="text-4xl font-black text-blue-300">{match.scoreA}</div><div className="text-xs font-bold mt-1 opacity-80">봉팀</div></div>
                <div className="text-lg font-black opacity-30">VS</div>
                <div className="text-center"><div className="text-4xl font-black text-red-300">{match.scoreB}</div><div className="text-xs font-bold mt-1 opacity-80">학팀</div></div>
              </div>
            </div>
            {mvpMember && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="bg-yellow-400 p-2 rounded-xl text-white"><Award className="w-8 h-8" /></div>
                <div><div className="text-[10px] font-black text-yellow-600 uppercase">Match MVP</div><div className="text-lg font-black text-yellow-900">{mvpMember.name}</div></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3"><div className="text-xs font-black text-blue-600 px-1 border-b pb-2">BONG TEAM</div>
                {match.teamA.map(id => {
                  const m = members.find(mem => mem.id === id);
                  return m ? <div key={id} className="flex items-center gap-2 p-2 bg-blue-50/50 rounded-xl border border-blue-100 text-[10px] font-bold"><img src={m.photo} className="w-6 h-6 rounded-full" />{m.name}</div> : null;
                })}
              </div>
              <div className="space-y-3"><div className="text-xs font-black text-red-600 px-1 border-b pb-2">HAK TEAM</div>
                {match.teamB.map(id => {
                  const m = members.find(mem => mem.id === id);
                  return m ? <div key={id} className="flex items-center gap-2 p-2 bg-red-50/50 rounded-xl border border-red-100 text-[10px] font-bold"><img src={m.photo} className="w-6 h-6 rounded-full" />{m.name}</div> : null;
                })}
              </div>
            </div>
          </div>
          <div className="p-5 border-t bg-gray-50"><button onClick={onClose} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black">닫기</button></div>
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
      <header className="bg-[#073763] text-white p-4 sticky top-0 z-10 shadow-md flex justify-between items-center">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> BongHak Manager</h1></div>
        <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-[#073763] rounded-3xl p-5 shadow-xl text-white">
              <h2 className="text-lg font-bold mb-4">봉팀 vs 학팀 통산 전적</h2>
              <div className="flex justify-between items-end gap-4">
                <div className="flex-1 text-center"><div className="text-3xl font-black text-blue-300">{teamTotalStats.winsA}</div><div className="text-[10px] font-bold opacity-60">봉팀 승</div></div>
                <div className="px-4 py-1 bg-white/10 rounded-full text-xs font-black">{teamTotalStats.draws} 무</div>
                <div className="flex-1 text-center"><div className="text-3xl font-black text-red-300">{teamTotalStats.winsB}</div><div className="text-[10px] font-bold opacity-60">학팀 승</div></div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#073763]"><PlayCircle className="w-5 h-5" /> 최근 결과</h2>
              <div className="space-y-4">
                {matches.slice(0, 3).map(m => (
                  <div key={m.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between text-[10px] text-gray-500 font-black mb-1"><div>{formatKoreanDate(m.date)}</div><div>{m.venue}</div></div>
                    <div className="flex justify-between items-center px-4">
                      <div className="text-2xl font-black text-blue-800">{m.scoreA}</div><div className="font-bold text-gray-200">VS</div><div className="text-2xl font-black text-red-800">{m.scoreB}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setSelectedMatchDetail(m)} className="flex-1 py-2 bg-gray-50 text-[10px] font-black rounded-lg">상세보기</button>
                      <button onClick={() => { setNewMatch({ ...m }); setEditingMatchId(m.id); setShowMatchForm(true); }} className="px-3 py-2 bg-[#073763]/10 text-[#073763] text-[10px] font-black rounded-lg">수정</button>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => { setNewMatch({ date: getKSTDateString(), category: '매일매일', venue: '대천초등', teamA: [], teamB: [], scoreA: 0, scoreB: 0, records: [] }); setEditingMatchId(null); setShowMatchForm(true); }} className="w-full mt-4 bg-red-600 text-white py-4 rounded-2xl font-bold">새 경기 기록하기</button>
            </div>
            <TacticsBoard members={members} />
          </div>
        )}
        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2"><h2 className="text-xl font-bold text-[#073763]">회원 ({members.length})</h2><button onClick={() => { setEditingMember({ position: Position.MF, clubRole: ClubRole.MEMBER }); setShowMemberForm(true); }} className="p-3 bg-[#073763] text-white rounded-2xl"><Plus className="w-6 h-6" /></button></div>
            {members.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-gray-100">
                <img src={m.photo || `https://picsum.photos/seed/${m.id}/200`} className="w-14 h-14 rounded-full" />
                <div className="flex-1"><div className="font-bold">{m.name}</div><div className="text-xs text-gray-500">{m.position} | {m.phone}</div></div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingMember(m); setShowMemberForm(true); }} className="p-2.5 bg-gray-50 rounded-xl"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => window.location.href = `tel:${m.phone}`} className="p-2.5 bg-[#073763]/10 rounded-xl"><Phone className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="space-y-4"><h2 className="text-xl font-bold text-[#073763] px-2">랭킹</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b"><tr><th className="p-4 text-left">순위</th><th className="p-4 text-left">이름</th><th className="p-4 text-center">출전</th><th className="p-4 text-center">득점</th><th className="p-4 text-right">PTS</th></tr></thead>
                <tbody>{stats.slice(0, 50).map((s, idx) => (
                  <tr key={s.memberId} className="border-b last:border-0"><td className="p-4 font-bold">{idx + 1}</td><td className="p-4 font-bold">{s.name}</td><td className="p-4 text-center">{s.appearances}</td><td className="p-4 text-center">{s.goals}</td><td className="p-4 text-right font-black text-[#073763]">{s.points}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 max-w-md mx-auto z-20 pb-6">
        {[{ id: 'dashboard', icon: LayoutDashboard, label: '홈' }, { id: 'members', icon: Users, label: '회원' }, { id: 'stats', icon: Trophy, label: '기록' }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex flex-col items-center gap-1 ${activeTab === tab.id ? 'text-[#073763]' : 'text-gray-400'}`}><tab.icon className="w-6 h-6" /><span className="text-[10px] font-bold">{tab.label}</span></button>
        ))}
      </nav>
      {showMemberForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 flex justify-between items-center border-b"><h3 className="text-xl font-black text-[#073763]">회원 관리</h3><button onClick={() => { setShowMemberForm(false); setEditingMember(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button></div>
            <div className="flex-1 p-6 space-y-4">
              <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" placeholder="이름" value={editingMember?.name || ''} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} />
              <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold" placeholder="전화번호" type="tel" value={editingMember?.phone || ''} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} />
            </div>
            <div className="p-6 border-t"><button onClick={handleSaveMember} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black">저장</button></div>
          </div>
        </div>
      )}
      {showMatchForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 flex justify-between items-center border-b"><h3 className="text-xl font-black text-[#073763]">경기 기록</h3><button onClick={() => { setShowMatchForm(false); setEditingMatchId(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button></div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <input type="date" className="w-full p-3 bg-gray-50 border rounded-xl font-bold" value={newMatch.date} onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-3xl text-center font-black text-blue-900 text-3xl">{newMatch.scoreA}</div>
                <div className="bg-red-50 p-4 rounded-3xl text-center font-black text-red-900 text-3xl">{newMatch.scoreB}</div>
              </div>
              <div className="h-72 border rounded-2xl overflow-hidden"><MemberSelector members={members} selectedIds={newMatch.teamA || []} onToggle={(id) => setNewMatch({ ...newMatch, teamA: newMatch.teamA?.includes(id) ? newMatch.teamA.filter(i => i !== id) : [...(newMatch.teamA || []), id] })} /></div>
              <div className="h-72 border rounded-2xl overflow-hidden"><MemberSelector members={members} selectedIds={newMatch.teamB || []} onToggle={(id) => setNewMatch({ ...newMatch, teamB: newMatch.teamB?.includes(id) ? newMatch.teamB.filter(i => i !== id) : [...(newMatch.teamB || []), id] })} /></div>
              {(newMatch.teamA?.length || 0) + (newMatch.teamB?.length || 0) > 0 && <div className="space-y-4">
                {newMatch.teamA?.map(id => renderPlayerRecordInput(id, 'blue'))}
                {newMatch.teamB?.map(id => renderPlayerRecordInput(id, 'red'))}
              </div>}
            </div>
            <div className="p-6 border-t"><button onClick={handleSaveMatch} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black">저장</button></div>
          </div>
        </div>
      )}
      {selectedMatchDetail && <MatchDetailModal match={selectedMatchDetail} onClose={() => setSelectedMatchDetail(null)} />}
    </div>
  );
};

export default App;
