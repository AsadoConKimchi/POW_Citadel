'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePowStore } from '@/stores/pow-store';
import { POW_FIELDS } from '@/constants';
import { formatTime, formatDateKorean, formatNumber } from '@/lib/utils';
import DonationModal from '@/components/pow/DonationModal';
import { createClient } from '@/lib/supabase/client';

interface MediaItem {
  id: string;
  dataUrl: string;
  type: 'image' | 'video';
  file: File;
  thumbnailUrl?: string; // 비디오의 경우 캡처된 첫 프레임
}

const MAX_MEDIA_COUNT = 5;

export default function CertificationPage() {
  const router = useRouter();
  const { completedPow, setCompletedPow } = usePowStore();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [mainMediaIndex, setMainMediaIndex] = useState(0);
  const [memo, setMemo] = useState('');
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});

  // completedPow가 없으면 나의 POW 페이지로
  useEffect(() => {
    if (!completedPow && !isCompleting) {
      router.push('/my-pow');
    }
  }, [completedPow, isCompleting, router]);

  if (!completedPow) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  const fieldInfo = POW_FIELDS[completedPow.field];
  const mainMedia = mediaList[mainMediaIndex];

  // 비디오에서 첫 프레임 캡처 (업로드 시점에 미리 처리)
  const captureVideoThumbnail = (videoFile: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const objectUrl = URL.createObjectURL(videoFile);
      video.src = objectUrl;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };

      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('비디오 로드 타임아웃'));
      }, 15000);

      video.onloadeddata = () => {
        // 0.5초 지점으로 이동 (검은 화면 방지)
        video.currentTime = 0.5;
      };

      video.onseeked = () => {
        clearTimeout(timeoutId);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth || 320;
          canvas.height = video.videoHeight || 240;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
            cleanup();
            resolve(thumbnailUrl);
          } else {
            cleanup();
            reject(new Error('캔버스 컨텍스트 생성 실패'));
          }
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      video.onerror = () => {
        clearTimeout(timeoutId);
        cleanup();
        reject(new Error('비디오 로드 실패'));
      };

      // iOS Safari에서 명시적 로드 필요
      video.load();
    });
  };

  // 미디어 업로드 처리
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = MAX_MEDIA_COUNT - mediaList.length;
    if (remainingSlots <= 0) {
      alert(`최대 ${MAX_MEDIA_COUNT}개까지만 업로드 가능합니다.`);
      return;
    }

    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const isVideo = file.type.startsWith('video/');
      const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

      try {
        let dataUrl: string;
        if (isVideo) {
          // 비디오는 blob URL 사용 (메모리 효율적, iOS Safari 호환)
          dataUrl = URL.createObjectURL(file);
        } else {
          // 이미지는 data URL 사용
          dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target?.result as string);
            reader.readAsDataURL(file);
          });
        }

        let thumbnailUrl: string | undefined;
        if (isVideo) {
          try {
            thumbnailUrl = await captureVideoThumbnail(file);
          } catch (err) {
            console.warn('비디오 썸네일 캡처 실패:', err);
            // 썸네일 캡처 실패해도 계속 진행
          }
        }

        setMediaList((prev) => [...prev, {
          id,
          dataUrl,
          type: isVideo ? 'video' : 'image',
          file,
          thumbnailUrl,
        }]);
      } catch (err) {
        console.error('파일 처리 오류:', err);
      }
    }

    e.target.value = '';
  };

  // 미디어 삭제
  const handleRemoveMedia = (index: number) => {
    const mediaToRemove = mediaList[index];
    if (mediaToRemove) {
      delete videoRefs.current[mediaToRemove.id];
    }

    setMediaList((prev) => prev.filter((_, i) => i !== index));
    if (index === mainMediaIndex) {
      setMainMediaIndex(0);
    } else if (index < mainMediaIndex) {
      setMainMediaIndex((prev) => Math.max(0, prev - 1));
    }
  };


  // 미디어 파일을 Supabase Storage에 업로드 (4.5MB 제한 우회용)
  const uploadMediaToSupabase = async (mediaItems: MediaItem[]): Promise<string[]> => {
    const supabase = createClient();
    const uploadedUrls: string[] = [];

    for (const media of mediaItems) {
      const ext = media.type === 'video' ? 'mp4' : 'jpg';
      const fileName = `pow-media-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('pow-images')
        .upload(fileName, media.file, {
          contentType: media.type === 'video' ? 'video/mp4' : 'image/jpeg',
        });

      if (uploadError) {
        console.error('Media upload error:', uploadError);
        continue;
      }

      const { data: publicUrl } = supabase.storage
        .from('pow-images')
        .getPublicUrl(fileName);

      uploadedUrls.push(publicUrl.publicUrl);
    }

    return uploadedUrls;
  };

  // 인증카드 이미지 생성
  const generateCertificationCard = async (): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas || !mainMedia) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const drawOverlay = (sourceWidth: number, sourceHeight: number, drawSource: () => void) => {
      const maxWidth = 1080;
      const aspectRatio = sourceHeight / sourceWidth;
      canvas.width = maxWidth;
      canvas.height = maxWidth * aspectRatio + 150;

      drawSource();

      const overlayHeight = 150;
      const overlayY = canvas.height - overlayHeight;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, overlayY, canvas.width, overlayHeight);

      ctx.fillStyle = '#FFFFFF';
      ctx.textBaseline = 'middle';

      ctx.font = 'bold 28px sans-serif';
      ctx.fillText(`${fieldInfo.emoji} ${fieldInfo.labelKo}`, 30, overlayY + 30);

      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Goal:', 30, overlayY + 60);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(completedPow.goal_content.substring(0, 30), 90, overlayY + 60);

      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Time:', 30, overlayY + 90);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(formatTime(completedPow.actual_time), 90, overlayY + 90);

      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Achieve:', 200, overlayY + 90);
      ctx.fillStyle = '#FF6B35';
      ctx.fillText(`${completedPow.achievement_rate}%`, 280, overlayY + 90);

      ctx.fillStyle = '#CCCCCC';
      ctx.fillText('Donation:', 30, overlayY + 120);
      ctx.fillStyle = '#FF6B35';
      ctx.fillText(`${formatNumber(completedPow.actual_sats)} sats`, 120, overlayY + 120);

      ctx.fillStyle = '#888888';
      ctx.font = '16px sans-serif';
      ctx.fillText(formatDateKorean(new Date()), canvas.width - 180, overlayY + 120);
    };

    return new Promise(async (resolve) => {
      // 비디오의 경우 미리 캡처된 썸네일 사용
      const imageSource = mainMedia.type === 'video' && mainMedia.thumbnailUrl
        ? mainMedia.thumbnailUrl
        : mainMedia.dataUrl;

      if (mainMedia.type === 'video' && !mainMedia.thumbnailUrl) {
        // 썸네일이 없는 비디오는 인증카드 생성 불가
        console.error('비디오 썸네일이 없습니다');
        resolve(null);
        return;
      }

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
      img.onerror = () => {
        console.error('이미지 로드 실패');
        resolve(null);
      };
      img.src = imageSource;
    });
  };

  // 디스코드 공유 (적립 모드)
  const handleShareOnly = async () => {
    if (mediaList.length === 0) {
      alert('사진 또는 동영상을 업로드해주세요.');
      return;
    }

    setIsSharing(true);
    setIsCompleting(true);

    try {
      // 1. 미디어 파일을 Supabase에 먼저 업로드 (4.5MB 제한 우회)
      const mediaUrls = await uploadMediaToSupabase(mediaList);
      console.log('Uploaded media URLs:', mediaUrls);

      // 2. 인증카드 생성
      const cardBlob = await generateCertificationCard();
      if (!cardBlob) throw new Error('인증카드 생성 실패');

      // 3. 인증카드 + URL만 전송 (기존: 파일 직접 전송)
      const formData = new FormData();
      formData.append('certificationCard', cardBlob, 'certification.jpg');

      // 미디어 URL 목록 전송 (파일 대신)
      formData.append('mediaUrls', JSON.stringify(mediaUrls));

      formData.append('powData', JSON.stringify({
        ...completedPow,
        memo: memo.trim() || null,
        mainMediaIndex,
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
      setIsCompleting(false);
    } finally {
      setIsSharing(false);
    }
  };

  // 기부 완료 후 처리
  const handleDonationSuccess = async () => {
    if (mediaList.length === 0) return;

    setIsCompleting(true);

    try {
      // 1. 미디어 파일을 Supabase에 먼저 업로드 (4.5MB 제한 우회)
      const mediaUrls = await uploadMediaToSupabase(mediaList);
      console.log('Uploaded media URLs:', mediaUrls);

      // 2. 인증카드 생성
      const cardBlob = await generateCertificationCard();
      if (!cardBlob) throw new Error('인증카드 생성 실패');

      // 3. 인증카드 + URL만 전송 (기존: 파일 직접 전송)
      const formData = new FormData();
      formData.append('certificationCard', cardBlob, 'certification.jpg');

      // 미디어 URL 목록 전송 (파일 대신)
      formData.append('mediaUrls', JSON.stringify(mediaUrls));

      formData.append('powData', JSON.stringify({
        ...completedPow,
        memo: memo.trim() || null,
        status: 'donated_immediate',
        mainMediaIndex,
      }));

      const response = await fetch('/api/pow/complete', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('저장 실패');

      alert('기부 및 디스코드 공유 완료!');
      setShowDonationModal(false);
      setCompletedPow(null);
      router.push('/my-pow');
    } catch (error) {
      console.error('Complete error:', error);
      alert('공유에 실패했습니다.');
      setIsCompleting(false);
    }
  };

  return (
    <div className="py-4 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
        🎉 POW 완료!
      </h1>

      {/* 미디어 업로드 */}
      <div className="space-y-4">
        {/* 대표 미디어 미리보기 */}
        <div
          className={`relative aspect-square w-full max-w-md mx-auto rounded-2xl overflow-hidden ${
            mainMedia
              ? 'bg-black'
              : 'bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600'
          }`}
        >
          {mainMedia ? (
            mainMedia.type === 'video' ? (
              <video
                ref={(el) => { videoRefs.current[mainMedia.id] = el; }}
                key={mainMedia.id}
                src={mainMedia.dataUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            ) : (
              <img
                src={mainMedia.dataUrl}
                alt="대표 미디어"
                className="w-full h-full object-contain"
              />
            )
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
              <span className="text-4xl mb-2">📸</span>
              <p>사진 또는 동영상을 선택하세요</p>
              <p className="text-sm mt-1">최대 {MAX_MEDIA_COUNT}개</p>
            </div>
          )}
          {mainMedia && (
            <div className="absolute top-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
              ⭐ 대표
            </div>
          )}
        </div>

        {/* 썸네일 그리드 */}
        {mediaList.length > 0 && (
          <div className="flex gap-2 max-w-md mx-auto overflow-x-auto pb-2">
            {mediaList.map((media, index) => (
              <div
                key={media.id}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  index === mainMediaIndex
                    ? 'border-orange-500 ring-2 ring-orange-500/50'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                }`}
                onClick={() => setMainMediaIndex(index)}
              >
                {media.type === 'video' ? (
                  media.thumbnailUrl ? (
                    <img
                      src={media.thumbnailUrl}
                      alt={`비디오 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <span className="text-white text-xs">로딩...</span>
                    </div>
                  )
                ) : (
                  <img
                    src={media.dataUrl}
                    alt={`미디어 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}
                {media.type === 'video' && (
                  <div className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1">
                    🎬
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveMedia(index);
                  }}
                  className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-bl flex items-center justify-center"
                >
                  ✕
                </button>
              </div>
            ))}

            {mediaList.length < MAX_MEDIA_COUNT && (
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-shrink-0 w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-gray-400 transition-colors"
              >
                <span className="text-xl">+</span>
              </button>
            )}
          </div>
        )}

        {mediaList.length > 0 && (
          <p className="text-center text-xs text-gray-500">
            썸네일을 탭하여 대표 선택 ({mediaList.length}/{MAX_MEDIA_COUNT})
          </p>
        )}

        {/* 업로드 버튼들 */}
        <div className="flex gap-3 max-w-md mx-auto">
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={mediaList.length >= MAX_MEDIA_COUNT}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>📷</span> 촬영
          </button>
          <button
            onClick={() => galleryInputRef.current?.click()}
            disabled={mediaList.length >= MAX_MEDIA_COUNT}
            className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <span>🖼️</span> 갤러리
          </button>
        </div>

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          onChange={handleMediaUpload}
          className="hidden"
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleMediaUpload}
          className="hidden"
        />
      </div>

      {/* 한마디 입력 */}
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
      {mainMedia && (
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
              if (mediaList.length === 0) {
                alert('사진 또는 동영상을 업로드해주세요.');
                return;
              }
              setShowDonationModal(true);
            }}
            disabled={mediaList.length === 0}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white font-bold rounded-xl transition-colors"
          >
            ⚡ Discord에 공유 & Sats 기부
          </button>
        ) : (
          <button
            onClick={handleShareOnly}
            disabled={mediaList.length === 0 || isSharing}
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

      <canvas ref={canvasRef} className="hidden" />

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
