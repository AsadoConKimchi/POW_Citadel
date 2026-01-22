'use client';

import { useState } from 'react';
import { usePowStore } from '@/stores/pow-store';
import { formatNumber } from '@/lib/utils';
import DonationModal from '@/components/pow/DonationModal';

export default function AccumulatedSatsCard() {
  const { user } = usePowStore();
  const [showDonationModal, setShowDonationModal] = useState(false);

  if (!user || user.accumulated_sats <= 0) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">적립된 Sats</p>
            <p className="text-2xl font-bold">{formatNumber(user.accumulated_sats)} sats</p>
          </div>
          <button
            onClick={() => setShowDonationModal(true)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg font-medium transition-colors"
          >
            기부하기
          </button>
        </div>
      </div>

      {showDonationModal && (
        <DonationModal
          amount={user.accumulated_sats}
          mode="accumulated"
          onClose={() => setShowDonationModal(false)}
        />
      )}
    </>
  );
}
