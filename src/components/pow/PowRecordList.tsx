'use client';

import { useEffect, useState } from 'react';
import { PowField, PowRecord } from '@/types';
import { POW_FIELDS } from '@/constants';
import { formatTime, formatDateKorean, formatNumber } from '@/lib/utils';
import { getSupabaseClient } from '@/lib/supabase/client';
import { usePowStore } from '@/stores/pow-store';

interface PowRecordListProps {
  fieldFilter: PowField | 'all';
  dateFilter: 'today' | 'week' | 'month' | 'custom';
}

export default function PowRecordList({ fieldFilter, dateFilter }: PowRecordListProps) {
  const { user } = usePowStore();
  const [records, setRecords] = useState<PowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchRecords = async () => {
      setIsLoading(true);
      const supabase = getSupabaseClient();

      // 날짜 필터 계산
      const now = new Date();
      let startDate: Date;

      switch (dateFilter) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      }

      let query = supabase
        .from('pow_records')
        .select('*')
        .eq('user_id', user.id)
        .neq('status', 'in_progress')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (fieldFilter !== 'all') {
        query = query.eq('field', fieldFilter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Failed to fetch records:', error);
      } else {
        setRecords(data || []);
      }

      setIsLoading(false);
    };

    fetchRecords();
  }, [user, fieldFilter, dateFilter]);

  if (!user) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        로그인 후 이용해주세요.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 dark:text-gray-400">
        <div className="text-4xl mb-2">📝</div>
        <p>아직 기록된 POW가 없습니다.</p>
        <p className="text-sm mt-1">첫 POW를 시작해보세요!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record) => (
        <PowRecordCard key={record.id} record={record} />
      ))}
    </div>
  );
}

function PowRecordCard({ record }: { record: PowRecord }) {
  const fieldInfo = POW_FIELDS[record.field];

  const getStatusLabel = () => {
    switch (record.status) {
      case 'donated_immediate':
      case 'donated_from_accumulated':
        return { text: '기부완료', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' };
      case 'accumulated':
        return { text: '적립됨', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' };
      case 'completed':
        return { text: '완료', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' };
      default:
        return { text: '진행중', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' };
    }
  };

  const status = getStatusLabel();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{fieldInfo.emoji}</span>
          <span className="font-medium text-gray-900 dark:text-white">{fieldInfo.labelKo}</span>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.text}
        </span>
      </div>

      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {record.goal_content}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="text-gray-500 dark:text-gray-400">
          목표: <span className="text-gray-900 dark:text-white">{formatTime(record.goal_time)}</span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          달성: <span className="text-gray-900 dark:text-white">{formatTime(record.actual_time)}</span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          달성률: <span className="text-orange-500 font-medium">{record.achievement_rate}%</span>
        </div>
        <div className="text-gray-500 dark:text-gray-400">
          {record.status === 'accumulated' ? '적립' : '기부'}:{' '}
          <span className="text-orange-500 font-medium">{formatNumber(record.actual_sats)}sats</span>
        </div>
      </div>

      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        {formatDateKorean(record.created_at)}
      </div>
    </div>
  );
}
