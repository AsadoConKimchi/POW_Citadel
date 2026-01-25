import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import webpush from 'web-push';

// VAPID 설정
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = 'mailto:pow-citadel@example.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Cron job이 호출 - 예약된 푸시 알림 처리
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();

    // 현재 시간 이전에 예약된 모든 푸시 가져오기
    const now = new Date().toISOString();
    const { data: scheduledPushes, error: fetchError } = await supabase
      .from('scheduled_push')
      .select('*')
      .lte('scheduled_at', now)
      .eq('sent', false);

    if (fetchError) {
      console.error('Failed to fetch scheduled pushes:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch scheduled pushes' },
        { status: 500 }
      );
    }

    if (!scheduledPushes || scheduledPushes.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let successCount = 0;
    let failCount = 0;

    for (const scheduled of scheduledPushes) {
      // 사용자의 푸시 구독 가져오기
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', scheduled.user_id);

      if (!subscriptions || subscriptions.length === 0) {
        // 구독 없음 - 삭제 처리
        await supabase
          .from('scheduled_push')
          .update({ sent: true, sent_at: now })
          .eq('id', scheduled.id);
        continue;
      }

      // 각 구독에 푸시 전송
      let sentToAny = false;
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            JSON.stringify(scheduled.payload)
          );
          sentToAny = true;
        } catch (err: any) {
          // 410/404 - 구독 만료
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id);
          }
        }
      }

      // 전송 완료 표시
      await supabase
        .from('scheduled_push')
        .update({ sent: true, sent_at: now })
        .eq('id', scheduled.id);

      if (sentToAny) {
        successCount++;
      } else {
        failCount++;
      }
    }

    return NextResponse.json({
      processed: scheduledPushes.length,
      success: successCount,
      failed: failCount,
    });
  } catch (error) {
    console.error('Process scheduled push error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST도 지원 (cron-job.org 호환)
export async function POST(request: NextRequest) {
  return GET(request);
}
