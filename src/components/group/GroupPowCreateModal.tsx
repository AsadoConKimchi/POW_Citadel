'use client';

import { useState, useRef } from 'react';
import { POW_FIELD_OPTIONS } from '@/constants';
import { PowField } from '@/types';
import { usePowStore } from '@/stores/pow-store';
import { formatNumber } from '@/lib/utils';

interface GroupPowCreateModalProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function GroupPowCreateModal({ onClose, onSuccess }: GroupPowCreateModalProps) {
  const { user } = usePowStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [field, setField] = useState<PowField>('study');
  const [description, setDescription] = useState('');
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedTime, setPlannedTime] = useState('19:00');
  const [durationHours, setDurationHours] = useState(2);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [targetSats, setTargetSats] = useState(50000);
  const [creatorPledgedSats, setCreatorPledgedSats] = useState(5000);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setThumbnail(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setThumbnailPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('제목을 입력해주세요.');
      return;
    }

    if (!plannedDate) {
      alert('날짜를 선택해주세요.');
      return;
    }

    const plannedDuration = durationHours * 3600 + durationMinutes * 60;
    if (plannedDuration <= 0) {
      alert('활동 시간을 설정해주세요.');
      return;
    }

    if (creatorPledgedSats < 100) {
      alert('개최자 기부금액은 최소 100 sats 이상이어야 합니다.');
      return;
    }

    if (!user?.id) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('field', field);
      formData.append('description', description.trim());
      formData.append('plannedDate', `${plannedDate}T${plannedTime}:00`);
      formData.append('plannedDuration', String(plannedDuration));
      formData.append('targetSats', String(targetSats));
      formData.append('creatorId', user.id);
      formData.append('creatorPledgedSats', String(creatorPledgedSats));

      if (thumbnail) {
        formData.append('thumbnail', thumbnail);
      }

      const response = await fetch('/api/group-pow', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('그룹 POW 생성 실패');
      }

      alert('그룹 POW가 생성되었습니다!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Create group POW error:', error);
      alert('그룹 POW 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 최소 날짜 (내일)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            그룹 POW 개최
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 대표 이미지 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              대표 이미지 (선택)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`relative aspect-video w-full rounded-xl overflow-hidden cursor-pointer transition-all ${
                thumbnailPreview
                  ? ''
                  : 'bg-gray-100 dark:bg-gray-700 border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-orange-500'
              }`}
            >
              {thumbnailPreview ? (
                <img
                  src={thumbnailPreview}
                  alt="Thumbnail"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                  <span className="text-3xl mb-1">📷</span>
                  <p className="text-sm">이미지 업로드</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleThumbnailChange}
              className="hidden"
            />
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              그룹 POW 제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 50))}
              placeholder="예: 유튜브 영상 마라톤"
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{title.length}/50</p>
          </div>

          {/* 분야 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              POW 분야
            </label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as PowField)}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              {POW_FIELD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              활동 내용
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="그룹 POW에 대한 상세 설명을 입력하세요"
              rows={4}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{description.length}/500</p>
          </div>

          {/* 날짜 및 시간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                날짜 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={plannedDate}
                min={minDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                시간
              </label>
              <input
                type="time"
                value={plannedTime}
                onChange={(e) => setPlannedTime(e.target.value)}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {/* 활동 시간 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              활동 예정 시간
            </label>
            <div className="flex gap-3">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(0, Math.min(12, parseInt(e.target.value) || 0)))}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white text-center focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-600 dark:text-gray-400">시간</span>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white text-center focus:ring-2 focus:ring-orange-500"
                />
                <span className="text-gray-600 dark:text-gray-400">분</span>
              </div>
            </div>
          </div>

          {/* 목표 모금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              목표 모금 금액
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1000}
                step={1000}
                value={targetSats}
                onChange={(e) => setTargetSats(Math.max(1000, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">sats</span>
            </div>
          </div>

          {/* 개최자 기부금액 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              나의 기부 금액 <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={100}
                step={100}
                value={creatorPledgedSats}
                onChange={(e) => setCreatorPledgedSats(Math.max(100, parseInt(e.target.value) || 0))}
                className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 border-0 rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-gray-600 dark:text-gray-400 whitespace-nowrap">sats</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * 개최자로서 약속하는 기부 금액입니다. 그룹 POW 종료 시 달성률에 따라 계산됩니다.
            </p>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
          >
            {isSubmitting ? '생성 중...' : '👥 그룹 POW 개최하기'}
          </button>
        </form>
      </div>
    </div>
  );
}
