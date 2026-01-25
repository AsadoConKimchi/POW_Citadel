'use client';

import { useState, useEffect, useCallback } from 'react';
import { subscribeToPush, unsubscribeFromPush, getPushSubscriptionStatus } from '@/lib/push';

interface PushNotificationState {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  loading: boolean;
}

export function usePushNotification(userId: string | undefined) {
  const [state, setState] = useState<PushNotificationState>({
    supported: false,
    permission: 'default',
    subscribed: false,
    loading: true,
  });

  // 초기 상태 확인
  useEffect(() => {
    async function checkStatus() {
      const status = await getPushSubscriptionStatus();
      setState({
        ...status,
        loading: false,
      });
    }

    checkStatus();
  }, []);

  // 푸시 구독
  const subscribe = useCallback(async () => {
    if (!userId) return false;

    setState((prev) => ({ ...prev, loading: true }));

    const subscription = await subscribeToPush(userId);

    setState((prev) => ({
      ...prev,
      subscribed: !!subscription,
      permission: Notification.permission,
      loading: false,
    }));

    return !!subscription;
  }, [userId]);

  // 푸시 구독 취소
  const unsubscribe = useCallback(async () => {
    if (!userId) return false;

    setState((prev) => ({ ...prev, loading: true }));

    const success = await unsubscribeFromPush(userId);

    setState((prev) => ({
      ...prev,
      subscribed: !success,
      loading: false,
    }));

    return success;
  }, [userId]);

  // 토글
  const toggle = useCallback(async () => {
    if (state.subscribed) {
      return await unsubscribe();
    } else {
      return await subscribe();
    }
  }, [state.subscribed, subscribe, unsubscribe]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    toggle,
  };
}
