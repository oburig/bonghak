
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { LayoutDashboard, Users, Trophy, PlayCircle, Shield, MessageCircle, Phone, Plus, Camera, Send, Edit2, Trash2, X, User, Hash, Calendar, RefreshCw, Loader2, Briefcase, WifiOff, Cloud, MapPin, Tag, AlertCircle, Info, Swords, Medal, Search, Filter, ChevronRight, Target, Award, Footprints, Image as ImageIcon, Lock, CheckCircle2, FileText, CircleDot } from 'lucide-react';
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
const ADMIN_PASSWORD = '1716';

type SortType = 'points' | 'appearances' | 'goals' | 'assists' | 'mvp' | 'ownGoals' | 'winRate';

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
  const [statsSearch, setSearchTerm] = useState('');
  const [statsSort, setStatsSort] = useState<SortType>('points');
  const [editingMember, setEditingMember] = useState<Partial<Member> | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'tab' | 'action', value: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const memberPhotoInputRef = useRef<HTMLInputElement>(null);

  const [newMatch, setNewMatch] = useState<Partial<Match>>({
    date: getKSTDateString(),
    category: '매일매일',
    venue: '대천초등',
    teamA: [],
    teamB: [],
    scoreA: 0,
    scoreB: 0,
    records: [],
    photo: '',
    memo: ''
  });

  useEffect(() => {
    if (showMatchForm) {
      const calculatedScoreA = (newMatch.records || [])
        .filter(r => (newMatch.teamA || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0) +
        (newMatch.records || [])
        .filter(r => (newMatch.teamB || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.ownGoals) || 0), 0);
      const calculatedScoreB = (newMatch.records || [])
        .filter(r => (newMatch.teamB || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.goals) || 0), 0) +
        (newMatch.records || [])
        .filter(r => (newMatch.teamA || []).includes(r.memberId))
        .reduce((sum, r) => sum + (Number(r.ownGoals) || 0), 0);
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
      try { data = JSON.parse(text); } catch (e) { throw new Error("Invalid JSON"); }
      
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
          photo: m.photo || '',
          memo: m.memo || '',
        })));
      }
      setSyncStatus('success');
    } catch (error: any) {
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
      if (m && m.id) sMap[m.id] = { 
        memberId: m.id, name: m.name, goals: 0, assists: 0, ownGoals: 0, mvpCount: 0, 
        wins: 0, draws: 0, losses: 0, 
        winsA: 0, drawsA: 0, lossesA: 0, 
        winsB: 0, drawsB: 0, lossesB: 0, 
        points: 0, appearances: 0, winRate: 0 
      };
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
        if (isDraw) { 
          sMap[strId].draws++; 
          sMap[strId].drawsA++;
          sMap[strId].points += 1; 
        }
        else if (teamAWon) { 
          sMap[strId].wins++; 
          sMap[strId].winsA++;
          sMap[strId].points += 3; 
        }
        else { 
          sMap[strId].losses++; 
          sMap[strId].lossesA++;
        }
      });
      (m.teamB || []).forEach(id => {
        const strId = String(id);
        if (!sMap[strId]) return;
        sMap[strId].appearances++;
        if (isDraw) { 
          sMap[strId].draws++; 
          sMap[strId].drawsB++;
          sMap[strId].points += 1; 
        }
        else if (!teamAWon) { 
          sMap[strId].wins++; 
          sMap[strId].winsB++;
          sMap[strId].points += 3; 
        }
        else { 
          sMap[strId].losses++; 
          sMap[strId].lossesB++;
        }
      });
      (m.records || []).forEach(rec => {
        if (!rec) return;
        const targetId = String(rec.memberId || '');
        const finalId = sMap[targetId] ? targetId : members.find(mem => mem.name === rec.name)?.id;
        if (finalId && sMap[finalId]) {
          sMap[finalId].goals += Number(rec.goals || 0);
          sMap[finalId].assists += Number(rec.assists || 0);
          sMap[finalId].ownGoals += Number(rec.ownGoals || 0);
          if (rec.isMvp) sMap[finalId].mvpCount++;
          // 자살골 1개당 승점 1점 차감 (마이너스골 제안 반영)
          sMap[finalId].points -= Number(rec.ownGoals || 0);
        }
      });
    });
    Object.values(sMap).forEach(s => {
      if (s.appearances > 0) {
        s.winRate = (s.wins / s.appearances) * 100;
      }
    });
    let result = Object.values(sMap);
    if (statsSearch.trim()) result = result.filter(s => s.name.includes(statsSearch.trim()));
    return result.sort((a, b) => {
      if (statsSort === 'points') return b.points - a.points || b.goals - a.goals;
      if (statsSort === 'appearances') return b.appearances - a.appearances || b.points - a.points;
      if (statsSort === 'goals') return b.goals - a.goals || b.assists - a.assists;
      if (statsSort === 'assists') return b.assists - a.assists || b.goals - a.goals;
      if (statsSort === 'mvp') return b.mvpCount - a.mvpCount || b.points - a.points;
      if (statsSort === 'ownGoals') return b.ownGoals - a.ownGoals || b.points - a.points;
      if (statsSort === 'winRate') return b.winRate - a.winRate || b.points - a.points;
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

  const sortedMatches = useMemo(() => {
    return [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches]);

  const checkAuth = (type: 'tab' | 'action', value: string) => {
    if (isAuthorized) {
      if (type === 'tab') setActiveTab(value);
      return true;
    }
    setPendingAction({ type, value });
    setShowPasswordModal(true);
    return false;
  };

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthorized(true);
      setShowPasswordModal(false);
      setPasswordInput('');
      setPasswordError(false);
      
      if (pendingAction) {
        if (pendingAction.type === 'tab') setActiveTab(pendingAction.value);
        setPendingAction(null);
      }
    } else {
      setPasswordError(true);
    }
  };

  const handleSaveMatch = () => {
    if (!newMatch.teamA?.length || !newMatch.teamB?.length) return alert("두 팀 모두 선수를 선택해주세요.");
    const isEdit = !!editingMatchId;
    const matchId = editingMatchId || Date.now().toString();
    const teamAIds = newMatch.teamA || [];
    const teamBIds = newMatch.teamB || [];
    const recordsWithIds = (newMatch.records || []).map(r => ({
      memberId: String(r.memberId),
      name: members.find(m => m.id === r.memberId)?.name || '',
      goals: r.goals, assists: r.assists, ownGoals: r.ownGoals || 0, isMvp: r.isMvp
    }));
    
    // 사진 데이터(newMatch.photo)가 포함되어 있는지 확실히 확인
    const photoData = String(newMatch.photo || '');

    const payload = {
      type: 'Matches', 
      action: isEdit ? 'update' : 'add', 
      id: matchId,
      row: [
        matchId, 
        newMatch.date, 
        JSON.stringify(teamAIds), 
        JSON.stringify(teamBIds), 
        newMatch.scoreA, 
        newMatch.scoreB, 
        JSON.stringify(recordsWithIds), 
        photoData, 
        newMatch.category, 
        newMatch.venue, 
        newMatch.memo || ''
      ]
    };
    
    syncToSheet(payload);
    setShowMatchForm(false); 
    setEditingMatchId(null);
    setNewMatch({ 
      date: getKSTDateString(), 
      category: '매일매일', 
      venue: '대천초등', 
      teamA: [], 
      teamB: [], 
      scoreA: 0, 
      scoreB: 0, 
      records: [], 
      photo: '', 
      memo: '' 
    });
  };

  const handleSaveMember = () => {
    if (!editingMember?.name || !editingMember?.phone) return alert("이름과 전화번호를 입력해주세요.");
    const isNew = !editingMember.id;
    const memberId = editingMember.id || `mem-${Date.now()}`;
    const row = [memberId, editingMember.name, editingMember.phone, editingMember.position || Position.MF, editingMember.photo || `https://picsum.photos/seed/${memberId}/200`, editingMember.clubRole || ClubRole.MEMBER];
    syncToSheet({ type: 'Members', action: isNew ? 'add' : 'update', id: memberId, row });
    setShowMemberForm(false); setEditingMember(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600; 
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.6);
        setNewMatch(prev => ({ ...prev, photo: base64String }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleMemberPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const SIZE = 400;
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, SIZE, SIZE);
        
        const base64String = canvas.toDataURL('image/jpeg', 0.8);
        setEditingMember(prev => ({ ...prev, photo: base64String }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const renderPlayerRecordInput = (id: string, teamColor: 'blue' | 'red') => {
    const m = members.find(member => member.id === id);
    if (!m) return null;
    const record = newMatch.records?.find(r => r.memberId === id) || { memberId: id, goals: 0, assists: 0, ownGoals: 0, isMvp: false };
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
            <input type="number" className="w-12 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none" value={record.goals} onChange={(e) => {
              const other = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...other, { ...record, goals: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <div className="relative">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-gray-400">A</span>
            <input type="number" className="w-12 p-1.5 bg-white border border-gray-100 rounded-lg text-center text-xs font-bold outline-none" value={record.assists} onChange={(e) => {
              const other = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...other, { ...record, assists: parseInt(e.target.value) || 0 }] });
            }} />
          </div>
          <div className="relative">
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[7px] font-black text-red-400">OG</span>
            <input type="number" className="w-12 p-1.5 bg-white border border-red-100 rounded-lg text-center text-xs font-bold outline-none text-red-600" value={record.ownGoals || 0} onChange={(e) => {
              const other = (newMatch.records || []).filter(r => r.memberId !== id);
              setNewMatch({ ...newMatch, records: [...other, { ...record, ownGoals: parseInt(e.target.value) || 0 }] });
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

    const teamAScorers = match.records.filter(r => match.teamA.includes(r.memberId) && r.goals > 0).sort((a,b) => b.goals - a.goals);
    const teamAAssists = match.records.filter(r => match.teamA.includes(r.memberId) && r.assists > 0).sort((a,b) => b.assists - a.assists);
    const teamAOwnGoals = match.records.filter(r => match.teamA.includes(r.memberId) && r.ownGoals > 0).sort((a,b) => b.ownGoals - a.ownGoals);
    const teamBScorers = match.records.filter(r => match.teamB.includes(r.memberId) && r.goals > 0).sort((a,b) => b.goals - a.goals);
    const teamBAssists = match.records.filter(r => match.teamB.includes(r.memberId) && r.assists > 0).sort((a,b) => b.assists - a.assists);
    const teamBOwnGoals = match.records.filter(r => match.teamB.includes(r.memberId) && r.ownGoals > 0).sort((a,b) => b.ownGoals - a.ownGoals);

    return (
      <div className="fixed inset-0 bg-black/60 z-[60] flex flex-col p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="p-5 flex justify-between items-center border-b">
            <div className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" /><h3 className="text-lg font-black text-[#073763]">경기 상세 리포트</h3></div>
            <button onClick={onClose} className="p-2 bg-gray-100 rounded-full text-gray-500"><X className="w-5 h-5"/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <div className="bg-[#073763] rounded-2xl p-6 text-white text-center">
              <div className="text-[10px] font-bold opacity-60 mb-2">{formatKoreanDate(match.date)}</div>
              <div className="flex justify-around items-center">
                <div className="text-center"><div className="text-4xl font-black text-blue-300">{match.scoreA}</div><div className="text-xs font-bold mt-1 opacity-80">봉팀</div></div>
                <div className="text-lg font-black opacity-30">VS</div>
                <div className="text-center"><div className="text-4xl font-black text-red-300">{match.scoreB}</div><div className="text-xs font-bold mt-1 opacity-80">학팀</div></div>
              </div>
            </div>

            {match.photo && (
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <img src={match.photo} alt="경기 사진" className="w-full h-48 object-cover" />
              </div>
            )}

            {match.memo && (
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <FileText className="w-3 h-3" /> 경기 메모
                </h4>
                <p className="text-xs font-medium text-gray-700 leading-relaxed whitespace-pre-wrap">{match.memo}</p>
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
               <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                 <Swords className="w-3 h-3" /> 주요 경기 기록
               </h4>
               
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-3">
                   <div className="text-[10px] font-black text-blue-600">BONG HIGHLIGHTS</div>
                   <div className="space-y-2">
                     {teamAScorers.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <Target className="w-3 h-3 text-blue-500" />
                         <span className="text-xs font-bold">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-blue-700 bg-blue-100 px-1.5 rounded-md">{r.goals}골</span>
                       </div>
                     ))}
                     {teamAAssists.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <Footprints className="w-3 h-3 text-emerald-500" />
                         <span className="text-xs font-medium text-gray-600">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 rounded-md">{r.assists}도움</span>
                       </div>
                     ))}
                     {teamAOwnGoals.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <AlertCircle className="w-3 h-3 text-red-500" />
                         <span className="text-xs font-medium text-gray-600">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 rounded-md">{r.ownGoals}자살골</span>
                       </div>
                     ))}
                     {teamAScorers.length === 0 && teamAAssists.length === 0 && teamAOwnGoals.length === 0 && <div className="text-[10px] text-gray-400 italic">기록 없음</div>}
                   </div>
                 </div>

                 <div className="space-y-3">
                   <div className="text-[10px] font-black text-red-600">HAK HIGHLIGHTS</div>
                   <div className="space-y-2">
                     {teamBScorers.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <Target className="w-3 h-3 text-red-500" />
                         <span className="text-xs font-bold">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 rounded-md">{r.goals}골</span>
                       </div>
                     ))}
                     {teamBAssists.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <Footprints className="w-3 h-3 text-emerald-500" />
                         <span className="text-xs font-medium text-gray-600">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 rounded-md">{r.assists}도움</span>
                       </div>
                     ))}
                     {teamBOwnGoals.map(r => (
                       <div key={r.memberId} className="flex items-center gap-2">
                         <AlertCircle className="w-3 h-3 text-red-500" />
                         <span className="text-xs font-medium text-gray-600">{members.find(m => m.id === r.memberId)?.name}</span>
                         <span className="text-[10px] font-black text-red-700 bg-red-100 px-1.5 rounded-md">{r.ownGoals}자살골</span>
                       </div>
                     ))}
                     {teamBScorers.length === 0 && teamBAssists.length === 0 && teamBOwnGoals.length === 0 && <div className="text-[10px] text-gray-400 italic">기록 없음</div>}
                   </div>
                 </div>
               </div>
            </div>

            {mvpMember && (
              <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4 flex items-center gap-4">
                <div className="bg-yellow-400 p-2 rounded-xl text-white"><Award className="w-8 h-8" /></div>
                <div><div className="text-[10px] font-black text-yellow-600 uppercase">Match MVP</div><div className="text-lg font-black text-yellow-900">{mvpMember.name}</div></div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="text-xs font-black text-blue-600 px-1 border-b pb-2 flex justify-between">
                  <span>BONG TEAM</span>
                  <span className="text-[10px] opacity-60">{match.teamA.length}명</span>
                </div>
                {match.teamA.map(id => {
                  const m = members.find(mem => mem.id === id);
                  const record = match.records.find(r => r.memberId === id);
                  return m ? (
                    <div key={id} className="flex items-center justify-between p-2 bg-blue-50/50 rounded-xl border border-blue-100 text-[10px] font-bold">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={m.photo} className="w-6 h-6 rounded-full flex-shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {record?.goals ? <span className="text-blue-600">{record.goals}G</span> : null}
                        {record?.assists ? <span className="text-emerald-600">{record.assists}A</span> : null}
                      </div>
                    </div>
                  ) : null;
                })}
              </div>
              <div className="space-y-3">
                <div className="text-xs font-black text-red-600 px-1 border-b pb-2 flex justify-between">
                  <span>HAK TEAM</span>
                  <span className="text-[10px] opacity-60">{match.teamB.length}명</span>
                </div>
                {match.teamB.map(id => {
                  const m = members.find(mem => mem.id === id);
                  const record = match.records.find(r => r.memberId === id);
                  return m ? (
                    <div key={id} className="flex items-center justify-between p-2 bg-red-50/50 rounded-xl border border-red-100 text-[10px] font-bold">
                      <div className="flex items-center gap-2 min-w-0">
                        <img src={m.photo} className="w-6 h-6 rounded-full flex-shrink-0" />
                        <span className="truncate">{m.name}</span>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {record?.goals ? <span className="text-red-600">{record.goals}G</span> : null}
                        {record?.assists ? <span className="text-emerald-600">{record.assists}A</span> : null}
                      </div>
                    </div>
                  ) : null;
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
      <header className="bg-[#073763] text-white p-4 sticky top-0 z-10 shadow-md flex flex-col gap-1">
        <div className="flex justify-between items-center">
          <div><h1 className="text-xl font-bold flex items-center gap-2"><Shield className="w-6 h-6" /> BongHak Manager</h1></div>
          <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
        <div className="flex items-center justify-between opacity-60">
          <div className="flex items-center gap-1.5">
            <Cloud className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-bold text-white">클라우드 동기화 완료</span>
          </div>
          <span className="text-[10px] font-bold text-white pr-1">하루를 리드하는 남자들</span>
        </div>
      </header>
      <main className="flex-1 p-4 overflow-y-auto">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-[#073763] rounded-[2rem] p-6 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-1/2 right-4 -translate-y-1/2 opacity-10 pointer-events-none">
                <CircleDot className="w-48 h-48 rotate-12 scale-110" />
              </div>

              <div className="relative z-10 space-y-5">
                <div>
                  <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">OVERALL RIVALRY RECORD</div>
                  <h2 className="text-xl font-black">봉팀 vs 학팀 통산 전적</h2>
                </div>

                <div className="flex justify-between items-center px-2">
                  <div className="flex flex-col items-center">
                    <div className="text-5xl font-black text-blue-400 mb-2">{teamTotalStats.winsA}</div>
                    <div className="text-[10px] font-bold text-white/70">봉팀 승</div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="px-5 py-2 bg-white/10 backdrop-blur-md rounded-full border border-white/10 shadow-sm mb-1">
                      <span className="text-[11px] font-black">{teamTotalStats.draws} 무승부</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                    <div className="text-5xl font-black text-red-400 mb-2">{teamTotalStats.winsB}</div>
                    <div className="text-[10px] font-bold text-white/70">학팀 승</div>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex justify-between items-center">
                  <div className="text-[10px] font-bold text-white/50">총 경기 수: {teamTotalStats.total}경기</div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${teamTotalStats.winsA > teamTotalStats.winsB ? 'bg-blue-400' : teamTotalStats.winsB > teamTotalStats.winsA ? 'bg-red-400' : 'bg-gray-400'}`} />
                    <span className="text-[10px] font-black uppercase tracking-tight">
                      {teamTotalStats.winsA > teamTotalStats.winsB ? 'Bong Team Leads' : teamTotalStats.winsB > teamTotalStats.winsA ? 'Hak Team Leads' : 'Evenly Matched'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-[#073763]"><PlayCircle className="w-5 h-5" /> 최근 경기 결과</h2>
              <div className="space-y-4">
                {sortedMatches.slice(0, 2).map(m => (
                  <div key={m.id} className="border-b pb-3 last:border-0">
                    <div className="flex justify-between text-[10px] text-gray-500 font-black mb-1">
                      <div>{formatKoreanDate(m.date)}</div>
                      <div className="flex gap-1">
                        <span>{m.category}</span>
                        <span>·</span>
                        <span>{m.venue}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center px-4">
                      <div className="text-2xl font-black text-blue-800">{m.scoreA}</div><div className="font-bold text-gray-200">VS</div><div className="text-2xl font-black text-red-800">{m.scoreB}</div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => setSelectedMatchDetail(m)} className="flex-1 py-2 bg-gray-50 text-[10px] font-black rounded-lg">상세보기</button>
                      <button onClick={() => { 
                        if (checkAuth('action', 'edit_match')) {
                          setNewMatch({ ...m }); setEditingMatchId(m.id); setShowMatchForm(true); 
                        }
                      }} className="px-3 py-2 bg-[#073763]/10 text-[#073763] text-[10px] font-black rounded-lg">수정</button>
                    </div>
                  </div>
                ))}
                {sortedMatches.length === 0 && (
                  <div className="text-center py-6 text-gray-400 text-xs font-medium">기록된 경기가 없습니다.</div>
                )}
              </div>
              <button onClick={() => { 
                setNewMatch({ date: getKSTDateString(), category: '매일매일', venue: '대천초등', teamA: [], teamB: [], scoreA: 0, scoreB: 0, records: [], photo: '', memo: '' }); setEditingMatchId(null); setShowMatchForm(true); 
              }} className="w-full mt-4 bg-red-600 text-white py-4 rounded-2xl font-bold">새 경기 기록하기</button>
            </div>
            <TacticsBoard members={members} />
          </div>
        )}

        {activeTab === 'matches_list' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold text-[#073763]">모든 경기</h2>
              <button onClick={() => { 
                setNewMatch({ date: getKSTDateString(), category: '매일매일', venue: '대천초등', teamA: [], teamB: [], scoreA: 0, scoreB: 0, records: [], photo: '', memo: '' }); setEditingMatchId(null); setShowMatchForm(true); 
              }} className="p-3 bg-[#073763] text-white rounded-2xl"><Plus className="w-6 h-6" /></button>
            </div>
            <div className="space-y-3">
              {sortedMatches.map(m => (
                <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3">
                  <div onClick={() => setSelectedMatchDetail(m)} className="flex items-center gap-4 active:scale-[0.98] transition-all cursor-pointer">
                    <div className="flex-shrink-0 w-12 h-12 bg-[#073763]/5 rounded-xl flex flex-col items-center justify-center">
                      <span className="text-[10px] font-black text-[#073763] uppercase leading-none mb-0.5">{m.date.split('-')[1]}월</span>
                      <span className="text-lg font-black text-[#073763] leading-none">{m.date.split('-')[2]}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-tighter">{m.category}</span>
                        <span className="text-[9px] font-bold text-gray-400">{m.venue}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-[#073763]">봉팀 {m.scoreA}</span>
                        <span className="text-[10px] font-black text-gray-300">VS</span>
                        <span className="text-sm font-bold text-[#073763]">학팀 {m.scoreB}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                  <div className="flex gap-2 pt-1 border-t">
                    <button 
                      onClick={() => {
                        if (checkAuth('action', 'edit_match')) {
                          setNewMatch({ ...m }); setEditingMatchId(m.id); setShowMatchForm(true); 
                        }
                      }}
                      className="flex-1 py-2 bg-gray-50 text-[10px] font-black rounded-lg text-gray-600 flex items-center justify-center gap-1.5"
                    >
                      <Edit2 className="w-3 h-3" /> 수정
                    </button>
                    <button 
                      onClick={() => setSelectedMatchDetail(m)}
                      className="flex-1 py-2 bg-[#073763]/5 text-[10px] font-black rounded-lg text-[#073763]"
                    >
                      상세보기
                    </button>
                  </div>
                </div>
              ))}
              {sortedMatches.length === 0 && (
                <div className="text-center py-20 text-gray-400 text-sm font-medium">기록된 경기가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'members' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold text-[#073763]">회원 ({members.length})</h2>
              <button onClick={() => { setEditingMember({ position: Position.MF, clubRole: ClubRole.MEMBER }); setShowMemberForm(true); }} className="p-3 bg-[#073763] text-white rounded-2xl"><Plus className="w-6 h-6" /></button>
            </div>
            {members.map(m => (
              <div key={m.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3 border border-gray-100">
                <img src={m.photo || `https://picsum.photos/seed/${m.id}/200`} className="w-14 h-14 rounded-full object-cover" />
                <div className="flex-1"><div className="font-bold">{m.name}</div><div className="text-xs text-gray-500">{m.position} | {m.phone}</div></div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditingMember(m); setShowMemberForm(true); }} className="p-2.5 bg-gray-50 rounded-xl"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => window.location.href = `sms:${m.phone}`} className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><MessageCircle className="w-4 h-4" /></button>
                  <button onClick={() => window.location.href = `tel:${m.phone}`} className="p-2.5 bg-[#073763]/10 rounded-xl"><Phone className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab === 'stats' && (
          <div className="space-y-4">
            <div className="px-2">
              <h2 className="text-xl font-bold text-[#073763]">개인 기록 랭킹</h2>
            </div>
            
            <div className="px-2 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="이름으로 검색..." 
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold outline-none"
                  value={statsSearch}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {[
                  { id: 'points', label: 'PTS순' },
                  { id: 'winRate', label: '승률순' },
                  { id: 'appearances', label: '출전순' },
                  { id: 'goals', label: '득점순' },
                  { id: 'assists', label: '도움순' },
                  { id: 'ownGoals', label: '자살골순' },
                  { id: 'mvp', label: 'MVP순' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setStatsSort(item.id as SortType)}
                    className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black transition-all ${
                      statsSort === item.id 
                        ? 'bg-[#073763] text-white' 
                        : 'bg-white text-gray-400 border border-gray-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-x-auto border border-gray-100">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left font-bold text-gray-500">순위</th>
                    <th className="p-4 text-left font-bold text-gray-500">이름</th>
                    <th className={`p-4 text-center font-bold ${statsSort === 'appearances' ? 'text-[#073763] bg-gray-100' : 'text-gray-500'}`}>출전</th>
                    <th className={`p-4 text-center font-bold ${statsSort === 'winRate' ? 'text-[#073763] bg-gray-100' : 'text-gray-500'}`}>승률</th>
                    <th className="p-4 text-center font-bold text-blue-500">봉팀출전</th>
                    <th className="p-4 text-center font-bold text-red-500">학팀출전</th>
                    <th className={`p-4 text-center font-bold ${statsSort === 'goals' ? 'text-[#073763] bg-gray-100' : 'text-gray-500'}`}>득점</th>
                    <th className={`p-4 text-center font-bold ${statsSort === 'assists' ? 'text-[#073763] bg-gray-100' : 'text-gray-500'}`}>도움</th>
                    <th className={`p-4 text-center font-bold ${statsSort === 'ownGoals' ? 'text-[#073763] bg-gray-100' : 'text-red-400'}`}>자살</th>
                    <th className={`p-4 text-right font-bold ${statsSort === 'mvp' ? 'text-[#073763] bg-gray-100' : 'text-gray-500'}`}>MVP</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s, idx) => (
                    <tr key={s.memberId} className="border-b last:border-0">
                      <td className="p-4"><span className={`inline-block w-6 h-6 text-center rounded-lg text-xs font-bold leading-6 ${idx === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-100 text-gray-400'}`}>{idx + 1}</span></td>
                      <td className="p-4 font-bold text-gray-800">{s.name}</td>
                      <td className={`p-4 text-center ${statsSort === 'appearances' ? 'font-black text-[#073763] bg-gray-50' : ''}`}>{s.appearances}</td>
                      <td className={`p-4 text-center ${statsSort === 'winRate' ? 'font-black text-[#073763] bg-gray-50' : ''}`}>{s.winRate.toFixed(1)}%</td>
                      <td className="p-4 text-center text-blue-600 text-[10px] font-bold">{s.winsA}승 {s.drawsA}무 {s.lossesA}패</td>
                      <td className="p-4 text-center text-red-600 text-[10px] font-bold">{s.winsB}승 {s.drawsB}무 {s.lossesB}패</td>
                      <td className={`p-4 text-center ${statsSort === 'goals' ? 'font-black text-[#073763] bg-gray-50' : ''}`}>{s.goals}</td>
                      <td className={`p-4 text-center ${statsSort === 'assists' ? 'font-black text-[#073763] bg-gray-50' : ''}`}>{s.assists}</td>
                      <td className={`p-4 text-center text-red-500 font-bold ${statsSort === 'ownGoals' ? 'bg-gray-50' : ''}`}>{s.ownGoals}</td>
                      <td className={`p-4 text-right font-black ${statsSort === 'mvp' ? 'text-[#073763] bg-gray-50' : 'text-gray-400'}`}>{s.mvpCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3 max-w-md mx-auto z-20 pb-6">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: '홈' },
          { id: 'matches_list', icon: PlayCircle, label: '경기' },
          { id: 'members', icon: Users, label: '회원' },
          { id: 'stats', icon: Trophy, label: '기록' }
        ].map(tab => (
          <button 
            key={tab.id} 
            onClick={() => {
              if (tab.id === 'members') {
                checkAuth('tab', 'members');
              } else {
                setActiveTab(tab.id);
              }
            }} 
            className={`flex flex-col items-center gap-1 flex-1 transition-all ${activeTab === tab.id ? 'text-[#073763] scale-110' : 'text-gray-400'}`}
          >
            <tab.icon className={`w-6 h-6 ${activeTab === tab.id ? 'stroke-[2.5px]' : 'stroke-2'}`} />
            <span className={`text-[10px] font-black ${activeTab === tab.id ? 'opacity-100' : 'opacity-60'}`}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-6 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xs rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="bg-[#073763] p-8 text-white text-center flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black mb-1">관리자 인증</h3>
                <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Admin Authorization Required</p>
              </div>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 ml-1 uppercase tracking-tighter">Enter Password</label>
                <input 
                  autoFocus
                  type="password"
                  inputMode="numeric"
                  placeholder="••••"
                  className={`w-full p-4 bg-gray-50 border ${passwordError ? 'border-red-300 ring-2 ring-red-100' : 'border-gray-100'} rounded-2xl text-center text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all`}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    setPasswordError(false);
                  }}
                />
                {passwordError && (
                  <p className="text-[10px] text-red-500 font-bold text-center animate-bounce">비밀번호가 올바르지 않습니다.</p>
                )}
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordInput('');
                    setPendingAction(null);
                  }}
                  className="flex-1 py-4 bg-gray-100 text-gray-500 font-black rounded-2xl active:scale-95 transition-all"
                >
                  취소
                </button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-[#073763] text-white font-black rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  확인 <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMemberForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 flex justify-between items-center border-b"><h3 className="text-xl font-black text-[#073763]">회원 관리</h3><button onClick={() => { setShowMemberForm(false); setEditingMember(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button></div>
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full border-2 border-gray-100 overflow-hidden bg-gray-50 shadow-sm">
                    {editingMember?.photo ? (
                      <img src={editingMember.photo} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <User className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                  <button 
                    onClick={() => memberPhotoInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-[#073763] text-white rounded-full shadow-lg active:scale-90 transition-transform"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input type="file" ref={memberPhotoInputRef} className="hidden" accept="image/*" onChange={handleMemberPhotoUpload} />
                </div>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Profile Photo</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Full Name</label>
                  <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all" placeholder="이름 입력" value={editingMember?.name || ''} onChange={(e) => setEditingMember({...editingMember, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Phone Number</label>
                  <input className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all" placeholder="010-0000-0000" type="tel" value={editingMember?.phone || ''} onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})} />
                </div>
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Main Position</label>
                  <select className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all appearance-none" value={editingMember?.position || Position.MF} onChange={(e) => setEditingMember({...editingMember, position: e.target.value as Position})}>
                    <option value={Position.FW}>공격수 (FW)</option>
                    <option value={Position.MF}>미드필더 (MF)</option>
                    <option value={Position.DF}>수비수 (DF)</option>
                    <option value={Position.GK}>골키퍼 (GK)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-6 border-t"><button onClick={handleSaveMember} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">회원 정보 저장</button></div>
          </div>
        </div>
      )}
      {showMatchForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex flex-col p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl flex-1 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
            <div className="p-5 flex justify-between items-center border-b"><h3 className="text-xl font-black text-[#073763]">경기 기록</h3><button onClick={() => { setShowMatchForm(false); setEditingMatchId(null); }} className="p-2 bg-gray-100 rounded-full"><X className="w-6 h-6"/></button></div>
            <div className="flex-1 p-6 space-y-5 overflow-y-auto">
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Match Date</label>
                  <input type="date" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all" value={newMatch.date} onChange={(e) => setNewMatch({...newMatch, date: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Category</label>
                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10" value={newMatch.category} onChange={(e) => setNewMatch({...newMatch, category: e.target.value})}>
                      <option value="매일매일">매일매일</option>
                      <option value="토요더비">토요더비</option>
                      <option value="친선경기">친선경기</option>
                      <option value="기타">기타</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 mb-1 block ml-1 uppercase">Venue</label>
                    <select className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none focus:ring-2 focus:ring-[#073763]/10" value={newMatch.venue} onChange={(e) => setNewMatch({...newMatch, venue: e.target.value})}>
                      <option value="대천초등">대천초등</option>
                      <option value="시설공단">시설공단</option>
                      <option value="박지성센터">박지성센터</option>
                      <option value="기타">기타(직접입력)</option>
                    </select>
                  </div>
                </div>
                
                {newMatch.venue === '기타' && (
                  <input type="text" placeholder="장소 직접 입력" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl font-bold outline-none" onChange={(e) => setNewMatch({...newMatch, venue: e.target.value})} />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-blue-50 p-4 rounded-3xl text-center">
                  <div className="text-[10px] font-black text-blue-400 mb-1">BONG</div>
                  <div className="font-black text-blue-900 text-3xl">{newMatch.scoreA}</div>
                </div>
                <div className="bg-red-50 p-4 rounded-3xl text-center">
                  <div className="text-[10px] font-black text-red-400 mb-1">HAK</div>
                  <div className="font-black text-red-900 text-3xl">{newMatch.scoreB}</div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-blue-600 uppercase tracking-tight">봉팀 명단 선택</label>
                    <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{(newMatch.teamA?.length || 0)}명 선택됨</span>
                  </div>
                  <div className="h-64 border-2 border-blue-50 rounded-2xl overflow-hidden shadow-inner bg-white">
                    <MemberSelector members={members} selectedIds={newMatch.teamA || []} onToggle={(id) => setNewMatch({ ...newMatch, teamA: newMatch.teamA?.includes(id) ? newMatch.teamA.filter(i => i !== id) : [...(newMatch.teamA || []), id] })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-red-600 uppercase tracking-tight">학팀 명단 선택</label>
                    <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">{(newMatch.teamB?.length || 0)}명 선택됨</span>
                  </div>
                  <div className="h-64 border-2 border-red-50 rounded-2xl overflow-hidden shadow-inner bg-white">
                    <MemberSelector members={members} selectedIds={newMatch.teamB || []} onToggle={(id) => setNewMatch({ ...newMatch, teamB: newMatch.teamB?.includes(id) ? newMatch.teamB.filter(i => i !== id) : [...(newMatch.teamB || []), id] })} />
                  </div>
                </div>
              </div>

              {(newMatch.teamA?.length || 0) + (newMatch.teamB?.length || 0) > 0 && (
                <div className="space-y-6 pt-2">
                   <div>
                     <label className="text-[10px] font-black text-gray-400 ml-1 uppercase mb-2 block">Match Records (Goals/Assists)</label>
                     <div className="space-y-3">
                       {newMatch.teamA?.map(id => renderPlayerRecordInput(id, 'blue'))}
                       {newMatch.teamB?.map(id => renderPlayerRecordInput(id, 'red'))}
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block">Match Day Photo</label>
                     <div className="relative group">
                        {newMatch.photo ? (
                          <div className="relative rounded-3xl overflow-hidden border border-gray-200 aspect-video shadow-md animate-in zoom-in-95 duration-200">
                            <img src={newMatch.photo} alt="Match preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                            <button 
                              onClick={() => setNewMatch(prev => ({ ...prev, photo: '' }))}
                              className="absolute top-3 right-3 p-2 bg-red-500/90 text-white rounded-full shadow-lg active:scale-90 transition-transform backdrop-blur-sm"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <div className="absolute bottom-3 left-4 flex items-center gap-2 text-white/90">
                              <ImageIcon className="w-4 h-4" />
                              <span className="text-[10px] font-black uppercase tracking-widest">Match Moment Captured</span>
                            </div>
                          </div>
                        ) : (
                          <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="relative w-full py-14 bg-gray-50 border-2 border-dashed border-gray-200 rounded-[2.5rem] flex flex-col items-center justify-center gap-3 text-gray-400 hover:bg-gray-100/50 transition-all active:scale-[0.98] overflow-hidden"
                          >
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                              <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                  <pattern id="tacticalGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="2"/>
                                  </pattern>
                                </defs>
                                <rect width="100%" height="100%" fill="url(#tacticalGrid)" />
                                <circle cx="50%" cy="50%" r="60" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" />
                              </svg>
                            </div>
                            
                            <div className="relative z-10 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 group-hover:scale-110 transition-transform duration-300">
                              <Camera className="w-8 h-8 text-[#073763]" />
                              <div className="absolute -bottom-1 -right-1 bg-[#073763] text-white p-1 rounded-lg">
                                <Plus className="w-3 h-3" />
                              </div>
                            </div>
                            <div className="relative z-10 flex flex-col items-center">
                              <span className="text-xs font-black text-[#073763] uppercase tracking-wider">오늘의 경기 사진 기록</span>
                              <span className="text-[9px] font-bold text-gray-400 mt-1">촬영하거나 갤러리에서 선택</span>
                            </div>
                          </button>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={handlePhotoUpload}
                        />
                     </div>
                   </div>

                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-400 ml-1 uppercase block">Match Memo</label>
                     <textarea 
                       placeholder="경기 특이사항이나 메모를 입력하세요..." 
                       className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl font-medium text-xs outline-none focus:ring-2 focus:ring-[#073763]/10 transition-all min-h-[100px] resize-none"
                       value={newMatch.memo}
                       onChange={(e) => setNewMatch({...newMatch, memo: e.target.value})}
                     />
                   </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t"><button onClick={handleSaveMatch} className="w-full bg-[#073763] text-white py-4 rounded-2xl font-black shadow-lg active:scale-95 transition-all">기록 저장하기</button></div>
          </div>
        </div>
      )}
      {selectedMatchDetail && <MatchDetailModal match={selectedMatchDetail} onClose={() => setSelectedMatchDetail(null)} />}
    </div>
  );
};

export default App;
