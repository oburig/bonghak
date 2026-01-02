
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { LayoutDashboard, Users, Trophy, PlayCircle, Shield, MessageCircle, Phone, Plus, Camera, Send, Edit2, Trash2, X, User, Hash, Calendar, RefreshCw, Loader2, Briefcase, WifiOff, CloudCheck, MapPin, Tag, AlertCircle, Info, Swords, Medal } from 'lucide-react';
import { Member, Match, MatchRecord, Position, ClubRole, PersonalStats } from './types';
import { INITIAL_MEMBERS } from './constants';
import { TacticsBoard } from './components/TacticsBoard';
import { MemberSelector } from './components/MemberSelector';

// 대한민국 시간(KST) YYYY-MM-DD 문자열을 반환하는 유틸리티
const getKSTDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
};

// 주의: GAS 배포 시 "액세스 권한: 모든 사용자(Anyone)"로 설정했는지 꼭 확인하세요!
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbweLgMusWlfUFJw5DrwOVb7Nxd2VQHV7Gzqja28FVjSNQSEeDi5WAnLqTrASEfNMnZw/exec';

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
    if (typeof data === 'object') return data;
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
          teamA: safeJsonParse(m.teamA),
          teamB: safeJsonParse(m.teamB),
          records: safeJsonParse(m.records),
          scoreA: Number(m.scoreA || 0),
          scoreB: Number(m.scoreB || 0),
          category: m.category || '매일매일',
          venue: m.venue || '대천초등',
          date: m.date || getKSTDateString(),
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
      sMap[m.id] = { memberId: m.id, name: m.name, goals: 0, assists: 0, mvpCount: 0, wins: 0, draws: 0, losses: 0, points: 0 };
    });

    matches.forEach(m => {
      const sA = Number(m.scoreA || 0);
      const sB = Number(m.scoreB || 0);
      const isDraw = sA === sB;
      const teamAWon = sA > sB;

      (m.teamA || []).forEach(id => {
        if (!sMap[id]) return;
        if (isDraw) { sMap[id].draws++; sMap[id].points += 1; }
        else if (teamAWon) { sMap[id].wins++; sMap[id].points += 3; }
        else { sMap[id].losses++; }
      });

      (m.teamB || []).forEach(id => {
        if (!sMap[id]) return;
        if (isDraw) { sMap[id].draws++; sMap[id].points += 1; }
        else if (!teamAWon) { sMap[id].wins++; sMap[id].points += 3; }
        else { sMap[id].losses++; }
      });

      (m.records || []).forEach(rec => {
        if (sMap[rec.memberId]) {
          sMap[rec.memberId].goals += Number(rec.goals || 0);
          sMap[rec.memberId].assists += Number(rec.assists || 0);
          if (rec.isMvp) sMap[rec.memberId].mvpCount++;
        }
      });
    });

    return Object.values(sMap).sort((a, b) => b.points - a.points || b.goals - a.goals);
  }, [matches, members]);

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

    const teamANames = (newMatch.teamA || []).map(id => members.find(m => m.id === id)?.name || id);
    const teamBNames = (newMatch.teamB || []).map(id => members.find(m => m.id === id)?.name || id);
    const recordsWithNames = (newMatch.records || []).map(r => ({
      name: members.find(m => m.id === r.memberId)?.name || r.memberId,
      goals: r.goals,
      assists: r.assists,
      isMvp: r.isMvp
    }));

    const payload = {
      type: 'Matches', action: 'add',
      row: [
        matchId, 
        newMatch.date, 
        JSON.stringify(teamANames), 
        JSON.stringify(teamBNames), 
        newMatch.scoreA, 
        newMatch.scoreB, 
        JSON.stringify(recordsWithNames), 
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
                     <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                     <div className="text-[10px] font-bold">Bong Team Leads</div>
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
                        <div className="text-[10px] text-gray-400 font-bold">
                          {m.date ? m.date.substring(0, 10) : '날짜 없음'}
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
                      <div className="flex justify-between items-center px-4">
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
            <h2 className="text-xl font-bold px-2 text-[#073763]">개인 기록 랭킹</h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left font-bold text-gray-500">순위</th>
                    <th className="p-4 text-left font-bold text-gray-500">이름</th>
                    <th className="p-4 text-center font-bold text-gray-500">득점</th>
                    <th className="p-4 text-center font-bold text-gray-500">도움</th>
                    <th className="p-4 text-right font-bold text-[#073763]">PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.slice(0, 20).map((s, idx) => {
                    const isTop3 = idx < 3;
                    const medalClass = idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-300 text-white' : idx === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-400';
                    return (
                      <tr key={s.memberId} className={`border-b last:border-0 ${isTop3 ? 'bg-gray-50/50' : ''}`}>
                        <td className="p-4"><span className={`inline-block w-6 h-6 text-center rounded-lg text-xs font-bold leading-6 ${medalClass}`}>{idx + 1}</span></td>
                        <td className="p-4 font-bold text-gray-800">{s.name}</td>
                        <td className="p-4 text-center font-medium">{s.goals}</td>
                        <td className="p-4 text-center font-medium">{s.assists}</td>
                        <td className="p-4 text-right text-[#073763] font-black">{s.points}</td>
                      </tr>
                    );
                  })}
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
    </div>
  );
};

export default App;
