import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, endpoint } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();

    // 특정 endpoint만 삭제하거나 전체 삭제
    const query = supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId);

    if (endpoint) {
      query.eq('endpoint', endpoint);
    }

    const { error } = await query;

    if (error) {
      console.error('Push unsubscribe error:', error);
      return NextResponse.json(
        { error: 'Failed to remove subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
