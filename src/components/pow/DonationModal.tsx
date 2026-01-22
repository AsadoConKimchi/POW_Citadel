'use client';

import { useState, useEffect } from 'react';
import { formatNumber } from '@/lib/utils';
import { WALLET_OPTIONS, WALLET_DEEPLINKS } from '@/constants';
import { usePowStore } from '@/stores/pow-store';

interface DonationModalProps {
  amount: number;
  memo?: string;
  mode: 'immediate' | 'accumulated';
  powRecordId?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function DonationModal({
  amount,
  memo,
  mode,
  powRecordId,
  onClose,
  onSuccess,
}: DonationModalProps) {
  const { user, setUser } = usePowStore();
  const [invoice, setInvoice] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaid, setIsPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invoice 생성
  useEffect(() => {
    const createInvoice = async () => {
      try {
        const response = await fetch('/api/blink/invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            memo: memo || `Citadel POW 기부`,
          }),
        });

        if (!response.ok) {
          throw new Error('Invoice 생성 실패');
        }

        const data = await response.json();
        setInvoice(data.paymentRequest);
        setInvoiceId(data.paymentHash);
      } catch (err) {
        console.error('Invoice creation error:', err);
        setError('Invoice 생성에 실패했습니다. 다시 시도해주세요.');
      } finally {
        setIsLoading(false);
      }
    };

    createInvoice();
  }, [amount, memo]);

  // Invoice 상태 폴링
  useEffect(() => {
    if (!invoiceId || isPaid) return;

    const checkPayment = async () => {
      try {
        const response = await fetch(`/api/blink/invoice/${invoiceId}`);
        const data = await response.json();

        if (data.paid) {
          setIsPaid(true);

          // 기부 완료 처리
          await fetch('/api/pow/donate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode,
              powRecordId,
              amount,
              userId: user?.id,
            }),
          });

          // 사용자 정보 업데이트
          if (user) {
            setUser({
              ...user,
              total_donated_sats: user.total_donated_sats + amount,
              accumulated_sats: mode === 'accumulated' ? 0 : user.accumulated_sats,
            });
          }

          onSuccess?.();
        }
      } catch (err) {
        console.error('Payment check error:', err);
      }
    };

    const interval = setInterval(checkPayment, 2000); // 2초마다 체크

    return () => clearInterval(interval);
  }, [invoiceId, isPaid, mode, powRecordId, amount, user, setUser, onSuccess]);

  // 지갑 딥링크 열기
  const openWallet = (walletId: string) => {
    if (!invoice) return;

    const deeplinks: Record<string, (invoice: string) => string> = {
      walletOfSatoshi: WALLET_DEEPLINKS.walletOfSatoshi,
      blink: WALLET_DEEPLINKS.blink,
      strike: WALLET_DEEPLINKS.strike,
      zeus: WALLET_DEEPLINKS.zeus,
    };

    const deeplink = deeplinks[walletId]?.(invoice);
    if (deeplink) {
      window.location.href = deeplink;
    }
  };

  // Invoice 복사
  const copyInvoice = async () => {
    if (!invoice) return;
    try {
      await navigator.clipboard.writeText(invoice);
      alert('Invoice가 복사되었습니다!');
    } catch {
      alert('복사에 실패했습니다.');
    }
  };

  if (isPaid) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            기부 완료!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {formatNumber(amount)} sats가 성공적으로 기부되었습니다.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
          >
            확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            💳 Sats 기부하기
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 금액 표시 */}
          <div className="text-center">
            <p className="text-3xl font-bold text-orange-500">
              {formatNumber(amount)} sats
            </p>
            {memo && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                &quot;{memo}&quot;
              </p>
            )}
          </div>

          {/* QR 코드 또는 로딩 */}
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-500 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-red-500">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
              >
                다시 시도
              </button>
            </div>
          ) : (
            <>
              {/* QR 코드 영역 */}
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-xl">
                  {/* QR 코드는 라이브러리를 사용하거나 API로 생성 */}
                  <div className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(invoice || '')}`}
                      alt="Lightning Invoice QR"
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>

              {/* Invoice 복사 버튼 */}
              <button
                onClick={copyInvoice}
                className="w-full py-2 text-sm text-orange-500 hover:text-orange-600"
              >
                📋 Invoice 복사하기
              </button>

              {/* 지갑 선택 */}
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 text-center">
                  아래에서 지갑을 선택하세요
                </p>
                <div className="space-y-2">
                  {WALLET_OPTIONS.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => openWallet(wallet.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors"
                    >
                      <span className="text-xl">{wallet.icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {wallet.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
