'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { POW_FIELDS } from '@/constants';
import { formatTime, formatDateKorean, formatNumber } from '@/lib/utils';
import DonationModal from '@/components/pow/DonationModal';

export default function CertificationPage() {
  const router = useRouter();
  const { completedPow, setCompletedPow, user } = usePowStore();
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [memo, setMemo] = useState('');
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // completedPow가 없으면 나의 POW 페이지로
  useEffect(() => {
    if (!completedPow) {
      router.push('/my-pow');
    }
  }, [completedPow, router]);

  if (!completedPow) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  const fieldInfo = POW_FIELDS[completedPow.field];

  // 미디어 업로드 처리 (이미지/동영상)
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    setMediaType(isVideo ? 'video' : 'image');

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedMedia(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // 인증카드 이미지 생성
  const generateCertificationCard = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !uploadedMedia) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 이미지 또는 비디오 프레임을 그릴 소스 준비
    const drawOverlay = (sourceWidth: number, sourceHeight: number, drawSource: () => void) => {
      const maxWidth = 1080;
      const aspectRatio = sourceHeight / sourceWidth;
      canvas.width = maxWidth;
      canvas.height = maxWidth * aspectRatio + 150;

      // 소스 그리기
      drawSource();

      // 하단 오버레이 배경
      const overlayHeight = 150;
      const overlayY = canvas.height - overlayHeight;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, overlayY, canvas.width, overlayHeight);

      // 텍스트 설정
      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';

      // 분야 + 이모지
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${fieldInfo.emoji} ${fieldInfo.labelKo}`, 30, overlayY + 30);

      // Goal
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Goal:', 30, overlayY + 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(completedPow.goal_content.substring(0, 30), 90, overlayY + 60);

      // Time & Achieve
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Time:', 30, overlayY + 90);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(formatTime(completedPow.actual_time), 90, overlayY + 90);

      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Achieve:', 200, overlayY + 90);
      ctx.fillStyle = '#FF6B35';
      ctx.fillText(`${completedPow.achievement_rate}%`, 280, overlayY + 90);

      // Donation & Date
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Donation:', 30, overlayY + 120);
      ctx.fillStyle = '#FF6B35';
      ctx.fillText(`${formatNumber(completedPow.actual_sats)} sats`, 120, overlayY + 120);

      ctx.fillStyle = '#888888';
      ctx.font = '16px sans-serif';
      ctx.fillText(formatDateKorean(new Date()), canvas.width - 180, overlayY + 120);
    };

    return new Promise((resolve) => {
      if (mediaType === 'video' && videoRef.current) {
        // 비디오: 현재 프레임 캡처
        const video = videoRef.current;
        const maxWidth = 1080;
        const aspectRatio = video.videoHeight / video.videoWidth;

        drawOverlay(video.videoWidth, video.videoHeight, () => {
          ctx.drawImage(video, 0, 0, maxWidth, maxWidth * aspectRatio);
        });

        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
      } else {
        // 이미지
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const maxWidth = 1080;
          const aspectRatio = img.height / img.width;

          drawOverlay(img.width, img.height, () => {
            ctx.drawImage(img, 0, 0, maxWidth, maxWidth * aspectRatio);
          });

          canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
        };
        img.src = uploadedMedia;
      }
    });
  };

  // 디스코드 공유 (적립 모드)
  const handleShareOnly = async () => {
    if (!uploadedMedia) {
      alert('사진을 업로드해주세요.');
      return;
    }

    setIsSharing(true);

    try {
      const cardBlob = await generateCertificationCard();
      if (!cardBlob) throw new Error('인증카드 생성 실패');

      // 서버에 POW 기록 저장 및 디스코드 공유
      const formData = new FormData();
      formData.append('image', cardBlob, 'certification.jpg');
      formData.append('powData', JSON.stringify({
        ...completedPow,
        memo: memo.trim() || null,
      }));

      const response = await fetch('/api/pow/complete', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('저장 실패');

      alert('디스코드에 공유되었습니다!');
      setCompletedPow(null);
      router.push('/my-pow');
    } catch (error) {
      console.error('Share error:', error);
      alert('공유에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSharing(false);
    }
  };

  // 기부 완료 후 처리
  const handleDonationSuccess = async () => {
    if (!uploadedMedia) return;

    try {
      const cardBlob = await generateCertificationCard();
      if (!cardBlob) throw new Error('인증카드 생성 실패');

      // 서버에 POW 기록 저장 및 디스코드 공유
      const formData = new FormData();
      formData.append('image', cardBlob, 'certification.jpg');
      formData.append('powData', JSON.stringify({
        ...completedPow,
        memo: memo.trim() || null,
        status: 'donated_immediate',
      }));

      await fetch('/api/pow/complete', {
        method: 'POST',
        body: formData,
      });

      setCompletedPow(null);
      setShowDonationModal(false);
      router.push('/my-pow');
    } catch (error) {
      console.error('Complete error:', error);
    }
  };

  return (
    <div className="py-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
        🎉 POW 완료!
      </h1>

      {/* 미디어 업로드 (사진/동영상) */}
      <div className="space-y-4">
        {/* 미리보기 영역 */}
        <div
          className={`relative aspect-square w-full max-w-md mx-auto rounded-2xl overflow-hidden ${
            uploadedMedia
              ? ''
              : 'bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600'
          }`}
        >
          {uploadedMedia ? (
            mediaType === 'video' ? (
              <video
                ref={videoRef}
                src={uploadedMedia}
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={uploadedMedia}
                alt="Uploaded"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">📸</span>
              <p>사진 또는 동영상을 선택하세요</p>
            </div>
          )}
        </div>

        {/* 업로드 버튼들 */}
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => cameraInputRef.current?.click()}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>📷</span> 촬영하기
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>🖼️</span> 갤러리
          </button>
        </div>

        {/* 카메라 입력 (촬영) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleMediaUpload}
          className="hidden"
        />
        {/* 갤러리 입력 (선택) */}
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleMediaUpload}
          className="hidden"
        />
      </div>

      {/* 한마디 입력 (개인 POW만) */}
      {!completedPow.group_pow_id && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            한마디 (선택)
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value.slice(0, 100))}
            placeholder="당신의 한마디를 입력하세요"
            rows={2}
            className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-800 border-0 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 resize-none"
          />
          <p className="text-xs text-gray-500 mt-1 text-right">{memo.length}/100</p>
        </div>
      )}

      {/* 인증카드 미리보기 */}
      {uploadedMedia && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-medium text-gray-900 dark:text-white mb-3">인증카드 미리보기</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xl">{fieldInfo.emoji}</span>
              <span className="font-medium">{fieldInfo.labelKo}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              Goal: {completedPow.goal_content}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <p>Time: {formatTime(completedPow.actual_time)}</p>
              <p className="text-orange-500">Achieve: {completedPow.achievement_rate}%</p>
              <p className="text-orange-500">Donation: {formatNumber(completedPow.actual_sats)} sats</p>
              <p className="text-gray-500">{formatDateKorean(new Date())}</p>
            </div>
          </div>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="space-y-3">
        {completedPow.mode === 'immediate' ? (
          <button
            onClick={() => {
              if (!uploadedMedia) {
                alert('사진을 업로드해주세요.');
                return;
              }
              setShowDonationModal(true);
            }}
            disabled={!uploadedMedia}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
          >
            ⚡ Discord에 공유 & Sats 기부
          </button>
        ) : (
          <button
            onClick={handleShareOnly}
            disabled={!uploadedMedia || isSharing}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
          >
            {isSharing ? '공유 중...' : '💾 Discord에 공유 (적립)'}
          </button>
        )}

        <button
          onClick={() => {
            if (confirm('정말 취소하시겠습니까? 이 POW 기록은 저장되지 않습니다.')) {
              setCompletedPow(null);
              router.push('/my-pow');
            }
          }}
          className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
        >
          취소
        </button>
      </div>

      {/* 숨겨진 캔버스 (이미지 생성용) */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 기부 모달 */}
      {showDonationModal && (
        <DonationModal
          amount={completedPow.actual_sats}
          memo={memo || undefined}
          mode="immediate"
          onClose={() => setShowDonationModal(false)}
          onSuccess={handleDonationSuccess}
        />
      )}
    </div>
  );
}
